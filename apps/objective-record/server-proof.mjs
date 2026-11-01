// Server-side research reference, NOT an exposed RPC or connected Edge handler.
// Only pass a session loaded from a trusted private server store. Never accept
// questions, identity, mode, rights, or score from a browser as trusted inputs.
// Terminal numerical answers do NOT yet establish the native borrow/carry method.
import {canonicalOperations} from './contract.mjs';
const APPS={
 'addition-ecrite-simple':'add','addition-ecrite-multiple':'add',
 'soustraction-ecrite-simple':'sub','multiplication-ecrite-simple':'mul',
 'melange-calculs-ecrits':null
};
const integer=n=>Number.isSafeInteger(n)&&n>=0;
const keys=(x,allowed)=>x&&typeof x==='object'&&!Array.isArray(x)
 &&Object.keys(x).every(k=>allowed.includes(k));
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
/** 
 * Validate a FINISHED transcript against pre-issued, backend-owned questions.
 * Returns a candidate server evidence record, or null on any ambiguity.
 * No client score/correctness/firstTry flag is accepted.
 *
 * Session lifecycle, identity, expiry, permissions, teacher epoch, and
 * question issuance are obligations of the future trusted Edge implementation.
 * Persist consumed session id and credit receipt in ONE transaction.
 */
export function verifyServerTranscript(session,payload){
 if(!keys(session,['sessionId','studentId','appKey','resetEpoch','rulesetVersion',
     'level','operations','mode','questions'])
  ||!uuid.test(session.sessionId)||!uuid.test(session.studentId)
  ||!Object.hasOwn(APPS,session.appKey)
  ||!integer(session.resetEpoch)||!integer(session.rulesetVersion)||!session.rulesetVersion
  ||![1,2,3].includes(session.level)
  ||!['three-lives','sudden'].includes(session.mode)
  ||!keys(payload,['sessionId','answers','finished'])
  ||payload.sessionId!==session.sessionId||payload.finished!==true
  ||!Array.isArray(payload.answers)
  ||!Array.isArray(session.questions)
  ||session.questions.length<1||session.questions.length>1000
  ||payload.answers.length<1||payload.answers.length>session.questions.length)return null;
 const mixed=session.appKey==='melange-calculs-ecrits';
 const ops=canonicalOperations(session.operations,mixed);
 if(ops===null||(!mixed&&session.operations!==null
   &&!(Array.isArray(session.operations)&&session.operations.length===0)))return null;
 const opSet=mixed?ops:[APPS[session.appKey]];
 const seen=new Set();
 for(const q of session.questions){
  if(!keys(q,['id','op','a','b'])
   ||typeof q.id!=='string'||q.id.length<1||q.id.length>80
   ||seen.has(q.id)||!opSet.includes(q.op)
   ||!integer(q.a)||!integer(q.b)||q.a>100000000||q.b>100000000
   ||(q.op==='sub'&&q.a<q.b))return null;
  seen.add(q.id);
 }
 let score=0,errors=0;
 for(const [index,answer] of payload.answers.entries()){
  const question=session.questions[index];
  if(!keys(answer,['questionId','value'])
   ||answer.questionId!==question.id||!integer(answer.value)
   ||answer.value>10000000000000000)return null;
  const expected=question.op==='add'?question.a+question.b:
   question.op==='sub'?question.a-question.b:question.a*question.b;
  if(answer.value===expected)score++;else errors++;
  // Each completed wrong calculation loses exactly one life;
  // sudden death ends on the first error, 3-lives on the third.
  if(errors >= (session.mode==='sudden'?1:3)
   &&index!==payload.answers.length-1)return null;
 }
 const lostAll=errors===(session.mode==='sudden'?1:3);
 if(!lostAll&&payload.answers.length!==session.questions.length)return null;
 return Object.freeze({
  sessionId:session.sessionId,studentId:session.studentId,
  appKey:session.appKey,resetEpoch:session.resetEpoch,
  rulesetVersion:session.rulesetVersion,level:session.level,
  operations:Object.freeze([...ops]),mode:session.mode,
  completed:payload.answers.length,score,errors,
  endedBy:lostAll?'mistake-limit':'question-limit',
  // Approval of these milestone keys is *still* decided by server-side rules.
  candidateRecordMilestones:Object.freeze(
   [5,10].filter(limit=>score>=limit).map(limit=>'record:'+limit)),
  trophyEligible:session.mode==='sudden'
 });
}
