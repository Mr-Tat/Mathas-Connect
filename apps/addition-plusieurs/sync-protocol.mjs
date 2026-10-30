// Protocole d'envoi transactionnel, activable seulement après déploiement Edge/RPC.
// Aucun polling : lancement manuel, une seule requête en vol, conflit => arrêt sûr.
export function createSync({queue,post,onAck=()=>{},onConflict=()=>{},onError=()=>{},getState=()=>null}){
 if(!queue||typeof post!=='function')throw Error('dependencies_required');
 let running=null;
 async function flush(){
  if(running)return running;
  running=(async()=>{
   let accepted=0, revision=null, resetEpoch=null;
   const known=getState();
   if(known&&Number.isSafeInteger(known.revision)&&Number.isSafeInteger(known.resetEpoch)){
     revision=known.revision;resetEpoch=known.resetEpoch;
   }
   // Re-read after each acknowledgment: a second completion can arrive while
   // the first HTTP request is in flight. No polling or overlapping sends.
   let examined=0;
   while(examined<100){
    const pending=queue.read()[0];
    if(!pending)break;
    examined++;
    // Never rebase queued results onto a new teacher-reset parcours.
    if(resetEpoch!==null&&pending.expectedResetEpoch!==resetEpoch){onConflict({ok:false,error:'queued_epoch_mismatch'});break}
    const request=revision===null?pending:{...pending,expectedRevision:revision,expectedResetEpoch:resetEpoch};
    let response;
    try{response=await post(request)}catch(error){onError(error);break}
    if(!response||response.ok!==true){
     if(response?.status===409||['revision_conflict','stale_reset_epoch'].includes(response?.error)){onConflict(response);break}
     onError(response);break;
    }
    // Seule preuve d'acquittement serveur. Les réponses malformées conservent le résultat.
    if(!Number.isSafeInteger(response.revision)||!Number.isSafeInteger(response.resetEpoch)){onError(new Error('bad_server_ack'));break}
    if(response.resetEpoch!==request.expectedResetEpoch||(!response.duplicate&&response.revision!==request.expectedRevision+1)|| (response.duplicate&&response.revision<request.expectedRevision)){onConflict({ok:false,error:'unexpected_server_revision',response});break}
    if(queue.acknowledge(pending.eventId)){accepted++;revision=response.revision;resetEpoch=response.resetEpoch;onAck(pending,response)}
   }
   return {accepted,remaining:queue.count()};
  })().finally(()=>{running=null});
  return running;
 }
 return Object.freeze({flush});
}
