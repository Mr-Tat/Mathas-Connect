import {createSimulatedSession} from './simulated-session.mjs';
import {milestones} from './xp-model.mjs';
export function createLocalLab({storage,onStatus}){
 const state={classic:[{},{},{}],sudden:[0,0,0],hard:[0,0,0]};
 let revision=0,points=0;
 const pilot=createSimulatedSession({storage,uuid:()=>crypto.randomUUID(),onStatus,post:async event=>{
  if(event.expectedRevision!==revision)return {ok:false,status:409,error:'revision_conflict'};
  const i=event.level-1;
  if(event.mode==='classic')state.classic[i][event.total]=Math.max(state.classic[i][event.total]??0,event.score);
  if(event.mode==='sudden'||event.mode==='hard')state[event.mode][i]=Math.max(state[event.mode][i],event.score);
  revision++;
  const updated=milestones(state).xp,delta=updated-points;points=updated;
  return {ok:true,revision,resetEpoch:0,xp:{appXp:points,total:points,delta}};
 }});
 return Object.freeze({completed:item=>pilot.completed(item),flush:()=>pilot.flush(),pending:()=>pilot.pending()});
}
