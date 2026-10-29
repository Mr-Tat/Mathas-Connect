import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true});
try{
 const context=await browser.newContext();
 const page=await context.newPage();
 const errors=[];
 page.on('pageerror',e=>errors.push(String(e.message)));
 await page.goto('http://127.0.0.1:8765/apps/addition-plusieurs/?simulation=1',{waitUntil:'domcontentloaded'});
 await page.waitForSelector('iframe#game');
 const frame=page.frameLocator('iframe#game');
 await frame.locator('body').waitFor({timeout:20000});
 const body=await frame.locator('body').innerText();
 assert.ok(body.length>100,'original game must render substantial content');
 assert.ok(!errors.length,'JavaScript errors: '+errors.join(' | '));
 assert.match(await page.locator('body').innerText(),/Laboratoire/);
 // Shared classroom computer: records written by a simulated student must never
 // appear in the unscoped HUB or the free-mode game (same browser context).
 const scope=await frame.locator('body').evaluate(()=>{
  localStorage.setItem('addition2_audit_probe','simulation-only');
  localStorage.setItem('mathas_audit_probe','simulation-trophy');
  return window.__mathasGameStorageScope;
 });
 assert.equal(scope,'simulation');
 const keys=await page.evaluate(()=>({
  raw:localStorage.getItem('addition2_audit_probe'),
  scoped:localStorage.getItem('mathas.addition-plusieurs.game.simulation.v1:addition2_audit_probe'),
  trophy:localStorage.getItem('mathas.addition-plusieurs.game.simulation.v1:mathas_audit_probe')
 }));
 assert.deepEqual(keys,{raw:null,scoped:'simulation-only',trophy:'simulation-trophy'});
 const freePage=await page.context().newPage();
 freePage.on('pageerror',e=>errors.push('free: '+e.message));
 await freePage.goto('http://127.0.0.1:8765/apps/addition-plusieurs/',{waitUntil:'domcontentloaded'});
 const freeFrame=freePage.frameLocator('iframe#game');
 await freeFrame.locator('body').waitFor({timeout:20000});
 const separated=await freeFrame.locator('body').evaluate(()=>{
  const before=localStorage.getItem('addition2_audit_probe');
  localStorage.setItem('addition2_audit_probe','free-only');
  return {scope:window.__mathasGameStorageScope,before};
 });
 assert.deepEqual(separated,{scope:'libre',before:null});
 assert.equal(await frame.locator('body').evaluate(()=>localStorage.getItem('addition2_audit_probe')),'simulation-only');
 assert.equal(await page.evaluate(()=>localStorage.getItem('mathas.addition-plusieurs.game.libre.v1:addition2_audit_probe')),'free-only');
 await freePage.close();

 // Exercise the actual native completion bridge through the loaded game frame.
 // This is a contract test, not a claim that every calculation UI was played.
 const native=await frame.locator('body').evaluate(()=>{
   const fn=window.__setLastWork;
   if(typeof fn!=='function')return 'missing';
   fn({label:'Calculs · Niveau 1',score:'4/4',rulerUsed:false});
   return 'called';
 });
 assert.equal(native,'called','native game completion function must exist');
 await page.waitForFunction(()=>document.getElementById('audit')?.textContent?.includes('1'),{timeout:10000});
 await page.waitForFunction(()=>document.getElementById('result')?.textContent?.includes('22 XP'),{timeout:10000});
 assert.match(await page.locator('#result').innerText(),/22 XP/);
 // Contract tests of all four terminal-event formats, through real iframe postMessage.
 // These are intentionally injected game events, not completed arithmetic problems.
 const cases=[
  [{label:'Calculs · Niveau 1',score:'10/10'},58],
  [{label:'Calculs · Niveau 1',score:'20/20'},118],
  [{label:'Mort subite · Niveau 1',score:'10'},138],
  [{label:'HARD NIV 1 · 5 calculs',score:'5/5'},138],
  [{label:'HARD NIV 1 · Mort subite · 3 chiffres',score:'7'},158],
  [{label:'Calculs · Niveau 1',score:'4/4'},158]
 ];
 for(let i=0;i<cases.length;i++){
  const [payload,xp]=cases[i];
  await frame.locator('body').evaluate((_body,entry)=>window.__setLastWork(entry),payload);
  try{
   await page.waitForFunction(({events,expected})=>
    document.querySelector('#audit')?.textContent?.includes('Événements : '+events)
    &&document.querySelector('#result')?.textContent?.includes('Simulation : '+expected+' XP'),
    {events:i+2,expected:xp},{timeout:10000});
  }catch(error){
   console.error('Chromium stage failed',JSON.stringify({
    step:i,expected:xp,payload,
    audit:await page.locator('#audit').innerText(),
    displayed:await page.locator('#result').innerText(),
    errors,
    fn:await frame.locator('body').evaluate(()=>String(window.__setLastWork).slice(0,160))
   }));
   throw error;
  }
 }
 assert.ok(!errors.length,'JavaScript errors after all completion modes: '+errors.join(' | '));
 console.log('PASS: Chromium native engine, isolated free/simulation storage, all completion modes and simulated XP');
}finally{await browser.close()}
