import {createSimulatedSession} from './simulated-session.mjs';
import {milestones} from './xp-model.mjs';
const KEY='mathas.addition-plusieurs.lab.simulation.v2';
export function createLocalLab({storage,onStatus}){
 const empty=()=>({classic:[{},{},{}],sudden:[0,0,0],hard:[0,0,0]});
 let saved=null;
 try{saved=JSON.parse(storage.getItem(KEY)||'null')}catch{}
 const valid=saved&&Number.isSafeInteger(saved.revision)&&saved.revision>=0
   &&Array.isArray(saved.state?.classic)&&saved.state.classic.length===3
   &&Array.isArray(saved.state?.sudden)&&saved.state.sudden.length===3
   &&Array.isArray(saved.state?.hard)&&saved.state.hard.length===3
   &&Array.isArray(saved.ids)&&saved.ids.every(x=>typeof x==='string');
 const state=valid?saved.state:empty();
 let revision=valid?saved.revision:0,points=milestones(state).xp;
 const ids=valid?saved.ids.slice(-100):[];
 const pilot=createSimulatedSession({storage,initialRevision:revision,uuid:()=>crypto.randomUUID(),onStatus,post:async event=>{
  // Simulate idempotent backend: an ack lost after commit cannot earn XP again.
  if(ids.includes(event.eventId))return {ok:true,duplicate:true,revision,resetEpoch:0,xp:{appXp:points,total:points,delta:0}};
  if(event.expectedRevision!==revision||event.expectedResetEpoch!==0)return {ok:false,status:409,error:'revision_conflict'};
  const i=event.level-1;
  if(event.mode==='classic')state.classic[i][event.total]=Math.max(state.classic[i][event.total]??0,event.score);
  if(event.mode==='sudden'||event.mode==='hard')state[event.mode][i]=Math.max(state[event.mode][i],event.score);
  revision++;
  const updated=milestones(state).xp,delta=updated-points;points=updated;
  ids.push(event.eventId);if(ids.length>100)ids.shift();
  storage.setItem(KEY,JSON.stringify({state,revision,ids}));
  return {ok:true,revision,resetEpoch:0,xp:{appXp:points,total:points,delta}};
 }});
 return Object.freeze({completed:item=>pilot.completed(item),flush:()=>pilot.flush(),pending:()=>pilot.pending()});
}
