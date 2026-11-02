import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const key='mathas_connect_abaque_demo_progress_v1';
const units=['km','hm','dam','m','dm','cm','mm'];
async function setup(){
 const server=createServer(async(req,res)=>{const p=resolve(root,'.'+new URL(req.url,'http://localhost').pathname.replace(/\/$/,'/index.html'));if(!p.startsWith(root+sep)){res.writeHead(403).end();return;}try{const b=await readFile(p);res.writeHead(200,{'content-type':({'.html':'text/html','.css':'text/css','.mjs':'text/javascript','.js':'text/javascript','.webp':'image/webp'})[extname(p)]||'application/octet-stream'}).end(b);}catch{res.writeHead(404).end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({...(process.env.CHROME_BIN?{executablePath:process.env.CHROME_BIN}:{}),headless:true,args:['--no-sandbox']});
 const page=await browser.newPage();const errors=[],external=[];
 page.on('pageerror',e=>errors.push(e.message));
 const url='http://127.0.0.1:'+server.address().port;
 await page.route('**/*',route=>{if(route.request().url().startsWith(url+'/'))return route.continue();external.push(route.request().url());return route.abort();});
 return {page,url:url+'/apps/abaque-longueurs/',errors,external,close:async()=>{await browser.close();await new Promise(r=>server.close(r));}};
}
async function modal(page,label){await page.locator('#celebrateActions').getByRole('button',{name:label,exact:true}).click();}
async function inputConversion(page,wrong=false){
 const articles=page.locator('.t3Ex');
 const count=await articles.count();
 assert.ok(count>0);
 for(let i=0;i<count;i++){
  const article=articles.nth(i);
  const text=await article.locator('.t3Expression').innerText();
  const m=text.match(/([\d\s]+)\s*(km|hm|dam|m|dm|cm|mm)\s*=[\s\S]*?(km|hm|dam|m|dm|cm|mm)\s*$/);
  assert.ok(m,text);
  const shift=units.indexOf(m[3])-units.indexOf(m[2]);
  const source=Number(m[1].replace(/\s/g,''));
  const value=wrong?0:shift>=0?source*10**shift:source/10**(-shift);
  await article.locator('input.t3Answer').click();await page.keyboard.type(String(value));
 }
 await page.locator('#t3Verify').click();
 assert.ok(await page.locator('#celebrateDialog').evaluate(e=>e.open),await page.locator('#t3Summary').textContent()+' answers='+await page.locator('.t3Answer').evaluateAll(els=>JSON.stringify(els.map(e=>e.value))));
}
async function fixture(page){await page.evaluate(k=>{localStorage.setItem(k,JSON.stringify({stage1:{passes:['green','green'],passScores:[12,12]},stage2:{passes:['green','green'],passScores:[8,8]},modes:{one:'green',three:'green',five:'green'}}));},key);await page.reload();}
test('Abaque : deux vraies constructions débloquent déplacements ; deux séries clavier débloquent conversions',async()=>{
 const h=await setup();const {page}=h;
 try{
  await page.goto(h.url);assert.equal(await page.locator('#moveLaunchBtn').getAttribute('aria-disabled'),'true');
  for(let run=0;run<2;run++){
   await page.locator('#launchBtn').click();
   for(const unit of ['km','m','cm','mm']){await page.locator(`#unitBank [data-id="${unit}"]`).click();await page.locator(`#abaque .col[data-unit="${unit}"]`).click();}
   await page.locator('#verifyBtn').click();
   const items=await page.locator('#imagesBank [data-id]').evaluateAll(els=>els.map(e=>({id:e.dataset.id,unit:window.MATHAS_ITEMS.find(x=>x.id===e.dataset.id).unit})));
   assert.equal(items.length,8);
   for(const it of items){await page.locator(`#imagesBank [data-id="${it.id}"]`).click();await page.locator(`#abaque .col[data-unit="${it.unit}"]`).click();}
   await page.locator('#verifyBtn').click();await modal(page,'Accueil');
  }
  assert.equal(await page.locator('#moveLaunchBtn').getAttribute('aria-disabled'),'false');
  for(let run=0;run<2;run++){
   await page.locator('#moveLaunchBtn').click();
   for(let part=0;part<2;part++){
    const rails=page.locator('.moveRail');
    for(let i=0;i<4;i++){const rail=rails.nth(i);const text=await rail.getAttribute('aria-label');const m=text.match(/de (\w+) vers (\w+)/);const shift=units.indexOf(m[2])-units.indexOf(m[1]);await rail.focus();for(let step=0;step<Math.abs(shift);step++)await page.keyboard.press(shift>0?'ArrowRight':'ArrowLeft');}
    await page.locator('#verifyMoves').click();await modal(page,part===0?'Page suivante':'Accueil');
   }
  }
  assert.equal(await page.locator('[data-mode="one"]').getAttribute('aria-disabled'),'false');
  assert.deepEqual(h.errors,[]);assert.deepEqual(h.external,[]);
 }finally{await h.close();}
});
test('Abaque : scores natifs, aides, 3 vies sans correction, incomplet et doublon, mort subite, mobile isolé',async()=>{
 const h=await setup();const {page}=h;
 try{
  await page.goto(h.url);await fixture(page);
  for(const [mode,pages,max] of [['one',1,100],['three',3,324],['five',5,580]]){
   await page.locator(`[data-mode="${mode}"]`).click();
   for(let n=0;n<pages;n++){await inputConversion(page);await modal(page,n+1===pages?'Accueil':'Page suivante');}
   const data=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);assert.equal(data.recordsByMode[mode],max);
  }
  await page.locator('[data-variant="lives"]').click();
  await page.locator('#t3Verify').click();assert.match(await page.locator('#recordLives').getAttribute('aria-label'),/3 vies/);
  await inputConversion(page);assert.match(await page.locator('#t3ScoreNow').textContent(),/25 points/);await modal(page,'Suivante');
  for(let remaining=2;remaining>=0;remaining--){
   await inputConversion(page,true);
   await page.evaluate(()=>document.querySelector('#t3Verify').click());
   assert.equal(await page.locator('#recordLives').getAttribute('aria-label'),remaining+' vies restantes');
   assert.equal(await page.locator('.t3retry').count(),0);
   await modal(page,remaining?'Suivante':'Accueil');
  }
  await page.locator('[data-variant="sudden"]').click();await inputConversion(page);assert.match(await page.locator('#t3ScoreNow').textContent(),/30 points/);await modal(page,'Suivante');
  assert.equal(await page.locator('.t3UnitsBtn').isDisabled(),true);
  await inputConversion(page,true);assert.match(await page.locator('#celebrateTitleEl').textContent(),/Fin de partie/);await modal(page,'Accueil');
  for(const width of [320,768,1024]){await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),String(width));}
  await page.setViewportSize({width:320,height:900});await page.screenshot({path:'/workspace/abaque-mobile.png',fullPage:true});
  assert.deepEqual(h.external,[]);assert.deepEqual(h.errors,[]);
  assert.equal(await page.evaluate(()=>localStorage.getItem('mathas_abaque_longueurs_progress_v1')),null);
 }finally{await h.close();}
});
