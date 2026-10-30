import {eligible} from './completion-contract.mjs';
export const empty=()=>({schemaVersion:1,classic:[{},{},{}],sudden:[0,0,0],hard:[0,0,0],eligible:{classic:[{},{},{}],sudden:[0,0,0],hard:[0,0,0],thresholds:{sudden:[{},{},{}],hard:[{},{},{}]}},recordAid:{classic:[{},{},{}],sudden:[null,null,null],hard:[null,null,null]},recent:[]});
export function applyCompletion(state,event){
 const next=structuredClone(state??empty()),i=event.level-1;
 if(!next.eligible)next.eligible=empty().eligible;
 if(!next.recordAid)next.recordAid=empty().recordAid;
 const prior=event.mode==='classic'?next.classic[i][event.total]:next[event.mode][i];
 const aidPath=event.mode==='classic'?next.recordAid.classic[i]:next.recordAid[event.mode];
 const aidKey=event.mode==='classic'?event.total:i;
 if(prior==null||event.score>prior||event.score===prior&&!event.aidUsed)aidPath[aidKey]=event.aidUsed;
 function update(dst,score){if(event.mode==='classic')dst.classic[i][event.total]=Math.max(dst.classic[i][event.total]??0,score);else dst[event.mode][i]=Math.max(dst[event.mode][i]??0,score)}
 update(next,event.score);
 if(event.mode==='classic'){if(eligible(event))update(next.eligible,event.score)}
 else for(const threshold of event.mode==='hard'?[3,7]:[5,10])if(event.score>=threshold&&eligible(event,threshold)){update(next.eligible,threshold);next.eligible.thresholds[event.mode][i][threshold]=true;}
 next.recent=[event,...(next.recent??[])].slice(0,3);
 return next;
}
