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
 console.log('PASS: Chromium rendered original addition multiple engine; no browser script errors');
}finally{await browser.close()}
