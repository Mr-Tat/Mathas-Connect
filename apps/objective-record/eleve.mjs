import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.95.0';
import {studentHostContract,permanentTrophyCount} from './student-host-contract.mjs';
import {ATOMIC_TEST_APP,isFixedTestApp} from './native-official-record.mjs';
import {createAtomicTestRecorder,isWritableTestApp} from './atomic-test-recorder.mjs';
import {MIXED_TEST_APP,isMixedTestTerminal} from './mixed-test-proof.mjs';
import {createAdditionProofUI} from './certified-addition-ui.mjs';
import {createMultipleProofUI} from './certified-multiple-ui.mjs';
import {createProjectionConsent} from '../../projection-consent.mjs';

// This is the future SCHOOL launcher, not the legacy pilot XP writer.
// Its current release gate is TEST-only and READ-ONLY until a verified
// atomic challenge/session/XP/trophy transaction is deployed.
const CLASS_TEST='4bf3400d-a315-4ea4-a2f3-afaca24dc9b9';
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
const session=createClient(BASE,KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,
 ...(teacher?{storageKey:'mathas-connect-professor-auth-v1'}:{})}});
let generation=0,tokenOwner=null,activeApp='',visibleDoc=null,watching=null,recorder=null,pupilId=null;
let certifiedRun=null,certifiedQueue=null,certifiedSending=false,projectionConsent=null;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
// Both additions now have an independently graded PostgreSQL proof. Never
// silently fall back to native/browser-declared XP, even in the TEST class.
// Native three-lives, sudden and HARD remain playable without official credits
// until their respective proof contracts are implemented.
const SERVER_PROOF_ADDITIONS=new Set(['addition-ecrite-simple','addition-ecrite-multiple']);
const nativeRecordAllowed=appKey=>isWritableTestApp(appKey)&&!SERVER_PROOF_ADDITIONS.has(appKey);
const message=(s)=>{$('status').textContent=s};
const clear=()=>{
  for(const id of ['app-xp','total-xp','level','trophies'])$(id).textContent='—';
  $('gameFrame').hidden=true;$('gameFrame').removeAttribute('src');$('refresh').disabled=true;
  $('certified-tools').hidden=true;$('certify').disabled=true;
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
 if(classId!==CLASS_TEST)throw Error('Version candidate réservée à la classe TEST');
 const profile=await call('connect-api',teacher?'teacher-player':'student-me');
 if(profile.status!=='approved'||profile.classId!==classId)throw Error('Profil TEST non approuvé');
 return profile;
}
function showOfficial({xp,loaded,appKey}){
 const summary=studentHostContract({xp,loaded,appKey});
 if(!summary)throw Error('Réponse du profil officiel incomplète');
 $('app-xp').textContent=String(summary.appXp);
 $('total-xp').textContent=String(summary.total);
 $('level').textContent=String(summary.level);
 $('trophies').textContent=permanentTrophyCount(loaded.state?.rewards) ?? '—';
}
function hideFictionalXp(doc){
 if(!doc?.head)return;
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
   const chooser=outer?.getElementById('xp-preview-mode')||outer?.getElementById('xpMode');
   if(chooser&&chooser.value!=='free'){
    chooser.value='free';chooser.dispatchEvent(new Event('change',{bubbles:true}));
   }
   hideFictionalXp(doc);
   const activeProofUI=activeApp==='addition-ecrite-multiple'?certifiedMultiUI:certifiedUI;
   const native=inside.contentWindow?.MathasLabV2Update;
   // The menu DOM may exist before the real script has installed its update
   // hook. Never enable certified launch until the native engine is ready.
   if(typeof native!=='function')return;
   activeProofUI.bind(inside.contentWindow,doc);
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
  }catch{
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
 button:$('certify'),panel:$('certified-tools'),levelSelect:$('certified-level'),totalSelect:$('certified-total'),frame:$('gameFrame'),
 getContext:()=>({generation,activeApp,pupilId,classId}),
 call:(action,payload)=>call('connect-objective-record-test',action,'addition-ecrite-simple',payload),
 refresh:()=>refresh(generation),notify:message,
 onRecorded:receipt=>{
  if(receipt.appKey===activeApp)projectionConsent?.offer(receipt.eventId);
 }
});
const certifiedMultiUI=createMultipleProofUI({
 button:$('certify'),panel:$('certified-tools'),levelSelect:$('certified-level'),
 totalSelect:$('certified-total'),frame:$('gameFrame'),
 getContext:()=>({generation,activeApp,pupilId,classId}),
 call:(action,payload)=>call('connect-objective-record-test',action,'addition-ecrite-multiple',payload),
 refresh:()=>refresh(generation),notify:message,
 onRecorded:receipt=>{
  if(receipt.appKey===activeApp)projectionConsent?.offer(receipt.eventId);
 }
});
async function choose(){
 generation++;const seq=generation;
 clearInterval(watching);visibleDoc=null;recorder=null;pupilId=null;certifiedUI.reset();certifiedMultiUI.reset();
 projectionConsent?.destroy();projectionConsent=null;clear();
 const slug=$('app').value;
 if(!Object.hasOwn(GAME_URLS,slug)){message('Jeu inconnu');return;}
 activeApp=GAME_URLS[slug][0];
 try{
  message('Vérification du profil approuvé de la classe TEST…');
  await approvedProfile();
  if(seq!==generation)return;
  message('Lecture des XP globaux et trophées permanents officiels…');
  const initial=await refresh(seq);
  if(seq!==generation)return;
  // The public projection board lists a result only after explicit pupil opt-in.
  // Creating this controller does NOT authorize or publish any game result.
  projectionConsent=createProjectionConsent({
   classId,appKey:activeApp,studentKey:pupilId,getToken:verifiedToken
  });
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
  $('gameFrame').src=GAME_URLS[slug][1]+(SERVER_PROOF_ADDITIONS.has(activeApp)?'?connect=1':'');
  $('gameFrame').hidden=false;$('refresh').disabled=false;
  watchGame(seq);
  message(SERVER_PROOF_ADDITIONS.has(activeApp)
   ?'Profil Connect approuvé · lance une série vérifiée pour enregistrer le score, les XP et les trophées de maîtrise. Les autres modes restent libres, sans XP.'
   :recorder?'Classe TEST : calculs autres qu’addition en essai · scores natifs encore en cours de certification, sans ouverture scolaire.'
   :'Session Connect authentifiée · sauvegarde des parties de ce jeu encore désactivée.');
 }catch(e){
  if(seq!==generation)return;
  clear();
  message('⚠️ '+(e?.message||'Accès indisponible')+'. Jeu non lancé.');
 }
}
$('refresh').addEventListener('click',async()=>{const seq=generation;try{if(certifiedUI.hasPending())await certifiedUI.retry();else if(certifiedMultiUI.hasPending())await certifiedMultiUI.retry();else if(recorder?.hasPending())await recorder.retry();else await refresh(seq);
  if(seq===generation&&!recorder?.hasPending())message('Profil officiel actualisé.');
 }catch(e){if(seq===generation)message('⚠️ '+e.message)}});
$('app').addEventListener('change',()=>{const next=new URL(location.href);next.searchParams.set('app',$('app').value);history.replaceState(null,'',next);void choose()});
const requested=params.get('app');
if(requested&&Object.hasOwn(GAME_URLS,requested))$('app').value=requested;
window.addEventListener('pagehide',()=>{clearInterval(watching);projectionConsent?.destroy()});
void choose();
