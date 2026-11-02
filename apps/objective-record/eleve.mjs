import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.95.0';
import {studentHostContract,permanentTrophyCount} from './student-host-contract.mjs';

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
let generation=0,tokenOwner=null,activeApp='',visibleDoc=null,watching=null;
const message=(s)=>{$('status').textContent=s};
const clear=()=>{
  for(const id of ['app-xp','total-xp','level','trophies'])$(id).textContent='—';
  $('gameFrame').hidden=true;$('gameFrame').removeAttribute('src');$('refresh').disabled=true;
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
async function call(endpoint,action,appKey){
 const token=await verifiedToken();
 const controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),12000);
 try{
  const res=await fetch(BASE+'/functions/v1/'+endpoint,{
   method:'POST',signal:controller.signal,
   headers:{apikey:KEY,authorization:'Bearer '+token,'content-type':'application/json'},
   body:JSON.stringify({action,classId,...(appKey?{appKey}:{})})
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
   if(doc===visibleDoc)return;
   visibleDoc=doc;
   const native=inside.contentWindow?.MathasLabV2Update;
   if(typeof native==='function'){
    inside.contentWindow.MathasLabV2Update=function(event){
     native(event);
     if(seq!==generation||!event)return;
     // Only local demonstration: no official ACK, XP, trophy or score written.
     if(event.phase==='ended')message('Partie terminée sur le moteur · enregistrement scolaire en attente de validation serveur. Aucun XP attribué.');
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
 showOfficial({xp,loaded,appKey:activeApp});
 return {loaded,xp};
}
async function choose(){
 generation++;const seq=generation;
 clearInterval(watching);visibleDoc=null;clear();
 const slug=$('app').value;
 if(!Object.hasOwn(GAME_URLS,slug)){message('Jeu inconnu');return;}
 activeApp=GAME_URLS[slug][0];
 try{
  message('Vérification du profil approuvé de la classe TEST…');
  await approvedProfile();
  if(seq!==generation)return;
  message('Lecture des XP globaux et trophées permanents officiels…');
  await refresh(seq);
  if(seq!==generation)return;
  $('gameFrame').src=GAME_URLS[slug][1];
  $('gameFrame').hidden=false;$('refresh').disabled=false;
  watchGame(seq);
  message('Session Connect authentifiée · moteur d’essai affiché · sauvegarde Objectif record non encore activée.');
 }catch(e){
  if(seq!==generation)return;
  clear();
  message('⚠️ '+(e?.message||'Accès indisponible')+'. Jeu non lancé.');
 }
}
$('refresh').addEventListener('click',()=>refresh(generation).then(()=>message('Profil officiel actualisé (lecture seule).')).catch(e=>message('⚠️ '+e.message)));
$('app').addEventListener('change',()=>{const next=new URL(location.href);next.searchParams.set('app',$('app').value);history.replaceState(null,'',next);void choose()});
const requested=params.get('app');
if(requested&&Object.hasOwn(GAME_URLS,requested))$('app').value=requested;
window.addEventListener('pagehide',()=>clearInterval(watching));
void choose();
