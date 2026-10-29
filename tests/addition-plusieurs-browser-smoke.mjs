import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage();
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
 assert.ok(!errors.length,'JavaScript errors after completion: '+errors.join(' | '));
 console.log('PASS: Chromium game engine, native completion bridge, and simulated 22 XP acknowledgement');
}finally{await browser.close()}
