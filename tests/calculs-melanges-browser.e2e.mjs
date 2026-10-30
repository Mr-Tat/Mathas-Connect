import assert from 'node:assert/strict';
import {playMixedClassic,solveMixed} from './calculs-melanges-real-play-helper.mjs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox']});
const site=process.env.MATHAS_TEST_SITE||'http://127.0.0.1:8765';assert.match(site,/^http:\/\/127\.0\.0\.1:\d+$/);
try{
 const context=await browser.newContext();const page=await context.newPage(),errors=[],remote=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!r.url().startsWith(site)&&!r.url().startsWith('data:'))remote.push(r.url())});
 await context.addInitScript(()=>{let seed=5168789;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}});
 async function open(){await page.goto(site+'/apps/calculs-melanges/?simulation=1');await page.locator('#game').waitFor();await page.waitForFunction(()=>document.querySelector('#game')?.contentDocument?.querySelector('.countBtn'));await page.waitForTimeout(350);return page.frames().find(f=>f.parentFrame())}
 let frame=await open();
 if(!process.env.MATHAS_SKIP_LONG_BROWSER)for(const order of [[4,10,20],[20,10,4]]){
  await page.evaluate(()=>{for(const k of Object.keys(localStorage))if(k.startsWith('mathas.calculs-melanges.'))localStorage.removeItem(k)});frame=await open();
  for(const total of order){
   await playMixedClassic({frame,page,total});await page.waitForTimeout(200);
   assert.match(await frame.locator('#feedback').innerText(),new RegExp(total+' / '+total));
   await frame.locator('.mathas-post-activity-menu').waitFor({timeout:10000});await frame.locator('.mathas-post-activity-menu').click();await page.waitForTimeout(200);
  }
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('mathas.calculs-melanges.lab.simulation.v1')));
  assert.deepEqual(saved.state.classic[0],{4:4,10:10,20:20});assert.equal(saved.revision,3);assert.equal(saved.ids.length,3);
  frame=await open();assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('mathas.calculs-melanges.lab.simulation.v1')).revision),3);
 }
 if(!process.env.MATHAS_SKIP_LONG_BROWSER)console.log('PASS real keyboard: both 4→10→20 and 20→10→4, exact scores, durable independent series, no duplicate terminal');
 // Exercise the two native subtraction techniques and both multiplication report methods.
 if(!process.env.MATHAS_SKIP_LONG_BROWSER)for(const [op,method] of [['sub','addBottom'],['sub','takeTop'],['mul','top'],['mul','side']]){
  frame=await open();
  await frame.locator('.op-toggle[data-op="'+op+'"]').waitFor();
  const chosen=frame.locator('.op-toggle[data-op="'+op+'"]');if(!await chosen.evaluate(e=>e.classList.contains('active')))await chosen.click({force:true});
  for(const other of ['add','sub','mul'])if(other!==op){const toggle=frame.locator('.op-toggle[data-op="'+other+'"]');if(await toggle.evaluate(e=>e.classList.contains('active')))await toggle.click({force:true});}
  const radio=frame.locator('input[name="'+(op==='sub'?'subMethod':'mulMethod')+'"][value="'+method+'"]');await radio.check({force:true});
  await playMixedClassic({frame,page,total:4});assert.match(await frame.locator('#feedback').innerText(),/4 \/ 4/);
  console.log('PASS real keyboard method',op,method);
 }
 // Native normal guided button is hidden in the original V6.0.2. Do not restore it silently.
 frame=await open();assert.equal(await frame.locator('#trainingBtn').isVisible(),false);
 if(process.env.MATHAS_HARD_METHODS){await frame.locator('input[name="subMethod"][value="takeTop"]').check({force:true});await frame.locator('input[name="mulMethod"][value="side"]').check({force:true});}
 // Synthetic unlock fixture, independent of XP. Exercise the actually accessible HARD training.
 await page.evaluate(()=>localStorage.setItem('mathas.calculs-melanges.game.simulation.v1:mathas_progression_melange_de_calculs_v1',JSON.stringify({level2:true,level3:true,perfect1:true,perfect2:true,perfect3:true,hard:true,sudden1:true,sudden2:true,sudden3:true})));
 if(!process.env.MATHAS_SKIP_LONG_BROWSER){
  for(const level of [2,3]){
   frame=await open();
   for(const op of ['add','sub','mul']){const toggle=frame.locator('.op-toggle[data-op="'+op+'"]');if(!await toggle.evaluate(e=>e.classList.contains('active')))await toggle.click({force:true});}
   await frame.locator('#levelSelect').selectOption(String(level));
   await playMixedClassic({frame,page,total:4});assert.match(await frame.locator('#feedback').innerText(),/4 \/ 4/);
  }
  console.log('PASS real mixed classic4 at levels2 and3 with native settings and synthetic unlock fixture');
  frame=await open();await frame.locator('#levelSelect').selectOption('1');await frame.locator('#suddenBtn').click();
  for(let pair=0;pair<5;pair++){
   await frame.waitForFunction(n=>document.querySelector('#pair .calc-label')?.textContent==='Calcul '+n&&!document.querySelector('#pair .answer-input')?.disabled,pair*2+1,{timeout:15000});
   await solveMixed({frame,page});
  }
  await frame.waitForFunction(()=>document.querySelector('#pair .calc-label')?.textContent==='Calcul 11'&&!document.querySelector('#pair .answer-input')?.disabled,null,{timeout:15000});
  await solveMixed({frame,page,wrong:true});await page.waitForFunction(()=>document.getElementById('audit')?.textContent==='Événements : 1');
  assert.match(await frame.locator('#feedback').innerText(),/Score : 10/);
  console.log('PASS real normal sudden10 + wrong terminal, exactly one completion');
 }
 frame=await open();await frame.locator('#levelBtn').click();await frame.locator('#levelMenu .level-option.hard').click();
 await frame.locator('.hard-train').first().click();await solveMixed({frame,page,hard:true});assert.equal(await page.locator('#audit').innerText(),'Événements : 0');
 console.log('PASS real HARD training=0; normal guided remains hidden exactly as upstream');
 // Terminal HARD sudden path, seven correct problems and a genuine wrong answer.
 for(const hardLevel of [1,2,3]){
 frame=await open();await frame.locator('#levelBtn').click();await frame.locator('#levelMenu .level-option.hard').click();await frame.locator('.hard-sudden').nth(hardLevel-1).click();
 for(let n=1;n<=7;n++){
  await frame.waitForFunction(n=>document.getElementById('hardCounter')?.textContent==='Calcul '+n&&document.getElementById('hardPrimary')?.textContent==='Valider'&&!document.querySelector('#hardCalc .answer-input')?.disabled,n,{timeout:15000}).catch(async error=>{throw Error('HARD '+n+': '+await frame.locator('#hardFeedback').innerText()+' '+JSON.stringify(await frame.locator('#hardCalc input').evaluateAll(es=>es.map(e=>({kind:e.dataset.kind,col:e.dataset.col,value:e.value}))))+' '+error.message)});
  await solveMixed({frame,page,hard:true});
 }
 await frame.waitForFunction(()=>document.getElementById('hardCounter')?.textContent==='Calcul 8'&&document.getElementById('hardPrimary')?.textContent==='Valider'&&!document.querySelector('#hardCalc .answer-input')?.disabled,null,{timeout:15000});
 await solveMixed({frame,page,hard:true,wrong:true});
 await page.waitForFunction(()=>document.getElementById('audit')?.textContent==='Événements : 1');
 assert.match(await frame.locator('#hardFeedback').innerText(),/Score final : 7/);
 console.log('PASS real HARD level'+hardLevel+' sudden7 + wrong terminal, exactly one completion');
 }
 // Class URL and teacher query cannot open compiled Connect gate.
 await page.goto(site+'/apps/calculs-melanges/?class=00000000-0000-4000-8000-000000000001&joueur=prof');
 await page.waitForTimeout(100);assert.match(await page.locator('#result').innerText(),/Aucun résultat ni XP Connect/);assert.equal(await page.locator('#game').getAttribute('srcdoc'),null);
 // Free / simulated scope separation on a shared device, with no historical cache import.
 await page.goto(site+'/apps/calculs-melanges/');await page.waitForFunction(()=>document.querySelector('#game')?.contentDocument?.querySelector('.countBtn'));
 frame=page.frames().find(f=>f.parentFrame());assert.equal(await frame.evaluate(()=>window.__mathasGameStorageScope),'libre');
 assert.equal(await frame.evaluate(()=>localStorage.getItem('mixcalc_classic_v1')),null);
 assert.equal(remote.length,0,'free/simulation/closed launch must never contact Supabase or external CDN');
 for(const width of [320,768,1366]){await page.setViewportSize({width,height:900});await page.waitForTimeout(100);assert.ok(await frame.locator('.countBtn[data-count="4"]').isVisible());assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'host overflow at '+width)}
 assert.deepEqual(errors,[]);console.log('PASS training=0, no hosted traffic, closed Connect/teacher URL, scope isolation, 320/768/1366 host');
}finally{await browser.close()}
