// Compatibility bridge for the native, existing, ATOMIC Connect game-record
// transaction. This is NOT the final arithmetic-proof contract: do not enable
// for real classes. The session/approved identity and XP rules are server-owned.
// Three-lives needs a separate half-credit transaction; never disguise it as sudden.
export const ATOMIC_TEST_APP='addition-ecrite-multiple';
const int=(v,min,max)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
export function normalizeAtomicTestCompletion({appKey,event,source='native'}={}){
 if(appKey!==ATOMIC_TEST_APP||source!=='native'||!event||typeof event!=='object'
   ||!((event.mode==='classic'&&event.phase==='finished')||(event.mode==='sudden'&&event.phase==='ended'))||event.hard===true
   ||!['classic','sudden'].includes(event.mode)
   ||!int(event.level,1,3)||!int(event.score,0,1000))return null;
 const total=event.mode==='classic'?event.total:null;
 if(event.mode==='classic'&&(![4,10,20].includes(total)||event.score>total))return null;
 if(event.mode==='sudden'&&event.total!=null)return null;
 if(event.completed!=null&&(!int(event.completed,0,1000)||event.completed<event.score
   ||(event.mode==='classic'&&event.completed!==total)))return null;
 return Object.freeze({
  schemaVersion:1,mode:event.mode,level:event.level,
  score:event.score,total,points:0,rewards:null
 });
}
export function acceptNativeRecordAck(response,expectedEventId){
 if(!response||response.ok!==true||!int(response.revision,0,1000000000)
    ||!int(response.resetEpoch,0,1000000000)||!response.xp
    ||!int(response.xp.appXp,0,1000000)||!int(response.xp.total,0,10000000)
    ||!int(response.xp.level,1,1000)||!int(response.xp.delta,-1000000,1000000)
    ||typeof expectedEventId!=='string'||expectedEventId.length!==36)return null;
 return Object.freeze({revision:response.revision,resetEpoch:response.resetEpoch,
  xp:response.xp,duplicate:response.duplicate===true,eventId:expectedEventId});
}
