// Consentement explicite pour UN résultat; aucun partage automatique.
// Une sauvegarde de jeu/XP reste indépendante du choix de projection.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const URL='https://awmhpfofacaglewammxt.supabase.co';
const KEY='sb_publishable_oI2Pyl3kXzmLkK-CBnw9Nw_66a4fZgM';
export function createProjectionConsent({classId,appKey,studentKey,getToken,
 storage=localStorage,fetchImpl=fetch,documentRef=document,windowRef=window}){
 if(!UUID.test(classId)||!UUID.test(studentKey)||typeof getToken!=='function')throw Error('invalid_projection_context');
 if(!/^[a-z0-9-]{4,60}$/.test(appKey))throw Error('invalid_projection_app');
 const queueKey='mathas.projection-consents.'+[classId,appKey,studentKey].join('.')+'.v1';
 const read=()=>{try{const v=JSON.parse(storage.getItem(queueKey)||'[]');return Array.isArray(v)?v.filter(x=>UUID.test(x)).slice(0,200):[]}catch{return []}};
 const save=arr=>{try{storage.setItem(queueKey,JSON.stringify(arr.slice(0,200)));return true}catch{return false}};
 // Le dialogue de preuve certifiée Multiplication est au z-index 100000 :
 // le choix explicite Oui/Non doit rester cliquable au-dessus de ce dialogue.
 const css=documentRef.createElement('style');
 css.textContent=`
.mathas-projection-offer{position:fixed!important;inset:0!important;z-index:100010!important;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:clamp(18px,3vh,36px);box-sizing:border-box;width:100vw;height:100dvh;margin:0;padding:clamp(20px,5vw,60px);overflow:auto;background:radial-gradient(circle at 50% 20%,#44326d 0%,#241a40 55%,#100e25 100%);color:#fff;border:0;font:650 clamp(18px,2.6vw,26px)/1.4 system-ui;box-shadow:0 0 0 100vmax #100e25}
.mathas-projection-offer[hidden]{display:none!important}
.mathas-projection-offer h2{margin:0;color:#ffe29a;text-align:center;font-size:clamp(31px,5.7vw,66px);line-height:1.12;text-shadow:0 4px 24px #0008}
.mathas-projection-offer .projection-score{display:block;color:#fff;font-size:clamp(55px,10vw,116px);font-weight:1000;line-height:1;letter-spacing:-.04em;font-variant-numeric:tabular-nums}
.mathas-projection-offer p{max-width:850px;margin:0;text-align:center}
.mathas-projection-offer .actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:clamp(12px,3vw,36px);width:min(860px,100%);margin-top:auto;padding-top:12px}
.mathas-projection-offer button{min-height:clamp(84px,14vh,145px);border-radius:22px;border:3px solid #9e92b5;background:#433656;color:#fff;cursor:pointer;font:1000 clamp(27px,4vw,48px) system-ui;box-shadow:0 9px 0 #111024,0 16px 30px #0008}
.mathas-projection-offer button.yes{background:linear-gradient(165deg,#ffe6a1,#ecb947);color:#2a1a32;border-color:#fff0ba}
.mathas-projection-offer button:focus-visible{outline:5px solid #75dcff;outline-offset:5px}
.mathas-projection-offer button:disabled{opacity:.68;cursor:progress}
.mathas-projection-offer small{display:block;min-height:24px;text-align:center;color:#e1d6ff;font-size:clamp(13px,1.5vw,18px)}
@media(max-width:530px){.mathas-projection-offer{padding:18px}.mathas-projection-offer .actions{gap:10px}.mathas-projection-offer button{border-radius:15px}}
`;
 documentRef.head.append(css);
 const dialog=documentRef.createElement('section');
 dialog.className='mathas-projection-offer';dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');
 dialog.setAttribute('aria-label','Proposer ce résultat au tableau de la classe');dialog.hidden=true;
 const heading=documentRef.createElement('h2');heading.textContent='🏆 Nouveau meilleur score du jour !';
 const score=documentRef.createElement('strong');score.className='projection-score';
 const question=documentRef.createElement('p');
 question.textContent='Veux-tu afficher ton record au tableau de la classe ?';
 const actions=documentRef.createElement('div');actions.className='actions';
 const no=documentRef.createElement('button');no.type='button';no.textContent='NON';
 const yes=documentRef.createElement('button');yes.type='button';yes.className='yes';yes.textContent='OUI !';
 const status=documentRef.createElement('small');status.setAttribute('role','status');
 actions.append(no,yes);dialog.append(heading,score,question,status,actions);documentRef.body.append(dialog);
 let showing=null,flushing=false;const waiting=[],resultListeners=new Set();
 const emit=(eventId,result)=>{for(const fn of resultListeners){try{fn({eventId,result})}catch{/* Le reçu serveur prime. */}}};
 function showNext(){
  if(showing)return;
  if(!waiting.length){dialog.hidden=true;return}
  showing=waiting.shift();status.textContent='';
  const n=showing.points;
  score.textContent=Number.isSafeInteger(n)&&n>=0?n+' points':'Score certifié';
  yes.textContent='OUI !';yes.hidden=false;yes.disabled=false;
  no.textContent='NON';no.disabled=false;
  dialog.hidden=false;no.focus();
 }
 function dismiss(){showing=null;dialog.hidden=true;showNext()}
 async function flush(wanted=null){
  if(flushing)return 'already_pending';
  flushing=true;let result='queued';
  try{for(let i=0;i<200;i++){
   const eventId=read()[0];if(!eventId)break;
   const token=await getToken();
   const response=await fetchImpl(URL+'/functions/v1/connect-projection-v2',{
    method:'POST',cache:'no-store',
    headers:{apikey:KEY,authorization:'Bearer '+token,'content-type':'application/json'},
    body:JSON.stringify({action:'student-share-score',classId,appKey,eventId})});
   const body=await response.json().catch(()=>null);
   if(!response.ok||body?.ok!==true){
    if(['not_improved','score_reset','event_not_found'].includes(body?.error)){
     if(!save(read().filter(v=>v!==eventId)))break;
     if(eventId===wanted)result=body.error;
     emit(eventId,body.error);
     continue;
    }
    if(eventId===wanted)result=body?.error||'network_error';
    break;
   }
   if(!save(read().filter(v=>v!==eventId)))break;
   if(eventId===wanted)result='sent';
   emit(eventId,'sent');
  }}catch{result='network_error'}
  finally{flushing=false}
  return result;
 }
 no.onclick=()=>{if(flushing)return;dismiss()};
 yes.onclick=async()=>{
  if(!showing||flushing)return;
  const eventId=showing.eventId;
  const queued=read();if(!queued.includes(eventId)){queued.push(eventId);if(!save(queued)){
   status.textContent='Impossible de conserver la demande : préviens ton professeur.';return;
  }}
  yes.disabled=true;no.disabled=true;status.textContent='Envoi sécurisé au tableau…';
  const outcome=await flush(eventId);
  if(outcome==='network_error'||outcome==='queued')emit(eventId,'queued');
  yes.disabled=false;no.disabled=false;
  if(!showing||showing.eventId!==eventId)return;
  if(outcome==='sent'){
   status.textContent='✅ Score bien envoyé au tableau !';
   yes.hidden=true;no.textContent='Fermer';
  }else if(outcome==='not_improved'){
   status.textContent='Ce score est déjà dépassé ou égalé sur le tableau.';
   yes.hidden=true;no.textContent='Fermer';
  }else if(outcome==='score_reset'||outcome==='event_not_found'){
   status.textContent='Ce résultat n’est plus publiable. Il reste dans ton historique.';
   yes.hidden=true;no.textContent='Fermer';
  }else{
   status.textContent='Connexion indisponible : envoi conservé et réessayé automatiquement.';
   yes.hidden=true;no.textContent='Fermer';
  }
 };
 const onOnline=()=>{void flush()};
 windowRef.addEventListener('online',onOnline);
 void flush(); // opt-ins explicitly accepted earlier, never ask again
 return Object.freeze({
  offer(eventId,details={}){if(!UUID.test(eventId)||showing?.eventId===eventId||waiting.some(x=>x.eventId===eventId))return false;
   const points=Number(details?.points);
   waiting.push({eventId,points:Number.isSafeInteger(points)&&points>=0?points:null});
   showNext();return true},
  retry:()=>flush(),pending:()=>read().length,
  onResult(fn){if(typeof fn!=='function')return ()=>{};resultListeners.add(fn);return ()=>resultListeners.delete(fn)},
  destroy(){ // Hide old-app offers on a change of pupil/app; keep explicitly opted-in retries.
   showing=null;waiting.length=0;resultListeners.clear();dialog.remove();css.remove();
   windowRef.removeEventListener('online',onOnline);
  }
 });
}
