import {APP_KEY,judgeCompletion} from './completion-contract.mjs';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const index=value=>Number.isSafeInteger(value)&&value>=0;
export function createAbaqueQueue({storage,classId,authSubject,studentId,post,onState=()=>{}}){
 if(![classId,authSubject,studentId].every(value=>uuid.test(value))||typeof post!=='function')throw Error('invalid_identity');
 classId=classId.toLowerCase();authSubject=authSubject.toLowerCase();studentId=studentId.toLowerCase();
 const key='mathas.abaque.connect.'+[classId,authSubject,studentId].map(x=>x.toLowerCase()).join('.')+'.v1';
 let pending=[],quarantine=[],revision=null,epoch=null,busy=null,blocked=null;
 try{const saved=JSON.parse(storage.getItem(key)||'null');if(saved){
  if(!Array.isArray(saved.pending)||!Array.isArray(saved.quarantine)||saved.pending.length>100||saved.quarantine.length>100)throw Error('corrupt_queue');
  for(const item of [...saved.pending,...saved.quarantine]){judgeCompletion(item.event);if(!index(item.epoch)||item.event.expectedResetEpoch!==item.epoch)throw Error('corrupt_queue');}
  pending=saved.pending;quarantine=saved.quarantine;
 }}catch(error){throw Error('queue_storage_unavailable',{cause:error});}
 function persist(){try{storage.setItem(key,JSON.stringify({pending,quarantine}));}catch(error){blocked='storage';onState('storage-error');throw Error('queue_storage_unavailable',{cause:error});}}
 function isolate(){quarantine=[...quarantine,...pending].slice(-100);pending=[];persist();}
 async function flush(){
  if(busy)return busy;
  if(revision===null||(blocked&&blocked!=='storage'))return false;
  if(pending.length){try{persist();blocked=null;}catch{return false;}}
  busy=(async()=>{
   while(pending.length&&!blocked){
    const item=pending[0];
    try{
     const ack=await post({action:'record',appKey:APP_KEY,classId,expectedStudentId:studentId,
      revision,resetEpoch:epoch,event:item.event});
     if(ack?.ok!==true||ack.eventId!==item.event.eventId||ack.studentId!==studentId||ack.appKey!==APP_KEY||
      ack.authSubject!==authSubject||ack.resetEpoch!==epoch||!index(ack.revision)||ack.revision<revision||
      (!ack.duplicate&&ack.revision!==revision+1))throw Error('invalid_ack');
     revision=ack.revision;pending.shift();persist();onState('saved',ack);
    }catch(error){
     if([401,403].includes(error.status)||error.code==='identity_binding_conflict')blocked='auth';
     if(error.code==='identity_binding_conflict'){blocked='auth';onState('unauthorized',error);}
     else if(error.status===409){blocked='conflict';onState('conflict',error);}
     else if(error.status===400){blocked='rejected';onState('rejected',error);}
     else onState(blocked==='storage'?'storage-error':blocked?'unauthorized':'offline',error);
     return false;
    }
   }
   return true;
  })().finally(()=>{busy=null});
  return busy;
 }
 return Object.freeze({
  key,
  initialize(nextRevision,nextEpoch){
   if(!index(nextRevision)||!index(nextEpoch)||busy)throw Error('invalid_revision');
   revision=nextRevision;epoch=nextEpoch;blocked=null;
   if(pending.some(item=>item.epoch!==epoch)){isolate();onState('quarantined');}
   return true;
  },
  enqueue(event){
   const judged=judgeCompletion(event);event={...event,eventId:judged.eventId};
   if(event.expectedResetEpoch!==epoch){onState('conflict');return false;}
   if(revision===null||blocked||pending.length>=100){onState(pending.length>=100?'queue-full':'blocked');return false;}
   if(pending.some(item=>item.event.eventId===event.eventId))return false;
   const item={event:structuredClone(event),epoch};pending.push(item);
   persist();
   onState('pending');return true;
  },
  flush,
  halt(){blocked='auth';},
  pending:()=>pending.length,
  quarantined:()=>quarantine.length,
  version:()=>({revision,resetEpoch:epoch}),
 });
}
