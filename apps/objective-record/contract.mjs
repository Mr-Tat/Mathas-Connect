// Candidate contract only. Not wired to any live Edge, SQL, or student profile.
// Client can DISPLAY server-confirmed values but must never mint rewards.
export const VERSION=1;
export const OPERATIONS=Object.freeze(['add','sub','mul']);
export const MODES=Object.freeze(['classic','three-lives','sudden']);
export const COUNTS=Object.freeze([4,10,20]);
const int=n=>Number.isSafeInteger(n)&&n>=0;
export function canonicalOperations(operations, mixed=false){
  if(!mixed)return operations==null||(Array.isArray(operations)&&operations.length===0)?[]:null;
  if(!Array.isArray(operations)||operations.length<1||operations.length>3
     ||new Set(operations).size!==operations.length
     ||operations.some(op=>!OPERATIONS.includes(op)))return null;
  return OPERATIONS.filter(op=>operations.includes(op));
}
/** A nullable, all-or-nothing read model. The caller MUST have verified the
 * Supabase identity, approved enrolment/device, and authenticated Edge response.
 * A missing or stale field hides the entire five-button projection. */
export function confirmedRemaining(response,context){
  if(!context?.approvedSession||!context?.acknowledgedRead||!response||response.ok!==true
     ||response.active!==true||response.version!==VERSION
     ||response.appKey!==context.appKey||!['addition-ecrite-simple','addition-ecrite-multiple',
       'soustraction-ecrite-simple','multiplication-ecrite-simple','melange-calculs-ecrits'].includes(context.appKey)
     ||![1,2,3].includes(context.level)
     ||response.level!==context.level
     ||!int(context.resetEpoch)||response.resetEpoch!==context.resetEpoch
     ||!int(response.rulesetVersion)||!response.rulesetVersion
     ||(context.rulesetVersion!=null&&context.rulesetVersion!==response.rulesetVersion))return null;
  const mixed=context.appKey==='melange-calculs-ecrits';
  const selected=canonicalOperations(context.operations,mixed);
  const reported=canonicalOperations(response.operations,mixed);
  if(selected===null||reported===null||selected.join(',')!==reported.join(','))return null;
  const r=response.remaining;
  if(!r||typeof r!=='object'||Array.isArray(r))return null;
  const keys=['4','10','20','three-lives','sudden'];
  if(keys.some(k=>!int(r[k])||r[k]>100000))return null;
  return Object.freeze(Object.fromEntries(keys.map(k=>[k,r[k]])));
}
/** Server-side reference, never called to credit XP in a browser.
 * The SQL ledger must perform this inside the transaction that consumes proof.
 * 3 vies caps the *same milestone* at floor(full/2); sudden caps at full. */
export function referenceTopUp({full,alreadyCredited,mode}){
  if(!int(full)||!int(alreadyCredited)||full>100000||
     !['three-lives','sudden'].includes(mode))return null;
  const cap=mode==='three-lives'?Math.floor(full/2):full;
  return Object.freeze({cap,delta:Math.max(0,cap-alreadyCredited),
    trophyEligible:mode==='sudden'});
}
/** Structural validation only: a client journal is NOT cryptographic proof of
 * correct arithmetic. The server must still validate app-specific math/rules. */
export function normalizeLifeJournal({steps,level,score,operations}={},mixed=false){
  const selected=canonicalOperations(operations,mixed);
  if(selected===null||![1,2,3].includes(level)||!int(score)
    ||!Array.isArray(steps)||steps.length>1000)return null;
  const seen=new Set();let errors=0,correct=0,ended=false;
  for(const [index,step] of steps.entries()){
    if(!step||typeof step.id!=='string'||step.id.length<1||step.id.length>100
       ||seen.has(step.id)||step.complete!==true||step.validated!==true
       ||typeof step.correct!=='boolean'||typeof step.firstTry!=='boolean'
       ||(mixed&&!selected.includes(step.operation))
       ||(!mixed&&step.operation!=null)
       ||ended)return null;
    seen.add(step.id);
    if(step.correct){if(!step.firstTry)return null;correct++;}
    else{if(step.firstTry)return null;errors++;if(errors===3)ended=true;}
    if(index===steps.length-1&&ended&&step.correct)return null;
  }
  if(score!==correct||errors>3)return null;
  return Object.freeze({score,errors,ended,completed:steps.length,
    operationsSelectedAtStart:Object.freeze([...selected])});
}
/** Comparison policy cannot be guessed: the server passes an explicit,
 * approved choice of unit and rounding; no client-generated ranked score. */
export function referenceRankingPoints(score,mode,policy){
  if(!int(score)||score>1000||!MODES.includes(mode)
    ||policy?.comparabilityApproved!==true
    ||policy.unit!=='correct-calculation'
    ||!['floor','nearest','ceil'].includes(policy.rounding))return null;
  const raw=mode==='sudden'?score*1.2:score;
  return Math[policy.rounding==='nearest'?'round':policy.rounding](raw);
}
