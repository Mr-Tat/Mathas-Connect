import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,resolve,extname} from 'node:path';
import {chromium} from 'playwright';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const server=createServer((req,res)=>{
 const url=new URL(req.url,'http://127.0.0.1');
 const file=resolve(root,'.'+decodeURIComponent(url.pathname));
 if(!file.startsWith(root+'/')){res.writeHead(403);res.end();return}
 try{
  const ext=extname(file);
  res.setHeader('content-type',ext==='.html'?'text/html; charset=utf-8':ext==='.mjs'||ext==='.js'?'text/javascript':'application/octet-stream');
  res.end(readFileSync(file));
 }catch{res.writeHead(404);res.end('Not found')}
});
test('Multiplication native : Reste XX XP reste uniquement dans le coin des 4/10/20 calculs', {timeout:90000},async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const url='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1160,height:900}});
  await page.goto(url+'/apps/multiplication-simple/game-original.html');
  const values=await page.evaluate(async()=>{
   const {installMultiplicationSchoolUi}=await import('/apps/multiplication-simple/school-ui.mjs');
   const xp={milestones:[],parcours:1,repeatXp:false};
   const buttons=[...document.querySelectorAll('#menuScreen .classic-count-btn[data-count]')];
   if(buttons.length!==3)throw Error('Le moteur natif ne possède plus les trois séries');
   installMultiplicationSchoolUi(document,{connected:true,xp});
   // Reproduire l'ordre d'exécution qui provoquait la capture de Reste XX XP
   // par le vieux script de mise en valeur des chiffres (sans modifier le moteur).
   for(const btn of buttons){
    const badge=btn.querySelector(':scope > .mathas-multi-official-xp');
    const count=Number(btn.dataset.count);
    if(!badge)throw Error('Badge XP Connect manquant '+count);
    btn.replaceChildren(document.createTextNode(count+' calculs'),badge);
   }
   const native=document.getElementById('mathas-v323-count-number-emphasis');
   if(!native?.textContent.includes('wrapCountNumbers'))throw Error('Script de mise en valeur absent');
   (new Function(native.textContent))();
   // Après la copie par le script natif, la chaîne XP doit être doublée.
   if(!buttons.every(btn=>/calculsReste\s+\d+\s+XP/.test(
    [...btn.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent).join(''))))
    throw Error('Reproduction du doublon non déclenchée');
   installMultiplicationSchoolUi(document,{connected:true,xp});
   installMultiplicationSchoolUi(document,{connected:true,xp});
   return buttons.map(btn=>{
    const badge=btn.querySelector(':scope > .mathas-multi-official-xp');
    const num=btn.querySelector(':scope > .count-number');
    const label=[...btn.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent).join('');
    const b=btn.getBoundingClientRect(),t=badge?.getBoundingClientRect();
    return {count:Number(btn.dataset.count),label,number:num?.textContent,
     badgeText:badge?.textContent,badges:btn.querySelectorAll(':scope > .mathas-multi-official-xp').length,
     rightOffset:t?Math.round(b.right-t.right):null,bottomOffset:t?Math.round(b.bottom-t.bottom):null};
   });
  });
  for(const [i,row] of values.entries()){
   const count=[4,10,20][i],remains=[22,36,60][i];
   assert.equal(row.count,count);
   assert.equal(row.number,String(count));
   assert.equal(row.label.trim(),'calculs','Le titre ne doit plus contenir Reste XX XP');
   assert.equal(row.badgeText,'Reste '+remains+' XP');
   assert.equal(row.badges,1,'Un seul badge doit rester');
   assert.ok(row.rightOffset>=0&&row.rightOffset<=20,'Badge hors coin droit : '+JSON.stringify(row));
   assert.ok(row.bottomOffset>=0&&row.bottomOffset<=20,'Badge hors coin bas : '+JSON.stringify(row));
  }
  console.log('PASS reproduction puis correction XP des trois boutons : '+JSON.stringify(values));
  await page.close();
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve))}
});
