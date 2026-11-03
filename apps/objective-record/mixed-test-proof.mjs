// TEST-only compatibility journal for the native Mélange engine.
// This is NOT a cryptographic arithmetic proof: never allow real-class release.
export const MIXED_TEST_APP='melange-calculs-ecrits';
const OPS=new Set(['add','sub','mul']);
const num=(v,a,b)=>Number.isSafeInteger(v)&&v>=a&&v<=b;
export function normalizeMixedTestCompletion({appKey,event}={}){
 if(appKey!==MIXED_TEST_APP||!event||typeof event!=='object'||event.hard===true
   ||!['classic','sudden'].includes(event.mode)
   ||event.phase!==(event.mode==='classic'?'finished':'ended')
   ||!num(event.level,1,3)||!num(event.score,0,1000))return null;
 const total=event.mode==='classic'?event.total:null;
 if(event.mode==='classic'&&(![4,10,20].includes(total)||event.score>total))return null;
 if(event.mode==='sudden'&&event.total!=null)return null;
 const proof=event.mixedProof;
 if(!proof||typeof proof!=='object'||proof.mode!==event.mode
   ||proof.level!==event.level||proof.score!==event.score
   ||proof.total!==total||typeof proof.aidUsed!=='boolean'
   ||typeof proof.masterMode!=='boolean'
   ||!Array.isArray(proof.operationsSelectedAtStart)
   ||!Array.isArray(proof.operationsCompleted)||!Array.isArray(proof.firstTry)
   ||proof.operationsSelectedAtStart.length<1||proof.operationsSelectedAtStart.length>3
   ||new Set(proof.operationsSelectedAtStart).size!==proof.operationsSelectedAtStart.length
   ||proof.operationsSelectedAtStart.some(op=>!OPS.has(op))
   ||proof.operationsCompleted.length>1000
   ||proof.operationsCompleted.length!==proof.firstTry.length
   ||proof.operationsCompleted.some(op=>!proof.operationsSelectedAtStart.includes(op))
   ||proof.firstTry.some(x=>typeof x!=='boolean'))return null;
 if(event.mode==='classic'&&(proof.operationsCompleted.length!==total||
    proof.firstTry.filter(Boolean).length!==event.score))return null;
 if(event.mode==='sudden'&&(proof.operationsCompleted.length!==event.score||
    proof.firstTry.some(x=>!x)))return null;
 return Object.freeze({
  schemaVersion:1,mode:event.mode,level:event.level,
  score:event.score,total,points:0,rewards:null,
  operationsSelectedAtStart:[...proof.operationsSelectedAtStart],
  operationsCompleted:[...proof.operationsCompleted],firstTry:[...proof.firstTry],
  aidUsed:proof.aidUsed,masterMode:proof.masterMode
 });
}
export const isMixedTestTerminal=(event)=>
 event?.hard!==true&&(
  event.mode==='classic'&&event.phase==='finished'||
  event.mode==='sudden'&&event.phase==='ended');
