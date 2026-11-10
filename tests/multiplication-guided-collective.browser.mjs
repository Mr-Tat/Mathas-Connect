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
const html=original.replace(marker,bridge+
 '\nconst mathasNativeHandlePrimary=handlePrimary;'
 +'\nhandlePrimary=function(...args){if(window.MathasGuidedBridge?.isCollectiveActive()&&phase==="review"){window.MathasGuidedBridge.onContinue?.();return;}return mathasNativeHandlePrimary(...args)};'
 +'\nprimaryBtn.onclick=(event)=>{if(window.MathasGuidedBridge?.isCollectiveActive()&&phase==="review"&&!event?.isTrusted)return;handlePrimary()};');
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
   // Vraie saisie par pavé, conservée en revenant à la page précédente.
   await student.locator('#calculationsPair .calc-box:first-child .answer-input[data-col="0"]').click();
   await student.locator('#numpad .num-key[data-key="9"]').click();
   assert.equal(await student.locator('#calculationsPair .calc-box:first-child .answer-input[data-col="0"]').inputValue(),'9');
   assert.equal(await student.evaluate(()=>window.MathasGuidedBridge.status().finished),false);
   // Le professeur peut ouvrir la page suivante sans avoir résolu la première.
   assert.equal(await prof.evaluate(p=>window.MathasGuidedBridge.show(p,1),page2),true);
   assert.equal(await student.evaluate(()=>window.MathasGuidedBridge.status().pageIndex),0);
   assert.equal(await student.evaluate(p=>window.MathasGuidedBridge.show(p,1),page2),true);
   assert.deepEqual(await read(prof),await read(student));
   await student.evaluate(p=>window.MathasGuidedBridge.show(p,0),page1);
   assert.equal(await student.locator('#calculationsPair .calc-box:first-child .answer-input[data-col="0"]').inputValue(),'9',
    'retour à la page 1 : chiffre saisi auparavant restauré');
  }finally{await prof.close();await student.close()}
 });

 await test('professeur : pages mémorisées, précédentes, obligation et réponses',async()=>{
  const page=await browser.newPage();
  try{
   await page.goto(origin,{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>!!window.MathasGuidedBridge);
   await page.evaluate(async({page1,page2,config})=>{
    const {createMultiplicationCollective}=await import('/apps/multiplication-simple/collective-ui.mjs');
    const state=()=>({ok:true,active:true,sessionId:'11111111-1111-4111-8111-111111111111',
     revision:window.__sharedRevision,level:1,carryMethod:'top',multipliers:config.multipliers,
     pages:window.__sharedPages,pageIndex:window.__sharedIndex,requiredPages:window.__requiredPages,
     updatedAt:new Date().toISOString()});
    window.__sharedPages=[];window.__sharedIndex=0;window.__requiredPages=[];window.__sharedRevision=0;
    window.__controller=createMultiplicationCollective({
     iframe:{contentDocument:document,contentWindow:window},teacher:true,
     classId:'4bf3400d-a315-4ea4-a2f3-afaca24dc9b9',classLabel:'Classe TEST',
     call:async(action,payload)=>{
      if(action==='status'||action==='resume')return window.__sharedPages.length?state():{ok:true,active:false};
      if(action==='start'){window.__sharedPages=[page1];window.__requiredPages=[false];window.__sharedRevision++;return state()}
      if(action==='next'){
       if(window.__sharedIndex===window.__sharedPages.length-1){
        window.__sharedPages.push(page2);window.__requiredPages.push(false);
       }
       window.__sharedIndex++;window.__sharedRevision++;return state();
      }
      if(action==='previous'){window.__sharedIndex--;window.__sharedRevision++;return state()}
      if(action==='set-required'){
       window.__requiredPages[payload.pageIndex]=payload.required;window.__sharedRevision++;return state();
      }
      if(action==='stop'){window.__sharedPages=[];return {ok:true,active:false}}
      return {ok:false,error:'unknown'};
     }
    });
    window.__controller.mount();
   },{page1,page2,config});
   await page.evaluate(()=>window.MathasGuidedBridge.practice());
   const guided=page.locator('#mc-guided-bar');
   await guided.getByRole('button',{name:/Lancer la séance/}).click();
   await page.waitForFunction(()=>window.__sharedPages.length===1&&window.MathasGuidedBridge.status().collective);
   const toolbar=guided.locator('[data-role="teacher"]');
   assert.equal(await page.locator('#mc-guided-slot').count(),0,'le lancement est dans Exercice guidé, pas au menu');
   await toolbar.getByRole('button',{name:/Nouvelle page/}).click();
   assert.equal(await page.evaluate(()=>window.MathasGuidedBridge.status().pageIndex),1);
   assert.equal(await page.evaluate(()=>window.__sharedPages.length),2);
   await toolbar.getByRole('button',{name:/Précédente/}).click();
   assert.equal(await page.evaluate(()=>window.MathasGuidedBridge.status().pageIndex),0);
   await toolbar.getByRole('button',{name:/Page suivante/}).click();
   assert.equal(await page.evaluate(()=>window.MathasGuidedBridge.status().pageIndex),1);
   assert.equal(await page.evaluate(()=>window.__sharedPages.length),2,'la page ouverte est retrouvée, pas régénérée');
   await toolbar.getByRole('button',{name:/Page obligatoire/}).click();
   assert.deepEqual(await page.evaluate(()=>window.__requiredPages),[false,true]);
   assert.equal(await toolbar.getByRole('button',{name:/Page obligatoire/}).getAttribute('aria-pressed'),'true');
   // Une ancienne saisie du professeur ne doit jamais être remplacée par le corrigé.
   await page.evaluate(()=>{
    document.querySelector('#calculationsPair .operation[data-calc="0"] .answer-input[data-col="0"]').value='9';
   });
   const snapshot=()=>page.evaluate(()=>[...document.querySelectorAll('#calculationsPair .answer-input')].map(e=>e.value));
   const before=await snapshot();
   await toolbar.getByRole('button',{name:'Afficher les réponses'}).click();
   await guided.getByRole('button',{name:'Oui'}).click();
   const comparisons=await page.evaluate(()=>[0,1].map(i=>{
    const op=document.querySelector('#calculationsPair .operation[data-calc="'+i+'"]');
    const read=(cls)=>[...op.querySelectorAll(cls)].map(e=>e.textContent).join('');
    const answerInputs=[...op.querySelectorAll('.answer-input')];
    const answerCells=[...op.querySelectorAll('.mc-guided-answer-digit')];
    const reportCells=[...op.querySelectorAll('.mc-guided-report-digit')];
    const offsets=answerCells.map(cell=>{
     const original=answerInputs.find(x=>x.dataset.col===cell.dataset.col);
     const report=reportCells.find(x=>x.dataset.col===cell.dataset.col);
     return {col:cell.dataset.col,
      answerX:cell.getBoundingClientRect().x,originalX:original?.getBoundingClientRect().x,
      reportX:report?.getBoundingClientRect().x};
    });
    return {answer:read('.mc-guided-answer-digit'),reports:read('.mc-guided-report-digit'),offsets,
     carryFont:parseFloat(getComputedStyle(reportCells[0]).fontSize),
     answerFont:parseFloat(getComputedStyle(answerCells[0]).fontSize)};
   }));
   assert.equal(comparisons[0].answer,'1482','247 × 6 : chiffres sur la ligne inférieure');
   assert.equal(comparisons[0].reports,'24','247 × 6 : reports 2 et 4 dans les colonnes correctes');
   assert.equal(comparisons[1].answer,'1112','139 × 8 : chiffres sur la ligne inférieure');
   assert.equal(comparisons[1].reports,'37','139 × 8 : reports 3 et 7 dans les colonnes correctes');
   for(const calc of comparisons){
    assert.ok(calc.carryFont<calc.answerFont,'la ligne de reports est visiblement plus petite');
    for(const c of calc.offsets){
     assert.ok(Math.abs(c.answerX-c.originalX)<3,'résultat aligné sous la case : '+JSON.stringify(c));
     assert.ok(Math.abs(c.reportX-c.originalX)<3,'report aligné sur la même colonne : '+JSON.stringify(c));
    }
   }
   assert.deepEqual(await snapshot(),before,'la comparaison ne doit jamais remplir les champs natifs');
   await toolbar.getByRole('button',{name:'Masquer les réponses'}).click();
   assert.equal(await page.locator('#calculationsPair .mc-guided-answer-overlay').count(),0);
   assert.deepEqual(await snapshot(),before,'masquer doit retrouver exactement la saisie initiale');
   assert.equal(await toolbar.getByRole('button',{name:/Élève au tableau/}).count(),0);
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
     pages:[page1],pageIndex:0,requiredPages:[false],updatedAt:new Date().toISOString()});
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
   await first.getByRole('button',{name:/Lancer la séance/}).click();
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
 await test('professeur et élève : lancement depuis Exercice guidé sur petits écrans',async()=>{
  const page=await browser.newPage({viewport:{width:1160,height:840}});
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
   assert.equal(await page.locator('#mc-guided-slot').count(),0,'aucun raccourci prof externe au guidé');
   await page.locator('#startTraining').click();
   for(const width of [1160,390,320]){
    await page.setViewportSize({width,height:850});
    const launch=page.locator('#mc-guided-bar').getByRole('button',{name:'👥 Lancer la séance'});
    await launch.waitFor({state:'visible'});
    assert.equal(await launch.isVisible(),true);
    const badge=page.locator('#mc-guided-bar .mc-guided-class-badge');
    assert.equal(await badge.textContent(),'Classe TEST');
    assert.equal(await badge.isVisible(),true);
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
 await test('élève arrivant en retard : commence par une page obligatoire non réussie',async()=>{
  const page=await browser.newPage();
  try{
   await page.goto(origin,{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>!!window.MathasGuidedBridge);
   await page.evaluate(async({page1,page2,config})=>{
    const {createMultiplicationCollective}=await import('/apps/multiplication-simple/collective-ui.mjs');
    window.__lateSession={ok:true,active:true,sessionId:'22222222-2222-4222-8222-222222222222',
     revision:1,level:1,carryMethod:'top',multipliers:config.multipliers,
     pages:[page1,page2],pageIndex:1,requiredPages:[true,false]};
    window.__lateController=createMultiplicationCollective({
     iframe:{contentDocument:document,contentWindow:window},teacher:false,
     classId:'4bf3400d-a315-4ea4-a2f3-afaca24dc9b9',classLabel:'Classe TEST',
     call:async()=>window.__lateSession
    });
    window.__lateController.mount();
   },{page1,page2,config});
   await page.evaluate(()=>window.MathasGuidedBridge.practice());
   await page.locator('#mc-guided-bar').getByRole('button',{name:'Rejoindre la classe'}).click();
   assert.equal(await page.evaluate(()=>window.MathasGuidedBridge.status().pageIndex),0,
    'l’élève commence à la première page obligatoire, pas à celle plus avancée du professeur');
   assert.equal(await page.locator('#mc-guided-bar [data-role="student"]').getByRole('button',{name:/Termine la page obligatoire/}).isDisabled(),true);
  }finally{await page.close()}
 });

 await test('élève : avance libre par défaut, page obligatoire et retour arrière',async()=>{
  const page=await browser.newPage();
  try{
   await page.goto(origin,{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>!!window.MathasGuidedBridge);
   await page.evaluate(async({page1,config})=>{
    const {createMultiplicationCollective}=await import('/apps/multiplication-simple/collective-ui.mjs');
    window.__classroom={ok:true,active:true,sessionId:'11111111-1111-4111-8111-111111111111',
     revision:1,level:1,carryMethod:'top',multipliers:config.multipliers,
     pages:[page1],pageIndex:0,requiredPages:[false]};
    window.__statusCalls=0;
    window.__controller=createMultiplicationCollective({
     iframe:{contentDocument:document,contentWindow:window},teacher:false,
     classId:'4bf3400d-a315-4ea4-a2f3-afaca24dc9b9',classLabel:'Classe TEST',
     call:async()=>{window.__statusCalls++;return window.__classroom}
    });
    window.__controller.mount();
   },{page1,config});
   await page.evaluate(()=>window.MathasGuidedBridge.practice());
   assert.equal(await page.evaluate(()=>window.__statusCalls),0,'pas de découverte avant clic élève');
   await page.locator('#mc-guided-bar').getByRole('button',{name:'Rejoindre la classe'}).click();
   assert.equal(await page.evaluate(()=>window.__statusCalls),1);
   const controls=page.locator('#mc-guided-bar [data-role="student"]');
   assert.equal(await controls.getByRole('button',{name:/En attente/}).isDisabled(),true);
   await page.evaluate(p=>{window.__classroom={...window.__classroom,revision:2,
    pages:[...window.__classroom.pages,p],requiredPages:[false,false],pageIndex:1}},page2);
   await page.evaluate(()=>window.__controller.refresh());
   const next=controls.getByRole('button',{name:/Suivant/});
   await next.waitFor({state:'visible'});
   assert.equal(await next.isEnabled(),true,'page ordinaire : on avance sans avoir fini');
   await next.click();
   assert.equal(await page.evaluate(()=>window.MathasGuidedBridge.status().pageIndex),1);
   await controls.getByRole('button',{name:/Précédente/}).click();
   assert.equal(await page.evaluate(()=>window.MathasGuidedBridge.status().pageIndex),0);
   await page.evaluate(()=>{window.__classroom={...window.__classroom,revision:3,requiredPages:[true,false]}});
   await page.evaluate(()=>window.__controller.refresh());
   const locked=controls.getByRole('button',{name:/Termine la page obligatoire/});
   await locked.waitFor({state:'visible'});
   assert.equal(await locked.isDisabled(),true);
   await page.evaluate(()=>{window.MathasGuidedBridge.finishedAt=()=>true});
   await controls.getByRole('button',{name:/Suivant/}).waitFor({state:'visible'});
   await controls.getByRole('button',{name:/Suivant/}).click();
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
