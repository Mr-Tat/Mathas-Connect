// Protocole d'envoi transactionnel, activable seulement après déploiement Edge/RPC.
// Aucun polling : lancement manuel, une seule requête en vol, conflit => arrêt sûr.
export function createSync({queue,post,onAck=()=>{},onConflict=()=>{},onError=()=>{}}){
 if(!queue||typeof post!=='function')throw Error('dependencies_required');
 let running=null;
 async function flush(){
  if(running)return running;
  running=(async()=>{
   let accepted=0;
   for(const pending of queue.read()){
    let response;
    try{response=await post(pending)}catch(error){onError(error);break}
    if(!response||response.ok!==true){
     if(response?.status===409||['revision_conflict','stale_reset_epoch'].includes(response?.error)){onConflict(response);break}
     onError(response);break;
    }
    // Seule preuve d'acquittement serveur. Les réponses malformées conservent le résultat.
    if(!Number.isSafeInteger(response.revision)||!Number.isSafeInteger(response.resetEpoch)){onError(new Error('bad_server_ack'));break}
    if(queue.acknowledge(pending.eventId)){accepted++;onAck(pending,response)}
   }
   return {accepted,remaining:queue.count()};
  })().finally(()=>{running=null});
  return running;
 }
 return Object.freeze({flush});
}
