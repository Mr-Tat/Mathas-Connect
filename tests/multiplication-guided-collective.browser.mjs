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
 const path=(req.url||'').split('?')[0];
 if(path==='/'){res.writeHead(200,{'content-type':'text/html; charset=utf-8'});res.end(html);return}
 if(['/apps/multiplication-simple/collective-ui.mjs','/apps/multiplication-simple/collective-contract.mjs'].includes(path)){
  res.writeHead(200,{'content-type':'text/javascript; charset=utf-8'});
  res.end(readFileSync(new URL('../'+path.slice(1),import.meta.url)));return;
 }
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

 await test('professeur : pages mémorisées, page obligatoire et réponses',async()=>{
  const page=await browser.newPage();
  try{
   await page.goto(origin,{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>!!window.MathasGuidedBridge);
   await page.evaluate(async({page1,page2,config})=>{
    const {createMultiplicationCollective}=await import('/apps/multiplication-simple/collective-ui.mjs');
    const state=()=>({ok:true,active:true,sessionId:'11111111-1111-4111-8111-111111111111',
     revision:window.__sharedRevision,level:1,carryMethod:'top',multipliers:config.multipliers,
     pages:window.__sharedPages,pageIndex:window.__sharedPages.length-1,
     teacherPageIndex:window.__shownPage,requiredPages:window.__requiredPages,
     allowSkip:true,updatedAt:new Date().toISOString()});
    window.__sharedPages=[];window.__sharedRevision=0;window.__shownPage=0;window.__requiredPages=[];
    window.__controller=createMultiplicationCollective({
     iframe:{contentDocument:document,contentWindow:window},teacher:true,classId:'4bf3400d-a315-4ea4-a2f3-afaca24dc9b9',classLabel:'Classe TEST',
     call:async(action,payload)=>{
      if(action==='status'||action==='resume')return window.__sharedPages.length?state():{ok:true,active:false};
      if(action==='start'){window.__sharedPages=[page1];window.__shownPage=0;window.__sharedRevision++;return state()}
      if(action==='next'){window.__sharedPages.push(page2);window.__shownPage++;window.__sharedRevision++;return state()}
      if(action==='set-page'){window.__shownPage=payload.pageIndex;window.__sharedRevision++;return state()}
      if(action==='set-required'){
       window.__requiredPages=payload.required?[payload.pageIndex]:[];
       window.__sharedRevision++;return state();
      }
      if(action==='stop'){window.__sharedPages=[];return {ok:true,active:false}}
      return {ok:false,error:'unknown'};
     }
    });window.__controller.mount();
   },{page1,page2,config});
   assert.equal(await page.locator('#mc-guided-slot').count(),0,'pas de commande collective au menu');
   await page.locator('#startTraining').click();
   await page.locator('#mc-guided-bar').getByRole('button',{name:/Lancer la séance/}).click();
   await page.waitForFunction(()=>window.__sharedPages.length===1&&window.MathasGuidedBridge.status().collective);
   const toolbar=page.locator('#mc-guided-bar [data-role="teacher"]');
   await toolbar.getByRole('button',{name:/Nouvelle page/}).click();
   assert.equal(await page.evaluate(()=>window.MathasGuidedBridge.status().pageIndex),1);
   await toolbar.getByRole('button',{name:/Précédente/}).click();
   assert.equal(await page.evaluate(()=>window.MathasGuidedBridge.status().pageIndex),0);
   await toolbar.getByRole('button',{name:'Page obligatoire'}).click();
   assert.deepEqual(await page.evaluate(()=>window.__requiredPages),[0]);
   assert.equal(await toolbar.getByRole('button',{name:/Page obligatoire/}).getAttribute('aria-pressed'),'true');
   await toolbar.getByRole('button',{name:/Page suivante/}).click();
   assert.equal(await page.evaluate(()=>window.MathasGuidedBridge.status().pageIndex),1);
   assert.equal(await page.evaluate(()=>window.__sharedPages.length),2,'pas de nouvelle génération');
   await toolbar.getByRole('button',{name:/Afficher les réponses/}).click();
   const confirmation=page.locator('#mc-guided-bar .mc-confirm');
   assert.equal(await confirmation.getByRole('button',{name:'Oui'}).isVisible(),true);
   await confirmation.getByRole('button',{name:'Oui'}).click();
   const result=await page.locator('#mc-guided-answers').innerText();
   assert.match(result,/247 × 6 = 1482/);assert.match(result,/139 × 8 = 1112/);
   await toolbar.getByRole('button',{name:/Masquer les réponses/}).click();
   assert.equal(await page.locator('#mc-guided-answers').isHidden(),true);
   assert.equal(await page.getByRole('button',{name:/Élève au tableau/}).count(),0);
  }finally{await page.close()}
 });
 await test('onglet professeur : changer d’onglet conserve la séance, quitter la page la ferme',async()=>{
  const first=await browser.newPage(),other=await browser.newPage();
  const departures=[];
  try{
   await first.exposeFunction('__guidedReportClose',data=>{departures.push(data)});
   await first.goto(origin,{waitUntil:'domcontentloaded'});
   await first.waitForFunction(()=>!!window.MathasGuidedBridge);
   await first.evaluate(async({page1,config})=>{
    const {createMultiplicationCollective}=await import('/apps/multiplication-simple/collective-ui.mjs');
    const state=()=>({ok:true,active:true,sessionId:'11111111-1111-4111-8111-111111111111',
     revision:1,level:config.level,carryMethod:'top',multipliers:config.multipliers,
     pages:[page1],pageIndex:0,allowSkip:false,updatedAt:new Date().toISOString()});
    window.__teacherActions=[];
    window.__teacherHasStarted=false;
    window.__lifeController=createMultiplicationCollective({
     iframe:{contentDocument:document,contentWindow:window},
     teacher:true,classId:'4bf3400d-a315-4ea4-a2f3-afaca24dc9b9',classLabel:'Classe TEST',
     onClose:payload=>window.__guidedReportClose(payload),
     call:async(action,params)=>{
      window.__teacherActions.push(action);
      if(action==='start'){window.__teacherHasStarted=true;return state()}
      if(action==='status'||action==='resume')return window.__teacherHasStarted?state():{ok:true,active:false};
      if(action==='heartbeat')return {ok:true,active:true};
      return {ok:false,error:'unexpected'};
     }
    });
    window.__lifeController.mount();
   },{page1,config});
   await first.evaluate(()=>window.MathasGuidedBridge.practice());
   await first.locator('#mc-guided-bar').getByRole('button',{name:/Lancer la séance/}).click();
   await first.waitForFunction(()=>window.__teacherHasStarted&&window.MathasGuidedBridge.status().collective);
   assert.equal(departures.length,0);
   await other.goto(origin,{waitUntil:'domcontentloaded'});
   await other.bringToFront();
   await other.waitForTimeout(600);
   assert.equal(departures.length,0,'simple changement d’onglet : pas de fermeture');
   await first.bringToFront();
   assert.equal(departures.length,0);
   await first.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true})));
   assert.equal(departures.length,0,'bfcache : ne pas considérer la page comme détruite');
   await first.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:false})));
   await other.waitForTimeout(100);
   assert.equal(departures.length,1,'pagehide réel (non bfcache) avertit le serveur');
   assert.equal(departures[0].sessionId,'11111111-1111-4111-8111-111111111111');
   assert.match(departures[0].hostId,/^[0-9a-f]{8}-[0-9a-f-]{27}$/i);
   assert.match(departures[0].pageId,/^[0-9a-f]{8}-[0-9a-f-]{27}$/i);
  }finally{await first.close();await other.close()}
 });
 await test('professeur : le bouton Lancer la séance est dans Exercice guidé, comme chez les élèves',async()=>{
  const page=await browser.newPage({viewport:{width:1160,height:850}});
  try{
   await page.goto(origin,{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>!!window.MathasGuidedBridge);
   await page.evaluate(async()=>{
    const {createMultiplicationCollective}=await import('/apps/multiplication-simple/collective-ui.mjs');
    window.__controller=createMultiplicationCollective({
     iframe:{contentDocument:document,contentWindow:window},teacher:true,
     classId:'4bf3400d-a315-4ea4-a2f3-afaca24dc9b9',classLabel:'Classe TEST',
     call:async()=>({ok:true,active:false})
    });
    window.__controller.mount();
   });
   assert.equal(await page.locator('#mc-guided-slot').count(),0);
   await page.locator('#startTraining').click();
   for(const width of [1160,390,320]){
    await page.setViewportSize({width,height:850});
    await page.locator('#mc-guided-bar').getByRole('button',{name:/Lancer la séance/}).waitFor({state:'visible'});
    assert.equal(await page.locator('#mc-guided-bar .mc-guided-class-badge').textContent(),'Classe TEST');
    assert.equal(await page.locator('.mc-guided-launch-row').count(),0);
   }
  }finally{await page.close()}
 });
 await test('élève : aucune recherche au chargement, bouton manuel même sans classe active',async()=>{
  const page=await browser.newPage();
  try{
   await page.goto(origin,{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>!!window.MathasGuidedBridge);
   await page.evaluate(async()=>{
    const {createMultiplicationCollective}=await import('/apps/multiplication-simple/collective-ui.mjs');
    window.__statusCalls=0;
    window.__controller=createMultiplicationCollective({
     iframe:{contentDocument:document,contentWindow:window},teacher:false,classId:'4bf3400d-a315-4ea4-a2f3-afaca24dc9b9',classLabel:'Classe TEST',
     call:async()=>{window.__statusCalls++;return {ok:true,active:false}}
    });
    window.__controller.mount();
   });
   await page.waitForTimeout(1100);
   assert.equal(await page.evaluate(()=>window.__statusCalls),0);
   await page.locator('#startTraining').click();
   await page.getByRole('button',{name:'Rejoindre la classe'}).waitFor({state:'visible'});
   const pupilBadge=page.locator('#mc-guided-bar .mc-guided-class-badge');
   assert.equal(await pupilBadge.textContent(),'Classe TEST');
   assert.equal(await pupilBadge.isVisible(),true);
   assert.equal(await page.evaluate(()=>window.__statusCalls),0);
   await page.getByRole('button',{name:'Rejoindre la classe'}).click();
   assert.equal(await page.evaluate(()=>window.__statusCalls),1);
   await page.getByText('Aucune séance collective lancée pour ta classe.').waitFor();
   await page.getByRole('button',{name:'Rejoindre la classe'}).waitFor({state:'visible'});
  }finally{await page.close()}
 });
 await test('élève : suivante libre par défaut, obligatoire bloque, retour possible',async()=>{
  const page=await browser.newPage();
  try{
   await page.goto(origin,{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>!!window.MathasGuidedBridge);
   await page.evaluate(async({page1,page2,config})=>{
    const {createMultiplicationCollective}=await import('/apps/multiplication-simple/collective-ui.mjs');
    window.__classroom={ok:true,active:true,sessionId:'11111111-1111-4111-8111-111111111111',
     revision:1,level:1,carryMethod:'top',multipliers:config.multipliers,
     pages:[page1],pageIndex:0,teacherPageIndex:0,requiredPages:[],allowSkip:true};
    window.__statusCalls=0;
    window.__controller=createMultiplicationCollective({
     iframe:{contentDocument:document,contentWindow:window},teacher:false,
     classId:'4bf3400d-a315-4ea4-a2f3-afaca24dc9b9',classLabel:'Classe TEST',
     call:async()=>{window.__statusCalls++;return window.__classroom}
    });window.__controller.mount();
   },{page1,page2,config});
   await page.locator('#startTraining').click();
   assert.equal(await page.evaluate(()=>window.__statusCalls),0,'pas de polling avant clic');
   await page.locator('#mc-guided-bar').getByRole('button',{name:'Rejoindre la classe'}).click();
   assert.equal(await page.evaluate(()=>window.__statusCalls),1);
   const row=page.locator('#mc-guided-bar .mc-controls').last();
   assert.equal(await row.getByRole('button',{name:/En attente/}).isDisabled(),true);
   await page.evaluate(p=>{window.__classroom={...window.__classroom,revision:2,pages:[...window.__classroom.pages,p],pageIndex:1,teacherPageIndex:1}},page2);
   await page.evaluate(()=>window.__controller.refresh());
   assert.equal(await row.getByRole('button',{name:/Suivant/}).isEnabled(),true);
   await row.getByRole('button',{name:/Suivant/}).click();
   assert.equal(await page.evaluate(()=>window.MathasGuidedBridge.status().pageIndex),1);
   await row.getByRole('button',{name:/Précédente/}).click();
   assert.equal(await page.evaluate(()=>window.MathasGuidedBridge.status().pageIndex),0);
   await page.evaluate(()=>{window.__classroom={...window.__classroom,revision:3,requiredPages:[0]}});
   await page.evaluate(()=>window.__controller.refresh());
   assert.equal(await row.getByRole('button',{name:/Page 1 obligatoire/}).isDisabled(),true);
   await page.evaluate(()=>{window.MathasGuidedBridge.isFinished=i=>i===0});
   await page.evaluate(()=>window.__controller.refresh());
   await row.getByRole('button',{name:/Suivant/}).click();
   assert.equal(await page.evaluate(()=>window.MathasGuidedBridge.status().pageIndex),1);
   await page.getByRole('button',{name:/M’entraîner/}).click();
   assert.equal(await page.evaluate(()=>window.MathasGuidedBridge.status().collective),false);
   await page.getByRole('button',{name:/Rejoindre la classe/}).click();
   assert.equal(await page.evaluate(()=>window.MathasGuidedBridge.status().pageIndex),1);
  }finally{await page.close()}
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
