import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.95.0';
import {studentHostContract} from './student-host-contract.mjs';
import {ATOMIC_TEST_APP,isFixedTestApp} from './native-official-record.mjs';
import {createAtomicTestRecorder,isWritableTestApp} from './atomic-test-recorder.mjs';
import {MIXED_TEST_APP,isMixedTestTerminal} from './mixed-test-proof.mjs';
import {createAdditionProofUI} from './certified-addition-ui.mjs';
import {createMultipleProofUI} from './certified-multiple-ui.mjs';
import {createMultiplicationProofUI} from './certified-multiplication-ui.mjs';
import {createCertifiedExtendedUI} from './certified-extended-ui.mjs';
import {installNativeCertifiedLaunch,renderNativeOfficialXp} from './native-connect-bridge.mjs?v=20261104-three-lives-half-xp-v1';
import {schoolProgressSnapshot,schoolModeAllowed,schoolModeLockReason,syncOfficialGameProgress,syncOfficialHardSummary} from './school-official-unlocks.mjs';
import {createProjectionConsent} from '../../projection-consent.mjs';
import {createSchoolScoreView} from './school-score-view.mjs?v=20261104-native-records-v1';
import {installTensFirstDuringGame} from './in-game-tens-first.mjs?v=20261103-leading-carry-amber-v1';
import {officialAdditionRewards} from './official-addition-trophies.mjs';
import {SCHOOL_CLASS_IDS} from './release-routing.mjs';

// Canonical school/test host; the HUB rollout flag controls when real pupils
// see this route. JWT and PostgreSQL proofs remain mandatory even by direct URL.
// Other three written-calculation games remain on their existing school URLs.
const CLASS_TEST='4bf3400d-a315-4ea4-a2f3-afaca24dc9b9';
const SCHOOL_CLASSES=new Set(SCHOOL_CLASS_IDS);
const BASE='https://awmhpfofacaglewammxt.supabase.co';
const KEY='sb_publishable_oI2Pyl3kXzmLkK-CBnw9Nw_66a4fZgM';
const GAME_URLS=Object.freeze({
  'addition-simple':['addition-ecrite-simple','./engines/addition-simple/essai-mode-score-3-vies.html'],
  'addition-multiple':['addition-ecrite-multiple','./engines/addition-multiple/essai-objectif-record-3-vies.html'],
  'soustraction':['soustraction-ecrite-simple','./engines/soustraction/essai-objectif-record-3-vies.html'],
  'multiplication':['multiplication-ecrite-simple','./engines/multiplication/essai-objectif-record-3-vies.html'],
  'melange':['melange-calculs-ecrits','./engines/melange/essai-objectif-record-3-vies.html']
});
const $=id=>document.getElementById(id);
const params=new URL(location.href).searchParams;
const teacher=params.get('joueur')==='prof';
const classId=params.get('class')||'';
// Preserve the authenticated school context when returning to the pupil HUB.
const back=new URL('../../hub.html',location.href);
if(UUID_SAFE_CLASS(classId)){
 back.searchParams.set('class',classId);
 if(teacher)back.searchParams.set('joueur','prof');
}
for(const id of ['bar-home','guest-home'])$(id).href=back.href;
function UUID_SAFE_CLASS(x){return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x)}
const session=createClient(BASE,KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,
 ...(teacher?{storageKey:'mathas-connect-professor-auth-v1'}:{})}});
let generation=0,tokenOwner=null,activeApp='',visibleDoc=null,watching=null,recorder=null,pupilId=null;
let certifiedRun=null,certifiedQueue=null,certifiedSending=false,projectionConsent=null,schoolScoreView=null,latestState=null;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
// Both additions now have an independently graded PostgreSQL proof. Never
// silently fall back to native/browser-declared XP, even in the TEST class.
// Native three-lives, sudden and HARD remain playable without official credits
// until their respective proof contracts are implemented.
const SERVER_PROOF_ADDITIONS=new Set(['addition-ecrite-simple','addition-ecrite-multiple']);
const MULTIPLICATION_PROOF_APP='multiplication-ecrite-simple';
const SERVER_PROOF_APPS=new Set([...SERVER_PROOF_ADDITIONS,MULTIPLICATION_PROOF_APP]);
const nativeRecordAllowed=appKey=>isWritableTestApp(appKey)&&!SERVER_PROOF_ADDITIONS.has(appKey)&&appKey!==MULTIPLICATION_PROOF_APP;

let statusTimer=null,barTimer=null,lastOfficialXp=null,lastOfficialProgress=null;
const bar=$('connect-bar'),handle=$('bar-handle'),xpPanel=$('xp-panel'),challengePanel=$('challenge-panel');
function message(s){
 const status=$('status');
 status.textContent=s;
 clearTimeout(statusTimer);
 const show=/^(⚠|❌|✅|🔐|Partie libre terminée|Partie terminée|Profil officiel actualisé|Résultat conservé)/.test(s);
 status.hidden=!show;
 status.classList.toggle('status-error',/^(⚠|❌)/.test(s));
 if(show)statusTimer=setTimeout(()=>{status.hidden=true},s.startsWith('⚠')?8000:4800);
}
const threshold=l=>l<7?Math.max(0,l)*50:300+(l-6)*100;
function renderMeter(total,level){
 if(!Number.isSafeInteger(total)||!Number.isSafeInteger(level)||level<1)return;
 const start=threshold(level-1),width=threshold(level)-start;
 const earned=Math.max(0,Math.min(width,total-start));
 $('level-xp').textContent=earned+' / '+width+' XP';
 $('level-fill').style.width=(width?100*earned/width:0)+'%';
 const track=$('meter-track');
 track.setAttribute('aria-valuenow',String(earned));
 track.setAttribute('aria-valuemax',String(width));
 $('connect-xp-meter').title='Niveau '+level+' · '+total+' XP au total';
}
function updateBarHeight(){
 if(!bar.hidden)document.documentElement.style.setProperty('--connect-bar-height',bar.offsetHeight+'px');
}
const aPanelOpen=()=>!xpPanel.hidden||!challengePanel.hidden;
function stopBarTimer(){clearTimeout(barTimer);barTimer=null}
function retractBar(){
 if(bar.hidden||aPanelOpen()||bar.contains(document.activeElement))return;
 bar.classList.add('retracted');handle.hidden=false;
}
function scheduleBar(){
 stopBarTimer();
 if(!bar.hidden&&!aPanelOpen())barTimer=setTimeout(retractBar,3200);
}
function revealBar(){
 if(bar.hidden)return;
 bar.classList.remove('retracted');handle.hidden=true;
 updateBarHeight();scheduleBar();
}
function closePanels(){
 xpPanel.hidden=true;challengePanel.hidden=true;
 $('xp-toggle').setAttribute('aria-expanded','false');
 scheduleBar();
}
function showConnectedBar(profile){
 $('connected-name').textContent=String(profile?.displayName||'Élève');
 bar.hidden=false;$('guest-home').hidden=true;
 revealBar();
}
function showXpPanel(){
 if(bar.hidden)return;
 const wasOpen=!xpPanel.hidden;
 closePanels();
 if(!wasOpen){
  xpPanel.hidden=false;
  $('xp-toggle').setAttribute('aria-expanded','true');
  stopBarTimer();revealBar();updateBarHeight();
  void loadXpDetails();
 }
}
function xpRows(){
 const rows=[];
 for(let l=1;l<=3;l++){
  for(const [size,key,points] of [[4,'perfect',22],[10,'pass',30],[10,'bonus',6],[20,'pass',50],[20,'bonus',10]])
   rows.push({key:'classic:'+l+':'+size+':'+key,label:'Classique N'+l+' · '+size+' calculs '+(key==='bonus'?'sans-faute':key==='perfect'?'4/4':'≥80 %'),points});
  for(const n of [5,10])rows.push({key:'sudden:'+l+':'+n,label:'3 vies / Mort subite N'+l+' · '+n+' réussites',points:10});
  for(const n of [3,7])rows.push({key:'hard:'+l+':'+n,label:'HARD N'+l+' · '+n+' réussites',points:10});
 }
 return rows;
}
async function loadXpDetails(){
 const generationAtStart=generation,appAtStart=activeApp;
 const container=$('xp-rows');
 container.replaceChildren();
 const waiting=document.createElement('tr'),cell=document.createElement('td');
 cell.textContent='Chargement du relevé officiel…';waiting.append(cell);container.append(waiting);
 try{
  const data=await call('connect-results','student-xp',appAtStart);
  if(generationAtStart!==generation||appAtStart!==activeApp||xpPanel.hidden)return;
  if(!Array.isArray(data.milestones)||!Array.isArray(data.currentMilestones))throw Error('Relevé détaillé momentanément indisponible');
  const acquired=new Set(data.repeatXp?data.currentMilestones:data.milestones);
  const rows=document.createDocumentFragment();
  for(const entry of xpRows()){
   const tr=document.createElement('tr'),name=document.createElement('td'),points=document.createElement('td');
   const isSurvival=entry.key.startsWith('sudden:')||entry.key.startsWith('hard:');
   const half=isSurvival&&acquired.has(entry.key+':half');
   const full=acquired.has(entry.key)||(isSurvival&&acquired.has(entry.key+':complement'));
   const earned=full||half;
   if(earned)tr.className='is-earned';
   name.textContent=(full?'✓ ':half?'◐ ':'○ ')+entry.label;
   points.textContent=full?'Acquis · '+entry.points+' XP'
    :half?'Acquis · '+Math.floor(entry.points/2)+' / '+entry.points+' XP (3 vies)'
    :'+'+entry.points+' XP';
   tr.append(name,points);rows.append(tr);
  }
  container.replaceChildren(rows);
 }catch(e){
  if(generationAtStart===generation&&!xpPanel.hidden){
   container.replaceChildren();
   const row=document.createElement('tr'),cell=document.createElement('td');
   cell.textContent='Relevé momentanément indisponible. Les XP officiels ne sont pas modifiés.';
   row.append(cell);container.append(row);
  }
 }
}
$('xp-toggle').addEventListener('click',showXpPanel);
$('xp-close').addEventListener('click',closePanels);
$('challenge-close').addEventListener('click',closePanels);
$('certify').addEventListener('click',()=>{if(!$('certify').disabled)closePanels()});
handle.addEventListener('click',()=>{revealBar();bar.focus?.()});
bar.addEventListener('pointerenter',revealBar);
bar.addEventListener('pointerleave',scheduleBar);
bar.addEventListener('focusin',()=>{revealBar();stopBarTimer()});
bar.addEventListener('focusout',scheduleBar);
document.addEventListener('pointermove',event=>{if(event.isTrusted)revealBar()},{passive:true});
document.addEventListener('pointerdown',event=>{if(event.isTrusted)revealBar()},{passive:true});
document.addEventListener('keydown',event=>{
 if(event.key==='Escape'&&aPanelOpen()){closePanels();$('xp-toggle').focus();return}
 if(event.key==='Tab'&&!bar.hidden)revealBar();
});
window.addEventListener('resize',updateBarHeight);

const clear=()=>{
  window.MathasConnectOfficialTrophies=null;window.MathasConnectOfficialState=null;
  for(const id of ['app-xp','level'])$(id).textContent='—';
  $('gameFrame').hidden=true;$('gameFrame').removeAttribute('src');$('refresh').disabled=true;
  $('certified-tools').hidden=true;$('certify').disabled=true;
  bar.hidden=true;handle.hidden=true;$('guest-home').hidden=false;stopBarTimer();closePanels();
  lastOfficialXp=null;lastOfficialProgress=null;window.MathasConnectOfficialSchoolProgress=null;
};
async function verifiedToken(){
 const {data:{session:local}}=await session.auth.getSession();
 if(!local?.access_token||!local.user?.id)throw Error('Session Connect absente');
 const {data:{user},error}=await session.auth.getUser();
 if(error||!user||user.id!==local.user.id||(teacher?user.is_anonymous===true:user.is_anonymous!==true))
  throw Error('Session Connect non reconnue');
 if(tokenOwner&&tokenOwner!==user.id)throw Error('Le profil connecté a changé');
 tokenOwner=user.id;
 return local.access_token;
}
async function call(endpoint,action,appKey,payload={}){
 const token=await verifiedToken();
 const controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),12000);
 try{
  const res=await fetch(BASE+'/functions/v1/'+endpoint,{
   method:'POST',signal:controller.signal,
   headers:{apikey:KEY,authorization:'Bearer '+token,'content-type':'application/json'},
   body:JSON.stringify({action,classId,...(appKey?{appKey}:{}),...payload})
  });
  const body=await res.json().catch(()=>null);
  if(!res.ok||body?.ok!==true)throw Error(body?.error||'connect_unavailable');
  return body;
 }finally{clearTimeout(timeout)}
}
async function approvedProfile(){
 if(classId!==CLASS_TEST&&!SCHOOL_CLASSES.has(classId))throw Error('Classe non autorisée pour ces calculs');
 if(classId!==CLASS_TEST&&!SERVER_PROOF_ADDITIONS.has(activeApp))throw Error('Ce calcul écrit n’est pas encore ouvert aux classes scolaires');
 const profile=await call('connect-api',teacher?'teacher-player':'student-me');
 if(profile.status!=='approved'||profile.classId!==classId)throw Error('Profil Connect non approuvé dans cette classe');
 return profile;
}
function showOfficial({xp,loaded,appKey}){
 const summary=studentHostContract({xp,loaded,appKey});
 if(!summary)throw Error('Réponse du profil officiel incomplète');
 $('app-xp').textContent=String(summary.appXp);
 $('level').textContent=String(summary.level);
 lastOfficialXp=xp;renderMeter(summary.total,summary.level);
 latestState=loaded.state||{};
 window.MathasConnectOfficialState=appKey===MULTIPLICATION_PROOF_APP
  ?{active:true,appKey,state:latestState}:null;
 schoolScoreView?.updateState(latestState);
 if(schoolScoreView)void schoolScoreView.load();
 lastOfficialProgress=classId===CLASS_TEST?null:schoolProgressSnapshot(appKey,loaded.state);
 window.MathasConnectOfficialSchoolProgress=lastOfficialProgress;
 if(SERVER_PROOF_ADDITIONS.has(appKey)){
  // Preserve the additions' already certified trophy validation contract.
  window.MathasConnectOfficialTrophies={
   active:true,appKey,studentId:pupilId,
   rewards:officialAdditionRewards(appKey,loaded.state?.rewards)
  };
 }else if(appKey===MULTIPLICATION_PROOF_APP){
  window.MathasConnectOfficialTrophies={
   active:true,appKey,studentId:pupilId,
   rewards:loaded.state?.rewards??null
  };
 }
}
function hideFictionalXp(doc){
 if(!doc?.head)return;
 // The old LAB XP preview was sometimes injected after the initial style.
 // Physically discard those fake markers, retaining ONLY official Connect XP.
 doc.querySelectorAll('#menuScreen .classic-xp-remaining,#menuScreen .score-mode-detail,#menuScreen .mathas-pilot-remaining')
  .forEach(node=>node.remove());
 let style=doc.getElementById('mathas-school-preview-no-fake-xp');
 if(!style){
  style=doc.createElement('style');
  style.id='mathas-school-preview-no-fake-xp';
  style.textContent='#menuScreen .classic-xp-remaining,#menuScreen .score-mode-detail,#menuScreen .mathas-pilot-remaining{display:none!important}';
  doc.head.append(style);
 }
}
function watchGame(seq){
 clearInterval(watching);
 watching=setInterval(()=>{
  if(seq!==generation){clearInterval(watching);return;}
  try{
   const outer=$('gameFrame').contentDocument;
   const inside=outer?.getElementById('game');
   const doc=inside?.contentDocument;
   if(!doc?.querySelector('#menuScreen'))return;
   for(const surface of [outer,doc]){
    if(surface.__mathasToolbarActivity)continue;
    surface.__mathasToolbarActivity=true;
    surface.addEventListener('pointermove',event=>{if(event.isTrusted)revealBar()},{passive:true});
    surface.addEventListener('pointerdown',event=>{if(event.isTrusted)revealBar()},{passive:true});
    surface.addEventListener('keydown',revealBar);
   }
   const chooser=outer?.getElementById('xp-preview-mode')||outer?.getElementById('xpMode');
   if(chooser&&chooser.value!=='free'){
    chooser.value='free';chooser.dispatchEvent(new Event('change',{bubbles:true}));
   }
   hideFictionalXp(doc);
   renderNativeOfficialXp(doc,activeApp,lastOfficialXp);
   schoolScoreView?.mount(doc);
   installTensFirstDuringGame(doc,activeApp);
   if(lastOfficialProgress){
    syncOfficialGameProgress(doc,lastOfficialProgress);
    syncOfficialHardSummary(doc,lastOfficialProgress);
   }
   const activeProofUI=activeApp===MULTIPLICATION_PROOF_APP?certifiedMulUI:activeApp==='addition-ecrite-multiple'?certifiedMultiUI:certifiedUI;
   const native=inside.contentWindow?.MathasLabV2Update;
   // The menu DOM may exist before the real script has installed its update
   // hook. Never enable certified launch until the native engine is ready.
   if(typeof native!=='function')return;
   activeProofUI.bind(inside.contentWindow,doc);
   installNativeCertifiedLaunch(doc,activeApp,choice=>{
    if(seq!==generation||!pupilId)return;
    if(classId!==CLASS_TEST&&!schoolModeAllowed(lastOfficialProgress,choice.mode,choice.level)){
     message('🔒 '+schoolModeLockReason(choice.mode,choice.level));return;
    }
    // The familiar game buttons now enter the authenticated, server-issued
    // proof. Never accept a native game score as an XP claim.
    if(choice.mode==='classic')void activeProofUI.startNative(choice.level,choice.total);
    else void extendedUI.startNative(choice.mode,choice.level);
   });
   if(doc===visibleDoc)return;
   visibleDoc=doc;
   {
    inside.contentWindow.MathasLabV2Update=function(event){
     native(event);
     if(seq!==generation||!event)return;
     if(activeProofUI.onGameEvent(event))return;
     if(recorder){
      const mixed=activeApp===MIXED_TEST_APP&&isMixedTestTerminal(event);
      const observed=mixed?{...event,
       mixedProof:inside.contentWindow.__mathasMixedTestFinished??null}:event;
      recorder.onSnapshot(observed);
     }
     else if(event.phase==='ended')message(SERVER_PROOF_ADDITIONS.has(activeApp)
      ?'Partie libre terminée : aucun XP officiel. Lance une série vérifiée par le serveur pour enregistrer ton résultat.'
      :'Partie terminée : aucun XP Connect (ce jeu n’est pas encore raccordé).');
    };
   }
  }catch(error){
   console.error('Contrôle du jeu natif : vérification interrompue',error);
   // No fallback to unauthenticated writes if a nested iframe cannot be read.
   clearInterval(watching);
   message('Le moteur est visible, mais son contrôle de recette est indisponible.');
  }
 },400);
}
async function refresh(seq){
 const [loaded,xp]=await Promise.all([
  call('connect-results','student-load',activeApp),
  call('connect-results','student-xp',activeApp)
 ]);
 if(seq!==generation)return;
 if(!UUID.test(loaded?.storageSubject))throw Error('Identité scolaire renvoyée par le serveur absente');
 const linked=loaded.storageSubject.toLowerCase();
 if(pupilId&&pupilId!==linked)throw Error('Le profil élève est différent : reconnexion nécessaire');
 pupilId=linked;
 showOfficial({xp,loaded,appKey:activeApp});
 if(recorder&&!recorder.initialize(loaded))throw Error('Version officielle indisponible');
 return {loaded,xp};
}
const certifiedUI=createAdditionProofUI({
 button:$('certify'),panel:$('certified-tools'),levelSelect:$('certified-level'),totalSelect:$('certified-total'),modeSelect:$('certified-mode'),frame:$('gameFrame'),
 getContext:()=>({generation,activeApp,pupilId,classId,officialProgress:lastOfficialProgress}),
 call:(action,payload)=>call(classId===CLASS_TEST?'connect-objective-record-test':'connect-objective-record-school',action,'addition-ecrite-simple',payload),
 refresh:()=>refresh(generation),notify:message,
 onRecorded:receipt=>{
  if(receipt.appKey===activeApp)void schoolScoreView?.recorded(receipt.eventId);
 }
});
const certifiedMultiUI=createMultipleProofUI({
 button:$('certify'),panel:$('certified-tools'),levelSelect:$('certified-level'),
 totalSelect:$('certified-total'),modeSelect:$('certified-mode'),frame:$('gameFrame'),
 getContext:()=>({generation,activeApp,pupilId,classId,officialProgress:lastOfficialProgress}),
 call:(action,payload)=>call(classId===CLASS_TEST?'connect-objective-record-test':'connect-objective-record-school',action,'addition-ecrite-multiple',payload),
 refresh:()=>refresh(generation),notify:message,
 onRecorded:receipt=>{
  if(receipt.appKey===activeApp)void schoolScoreView?.recorded(receipt.eventId);
 }
});
const certifiedMulUI=createMultiplicationProofUI({
 button:$('certify'),panel:$('certified-tools'),
 levelSelect:$('certified-level'),totalSelect:$('certified-total'),
 modeSelect:$('certified-mode'),frame:$('gameFrame'),
 getContext:()=>({generation,activeApp,pupilId,classId}),
 call:(action,payload)=>call('connect-multiplication-school',action,null,payload),
 refresh:()=>refresh(generation),notify:message
});
// Séries classiques certifiées uniquement ; survie et HARD restent non officiels.
const extendedUI=createCertifiedExtendedUI({
 button:$('certify'),modeSelect:$('certified-mode'),levelSelect:$('certified-level'),
 frame:$('gameFrame'),root:$('extended-certified'),title:$('extended-title'),
 status:$('extended-status'),grid:$('extended-grid'),
 verifyButton:$('extended-verify'),nextButton:$('extended-next'),exitButton:$('extended-exit'),
 getContext:()=>({generation,activeApp,pupilId,classId,officialProgress:lastOfficialProgress}),
 call:(action,app,payload)=>call('connect-objective-record-school',action,app,payload),
 refresh:()=>refresh(generation),notify:message,
 onRecorded:receipt=>{if(receipt.appKey===activeApp)void schoolScoreView?.recorded(receipt.eventId);}
});
function updateCertifiedModeControls(){
 const mode=$('certified-mode').value,classic=mode==='classic',hard=mode.startsWith('hard-');
 const widths=activeApp==='addition-ecrite-multiple'?
   (hard?[9,12,14]:[5,6,7]):
   (hard?[10,12,16]:[3,5,7]);
 for(let l=1;l<=3;l++){
  const option=$('certified-level').querySelector('option[value="'+l+'"]');
  if(option)option.textContent=l+' · '+widths[l-1]+' chiffres';
 }
 $('certified-count-label').hidden=!classic;
 $('certify').textContent=classic?'🔐 Lancer une série vérifiée par le serveur':
  '🔐 Lancer ce défi vérifié par le serveur';
}
$('certified-mode').addEventListener('change',updateCertifiedModeControls);
updateCertifiedModeControls();
async function choose(){
 generation++;const seq=generation;
 clearInterval(watching);visibleDoc=null;recorder=null;pupilId=null;certifiedUI.reset();certifiedMultiUI.reset();certifiedMulUI.reset();extendedUI.reset();
 projectionConsent?.destroy();projectionConsent=null;
 schoolScoreView?.destroy();schoolScoreView=null;latestState=null;clear();
 const slug=$('app').value;
 if(!Object.hasOwn(GAME_URLS,slug)){message('Jeu inconnu');return;}
 activeApp=GAME_URLS[slug][0];
 // Le bandeau rétractable est remplacé, dans les deux additions seulement,
 // par une identité compacte et un bouton XP dans les véritables cartes du jeu.
 document.documentElement.classList.toggle('mathas-native-connect-hud',
  SERVER_PROOF_ADDITIONS.has(activeApp));
 try{
  message('Vérification de l’identité et de la classe Connect…');
  const approved=await approvedProfile();
  if(seq!==generation)return;
  message('Lecture des XP globaux et trophées permanents officiels…');
  const initial=await refresh(seq);
  if(seq!==generation)return;
  showConnectedBar(approved);
  // The public projection board lists a result only after explicit pupil opt-in.
  // Creating this controller does NOT authorize or publish any game result.
  projectionConsent=createProjectionConsent({
   classId,appKey:activeApp,studentKey:pupilId,getToken:verifiedToken
  });
  if(SERVER_PROOF_ADDITIONS.has(activeApp)){
   schoolScoreView=createSchoolScoreView({
    appKey:activeApp,
    fetchHistory:()=>call('connect-projection-v2','student-score-history',activeApp),
    consent:()=>projectionConsent,notify:message
   });
   schoolScoreView.updateState(latestState||initial.loaded?.state||{});
   void schoolScoreView.load();
  }
  if(nativeRecordAllowed(activeApp)){
   recorder=createAtomicTestRecorder({classId,appKey:activeApp,subject:pupilId,storage:localStorage,
    send:request=>call(activeApp===ATOMIC_TEST_APP||activeApp===MIXED_TEST_APP?'connect-results':'connect-objective-record-test','game-record',activeApp,{...request,expectedStudentId:pupilId}),
    reload:()=>refresh(seq),notify:message,isCurrent:()=>seq===generation&&nativeRecordAllowed(activeApp),
    onRecorded:receipt=>{
     if(seq===generation&&receipt.appKey===activeApp)projectionConsent?.offer(receipt.eventId);
    }});
   if(!recorder||!recorder.initialize(initial.loaded))throw Error('Écriture scolaire indisponible');
  }
  if(recorder?.hasPending()&&!await recorder.retry()){
   message('Résultat conservé en attente de réseau : cliquer Actualiser.');$('refresh').disabled=false;return;
  }
  for(const [level,width] of Object.entries(activeApp==='addition-ecrite-multiple'
    ?{1:5,2:6,3:7}:{1:3,2:5,3:7})){
   const option=$('certified-level').querySelector('option[value="'+level+'"]');
   if(option)option.textContent=level+' · '+width+' chiffres';
  }
  if(classId!==CLASS_TEST){
   for(const option of $('app').options)option.disabled=!['addition-simple','addition-multiple'].includes(option.value);
   for(const option of $('certified-mode').options)option.disabled=false;
   $('notice').textContent='Classique, 3 vies, Mort subite et HARD : démarre avec le cadenas Connect pour obtenir les XP, records et trophées vérifiés côté serveur. Dans les pages natives, les parties libres restent sans XP.';
  }else{
   $('certified-mode').value='classic';
   for(const option of $('certified-mode').options)option.disabled=option.value!=='classic';
  }
  updateCertifiedModeControls();
  $('gameFrame').src=GAME_URLS[slug][1]+(SERVER_PROOF_APPS.has(activeApp)?'?connect=1&ui=20261104-multiplication-certified-test-v1':'');
  $('gameFrame').hidden=false;$('refresh').disabled=false;
  watchGame(seq);
  message(activeApp===MULTIPLICATION_PROOF_APP
   ?'Classe TEST : séries classiques Multiplication certifiées par Connect. Les modes 3 vies, Mort subite et HARD restent libres, sans XP officiel.'
   :SERVER_PROOF_ADDITIONS.has(activeApp)
   ?'Profil Connect approuvé · choisis Classique, 3 vies, Mort subite ou HARD puis lance le défi certifié. Les parties natives libres restent sans XP.'
   :recorder?'Classe TEST : calculs autres qu’addition en essai · scores natifs encore en cours de certification, sans ouverture scolaire.'
   :'Session Connect authentifiée · sauvegarde des parties de ce jeu encore désactivée.');
 }catch(e){
  if(seq!==generation)return;
  clear();
  // Un visitor sans profil approuvé garde le moteur natif jouable, sans
  // aucune requête de validation XP ni privilège d'enregistrement.
  // Le repli libre est EXPLICITE pour ne jamais faire croire à un crédit Connect.
  if(SERVER_PROOF_ADDITIONS.has(activeApp)){
   $('gameFrame').src=GAME_URLS[slug][1]+'?connect=1&ui=20261104-three-lives-half-xp-v1';
   $('gameFrame').hidden=false;
   $('guest-home').hidden=true; // le bouton HUB existe dans le moteur lui-même
   message('⚠️ Profil Connect indisponible : mode libre sans XP officiel. '+(e?.message||''));
  }else message('⚠️ '+(e?.message||'Accès indisponible')+'. Jeu non lancé.');
 }
}
$('refresh').addEventListener('click',async()=>{const seq=generation;try{if(extendedUI.hasPending())await extendedUI.retry();else if(certifiedUI.hasPending())await certifiedUI.retry();else if(certifiedMultiUI.hasPending())await certifiedMultiUI.retry();else if(certifiedMulUI.hasPending())await certifiedMulUI.retry();else if(recorder?.hasPending())await recorder.retry();else await refresh(seq);
  if(seq===generation&&!recorder?.hasPending())message('Profil officiel actualisé.');
 }catch(e){if(seq===generation)message('⚠️ '+e.message)}});
$('app').addEventListener('change',()=>{const next=new URL(location.href);next.searchParams.set('app',$('app').value);history.replaceState(null,'',next);void choose()});
const requested=params.get('app');
if(requested&&Object.hasOwn(GAME_URLS,requested))$('app').value=requested;
window.addEventListener('pagehide',()=>{clearInterval(watching);projectionConsent?.destroy();stopBarTimer();clearTimeout(statusTimer)});
void choose();
