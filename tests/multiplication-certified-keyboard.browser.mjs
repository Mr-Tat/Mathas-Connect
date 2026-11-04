// Vrai DOM Chromium, vrais champs et événements clavier. Serveur émetteur simulé :
// cette recette UI n'écrit rien dans Supabase et ne prouve pas un JWT hébergé.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {chromium} from 'playwright';

const html='<!doctype html><html lang="fr"><head><meta charset="utf-8"></head><body><h1>Recette multiplication certifiée</h1></body></html>';
const moduleBytes=readFileSync(new URL('../apps/multiplication-simple/certified-classic.mjs',import.meta.url));
const server=createServer((req,res)=>{
 if(req.url==='/'){
  res.writeHead(200,{'content-type':'text/html; charset=utf-8'});res.end(html);return;
 }
 if(req.url==='/apps/multiplication-simple/certified-classic.mjs'){
  res.writeHead(200,{'content-type':'text/javascript; charset=utf-8'});res.end(moduleBytes);return;
 }
 res.writeHead(404);res.end();
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true});

async function setup(page,{method='top',tensFirst=false}={}){
 await page.goto(origin);
 await page.evaluate(async ({method,tensFirst})=>{
  const mod=await import('/apps/multiplication-simple/certified-classic.mjs');
  const studentId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const classId='4bf3400d-a315-4ea4-a2f3-afaca24dc9b9';
  const questions=Array.from({length:4},(_,i)=>({id:'q'+(i+1),op:'mul',a:'249',m:9,width:3}));
  const receipt={ok:true,proofVerified:true,verifiedScore:4,
   xp:{delta:22,total:22,appXp:22,level:1}};
  window.__proofCalls=[];
  window.__tensChanges=[];
  window.__verified=[];
  window.__proof=mod.createCertifiedMultiplicationClassic({
   documentRef:document,storage:localStorage,
   getContext:()=>({connected:true,studentId,classId}),
   call:async(action,payload)=>{
    window.__proofCalls.push({action,payload});
    if(action==='start-classic-v1')return {
     ok:true,sessionId:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
     revision:0,resetEpoch:0,expiresAt:new Date(Date.now()+1800000).toISOString(),
     level:1,total:4,questions
    };
    if(action==='finish-classic-v1')return receipt;
    throw Error('Unexpected proof action '+action);
   },
   onVerified:x=>window.__verified.push(x),
   onTensFirstChanged:x=>window.__tensChanges.push(x),
   refresh:async()=>{},notify:()=>{}
  });
  await window.__proof.start({mode:'classic',level:1,total:4,
   multipliers:[9],method,tensFirst});
 },{method,tensFirst});
 await page.locator('#mathasMultiCertified:not([hidden])').waitFor();
}

async function answer(page){
 // 249 x 9 = 2241, écrit en colonnes de droite à gauche ; reports 8 puis 4.
 for(const [col,digit] of [[0,'1'],[1,'4'],[2,'2'],[3,'2']])
  await page.locator('#mathasMultiCertified .mul-proof-input.answer[data-col="'+col+'"]').fill(digit);
 for(const [col,digit] of [[1,'8'],[2,'4']])
  await page.locator('#mathasMultiCertified .mul-proof-input.carry[data-col="'+col+'"]').fill(digit);
 await page.getByRole('button',{name:'Vérifier ce calcul'}).click();
}

try{
 await test('classic top: changing tens-first mid-calculation preserves digits and correct carries',async()=>{
  const page=await browser.newPage();
  try{
   await setup(page);
   const first=page.locator('#mathasMultiCertified .mul-proof-input.answer[data-col="0"]');
   await first.fill('1');
   const mid=page.locator('#mathasMultiCertified .mul-proof-input.answer[data-col="1"]');
   await mid.fill('4');
   await page.locator('#mathasMultiCertifiedTensFirst').check();
   assert.equal(await first.inputValue(),'1');
   assert.equal(await mid.inputValue(),'4');
   assert.deepEqual(await page.evaluate(()=>window.__tensChanges),[true]);
   for(let index=0;index<4;index++){
    await answer(page);
    if(index<3)await page.getByRole('button',{name:'Calcul suivant'}).click();
   }
   await page.getByText('Score vérifié par le serveur.',{exact:false}).waitFor();
   const result=await page.evaluate(()=>({
    actions:window.__proofCalls.map(x=>x.action),
    len:window.__proofCalls.at(-1)?.payload.answers.length,
    verified:window.__verified.length
   }));
   assert.deepEqual(result.actions,['start-classic-v1','finish-classic-v1']);
   assert.equal(result.len,4);
   assert.equal(result.verified,1);
  }finally{await page.close()}
 });
 await test('side carry method: carry inputs stay editable and follow the same proof schema',async()=>{
  const page=await browser.newPage();
  try{
   await setup(page,{method:'side',tensFirst:true});
   assert.equal(await page.locator('.mul-proof-side-carries .mul-proof-input.carry').count(),2);
   assert.equal(await page.locator('.mul-proof-grid .mul-proof-input.carry').count(),0);
   await answer(page);
   const persisted=await page.evaluate(()=>window.__proofCalls);
   assert.equal(persisted.length,1,'no network finish before all four calculations');
   assert.match(await page.locator('.mul-proof-status').innerText(),/Calcul juste/);
   assert.equal(await page.locator('#mathasMultiCertifiedTensFirst').isChecked(),true);
  }finally{await page.close()}
 });
}finally{
 await browser.close();
 await new Promise(resolve=>server.close(resolve));
}
