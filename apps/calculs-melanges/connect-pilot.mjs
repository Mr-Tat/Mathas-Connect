import {normalizeCompletion} from './completion-contract.mjs';
import {createQueue} from './offline-queue.mjs';
import {createSync} from './sync-protocol.mjs';
// Release candidate only: the hosted app and class access remain closed by default.
// Neither a URL parameter nor local storage can enable server-side access.
export const CONNECT_WRITE_READY=true;
// Dependency-injected protocol is also used by the isolated laboratory.
export function createPilot({storage,classId,studentId,pupilId=studentId,post,onStatus=()=>{}}){
 const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
 if(!uuid.test(classId)||!uuid.test(studentId)||!uuid.test(pupilId))throw Error('invalid_identity');
 classId=classId.toLowerCase();studentId=studentId.toLowerCase();pupilId=pupilId.toLowerCase();
 const queue=createQueue(storage,'mathas.calculs-melanges.connect.'+classId+'.'+studentId+'.'+pupilId+'.v1');
 let revision=null,resetEpoch=null;
 const sync=createSync({queue,post,getState:()=>revision===null?null:{revision,resetEpoch},
  onAck:(_,r)=>{revision=r.revision;resetEpoch=r.resetEpoch;onStatus('saved',r.duplicate?{...r,xp:r.xp?{...r.xp,delta:0}:undefined}:r)},
  onConflict:()=>onStatus('conflict'),onError:error=>onStatus([401,403].includes(error?.status)||['missing_session','connect_identity_changed'].includes(error?.message)?'unauthorized':error?.status===400?'rejected':'offline')});
 return Object.freeze({
  initialize(rev,epoch){if(!Number.isSafeInteger(rev)||rev<0||!Number.isSafeInteger(epoch)||epoch<0)throw Error('invalid_revision');revision=rev;resetEpoch=epoch;const count=queue.quarantineEpoch(epoch);if(count)onStatus('quarantined',{count});return true},
  completed(raw){const e=normalizeCompletion(raw);if(!e||revision===null)return false;if(e.expectedResetEpoch!==resetEpoch){onStatus('conflict');return false}
   if(queue.count()>=100){onStatus('queue-full');return false}
   if(!queue.enqueue({...e,action:'game-record',points:0,classId,expectedStudentId:pupilId}))return false;onStatus('pending',{eventId:e.eventId});void sync.flush();return true},
  retry:()=>sync.flush(),pending:()=>queue.count(),quarantined:()=>queue.archivedCount(),
  version:()=>({revision,resetEpoch})
 });
}
export function buildConnectPilot(args){if(!CONNECT_WRITE_READY)throw Error('connect_not_ready');return createPilot(args)}
