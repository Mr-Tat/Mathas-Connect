// Chromium réel : deux copies natives partagent les questions sans partager leurs champs.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {chromium} from 'playwright';

const original=readFileSync(new URL('../apps/multiplication-simple/game-original.html',import.meta.url),'utf8');
const bridge=readFileSync(new URL('../apps/multiplication-simple/collective-native-bridge.js',import.meta.url),'utf8');
const marker='primaryBtn.onclick=handlePrimary;';
assert.equal(original.split(marker).length,2,'ancrage unique à maintenir');
const html=original.replace(marker,bridge+'\nprimaryBtn.onclick=(event)=>{if(window.MathasGuidedBridge?.isCollectiveActive()&&phase==="review"){if(event?.isTrusted)window.MathasGuidedBridge.onContinue?.();return;}handlePrimary()};');
const server=createServer((req,res)=>{
 if(req.url==='/'){res.writeHead(200,{'content-type':'text/html; charset=utf-8'});res.end(html);return}
 res.writeHead(404);res.end();
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true});
const origin='http://127.0.0.1:'+server.address().port;
const page1=[{a:'106',m:5},{a:'558',m:2}],page2=[{a:'247',m:6},{a:'139',m:8}];
const config={level:1,carryMethod:'top',multipliers:[2,5,6,8]};

try{
 await test('prof et élève voient les mêmes opérations sans dupliquer les réponses',async()=>{
  const prof=await browser.newPage(),student=await browser.newPage();
  try{
   for(const p of [prof,student]){
    await p.goto(origin,{waitUntil:'domcontentloaded'});
    await p.waitForFunction(()=>!!window.MathasGuidedBridge);
    const entered=await p.evaluate(({page1,config})=>window.MathasGuidedBridge.enter(page1,0,config),{page1,config});
    assert.equal(entered,true);
   }
   const read=async p=>p.evaluate(()=>[...document.querySelectorAll('#calculationsPair .calc-box')].map(box=>({
    a:[...box.querySelectorAll('.digit[data-role="multiplicand"]')].map(e=>e.textContent).join(''),
    m:[...box.querySelectorAll('.digit[data-role="multiplier"]')].map(e=>e.textContent).join('')
   })));
   assert.deepEqual(await read(prof),await read(student));
   await prof.evaluate(()=>{document.querySelector('#calculationsPair .calc-box:first-child .answer-input[data-col="0"]').value='9'});
   assert.equal(await student.locator('#calculationsPair .calc-box:first-child .answer-input[data-col="0"]').inputValue(),'');
   assert.equal(await student.evaluate(()=>window.MathasGuidedBridge.status().finished),false);
   // Le professeur peut ouvrir la page suivante sans avoir résolu la première.
   assert.equal(await prof.evaluate(p=>window.MathasGuidedBridge.show(p,1),page2),true);
   assert.equal(await student.evaluate(()=>window.MathasGuidedBridge.status().pageIndex),0);
   assert.equal(await student.evaluate(p=>window.MathasGuidedBridge.show(p,1),page2),true);
   assert.deepEqual(await read(prof),await read(student));
  }finally{await prof.close();await student.close()}
 });
 await test('entraînement libre puis retour à la même opération collective',async()=>{
  const pupil=await browser.newPage();
  try{
   await pupil.goto(origin,{waitUntil:'domcontentloaded'});
   await pupil.waitForFunction(()=>!!window.MathasGuidedBridge);
   assert.equal(await pupil.evaluate(({page1,config})=>window.MathasGuidedBridge.enter(page1,0,config),{page1,config}),true);
   await pupil.evaluate(()=>window.MathasGuidedBridge.practice());
   assert.equal(await pupil.evaluate(()=>window.MathasGuidedBridge.status().collective),false);
   assert.equal(await pupil.evaluate(({page1,config})=>window.MathasGuidedBridge.enter(page1,0,config),{page1,config}),true);
   assert.equal(await pupil.locator('#calculationsPair .calc-box').count(),2);
  }finally{await pupil.close()}
 });
}finally{
 await browser.close();await new Promise(resolve=>server.close(resolve));
}
