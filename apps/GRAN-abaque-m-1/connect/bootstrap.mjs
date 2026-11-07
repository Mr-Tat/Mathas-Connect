import {createAbaqueQueue} from './offline-queue.mjs';
import {APP_KEY} from './completion-contract.mjs';
import {createXpHints} from '../xp-hints.mjs';
import {paintConnectedAvatar} from '../../objective-record/profile-avatar-badge.mjs?v=20261107-v1';
const BASE='https://awmhpfofacaglewammxt.supabase.co';
const KEY='sb_publishable_oI2Pyl3kXzmLkK-CBnw9Nw_66a4fZgM';
const PILOT='4bf3400d-a315-4ea4-a2f3-afaca24dc9b9';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const integer=value=>Number.isSafeInteger(value)&&value>=0;
const params=new URLSearchParams(location.search);
const enabled=params.get('connect')==='1';
const CLASS=params.get('class')?.toLowerCase();

function element(tag,text,cls){const node=document.createElement(tag);node.textContent=text||'';if(cls)node.className=cls;return node;}
function setInert(value){
 if(value){document.documentElement.dataset.abaqueBlocked='true';for(const dialog of document.querySelectorAll('dialog[open]'))dialog.close();}
 else delete document.documentElement.dataset.abaqueBlocked;
 for(const node of document.body.children)if(node.id!=='abaque-connect-panel'&&node.tagName!=='SCRIPT')node.inert=value;}
function validSnapshot(value,subject,pupil=null){
 const caps={build:20,moves:20,one:20,three:28,five:40,lives:16,sudden:32};
 return value?.ok===true&&value.status==='approved'&&value.ruleset===1&&value.appKey===APP_KEY&&value.classId===CLASS&&value.authSubject===subject&&
  uuid.test(value.studentId)&&(!pupil||value.studentId===pupil)&&integer(value.revision)&&integer(value.resetEpoch)&&
  value.state&&typeof value.state==='object'&&!Array.isArray(value.state)&&Array.isArray(value.trophies)&&
  value.xp?.max===160&&integer(value.xp.appXp)&&value.xp.appXp<=160&&integer(value.xp.total)&&
  Object.entries(caps).every(([kind,cap])=>integer(value.xp.remaining?.[kind])&&value.xp.remaining[kind]<=cap);
}
async function connect(){
 const panel=element('aside','','abaque-connect-panel');panel.id='abaque-connect-panel';
 const label=element('strong','Vérification de la connexion…');
 const dot=element('span','●');dot.setAttribute('aria-hidden','true');dot.style.color='#70e3ae';dot.hidden=true;
 const face=element('span');face.setAttribute('aria-hidden','true');face.hidden=true;
 let chosenAvatar=null;
 const details=element('span');details.setAttribute('role','status');details.setAttribute('aria-live','polite');
 const xp=element('span','','abaque-account-xp');
 const retry=element('button','Réessayer','btn');retry.type='button';retry.hidden=true;
 const demo=element('a','Ouvrir la démo isolée');demo.href='./';
 panel.append(dot,face,label,details,xp,retry,demo);document.body.prepend(panel);setInert(true);
 const nativeModal=window.MATHAS_CELEBRATE.modal;
 window.MATHAS_CELEBRATE.modal=options=>{if(!document.documentElement.dataset.abaqueBlocked)nativeModal(options);};
 if(!uuid.test(CLASS||'')){label.textContent='Classe manquante';details.textContent='Ouvre ce jeu depuis le HUB de ta classe.';return;}
 let client,subject,pupil,queue,latest=null,cacheKey=null,sessionActive=false,sessionVersion=0;
 const cachedBindingKey='mathas.abaque.binding.'+CLASS+'.';
 const hints=createXpHints();
 const homeAccount=document.getElementById('homeConnectAccount');
 const homeAvatar=document.getElementById('homeConnectAvatar');
 const homeName=document.getElementById('homeConnectName');
 const homeXp=document.getElementById('homeConnectXp');
 function hideRemaining(){delete document.documentElement.dataset.abaqueXpApproved;hints.hide();}
 function draw(snapshot,online){
  latest=snapshot;
  const showRemaining=online&&sessionActive&&navigator.onLine;
  if(showRemaining)document.documentElement.dataset.abaqueXpApproved='true';else hideRemaining();
  document.documentElement.dataset.abaqueConnected='true';
  document.documentElement.dataset.abaqueOnline=online?'true':'false';
  if(!online)document.documentElement.dataset.abaqueAttention='true';
  if(homeAccount&&homeName&&homeXp){
   homeAccount.hidden=false;
   homeName.textContent=snapshot.displayName||'Compte Connect';
   homeXp.textContent=online?snapshot.xp.appXp+' / 160 XP acquis · '+snapshot.trophies.length+' / 6 trophées':'Hors connexion · XP en attente';
   paintConnectedAvatar(homeAvatar,chosenAvatar,snapshot.displayName);
  }
  document.querySelector('.demo-notice').textContent=online?(CLASS===PILOT?'Laboratoire connecté · résultats liés à ton compte':'Mode Connect · résultats liés à ton compte'):'Hors connexion · résultats conservés en attente de synchronisation';
  label.textContent=snapshot.displayName||'Compte Connect';
  dot.hidden=false;face.hidden=false;paintConnectedAvatar(face,chosenAvatar,snapshot.displayName);face.style.display='inline-grid';
  xp.textContent=online?snapshot.xp.appXp+' / 160 XP acquis · '+snapshot.trophies.length+' / 6 trophées':'Connexion à confirmer';
  hints.render(snapshot.xp.remaining,showRemaining);
  if(online){
   try{localStorage.setItem(cacheKey,JSON.stringify(snapshot));localStorage.setItem(cachedBindingKey+subject,JSON.stringify({studentId:pupil}));}
   catch{details.textContent='Stockage local indisponible. Garde cette page ouverte et réessaie.';}
  }
 }
 async function token(){
  const session=(await client.auth.getSession()).data?.session;
  if(!sessionActive||!session?.access_token||session.user?.id!==subject)throw Object.assign(Error('identity_changed'),{status:401});
  return session.access_token;
 }
 async function post(body){
  const requestSessionVersion=sessionVersion;
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
  try{
   const bearer=await token();
   const response=await fetch(BASE+'/functions/v1/connect-abaque',{method:'POST',signal:controller.signal,
    headers:{apikey:KEY,authorization:'Bearer '+bearer,'content-type':'application/json'},
    body:JSON.stringify({...body,...(pupil?{expectedStudentId:pupil}:{}),appKey:APP_KEY,classId:CLASS})});
   const value=await response.json().catch(()=>null);
   if(requestSessionVersion!==sessionVersion||!sessionActive)throw Object.assign(Error('identity_changed'),{status:401});
   await token();
   if(!response.ok||value?.ok!==true)throw Object.assign(Error(value?.error||'connection_unavailable'),{status:response.status,code:value?.error});
   if(value.authSubject!==subject)throw Object.assign(Error('identity_changed'),{status:401});
   return value;
  }finally{clearTimeout(timer);}
 }
 function handleState(state,value,event){
  retry.hidden=false;
  if(state!=='saved')document.documentElement.dataset.abaqueAttention='true';
  if(state==='saved'){
   if(!sessionActive){hideRemaining();return;}
   if(!validSnapshot(value,subject,pupil)){hideRemaining();queue.halt();setInert(true);details.textContent='Réponse de synchronisation invalide. Réessaie la connexion.';return;}
   const prior=latest;
   window.MATHAS_PROGRESS.applyServer(value);draw(value,true);
   details.textContent=queue.pending()?'Résultats en cours de synchronisation…':'Résultats enregistrés.';
   if(queue.pending())document.documentElement.dataset.abaqueAttention='true';
   else delete document.documentElement.dataset.abaqueAttention;
   if(queue.pending()<100)setInert(false);
   const celebrated=window.MATHAS_ABAQUE_HIGHLIGHT?.fromServer(prior,value,event);
   if(value.xp.delta>0&&!value.duplicate&&!celebrated)window.MATHAS_CELEBRATE?.toast('+'+value.xp.delta+' XP');
  }else if(state==='pending'){details.textContent='Résultat conservé en attente de synchronisation.';if(queue.pending()>=100){setInert(true);details.textContent='100 résultats en attente. Reconnecte-toi avant une nouvelle partie.';}}
  else if(state==='offline'){hideRemaining();details.textContent='Hors connexion : résultats conservés sur cet appareil.';}
  else if(state==='quarantined')details.textContent='Les résultats antérieurs à la remise à zéro restent archivés et ne seront pas recrédités.';
  else if(state==='conflict'){hideRemaining();setInert(true);details.textContent='Le parcours a changé sur le serveur. Réessaie la connexion avant de continuer.';}
  else if(state==='unauthorized'){hideRemaining();setInert(true);document.documentElement.dataset.abaquePending='true';label.textContent='Session à reconnecter';dot.hidden=true;face.hidden=true;face.style.display='none';xp.textContent='';details.textContent='La session ou l’appareil n’est plus approuvé. Reconnecte-toi depuis le HUB.';}
  else if(state==='rejected'){hideRemaining();setInert(true);details.textContent='Un résultat n’a pas été accepté. Il reste conservé sur cet appareil. Réessaie la connexion.';}
  else if(state==='storage-error'){hideRemaining();setInert(true);details.textContent='Stockage indisponible. Garde cette page ouverte pour réessayer sans perdre le résultat.';}
  else if(state==='queue-full'){setInert(true);details.textContent='100 résultats sont en attente. Reconnecte-toi avant une nouvelle partie.';}
 }
 async function initialize(snapshot,online){
  if(!sessionActive)throw Object.assign(Error('identity_changed'),{status:401});
  if(!validSnapshot(snapshot,subject,pupil))throw Error('invalid_server_snapshot');
  pupil=snapshot.studentId;cacheKey='mathas.abaque.approved.'+[CLASS,subject,pupil].join('.')+'.v1';
  if(!queue)queue=createAbaqueQueue({storage:localStorage,classId:CLASS,authSubject:subject,studentId:pupil,post,onState:handleState});
  const previousEpoch=queue.version().resetEpoch;
  if(previousEpoch!==null&&previousEpoch!==snapshot.resetEpoch){window.MATHAS_ABAQUE_PROOF.cancel();document.getElementById('homeBtn').click();}
  queue.initialize(snapshot.revision,snapshot.resetEpoch);
  if(previousEpoch===null||previousEpoch!==snapshot.resetEpoch)window.MATHAS_PROGRESS.bindConnect({classId:CLASS,authSubject:subject,studentId:pupil},snapshot);
  else window.MATHAS_PROGRESS.applyServer(snapshot);
  window.MATHAS_ABAQUE_PROOF.configure(event=>{
   try{if(queue.enqueue(event))void queue.flush();}
   catch(error){handleState(error.message==='invalid_completion'?'rejected':'storage-error');}
  },()=>queue.version().resetEpoch);
  draw(snapshot,online);delete document.documentElement.dataset.abaquePending;
  if(online&&!queue.pending())delete document.documentElement.dataset.abaqueAttention;
  retry.hidden=false;setInert(false);
  if(online)await queue.flush();
 }
 try{
  const {createClient}=await import('https://esm.sh/@supabase/supabase-js@2.95.0');
  client=createClient(BASE,KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,
   storageKey:params.get('joueur')==='prof'?'mathas-connect-professor-auth-v1':'sb-awmhpfofacaglewammxt-auth-token'}});
  const session=(await client.auth.getSession()).data?.session;
  if(!session?.access_token||!uuid.test(session.user?.id))throw Error('session_missing');
  subject=session.user.id;
  sessionActive=true;
  client.auth.onAuthStateChange((_event,updated)=>{
   if(subject&&(!updated?.access_token||updated.user?.id!==subject)){sessionActive=false;sessionVersion++;queue?.halt();setInert(true);hideRemaining();document.documentElement.dataset.abaquePending='true';label.textContent='Session à reconnecter';dot.hidden=true;face.hidden=true;face.style.display='none';xp.textContent='';details.textContent='La session a changé. Ouvre à nouveau le jeu depuis le HUB.';}
   else if(updated?.user?.id===subject)sessionActive=true;
  });
  retry.onclick=async()=>{
   retry.disabled=true;
   try{await queue?.flush();const loaded=await post({action:'load'});if(pupil&&loaded.studentId!==pupil)throw Error('identity_changed');await initialize(loaded,true);}
   catch(error){hideRemaining();document.documentElement.dataset.abaqueAttention='true';if([401,403,409].includes(error.status)||error.message==='identity_changed'){queue?.halt();setInert(true);document.documentElement.dataset.abaquePending='true';label.textContent='Session à reconnecter';dot.hidden=true;face.hidden=true;face.style.display='none';xp.textContent='';}details.textContent='Connexion indisponible : '+error.message;}
   finally{retry.disabled=false;}
  };
  try{await initialize(await post({action:'load'}),true);}
  catch(error){
   // Cache permits local play only after a prior approved response, never new XP.
   // An explicit refusal does not fall back to the cache.
   if(error.status||!subject)throw error;
   const binding=JSON.parse(localStorage.getItem(cachedBindingKey+subject)||'null');
   if(!uuid.test(binding?.studentId))throw error;
   pupil=binding.studentId;cacheKey='mathas.abaque.approved.'+[CLASS,subject,pupil].join('.')+'.v1';
   const cached=JSON.parse(localStorage.getItem(cacheKey)||'null');await initialize(cached,false);handleState('offline');
  }
  // Lecture facultative de l'avatar officiel : le jeu et ses résultats ne
  // dépendent jamais de ce second appel. Ne persister aucune identité locale.
  void (async()=>{
   try{
    const bearer=await token();
    const action=params.get('joueur')==='prof'?'teacher-player':'student-me';
    const response=await fetch(BASE+'/functions/v1/connect-api',{method:'POST',
     headers:{apikey:KEY,authorization:'Bearer '+bearer,'content-type':'application/json'},
     body:JSON.stringify({action,classId:CLASS})});
    if(!response.ok)return;
    const profile=await response.json();
    if(!profile?.ok||profile.status!=='approved'||profile.classId!==CLASS||!sessionActive)return;
    await token();
    chosenAvatar=profile.avatar??null;
    paintConnectedAvatar(face,chosenAvatar,profile.displayName||latest?.displayName);
    paintConnectedAvatar(homeAvatar,chosenAvatar,profile.displayName||latest?.displayName);
   }catch{/* La fiche avatar n'empêche pas les exercices authentifiés. */}
  })();
  window.addEventListener('online',()=>{if(!retry.disabled)retry.click();});
  window.addEventListener('offline',()=>handleState('offline'));
 }catch(error){label.textContent='Connexion non disponible';details.textContent='Aucun résultat Connect envoyé. '+error.message;retry.hidden=!client;hideRemaining();setInert(true);}
}
if(enabled)void connect();
