// Vraie entrée enfant/hôte/jeu V7.0.0. Les endpoints Supabase Auth, XP et
// preuves sont simulés à la frontière HTTP ; AUCUN JWT hébergé n'est testé.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {chromium} from 'playwright';

const CLS='4bf3400d-a315-4ea4-a2f3-afaca24dc9b9';
const AUTH='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const EVENT='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const day=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Brussels'}).format(new Date());
const files={
 '/apps/multiplication-simple/':['../apps/multiplication-simple/index.html','text/html'],
 '/apps/multiplication-simple/index.html':['../apps/multiplication-simple/index.html','text/html'],
 '/apps/multiplication-simple/game-original.html':['../apps/multiplication-simple/game-original.html','text/html'],
 '/apps/multiplication-simple/school-ui.mjs':['../apps/multiplication-simple/school-ui.mjs','text/javascript'],
 '/apps/multiplication-simple/certified-classic.mjs':['../apps/multiplication-simple/certified-classic.mjs','text/javascript'],
 '/apps/multiplication-simple/native-proof-adapter.mjs':['../apps/multiplication-simple/native-proof-adapter.mjs','text/javascript'],
 '/apps/multiplication-simple/native-certified.mjs':['../apps/multiplication-simple/native-certified.mjs','text/javascript'],
 '/apps/multiplication-simple/school-record-eligibility.mjs':['../apps/multiplication-simple/school-record-eligibility.mjs','text/javascript'],
 '/apps/objective-record/native-connect-bridge.mjs':['../apps/objective-record/native-connect-bridge.mjs','text/javascript'],
 '/apps/objective-record/in-game-manual-validation.mjs':['../apps/objective-record/in-game-manual-validation.mjs','text/javascript'],
 '/apps/objective-record/school-score-view.mjs':['../apps/objective-record/school-score-view.mjs','text/javascript'],
 '/projection-consent.mjs':['../projection-consent.mjs','text/javascript']
};
const server=createServer((req,res)=>{
 const entry=files[(req.url||'').split('?')[0]];
 if(!entry){res.writeHead(404);res.end();return}
 res.writeHead(200,{'content-type':entry[1]+'; charset=utf-8'});
 res.end(readFileSync(new URL(entry[0],import.meta.url)));
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true});

async function connectedPage(teacher=false,failFirstFinish=false,cls=CLS){
 const page=await browser.newPage({viewport:{width:390,height:820}});
 // Image par image : ce compteur détecte les bandeaux fugitifs à l'ouverture.
 await page.addInitScript(()=>{
  window.__toolbarVisibleFrames=0;
  window.__toolbarSampledFrames=0;
  function sample(){
   const toolbar=document.getElementById('ce-toolbar');
   if(toolbar){
    window.__toolbarSampledFrames++;
    if(getComputedStyle(toolbar).display!=='none'&&toolbar.getBoundingClientRect().height>0)
     window.__toolbarVisibleFrames++;
   }
   requestAnimationFrame(sample);
  }
  requestAnimationFrame(sample);
 });
 const calls=[],proofCalls=[],projectionCalls=[];
 let state=null,firstFinishFails=failFirstFinish,projectionPublished=false;
 let xp={ok:true,milestones:[],repeatXp:false,parcours:1,total:0,appXp:0,level:1};
 const context={get state(){return state},get xp(){return xp},calls,proofCalls,projectionCalls,page};
 await page.route('https://esm.sh/**',async route=>{
  const session={user:{id:AUTH,is_anonymous:!teacher},access_token:'jwt-fixture-only'};
  const js='export function createClient(){return {auth:{getSession:async()=>({data:{session:'+JSON.stringify(session)+'}})}}}';
  await route.fulfill({status:200,contentType:'application/javascript',body:js});
 });
 await page.route('https://awmhpfofacaglewammxt.supabase.co/functions/v1/**',async route=>{
  const url=route.request().url();
  const b=route.request().postDataJSON();
  calls.push({url:url.split('/').at(-1),action:b?.action});
  if(['student-me','teacher-player','student-load','student-xp',
   'start-classic-v1','finish-classic-v1','student-score-history','student-share-score'].includes(b?.action))
   assert.equal(b.classId,cls,'La classe est liée au contexte Connect.');
  let response={ok:false,error:'unexpected_action'},status=200;
  if(url.endsWith('/connect-api')){
   assert.equal(b.action,teacher?'teacher-player':'student-me');
   response={ok:true,status:'approved',classId:cls,displayName:teacher?'Monsieur T · navigateur':'Élève fictif · navigateur'};
  }else if(url.endsWith('/connect-results')){
   if(b.action==='student-load')
    response={ok:true,revision:state?1:0,resetEpoch:0,state,multiplierLock:[9]};
   else if(b.action==='student-xp')response=xp;
  }else if(url.endsWith('/connect-multiplication-school')){
   proofCalls.push(b);
   if(b.action==='start-classic-v1'){
    response={ok:true,sessionId:EVENT,revision:0,resetEpoch:0,level:1,total:4,
     expiresAt:new Date(Date.now()+3600000).toISOString(),
     questions:Array.from({length:4},(_,i)=>({id:'q'+(i+1),op:'mul',a:'249',m:9,width:3}))};
   }else if(b.action==='finish-classic-v1'){
    assert.equal(b.answers.length,4);
    if(firstFinishFails){
     firstFinishFails=false;status=503;
     response={ok:false,error:'temporary_school_network_failure'};
     await route.fulfill({status,contentType:'application/json',body:JSON.stringify(response)});
     return;
    }
    state={classic:[{'4':4},{},{}],sudden:[0,0,0],hard:[0,0,0],
     progress:{},recent:[{eventId:EVENT,mode:'classic',level:1,score:4,total:4,
      points:16,at:new Date().toISOString()}],
     bestPoints:16,todayBest:{day:day(),points:16},topThree:[16],
     rewards:{version:3,mastery:{4:[true,false,false],10:[false,false,false],20:[false,false,false]},
      sudden:[false,false,false],hardAwards:{bronze:[false,false,false],
       silver:[false,false,false],gold:[false,false,false]},
      scoreOne:{bronze:false,silver:false,gold:false},unlockedGold:false}};
    xp={...xp,appXp:22,total:22,milestones:['classic:1:4:perfect']};
    response={ok:true,proofVerified:true,verifiedScore:4,duplicate:false,state,
     xp:{delta:22,appXp:22,total:22,level:1}};
   }
  }else if(url.endsWith('/connect-projection-v2')){
   if(b.action==='student-score-history'){
    const record=state?.recent?.[0];
    const item=record?{eventId:EVENT,mode:'classic',score:4,total:4,
     points:16,at:record.at}:null;
    response={ok:true,events:item?[item]:[],bestThree:item?[item]:[],
     todayBest:item,boardBest:projectionPublished?16:0};
   }else if(b.action==='student-share-score'){
    projectionCalls.push(b);projectionPublished=true;
    response={ok:true,consentRecorded:true,improved:true,boardBest:16};
   }
  }
  await route.fulfill({status,contentType:'application/json',body:JSON.stringify(response)});
 });
 page.on('pageerror',error=>{context.error=String(error.message)});
 const suffix='?class='+cls+'&requireConnect=1'+(teacher?'&joueur=prof':'');
 await page.goto(origin+'/apps/multiplication-simple/'+suffix,{waitUntil:'domcontentloaded'});
 await page.locator('iframe').waitFor({state:'attached',timeout:18000});
 await page.frameLocator('iframe').locator('#menuScreen').waitFor({state:'attached'});
 return context;
}

async function fillTwoNativeProducts(frame){
 await frame.locator('#calculationsPair .calc-box').first().waitFor({timeout:13000});
 assert.equal(await frame.locator('#calculationsPair .calc-box').count(),2,
  'le moteur natif doit garder deux opérations côte à côte');
 for(const calc of [0,1]){
  for(const [col,digit] of [[0,'1'],[1,'4'],[2,'2'],[3,'2']]){
   const input=frame.locator('#calculationsPair .calc-box[data-calc="'+calc+'"] .answer-input[data-col="'+col+'"]');
   await input.click();
   await frame.locator('#numpad .num-key[data-key="'+digit+'"]').click();
  }
 }
 // Le moteur natif valide automatiquement dès que les deux calculs sont remplis.
 // Un clic inconditionnel ici ferait passer directement à la paire suivante.
 await frame.locator('#primaryBtn').evaluate(async btn=>{
  await new Promise(ok=>setTimeout(ok,350));
  if(btn.textContent.trim()==='Valider')btn.click();
 });
}

async function playFourAttemptsWithoutReceipt(page){
 const frame=page.frameLocator('iframe');
 await frame.locator('.classic-count-btn[data-count="4"]').click();
 await frame.locator('#gameScreen:not(.hidden)').waitFor();
 await fillTwoNativeProducts(frame);
 await frame.locator('#primaryBtn').click();
 await fillTwoNativeProducts(frame);
}

async function playFour(page){
 const frame=page.frameLocator('iframe');
 await frame.locator('.classic-count-btn[data-count="4"]').click({timeout:12000});
 await frame.locator('#gameScreen:not(.hidden)').waitFor({timeout:13000});
 assert.equal(await page.locator('#mathasMultiCertified').count(),0,
  'aucun écran de multiplication de remplacement ne doit apparaître');
 await fillTwoNativeProducts(frame);
 const diagnostic=await frame.locator('#gameScreen').evaluate(el=>({
  button:el.querySelector('#primaryBtn')?.textContent,
  feedback:el.querySelector('#feedback')?.textContent,
  statuses:[...el.querySelectorAll('.calc-box .calc-status')].map(x=>x.textContent),
  answers:[...el.querySelectorAll('.calc-box')].map(b=>[...b.querySelectorAll('.answer-input')]
   .map(x=>({col:x.dataset.col,value:x.value}))),
  products:[...el.querySelectorAll('.calc-box .operation')].map(op=>op.textContent.slice(0,70))
 }));
 assert.match(diagnostic.button,/Calculs suivants/,
  'Deux calculs natifs doivent être validés : '+JSON.stringify(diagnostic));
 await frame.locator('#primaryBtn').click();
 await fillTwoNativeProducts(frame);
 await page.getByText('Série certifiée',{exact:false}).waitFor({timeout:14000});
}

try{
 await test('Connect multiplication: the old toolbar never flashes while the native header mounts',async()=>{
  const {page}=await connectedPage();
  try{
   await page.frameLocator('iframe').locator('#mathas-multi-connect-dock').waitFor({state:'attached',timeout:17000});
   await page.waitForTimeout(300);
   const check=await page.evaluate(()=>({
    visible:window.__toolbarVisibleFrames,
    sampled:window.__toolbarSampledFrames,
    display:getComputedStyle(document.getElementById('ce-toolbar')).display,
    native:!!document.querySelector('iframe')?.contentDocument?.getElementById('mathas-multi-connect-dock')
   }));
   assert.ok(check.sampled>0,'mesurer des images pendant le chargement');
   assert.equal(check.visible,0,'aucune image affichant la barre : '+JSON.stringify(check));
   assert.equal(check.display,'none');
   assert.equal(check.native,true);
   const profile=await page.frameLocator('iframe')
    .locator('#mathas-multi-connect-identity').evaluate(el=>({
     text:el.textContent,
     bullet:getComputedStyle(el,'::before').content,
     color:getComputedStyle(el,'::before').color
    }));
   assert.match(profile.text,/Élève fictif/);
   assert.equal(profile.text.includes('Connecté'),false,'nom sans mention redondante');
   assert.ok(profile.bullet.includes('●'),'point de connexion présent');
   assert.equal(profile.color,'rgb(112, 227, 174)','point de connexion vert');
   const badge=await page.frameLocator('iframe').locator('#mathas-multi-connect-level').evaluate(el=>{
    const css=getComputedStyle(el),digit=el.querySelector('strong'),numberCss=getComputedStyle(digit);
    return {text:el.textContent,number:digit.textContent,color:css.borderTopColor,
     background:css.backgroundImage,font:parseFloat(numberCss.fontSize),
     weight:numberCss.fontWeight,width:el.getBoundingClientRect().width,
     viewport:innerWidth,right:el.getBoundingClientRect().right};
   });
   assert.match(badge.text,/Niveau\s*1/,'niveau réel conservé');
   assert.equal(badge.number,'1');
   assert.equal(badge.color,'rgb(239, 197, 106)','contour doré du badge');
   assert.match(badge.background,/linear-gradient/,'fond bleu dégradé');
   assert.ok(badge.font>=23&&Number(badge.weight)===900,'chiffre dominant');
   assert.ok(badge.width>=75&&badge.right<=badge.viewport+2,
    'le badge Niveau ne déborde pas sur téléphone : '+JSON.stringify(badge));
   await page.frameLocator('iframe').locator('#mathasPointsQuick .mathas-school-share-hint')
    .waitFor({state:'attached',timeout:12000});
   const actions=await page.frameLocator('iframe').locator('#mathasPointsQuick').evaluate(quick=>{
    const card=quick.querySelector('.mathas-points-quick-item--best');
    const hint=card.querySelector('.mathas-school-share-hint');
    const cups=card.querySelector(':scope > .mathas-multi-school-cups');
    const shareRect=hint.getBoundingClientRect(),cupRect=cups?.getBoundingClientRect();
    const trophy=document.getElementById('mathasTrophiesStrip');
    const label=trophy.querySelector('.mathas-trophies-hint');
    return {
     share:hint.textContent,shareBorder:getComputedStyle(hint).borderTopWidth,
     sharePointer:getComputedStyle(hint).pointerEvents,cardRole:card.getAttribute('role'),
     shareRight:shareRect.right,shareWidth:shareRect.width,cardWidth:card.getBoundingClientRect().width,
     cupsLeft:cupRect?.left,shareArrow:getComputedStyle(hint,'::after').content,
     shareArrowGap:getComputedStyle(hint,'::after').marginLeft,
     trophyArrowGap:getComputedStyle(label,'::after').marginLeft,
     challenges:label.textContent.trim(),trophyBorder:getComputedStyle(label).borderTopWidth,
     trophyPointer:getComputedStyle(label).pointerEvents,stripTag:trophy.tagName
    };
   });
   assert.equal(actions.share,'Proposer ce score à la projection');
   assert.equal(actions.shareBorder,'1px');
   assert.equal(actions.sharePointer,'none','le cadre décoratif ne change pas la zone de clic');
   assert.equal(actions.cardRole,'button');
   assert.ok(actions.shareWidth<actions.cardWidth-60,
    'le cadre score doit s arrêter avant les coupes : '+JSON.stringify(actions));
   assert.ok(actions.shareRight<=actions.cupsLeft+2,
    'les coupes doivent être hors du cadre : '+JSON.stringify(actions));
   assert.match(actions.shareArrow,/›/);
   assert.equal(actions.shareArrowGap,'7px');
   assert.equal(actions.trophyArrowGap,'7px');
   assert.equal(actions.challenges,'Voir les défis');
   assert.equal(actions.trophyBorder,'1px');
   assert.equal(actions.trophyPointer,'none');
   assert.equal(actions.stripTag,'BUTTON');
  }finally{await page.close()}
 });
 await test('TEST en ligne: refuse a silently free 4/4 without approved Connect session, including legacy free-mode flag',async()=>{
  const page=await browser.newPage({viewport:{width:390,height:820}});
  const edgeCalls=[];
  try{
   await page.addInitScript(()=>localStorage.setItem('mathas.connect.mode-libre.v1','1'));
   await page.route('https://esm.sh/**',route=>route.fulfill({
    status:200,contentType:'application/javascript',
    body:'export function createClient(){return {auth:{getSession:async()=>({data:{session:null}})}}}'
   }));
   await page.route('https://awmhpfofacaglewammxt.supabase.co/functions/v1/**',route=>{
    edgeCalls.push(route.request().url());
    return route.fulfill({status:401,contentType:'application/json',
     body:JSON.stringify({ok:false,error:'auth_required'})});
   });
   await page.goto(origin+'/apps/multiplication-simple/?class='+CLS+'&requireConnect=1',
    {waitUntil:'domcontentloaded'});
   await page.getByText('Connexion Connect obligatoire pour ce test en ligne',{exact:false})
    .waitFor({timeout:12000});
   assert.equal(await page.locator('iframe').count(),0,'aucune partie libre ne peut démarrer');
   assert.equal(await page.getByRole('button',{name:'Jouer sans synchronisation'}).count(),0,
    'pas de bouton pour contourner le mode scolaire certifié');
   const signIn=page.getByRole('link',{name:'Se connecter avec un élève fictif TEST'});
   await signIn.waitFor({timeout:12000});
   assert.equal(await signIn.count(),1);
   assert.match(await signIn.getAttribute('href'),/lab=1/);
   assert.deepEqual(edgeCalls,[],'aucun appel XP/projection sans élève Connect');
  }finally{await page.close()}
 });

 await test('OFFICIEL: an unapproved school pupil sees a real-class login, never a fictitious TEST link or free 4/4',async()=>{
  const school='71f5f4a5-3f25-4ec7-ac29-c33d2e6b395e';
  const page=await browser.newPage({viewport:{width:390,height:820}});
  try{
   await page.addInitScript(()=>localStorage.setItem('mathas.connect.mode-libre.v1','1'));
   await page.route('https://esm.sh/**',route=>route.fulfill({
    status:200,contentType:'application/javascript',
    body:'export function createClient(){return {auth:{getSession:async()=>({data:{session:null}})}}}'
   }));
   await page.goto(origin+'/apps/multiplication-simple/?class='+school+'&requireConnect=1',
    {waitUntil:'domcontentloaded'});
   await page.getByText('Connexion Connect obligatoire pour les résultats officiels de multiplication',{exact:false})
    .waitFor({timeout:15000});
   assert.equal(await page.locator('iframe').count(),0,'no pupil can earn an unverified school score');
   const login=page.getByRole('link',{name:'Se connecter à ma classe'});
   await login.waitFor();
   const href=new URL(await login.getAttribute('href'));
   assert.equal(href.searchParams.get('class'),school);
   assert.equal(href.searchParams.has('lab'),false,'school pupils are never sent into the fictitious LAB');
   assert.equal(href.searchParams.has('name'),false,'a school launch never calls itself TEST');
   assert.equal(await page.getByRole('button',{name:'Jouer sans synchronisation'}).count(),0);
  }finally{await page.close()}
 });
 await test('OFFICIEL: actual school launcher -> four products -> certified receipt -> XP and opt-in projection',async()=>{
  const school='71f5f4a5-3f25-4ec7-ac29-c33d2e6b395e';
  const {page,proofCalls,projectionCalls,calls}=await connectedPage(false,false,school);
  try{
   assert.equal(await page.evaluate(()=>window.MathasPilotBridge?.mode),'connected');
   await playFour(page);
   assert.deepEqual(proofCalls.map(x=>x.action),['start-classic-v1','finish-classic-v1']);
   assert.ok(calls.some(x=>x.action==='student-xp'));
   await page.waitForFunction(()=>
    document.getElementById('xp-earned-total')?.textContent?.includes('22'),null,{timeout:11000});
   const consent=page.locator('.mathas-projection-offer:not([hidden])');
   await consent.waitFor({timeout:9000});
   assert.equal(projectionCalls.length,0);
   await consent.locator('button.yes').click();
   await consent.getByText('Score bien envoyé au tableau',{exact:false}).waitFor({timeout:9000});
   await page.waitForFunction((school)=>window.localStorage.getItem(
    'mathas.projection-consents.'+school+'.multiplication-ecrite-simple.'+
     'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.v1')==='[]',school,{timeout:9000});
   assert.equal(projectionCalls.length,1);
   assert.equal(projectionCalls[0].classId,school);
   assert.equal(projectionCalls[0].eventId,EVENT);
   assert.equal(projectionCalls[0].appKey,'multiplication-ecrite-simple');
   await page.reload({waitUntil:'domcontentloaded'});
   const scores=page.frameLocator('iframe').locator('#mathasPointsQuick [data-points="daily"]');
   await scores.waitFor({timeout:20000});
   assert.match(await scores.innerText(),/16/,'the certified daily record is restored by Connect');
  }finally{await page.close()}
 });

 await test('TEST student: native button -> challenge -> server receipt -> XP & reload',async()=>{
  const {page,proofCalls,projectionCalls,calls}=await connectedPage();
  try{
   assert.equal(await page.evaluate(()=>window.MathasPilotBridge?.mode),'connected');
   const frame=page.frameLocator('iframe');
   assert.equal(await frame.locator('#menuScreen .classic-count-btn[data-count="4"]').count(),1);
   await playFour(page);
   // Même après un meilleur score certifié, aucune publication automatique.
   const consent=page.locator('.mathas-projection-offer:not([hidden])');
   await consent.waitFor({timeout:9000});
   assert.equal(projectionCalls.length,0,'un résultat certifié seul ne partage aucun score');
   await consent.getByRole('button',{name:'NON'}).click();
   assert.equal(projectionCalls.length,0,'refuser ne transmet aucune donnée');
   assert.equal(await page.locator('.mathas-projection-offer:not([hidden])').count(),0);
   assert.deepEqual(proofCalls.map(x=>x.action),['start-classic-v1','finish-classic-v1']);
   assert.ok(calls.some(x=>x.action==='student-xp'));
   await page.waitForFunction(()=>
     document.getElementById('xp-earned-total')?.textContent?.includes('22'),null,{timeout:11000});
   await frame.locator('#menuBtn').click().catch(()=>{});
   await page.reload({waitUntil:'domcontentloaded'});
   await page.frameLocator('iframe').locator('#mathasPointsQuick [data-points="daily"]')
    .waitFor({timeout:20000});
   const score=await page.frameLocator('iframe').locator('#mathasPointsQuick [data-points="daily"]').innerText();
   assert.match(score,/16/,'native Top du jour reads certified 16 points after reloading');
   assert.equal(await page.evaluate(()=>window.MathasPilotBridge?.mode),'connected');
  }finally{await page.close()}
 });

 await test('TEST student: certified score requires Yes before projection and is sent only once',async()=>{
  const {page,projectionCalls,proofCalls,calls}=await connectedPage();
  try{
   await playFour(page);
   const consent=page.locator('.mathas-projection-offer:not([hidden])');
   await consent.waitFor({timeout:9000});
   assert.equal(projectionCalls.length,0,'aucune projection sans choix de l’élève');
   await consent.locator('button.yes').click();
   await consent.getByText('Score bien envoyé au tableau',{exact:false}).waitFor({timeout:9000});
   await consent.getByRole('button',{name:'Fermer'}).click();
   await page.waitForFunction(()=>!document.querySelector('.mathas-projection-offer:not([hidden])'),
    null,{timeout:9000});
   await page.waitForFunction(()=>window.localStorage.getItem('mathas.projection-consents.'+
    '4bf3400d-a315-4ea4-a2f3-afaca24dc9b9.multiplication-ecrite-simple.'+
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.v1')==='[]',null,{timeout:9000});
   assert.equal(proofCalls.filter(x=>x.action==='finish-classic-v1').length,1);
   assert.equal(projectionCalls.length,1,'une seule requête après Oui');
   assert.deepEqual(projectionCalls[0],{
    action:'student-share-score',classId:CLS,appKey:'multiplication-ecrite-simple',eventId:EVENT
   },'seule la preuve certifiée du jeu et de la classe est envoyée');
   await page.evaluate(()=>window.dispatchEvent(new Event('online')));
   await page.waitForTimeout(150);
   assert.equal(projectionCalls.length,1,'une reconnexion ne publie pas le score deux fois');
   assert.ok(calls.some(x=>x.action==='student-xp'));
  }finally{await page.close()}
 });

 await test('TEST student: network fails after four answers, reload resumes SAME certified session and ACK',async()=>{
  const {page,proofCalls,projectionCalls}=await connectedPage(false,true);
  try{
   await playFourAttemptsWithoutReceipt(page);
   await page.getByText('Preuve sauvegardée',{exact:false}).waitFor({timeout:15000});
   assert.deepEqual(proofCalls.map(x=>x.action),['start-classic-v1','finish-classic-v1']);
   assert.equal(projectionCalls.length,0);
   await page.reload({waitUntil:'domcontentloaded'});
   await page.frameLocator('iframe').locator('.classic-count-btn[data-count="4"]').click();
   await page.getByText('Série certifiée',{exact:false}).waitFor({timeout:18000});
   assert.deepEqual(proofCalls.map(x=>x.action),[
    'start-classic-v1','finish-classic-v1','finish-classic-v1'
   ],'reprise = même sessionId, aucune émission d’un nouveau défi');
   assert.equal(proofCalls.at(-1).sessionId,EVENT);
   assert.equal(projectionCalls.length,0,'aucune projection sans Oui après la reprise');
   await page.waitForFunction(()=>
    document.getElementById('xp-earned-total')?.textContent?.includes('22'),null,{timeout:11000});
  }finally{await page.close()}
 });
 await test('Monsieur T: teacher JWT scope uses the same school-certified multiplication entry',async()=>{
  const {page,proofCalls,calls}=await connectedPage(true);
  try{
   assert.equal(await page.evaluate(()=>window.MathasPilotBridge?.mode),'connected');
   assert.ok(calls.some(x=>x.action==='teacher-player'));
   await page.frameLocator('iframe').locator('.classic-count-btn[data-count="4"]').click();
   await page.frameLocator('iframe').locator('#gameScreen:not(.hidden)').waitFor();
   assert.equal(proofCalls[0].action,'start-classic-v1');
  }finally{await page.close()}
 });
}finally{
 await browser.close();
 await new Promise(resolve=>server.close(resolve));
}
