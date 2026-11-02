import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.95.0';

// Pont uniquement pour le laboratoire. Le jeu pedagogique conserve son moteur.
// Le serveur authentifie la fiche TEST et calcule les droits du registre PILOTE.
const TEST='4bf3400d-a315-4ea4-a2f3-afaca24dc9b9';
const URL='https://awmhpfofacaglewammxt.supabase.co';
const KEY='sb_publishable_oI2Pyl3kXzmLkK-CBnw9Nw_66a4fZgM';
const MAP={
  'addition-simple':['addition-ecrite-simple','https://mr-tat.github.io/CE-Addition-simple/essai-mode-score-3-vies.html'],
  'addition-multiple':['addition-ecrite-multiple','https://mr-tat.github.io/addition-ecrite-multiple/essai-objectif-record-3-vies.html'],
  'soustraction':['soustraction-ecrite-simple','https://mr-tat.github.io/soustraction-ecrite/essai-objectif-record-3-vies.html'],
  'multiplication':['multiplication-ecrite-simple','https://mr-tat.github.io/Multiplication-simple/essai-objectif-record-3-vies.html'],
  'melange':['melange-calculs-ecrits','https://mr-tat.github.io/Melange-calculs-ecrits-1/essai-objectif-record-3-vies.html']
};
const $=id=>document.getElementById(id);
const teacher=new URL(location.href).searchParams.get('joueur')==='prof';
const sb=createClient(URL,KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,
  ...(teacher?{storageKey:'mathas-connect-professor-auth-v1'}:{})}});
let studentId=null,activeSlug='',activeApp='',generation=0,snapshot=null,startId=null,lastRecording=false;
let previousRunning=false,observedDoc=null,observedWin=null,observer=null,settle=null;
let lastProjectionKey='',projectionInFlight=false;
let pilotRights=null,loadSequence=0;
window.MathasPilotState=null;
const status=(message)=>{$('status').textContent=message};
const pilotError=e=>{status('⚠️ '+(e?.message||e))};
async function api(action,data={}){
 const {data:{session}}=await sb.auth.getSession();
 if(!session?.access_token)throw Error('Session Connect absente. Ouvre d’abord le HUB de la classe TEST et approuve cet appareil.');
 if(!session.user)throw Error('Identité Connect indisponible');
 const r=await fetch(URL+'/functions/v1/connect-record-pilot',{method:'POST',
   headers:{apikey:KEY,authorization:'Bearer '+session.access_token,'content-type':'application/json'},
   body:JSON.stringify({action,appKey:activeApp,classId:TEST,expectedStudentId:studentId,...data})});
 const answer=await r.json().catch(()=>({}));
 if(!r.ok||!answer.ok)throw Error(answer.error||'API pilote indisponible ('+r.status+')');
 return answer;
}
function render(data){
 $('xp').textContent=String(data.xp??0);
 $('best').textContent=String(data.best??0);
 $('trophies').textContent=String(data.trophies?.length??0);
 $('attempts').textContent=String(data.recent?.length??'—');
}
async function refresh(selection={}){
 const requestApp=activeApp,requestGeneration=generation,requestSequence=++loadSequence;
 const d=await api('load',selection);
 if(requestGeneration!==generation||requestApp!==activeApp||requestSequence!==loadSequence)return null;
 if(studentId&&studentId!==d.studentId)throw Error('Le profil actif a changé : recharge la page');
 studentId=d.studentId;
 render(d);
 // Ne jamais garder les droits d'un autre niveau/jeu en cas de réponse incomplète.
 pilotRights=d.rights??null;
 window.MathasPilotState={active:true,app:activeApp,rights:pilotRights,trophies:d.trophies||[]};
 if(observedDoc)renderRights(observedDoc);
 return d;
}
// Affichage à partir des seuls plafonds confirmés par l'API du pilote.
// Le prototype force "Sans connexion" pour éviter ses XP fictifs ; nous ne
// réactivons jamais ses valeurs simulées. Les données restent côté parent.
function renderRights(doc){
 const rights=pilotRights;
 if(!doc?.documentElement)return;
 let style=doc.getElementById('mathas-pilot-rights-style');
 if(!style){
   style=doc.createElement('style');
   style.id='mathas-pilot-rights-style';
   style.textContent=`
     #menuScreen button[data-count] {position:relative!important}
     #menuScreen .mathas-pilot-remaining {position:absolute;bottom:3px;right:5px;
       font:400 10px/1.1 system-ui,sans-serif;color:#e4ddecaa;
       pointer-events:none;white-space:nowrap;z-index:4}
     #menuScreen #startThreeLives .mathas-pilot-remaining,
     #menuScreen #startSudden .mathas-pilot-remaining,
     #menuScreen #suddenBtn .mathas-pilot-remaining {right:54px;bottom:4px;
       font-size:10px;color:#f4e7dcaa}
   `;
   doc.head?.appendChild(style);
 }
 const show=(selector,value)=>{
   for(const button of doc.querySelectorAll(selector)){
     let indicator=button.querySelector('.mathas-pilot-remaining');
     if(!Number.isSafeInteger(value)||value<0){
       indicator?.remove();continue;
     }
     if(!indicator){indicator=doc.createElement('span');indicator.className='mathas-pilot-remaining';button.append(indicator)}
     indicator.textContent='Reste '+value+' XP';
     indicator.setAttribute('aria-label','Reste '+value+' XP pilotes');
   }
 };
 for(const amount of [4,10,20])
   show('#menuScreen button[data-count="'+amount+'"]',
     rights?.classic?.[amount]??null);
 show('#menuScreen #startThreeLives',rights?.threeLives??null);
 show('#menuScreen #startSudden,#menuScreen #suddenBtn',rights?.sudden??null);
}
function operations(doc){
 if(activeSlug!=='melange')return null;
 return ['add','sub','mul'].filter(op=>doc.querySelector('#opsSelector .op-toggle[data-op="'+op+'"]')?.classList.contains('active'));
}
function selection(doc){
 const el=doc.querySelector('#menuScreen #classicMaxDigits')||
   doc.querySelector('#menuScreen #classicLevel')||doc.querySelector('#menuScreen #levelSelect');
 const label=el?.selectedOptions?.[0]?.textContent||'';
 const p=label.match(/(?:Niveau|Niv\.?)\s*([123])/i);
 const v=Number(el?.value);
 const level=p?Number(p[1]):el?.id==='classicMaxDigits'&&v>=2&&v<=4?v-1:v;
 return {level:Number.isInteger(level)&&level>=1&&level<=3?level:1,ops:operations(doc)};
}
function determinePhase(doc,s){
 const end=doc.querySelector('#gameScreen:not(.hidden) #primaryBtn,#gameScreen:not(.hidden) #primaryBtnText,#gameScreen:not(.hidden) #primaryAction');
 const mainIsEnd=!!end&&/Retour au menu/i.test(end.textContent||'');
 const hard=doc.querySelector('#hardGameScreen:not(.hidden) #hardPrimary,#hardGame:not(.hidden) #hardPrimary');
 const hardIsEnd=!!hard&&/Retour au menu HARD/i.test(hard.textContent||'');
 return s?.phase==='ended'||(s?.hard?hardIsEnd:mainIsEnd);
}
let writing=Promise.resolve();
function scheduleRecord(doc){
 if(!snapshot||!startId||lastRecording||!determinePhase(doc,snapshot))return;
 const d=snapshot;
 if(!Number.isSafeInteger(d.score)||!Number.isSafeInteger(d.level)||!d.mode)return;
 const converted=d.hard?'hard-'+(d.mode==='three-lives'?'three-lives':d.mode==='sudden'?'sudden':'classic'):d.mode;
 if(!['classic','sudden','three-lives','hard-classic','hard-sudden','hard-three-lives'].includes(converted))return;
 const ops=activeSlug==='melange'?(d.hard?['add','sub','mul']:(Array.isArray(d.ops)?d.ops:operations(doc))):null;
 if(activeSlug==='melange'&&(!ops||ops.length===0))return;
 const total=converted==='classic'?Number(d.total):null;
 if(converted==='classic'&&![4,10,20].includes(total))return;
 const eventId=startId,seq=generation;
 lastRecording=true;
 status('Partie terminée : enregistrement serveur dans le registre du laboratoire…');
 writing=writing.then(async()=>{
   if(seq!==generation)return;
   const proof={eventId,mode:converted,level:Number(d.level),score:Number(d.score),total,ops,
     phase:d.phase,hearts:d.hearts,completed:d.completed};
   const result=await api('record',proof);
   if(seq!==generation)return;
   $('xp').textContent=String(result.xp);
   $('best').textContent=String(result.best);
   $('trophies').textContent=String(result.trophies?.length||0);
   status((result.duplicate?'Partie déjà enregistrée.':'Partie enregistrée : +'+result.awarded+' XP pilote.')+' Aucun XP scolaire modifié.');
   await refresh(observedDoc?selection(observedDoc):{});
 }).catch(e=>{lastRecording=false;pilotError(e)});
}
function syncObservation(){
 if(!observedDoc)return;
 const doc=observedDoc;
 const game=doc.getElementById('gameScreen');
 const hard=doc.getElementById('hardGameScreen')||doc.getElementById('hardGame');
 const running=!!((game&&!game.classList.contains('hidden')&&!game.hidden)||(hard&&!hard.classList.contains('hidden')&&!hard.hidden));
 if(running&&!previousRunning){
   startId=crypto.randomUUID();lastRecording=false;snapshot=null;
   status('Partie de test en cours. Le serveur enregistrera uniquement la fin.');
 }
 if(!running&&previousRunning){startId=null;snapshot=null;lastRecording=false}
 previousRunning=running;
 if(running)scheduleRecord(doc);
}
function mount(doc,win,seq){
 if(seq!==generation||doc===observedDoc)return;
 const old=win.MathasLabV2Update;
 if(typeof old!=='function')return;
 observer?.disconnect();observedDoc=doc;observedWin=win;previousRunning=false;
 renderRights(doc);
 win.MathasLabV2Update=function(d){
   old(d);
   if(seq!==generation||!d)return;
   snapshot=d;
   syncObservation();
 };
 observer=new MutationObserver(syncObservation);
 observer.observe(doc.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,
   attributeFilter:['class','hidden']});
 syncObservation();
 status('Moteur prêt · les parties terminées seront sauvegardées dans le registre TEST.');
}
function startWatching(seq){
 clearInterval(settle);
 settle=setInterval(()=>{
   if(seq!==generation){clearInterval(settle);return}
   try{
     const outer=$('gameFrame').contentDocument;
     const inner=outer?.getElementById('game');
     const doc=inner?.contentDocument,win=inner?.contentWindow;
     if(!doc||!win||!doc.querySelector('#menuScreen'))return;
     const choice=outer?.getElementById('xp-preview-mode')||outer?.getElementById('xpMode');
     if(choice&&choice.value!=='free'){choice.value='free';choice.dispatchEvent(new Event('change',{bubbles:true}))}
     if(win.MathasLabV2Update&&doc!==observedDoc)mount(doc,win,seq);
     if(doc===observedDoc&&!projectionInFlight){
       renderRights(doc);
       const req=selection(doc),key=JSON.stringify(req);
       if(lastProjectionKey!==key){
         lastProjectionKey=key;pilotRights=null;renderRights(doc);projectionInFlight=true;
         refresh(req).catch(pilotError).finally(()=>{projectionInFlight=false});
       }
     }
   }catch(e){pilotError('Impossible de lire la démo du moteur : '+e.message);clearInterval(settle)}
 },350);
}
async function choose(){
 generation++;const seq=generation;
 observer?.disconnect();observedDoc=null;observedWin=null;snapshot=null;startId=null;
 previousRunning=false;lastRecording=false;lastProjectionKey='';projectionInFlight=false;pilotRights=null;loadSequence++;
 window.MathasPilotState=null;
 clearInterval(settle);
 activeSlug=$('app').value;activeApp=MAP[activeSlug]?.[0]||'';
 $('gameFrame').removeAttribute('src');
 if(!activeApp)return;
 try{
   studentId=null;
   status('Vérification de la session et de la classe TEST…');
   await refresh();
   if(seq!==generation)return;
   status('Compte fictif approuvé : chargement du moteur d’essai…');
   $('gameFrame').src=MAP[activeSlug][1];
   startWatching(seq);
 }catch(e){if(seq===generation)pilotError(e)}
}
$('refresh').addEventListener('click',()=>refresh().then(()=>status('Bilan pilote relu depuis le serveur.')).catch(pilotError));
$('app').addEventListener('change',()=>{const q=new URL(location.href);q.searchParams.set('app',$('app').value);history.replaceState(null,'',q);choose()});
const requested=new URL(location.href).searchParams.get('app');
if(MAP[requested])$('app').value=requested;
choose();
