import assert from 'node:assert/strict';
const units=['km','hm','dam','m','dm','cm','mm'];
export const modal=(page,label)=>page.locator('#celebrateActions').getByRole('button',{name:label,exact:true}).click();
export async function inputConversion(page,wrong=false,{expectModal=true}={}){
 const articles=page.locator('.t3Ex');
 const count=await articles.count();assert.ok(count>0);
 for(let i=0;i<count;i++){
  const article=articles.nth(i),input=article.locator('input.t3Answer');
  if(await input.isDisabled())continue;
  const expression=await article.locator('.t3Expression').innerText();
  const match=expression.match(/([\d\s]+)\s*(km|hm|dam|m|dm|cm|mm)\s*=[\s\S]*?(km|hm|dam|m|dm|cm|mm)\s*$/);
  assert.ok(match,expression);
  const shift=units.indexOf(match[3])-units.indexOf(match[2]);
  const source=Number(match[1].replace(/\s/g,''));
  const incorrect=typeof wrong==='function'?wrong(i):wrong;
  const value=incorrect?0:shift>=0?source*10**shift:source/10**(-shift);
  await input.click();await page.keyboard.press('Delete');await page.keyboard.type(String(value));
 }
 await page.locator('#t3Verify').click();
 assert.equal(await page.locator('#celebrateDialog').evaluate(el=>el.open),expectModal,
  await page.locator('#t3Summary').textContent());
}

export async function enterMaster(page){
 await page.locator('#masterToggle').click();
 await page.locator('#masterPassword').fill('Thecakeisalie');
 await page.locator('#masterForm button[type="submit"]').click();
}
export async function solveConstruction(page,{imperfect=false,started=false}={}){
 if(!started)await page.locator('#launchBtn').click();
 for(const unit of ['km','m','cm','mm']){
  const column=imperfect&&unit==='km'?'m':imperfect&&unit==='m'?'km':unit;
  await page.locator(`#unitBank [data-id="${unit}"]`).click();
  await page.locator(`#abaque .col[data-unit="${column}"]`).click();
 }
 await page.locator('#verifyBtn').click();
 if(imperfect){
  assert.match(await page.locator('#feedback').textContent(),/2 unités/);
  await page.locator('#abaque [data-type="unit"][data-id="km"]').click();
  await page.locator('#abaque .col[data-unit="km"]').click();
  await page.locator('#verifyBtn').click();
 }
 const items=await page.locator('#imagesBank [data-id]').evaluateAll(els=>els.map(el=>({
  id:el.dataset.id,unit:window.MATHAS_ITEMS.find(item=>item.id===el.dataset.id).unit
 })));
 assert.equal(items.length,8);
 for(const item of items){
  await page.locator(`#imagesBank [data-id="${item.id}"]`).click();
  await page.locator(`#abaque .col[data-unit="${item.unit}"]`).click();
 }
 await page.locator('#verifyBtn').click();await modal(page,'Accueil');
}
export async function solveMoves(page,{imperfect=false,started=false}={}){
 if(!started)await page.locator('#moveLaunchBtn').click();
 for(let part=0;part<2;part++){
  for(let i=0;i<4;i++){
   const rail=page.locator('.moveRail').nth(i);
   const match=(await rail.getAttribute('aria-label')).match(/de (\w+) vers (\w+)/);
   const shift=imperfect&&part===0&&i===0?0:units.indexOf(match[2])-units.indexOf(match[1]);
   await rail.focus();
   for(let step=0;step<Math.abs(shift);step++)await page.keyboard.press(shift>0?'ArrowRight':'ArrowLeft');
  }
  await page.locator('#verifyMoves').click();
  if(part===0&&imperfect)await page.locator('#moveNew').click();
  else await modal(page,part===0?'Page suivante':'Accueil');
 }
}

