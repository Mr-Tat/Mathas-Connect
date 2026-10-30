import assert from 'node:assert/strict';
import {chromium} from 'playwright';

// Browser plays EVERY column and carry through the actual read-only game inputs.
// No direct __setLastWork calls, no fake completion, no master-mode shortcuts.
// 4 successes -> native 4/4 -> bridge -> real simulation bar +22 XP.
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage();
 const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8765/apps/addition-plusieurs/?simulation=1',{waitUntil:'domcontentloaded'});
 const frame=page.frameLocator('iframe#game');
 await frame.locator('#menuScreen:not(.hidden) .classic-count-btn[data-count="4"]').waitFor({timeout:20000});
 // The V6 UI hides #startClassic deliberately. The visible 4-calculs button
 // is the real user action and internally triggers the original launch code.
 await frame.locator('#trainingMaxDigits').selectOption('5');
 await frame.locator('#tensFirstToggle').uncheck();
 await frame.locator('.classic-count-btn[data-count="4"]').click();
 await frame.locator('#gameScreen:not(.hidden)').waitFor();
 assert.match(await frame.locator('#sessionLevel').innerText(),/Niveau 1/);

 for(let pair=0;pair<2;pair++){
  for(let calc=0;calc<2;calc++){
   const operation=frame.locator('.operation[data-calc="'+calc+'"]');
   const digits=await operation.evaluate(op=>{
    const addends=[];let row=null;
    for(const el of op.children){
     if(el.classList.contains('operator')){
      if(row)addends.push(row);
      row={};
     }else if(el.classList.contains('digit')&&row&&el.textContent.trim()){
      row[Number(el.dataset.col)]=Number(el.textContent.trim());
     }
    }
    if(row)addends.push(row);
    const count=op.querySelectorAll('.answer-input').length;
    if(!addends.length||count<4)throw Error('unreadable_arithmetic');
    let carry=0;const answers=[],carries=[];
    for(let c=0;c<count;c++){
     const sum=carry+addends.reduce((v,n)=>v+(n[c]||0),0);
     answers.push(sum%10);
     carry=Math.floor(sum/10);
     carries.push(carry);
    }
    if(carry)throw Error('displayed result columns truncated');
    return {addends,answers,carries};
   });
   for(let c=0;c<digits.answers.length;c++){
    const selector='.operation[data-calc="'+calc+'"] .answer-input[data-col="'+c+'"]';
    const field=frame.locator(selector);
    await field.click();
    await field.press(String(digits.answers[c]));
    const carry=digits.carries[c];
    const carryField=frame.locator('.operation[data-calc="'+calc+'"] .carry-input[data-carry-col="'+(c+1)+'"]');
    if(carry>0&&await carryField.count()){
     await carryField.click();
     await carryField.press(String(carry));
    }
   }
  }
  // The engine auto-checks a filled pair after 100ms; use its visible
  // primary button only when automatic validation has not happened yet.
  await page.waitForTimeout(220);
  const message=await frame.locator('#primaryBtn').innerText();
  if(message==='Valider')await frame.locator('#primaryBtn').click();
  await frame.locator('#sessionScore').waitFor();
  if(pair===0){
   await page.waitForFunction(()=>
     document.getElementById('game')?.contentDocument?.getElementById('primaryBtn')?.textContent?.includes('Passer aux 2 calculs suivants'),
     null,{timeout:15000});
   await frame.locator('#primaryBtn').click({force:true});
   await frame.locator('#gameScreen .operation').first().waitFor();
  }
 }
 await frame.locator('#primaryBtn').waitFor();
 await page.waitForFunction(()=>document.getElementById('audit')?.textContent==='Événements : 1',{timeout:20000});
 await page.waitForFunction(()=>document.getElementById('xp-total')?.textContent==='22 XP',{timeout:20000});
 assert.match(await frame.locator('#feedback').innerText(),/4\/4/);
 assert.equal(await frame.locator('body').evaluate(()=>
  JSON.parse(localStorage.getItem('addition2_classic_v1')||'{}').levels?.['1']?.['4']),4);
 assert.deepEqual(errors,[]);
 console.log('PASS: Four original arithmetic problems solved via actual input controls, native 4/4 and +22 XP in Chromium');
}finally{await browser.close()}
