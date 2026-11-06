// Real native browser flows, no real pupils, XP, tokens or Supabase writes.
// Validates both optional/manual progression and the unchanged automatic path.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const PROFILE_A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PROFILE_B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const games=[
 {slug:'multiplication-simple',appKey:'multiplication-ecrite-simple',isMul:true},
 {slug:'soustraction-simple',appKey:'soustraction-ecrite-simple',isMul:false}
];

async function serve(){
 const server=createServer(async(req,res)=>{
  const file=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
  if(!file.startsWith(root+sep)){res.writeHead(403).end();return}
  try{
   const bytes=await readFile(file);
   const contentType=({'.html':'text/html; charset=utf-8','.mjs':'text/javascript',
    '.js':'text/javascript','.css':'text/css','.webp':'image/webp','.png':'image/png'})[extname(file)]||'application/octet-stream';
   res.writeHead(200,{'content-type':contentType}).end(bytes);
  }catch{res.writeHead(404).end()}
 });
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 return {server,url:'http://127.0.0.1:'+server.address().port};
}

async function mount(page,item,profile){
 return page.evaluate(async ({appKey,profile})=>{
  const m=await import('/apps/objective-record/in-game-manual-validation.mjs');
  return m.installManualValidationForWrittenCalc(document,appKey,profile);
 },{appKey:item.appKey,profile});
}

async function open(page,url,item,profile=PROFILE_A){
 await page.goto(url+'/apps/'+item.slug+'/game-original.html',{waitUntil:'domcontentloaded'});
 await page.locator('#menuScreen:not(.hidden)').waitFor({timeout:20000});
 assert.equal(await mount(page,item,profile),true);
 await page.locator('#mathasManualValidationDuringGame-normal').waitFor({state:'attached'});
 assert.equal(await page.locator('#mathasManualValidationDuringGame-hard').count(),1);
 if(item.isMul){
  assert.equal(await page.locator('#mathasTensFirstDuringGame-normal').count(),1);
  assert.equal(await page.locator('#mathasTensFirstDuringGame-hard').count(),1);
  const order=await page.evaluate(()=>{
   const tens=document.getElementById('mathasTensFirstDuringGame-normal').closest('label');
   const manual=document.getElementById('mathasManualValidationDuringGame-normal').closest('label');
   return tens.nextElementSibling===manual;
  });
  assert.equal(order,true,'manual switch must sit just to the right of tens-first');
 }
}

async function startFour(page,item){
 if(!item.isMul){
  await page.locator('input[name="borrowMethod"][value="addBottom"]')
   .evaluate(input=>input.closest('label').click());
 }
 await page.locator('.classic-count-btn[data-count="4"]').click();
 await page.locator('#gameScreen:not(.hidden)').waitFor({timeout:14000});
 assert.equal(await page.locator('#calculationsPair .calc-box').count(),2);
}

// Enter the ACTUAL arithmetic result using native digit buttons.
// The renderer's operands (not private engine variables) supply the operation.
async function solve(page,item,calc){
 return page.evaluate(({isMul,calc})=>{
  const box=document.querySelector('#calculationsPair .calc-box[data-calc="'+calc+'"]');
  if(!box)throw Error('missing calculation '+calc);
  let result;
  if(isMul){
   const a=[...box.querySelectorAll('.digit[data-role="multiplicand"]')]
    .sort((x,y)=>Number(y.dataset.col)-Number(x.dataset.col))
    .map(x=>x.textContent.trim()).join('');
   const m=box.querySelector('.digit[data-role="multiplier"][data-col="0"]')?.textContent.trim();
   result=Number(a)*Number(m);
  }else{
   const upper=[...box.querySelectorAll('.top-digit')]
    .sort((x,y)=>Number(y.dataset.topCol)-Number(x.dataset.topCol))
    .map(x=>x.textContent.trim()).join('');
   const lower=[...box.querySelectorAll('.bottom-digit')]
    .sort((x,y)=>Number(y.dataset.bottomCol)-Number(x.dataset.bottomCol))
    .map(x=>x.querySelector('.bottom-main')?.textContent.trim()||'').join('');
   result=Number(upper)-Number(lower);
  }
  const count=box.querySelectorAll('.answer-input').length;
  const digits=String(result).padStart(count,'0').split('').reverse();
  if(!Number.isSafeInteger(result)||result<0||digits.length!==count)
   throw Error('unexpected native calculation '+result+' / '+count);
  for(let c=0;c<digits.length;c++){
   const input=box.querySelector('.answer-input[data-col="'+c+'"]');
   const button=document.querySelector('#numpad .num-key[data-key="'+digits[c]+'"]');
   if(!input||!button)throw Error('missing native input/button '+c);
   input.focus();button.click();
   if(input.value!==digits[c])throw Error('native digit was not recorded at '+c);
  }
  return {result,filled:digits.length};
 },{isMul:item.isMul,calc});
}

for(const item of games){
 test(item.slug+' manual: each calculation requires an explicit validation',async()=>{
  const {server,url}=await serve();
  let browser;
  try{
   browser=await chromium.launch({headless:true,args:['--no-sandbox']});
   const page=await browser.newPage({viewport:{width:1360,height:900}});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await open(page,url,item);
   const manual=page.locator('#mathasManualValidationDuringGame-normal');
   assert.equal(await manual.isChecked(),false,'automatic must remain default');
   await startFour(page,item);
   await manual.check();
   assert.equal(await page.locator('#mathasManualValidationDuringGame-hard').isChecked(),true);
   const key='mathas.manual-validation.v1.'+item.appKey+'.'+PROFILE_A;
   assert.equal(await page.evaluate(k=>localStorage.getItem(k),key),'1');
   await solve(page,item,0);
   await page.waitForTimeout(300);
   assert.equal((await page.locator('#primaryBtn').textContent()).trim(),'Valider');
   assert.equal((await page.locator('#calculationsPair .calc-box[data-calc="0"] .calc-status').textContent()).trim(),'');
   assert.equal(await page.locator('#calculationsPair .calc-box[data-calc="1"] .answer-input').first().inputValue(),'');
   await page.locator('#primaryBtn').click();
   assert.match(await page.locator('#calculationsPair .calc-box[data-calc="0"] .calc-status').textContent(),/Correct|Corrigé/);
   assert.equal((await page.locator('#primaryBtn').textContent()).trim(),'Valider');
   await solve(page,item,1);
   await page.waitForTimeout(300);
   assert.equal((await page.locator('#primaryBtn').textContent()).trim(),'Valider',
    'second result must not trigger automatic page advance');
   await page.locator('#primaryBtn').click();
   await page.locator('#primaryBtn').filter({hasText:/Calculs suivants|Passer aux 2 calculs suivants/}).waitFor({timeout:8000});
   assert.deepEqual(errors,[]);
  }finally{await browser?.close();await new Promise(ok=>server.close(ok));}
 });

 test(item.slug+' auto default and preference isolated by profile',async()=>{
  const {server,url}=await serve();
  let browser;
  try{
   browser=await chromium.launch({headless:true,args:['--no-sandbox']});
   const page=await browser.newPage({viewport:{width:1360,height:900}});
   await open(page,url,item,PROFILE_A);
   assert.equal(await page.locator('#mathasManualValidationDuringGame-normal').isChecked(),false);
   await startFour(page,item);
   await page.locator('#mathasManualValidationDuringGame-normal').check();
   await page.reload({waitUntil:'domcontentloaded'});
   assert.equal(await mount(page,item,PROFILE_A),true);
   assert.equal(await page.locator('#mathasManualValidationDuringGame-normal').isChecked(),true);
   assert.equal(await mount(page,item,PROFILE_B),true);
   assert.equal(await page.locator('#mathasManualValidationDuringGame-normal').isChecked(),false);
   await startFour(page,item);
   await solve(page,item,0);
   await solve(page,item,1);
   await page.locator('#primaryBtn').filter({hasText:/Calculs suivants|Passer aux 2 calculs suivants/})
    .waitFor({timeout:9000});
  }finally{await browser?.close();await new Promise(ok=>server.close(ok));}
 });
}
