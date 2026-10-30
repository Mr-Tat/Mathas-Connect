import {normalizeRewards} from './rewards-contract.mjs';
// Candidate mixed_v1. These proofs are browser observations, not cryptographic attestation.
export const APP_KEY='melange-calculs-ecrits';
const OPS=['add','sub','mul'];
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const int=(v,max)=>Number.isSafeInteger(v)&&v>=0&&v<=max;
export function normalizeCompletion(e){
 if(!e||e.schemaVersion!==1||e.appKey!==APP_KEY||!uuid(e.eventId)||!['classic','sudden','hard'].includes(e.mode)
  ||![1,2,3].includes(e.level)||!int(e.score,1000)||!int(e.expectedRevision,1e9)||!int(e.expectedResetEpoch,1e9)
  ||typeof e.aidUsed!=='boolean'||typeof e.masterMode!=='boolean')return null;
 if(e.mode==='classic'?(![4,10,20].includes(e.total)||e.score>e.total):e.total!==null)return null;
 const selected=e.operationsSelectedAtStart,completed=e.operationsCompleted,first=e.firstTry;
 if(!Array.isArray(selected)||!selected.length||selected.length>3||new Set(selected).size!==selected.length||selected.some(x=>!OPS.includes(x)))return null;
 if(!Array.isArray(completed)||completed.length>1000||completed.some(x=>!selected.includes(x))
  ||!Array.isArray(first)||first.length!==completed.length||first.some(x=>typeof x!=='boolean'))return null;
 if(e.mode==='classic'?(completed.length!==e.total||first.filter(Boolean).length!==e.score):(completed.length!==e.score||first.some(x=>!x)))return null;
 if(e.mode==='hard'&&selected.length!==3)return null;
 return Object.freeze({schemaVersion:1,appKey:APP_KEY,eventId:e.eventId.toLowerCase(),mode:e.mode,level:e.level,score:e.score,total:e.total,
  operationsSelectedAtStart:[...selected],operationsCompleted:[...completed],firstTry:[...first],aidUsed:e.aidUsed,masterMode:e.masterMode,
  expectedRevision:e.expectedRevision,expectedResetEpoch:e.expectedResetEpoch,...(normalizeRewards(e.rewards)?{rewards:normalizeRewards(e.rewards)}:{})});
}
export function eligible(e,threshold=null){
 if(e.masterMode||e.operationsSelectedAtStart.length!==3)return false;
 const completed=threshold===null?e.operationsCompleted:e.operationsCompleted.slice(0,threshold);
 return new Set(completed).size>=2;
}
