// Reads rendered numbers and enters real keyboard/borrow controls, never engine state/hooks.
export async function solveMixed({frame,page,hard=false,wrong=false}){
 const settle=()=>frame.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 const root=hard?'#hardCalc .calc-box':'#pair .calc-box';
 for(let calc=0;calc<await frame.locator(root).count();calc++){
  const box=frame.locator(root).nth(calc);
  if(await box.locator('.answer-input').first().isDisabled())continue;
  const s=await box.evaluate(el=>{
   const op=el.classList.contains('sub')?'sub':el.classList.contains('mul')?'mul':'add',width=el.querySelectorAll('.answer-input').length;
   let a,b;
   if(op==='sub'){
    a=[...el.querySelectorAll('[data-top-col]')].map(x=>[...x.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent).join('').trim()||'0').join('');
    b=[...el.querySelectorAll('[data-bottom-col]')].map(x=>[...x.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent).join('').trim()||'0').join('');
   }else{
    const d=[...el.querySelector('.operation').children].filter(x=>x.classList.contains('digit-cell')&&!x.classList.contains('operator')).map(x=>x.textContent.trim()||'0');
    a=d.slice(0,width).join('');b=d.slice(width).join('');
   }
   const answer=String(op==='add'?BigInt(a)+BigInt(b):op==='sub'?BigInt(a)-BigInt(b):BigInt(a)*BigInt(b)).padStart(width,'0').split('').reverse();
   let carry=0;const incoming=[],borrow=[],top=a.split('').reverse().map(Number),bottom=b.split('').reverse().map(Number);
   for(let c=0;c<width;c++){
    incoming[c]=carry;
    if(op==='add')carry=Math.floor(((top[c]||0)+(bottom[c]||0)+carry)/10);
    else if(op==='mul')carry=Math.floor(((top[c]||0)*Number(b)+carry)/10);
    else {borrow[c]=(top[c]||0)<(bottom[c]||0)+carry;carry=borrow[c]?1:0;}
   }
   return {op,width,count:op==='sub'?width:a.replace(/^0+/,'').length,answer,incoming,borrow,top,a,b};
  });
  if(s.op==='sub'){
   for(let c=0;c<s.borrow.length;c++)if(s.borrow[c]){
    const field=box.locator('.borrow-cell[data-col="'+c+'"]');
    if(!await field.evaluate(e=>e.classList.contains('active')))await field.click({force:true});
   }
   for(let c=1;c<s.width;c++)if(s.borrow[c-1]){
    const adj=box.locator('input[data-kind="adjust"][data-col="'+c+'"]');
    if(await adj.count()&&await adj.isVisible()){
     await settle();await adj.focus();await settle();const value=String(s.top[c]+(s.borrow[c]?10:0)-1);await adj.pressSequentially(value,{delay:30});
     if(await adj.inputValue()!==value)throw Error('Direct borrow input expected '+value+' got '+await adj.inputValue());
    }
   }
  }
  for(let c=0;c<s.width;c++){
   if(c<s.count&&s.incoming[c]>0&&s.op!=='sub'){
    const report=box.locator('input[data-kind="carry"][data-col="'+c+'"]'),side=box.locator('input[data-kind="side"]');
    const field=await report.count()?report:side;
    if(await field.count()){await settle();await field.focus();await settle();await field.press(String(s.incoming[c]));}
   }
   const field=box.locator('input[data-kind="answer"][data-col="'+c+'"]');
   await settle();await field.focus();await settle();await field.press(wrong&&c===0?String((Number(s.answer[c])+1)%10):s.answer[c]);await settle();
   if(!wrong&&!await field.isDisabled()&&(await field.inputValue())!==s.answer[c])throw Error('Keyboard target lost at '+s.op+' col '+c+' expected '+s.answer[c]+' got '+await field.inputValue());
  }
 }
 await page.waitForTimeout(220);
}
export async function playMixedClassic({frame,page,total,operations=null}){
 if(operations)for(const op of ['add','sub','mul']){
  const button=frame.locator('.op-toggle[data-op="'+op+'"]');
  if(await button.evaluate(e=>e.classList.contains('active'))!==operations.includes(op))await button.click();
 }
 await frame.locator('.countBtn[data-count="'+total+'"]').click();
 for(let pair=0;pair<total/2;pair++){
  await frame.waitForFunction(expected=>document.querySelector('#pair .calc-label')?.textContent==='Calcul '+expected,pair*2+1,{timeout:15000});
  await solveMixed({frame,page});
  // Let the native automatic transition advance. Clicking manually can race its delayed callback.
  if(pair<total/2-1)await frame.waitForFunction(expected=>document.querySelector('#pair .calc-label')?.textContent==='Calcul '+expected,pair*2+3,{timeout:15000});
 }
 await frame.waitForFunction(()=>document.getElementById('feedback')?.textContent?.startsWith('Série terminée'),null,{timeout:10000});
}
