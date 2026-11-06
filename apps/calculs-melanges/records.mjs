import {eligible} from './completion-contract.mjs';
const emptyEvidence=()=>({classic:[{},{},{}],sudden:[0,0,0],hard:[0,0,0],threeLives:[0,0,0],hardThreeLives:[0,0,0],thresholds:{sudden:[{},{},{}],hard:[{},{},{}],threeLives:[{},{},{}],hardThreeLives:[{},{},{}]}});
export const empty=()=>({schemaVersion:1,classic:[{},{},{}],sudden:[0,0,0],hard:[0,0,0],threeLives:[0,0,0],hardThreeLives:[0,0,0],eligible:emptyEvidence(),halfEligible:emptyEvidence(),quarterEligible:emptyEvidence(),recordAid:{classic:[{},{},{}],sudden:[null,null,null],hard:[null,null,null],threeLives:[null,null,null],hardThreeLives:[null,null,null]},recent:[]});
export function applyCompletion(state,event){
 const next=structuredClone(state??empty()),i=event.level-1;
 const mode=event.mode==='three-lives'?'threeLives':event.mode==='hard-three-lives'?'hardThreeLives':event.mode;
 if(!next[mode]&&mode!=='classic')next[mode]=[0,0,0];
 if(next.recordAid&&!next.recordAid[mode])next.recordAid[mode]=[null,null,null];
 if(!next.eligible)next.eligible=empty().eligible;
 if(!next.halfEligible)next.halfEligible=emptyEvidence();
 if(!next.quarterEligible)next.quarterEligible=emptyEvidence();
 if(!next.recordAid)next.recordAid=empty().recordAid;
 const prior=event.mode==='classic'?next.classic[i][event.total]:next[mode][i];
 const aidPath=event.mode==='classic'?next.recordAid.classic[i]:next.recordAid[mode];
 const aidKey=event.mode==='classic'?event.total:i;
 if(prior==null||event.score>prior||event.score===prior&&!event.aidUsed)aidPath[aidKey]=event.aidUsed;
 function update(dst,score){if(event.mode==='classic')dst.classic[i][event.total]=Math.max(dst.classic[i][event.total]??0,score);else {if(!dst[mode])dst[mode]=[0,0,0];dst[mode][i]=Math.max(dst[mode][i]??0,score)}}
 update(next,event.score);
 const proof=event.masterMode?null:eligible(event)?next.eligible:event.operationsSelectedAtStart.length===2?next.halfEligible:next.quarterEligible;
 if(proof){
  if(event.mode==='classic')update(proof,event.score);
  else for(const threshold of ['hard','hardThreeLives'].includes(mode)?[3,7]:[5,10])if(event.score>=threshold){update(proof,threshold);if(!proof.thresholds[mode])proof.thresholds[mode]=[{},{},{}];proof.thresholds[mode][i][threshold]=true;}
 }
 next.recent=[event,...(next.recent??[])].slice(0,3);
 return next;
}
