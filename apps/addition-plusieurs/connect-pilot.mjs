// Activation volontairement bloquée tant que le serveur et la recette ne sont pas prêts.
// Pas de persistance Connect ni d'XP tant que ce verrou demeure.
import {normalizeCompletion} from './completion-contract.mjs';
import {createQueue} from './offline-queue.mjs';
import {createSync} from './sync-protocol.mjs';
export const CONNECT_WRITE_READY=false;
export function buildConnectPilot({storage,classId,studentId,post,onStatus=()=>{}}){
 if(!CONNECT_WRITE_READY)throw Error('connect_not_ready');
 if(!/^[0-9a-f-]{36}$/i.test(classId)||!/^[0-9a-f-]{36}$/i.test(studentId))throw Error('invalid_identity');
 const queue=createQueue(storage,'mathas.addition-plusieurs.connect.'+classId+'.'+studentId+'.v1');
 let revision=null,resetEpoch=null;
 const sync=createSync({queue,post,onAck:(_,reply)=>{revision=reply.revision;resetEpoch=reply.resetEpoch;onStatus('saved',reply)},onConflict:()=>onStatus('conflict'),onError:()=>onStatus('offline')});
 return Object.freeze({
  initialize(rev,epoch){if(!Number.isSafeInteger(rev)||!Number.isSafeInteger(epoch)||rev<0||epoch<0)throw Error('invalid_revision');revision=rev;resetEpoch=epoch;},
  completed(entry){
   const event=normalizeCompletion(entry);
   if(!event||revision===null)return false;
   const record={...event,action:'game-record',eventId:crypto.randomUUID(),expectedRevision:revision,expectedResetEpoch:resetEpoch,points:0,classId};
   if(!queue.enqueue(record))return false;
   onStatus('pending');void sync.flush();return true;
  },
  retry(){return sync.flush()},
  pending(){return queue.count()}
 });
}
