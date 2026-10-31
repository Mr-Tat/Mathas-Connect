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
 const css=documentRef.createElement('style');
 css.textContent='.mathas-projection-offer{position:fixed;z-index:95000;left:50%;bottom:20px;transform:translateX(-50%);width:min(460px,calc(100vw - 28px));background:#103555;color:#fff;border:2px solid #ffe09b;border-radius:16px;box-shadow:0 9px 44px #000b;padding:15px;font:600 15px system-ui}.mathas-projection-offer p{margin:0 0 12px;line-height:1.4}.mathas-projection-offer .actions{display:flex;justify-content:flex-end;flex-wrap:wrap;gap:9px}.mathas-projection-offer button{border-radius:9px;padding:8px 13px;cursor:pointer;font:700 14px system-ui;border:1px solid #b7cadd;background:#375c7d;color:#fff}.mathas-projection-offer button.yes{background:#ffe09b;color:#1c3552;border-color:#ffe09b}.mathas-projection-offer small{display:block;margin-top:6px;color:#cce6fa}';
 documentRef.head.append(css);
 const dialog=documentRef.createElement('section');
 dialog.className='mathas-projection-offer';dialog.setAttribute('role','group');
 dialog.setAttribute('aria-label','Proposer ce résultat au tableau de la classe');dialog.hidden=true;
 const question=documentRef.createElement('p');
 question.textContent='Veux-tu envoyer ce score au tableau de projection de la classe ?';
 const actions=documentRef.createElement('div');actions.className='actions';
 const no=documentRef.createElement('button');no.type='button';no.textContent='Non, merci';
 const yes=documentRef.createElement('button');yes.type='button';yes.className='yes';yes.textContent='Oui, envoyer';
 const status=documentRef.createElement('small');status.setAttribute('role','status');
 actions.append(no,yes);dialog.append(question,actions,status);documentRef.body.append(dialog);
 let showing=null,flushing=false;const waiting=[];
 function showNext(){if(showing||!waiting.length){dialog.hidden=true;return}
  showing=waiting.shift();status.textContent='';dialog.hidden=false;yes.focus()}
 function dismiss(){showing=null;dialog.hidden=true;showNext()}
 async function flush(){
  if(flushing)return;flushing=true;
  try{for(const eventId of read()){
   const token=await getToken();
   const response=await fetchImpl(URL+'/functions/v1/connect-projection-v2',{
    method:'POST',cache:'no-store',
    headers:{apikey:KEY,authorization:'Bearer '+token,'content-type':'application/json'},
    body:JSON.stringify({action:'student-share-score',classId,appKey,eventId})});
   const body=await response.json().catch(()=>null);
   if(!response.ok||body?.ok!==true)break;
   save(read().filter(v=>v!==eventId));
  }}catch{ /* Offline: keep opted-in event IDs for later retransmission. */ }
  finally{flushing=false}
 }
 no.onclick=()=>dismiss();
 yes.onclick=()=>{
  if(!showing)return;
  const eventId=showing;
  const queued=read();if(!queued.includes(eventId)){queued.push(eventId);save(queued)}
  status.textContent='Envoi sécurisé en cours.';
  dismiss();void flush();
 };
 windowRef.addEventListener('online',()=>{void flush()});
 void flush(); // opt-ins explicitly accepted earlier, never ask again
 return Object.freeze({
  offer(eventId){if(!UUID.test(eventId)||showing===eventId||waiting.includes(eventId))return false;
   waiting.push(eventId);showNext();return true},
  retry:()=>flush(),pending:()=>read().length
 });
}
