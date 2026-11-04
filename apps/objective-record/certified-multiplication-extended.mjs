// Multiplication: preuves de survie écrites, chiffres ET reports vérifiables.
import {normalizeMultiplicationAttempt,validMultipliers} from './certified-multiplication.mjs';
export const MUL_EXTENDED_MODES=Object.freeze(['three-lives','sudden','hard-three-lives','hard-sudden']);
export const MUL_EXTENDED_LIMIT=120;
export const MUL_EXTENDED_LABELS=Object.freeze({
 'three-lives':'❤️ 3 vies','sudden':'💀 Mort subite',
 'hard-three-lives':'❤️ HARD · 3 vies','hard-sudden':'💀 HARD · Mort subite'
});
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function parseMulExtendedChallenge(data,mode,level,multipliers){
 if(!MUL_EXTENDED_MODES.includes(mode)||![1,2,3].includes(level)
  ||!validMultipliers(multipliers)||data?.ok!==true||data.mode!==mode
  ||data.level!==level||data.limit!==MUL_EXTENDED_LIMIT
  ||!Number.isSafeInteger(data.revision)||data.revision<0
  ||!Number.isSafeInteger(data.resetEpoch)||data.resetEpoch<0
  ||!UUID.test(data.sessionId)||!Number.isFinite(Date.parse(data.expiresAt))
  ||!Array.isArray(data.questions)||data.questions.length!==MUL_EXTENDED_LIMIT)return null;
 const width=mode.startsWith('hard-')?[10,12,16][level-1]:[3,5,7][level-1];
 if(data.width!==width
  ||!data.questions.every((q,i)=>q?.id==='q'+(i+1)&&q.op==='mul'
   &&typeof q.a==='string'
   &&new RegExp('^[1-9][0-9]{'+(width-2)+','+(width-1)+'}$').test(q.a)
   &&q.width===q.a.length&&Number.isInteger(q.m)
   &&multipliers.includes(q.m)))return null;
 return Object.freeze({sessionId:data.sessionId,level,mode,width,
  limit:MUL_EXTENDED_LIMIT,revision:data.revision,resetEpoch:data.resetEpoch,
  expiresAt:data.expiresAt,questions:data.questions.map(q=>Object.freeze({...q}))});
}
export function mulFirstTryCorrect(q,answer){
 const a=normalizeMultiplicationAttempt(answer,q);
 if(!a)return false;
 const n=BigInt(q.a),m=BigInt(q.m);
 if(!(n*m).toString().split('').reverse().every((digit,i)=>a.digits[i]===digit))return false;
 for(let i=1;i<q.a.length;i++){
  const carry=(n%(10n**BigInt(i)))*m/(10n**BigInt(i));
  const expected=carry===0n?'':carry.toString();
  const typed=a.carries[i]==='0'&&expected===''?'':a.carries[i];
  if(typed!==''&&typed!==expected)return false;
 }
 return true;
}
export function mulExtendedEndState(mode,answers,questions){
 if(!MUL_EXTENDED_MODES.includes(mode)||!Array.isArray(answers)
  ||!Array.isArray(questions)||questions.length!==MUL_EXTENDED_LIMIT
  ||answers.length>MUL_EXTENDED_LIMIT)return {valid:false};
 const lives=mode.endsWith('three-lives')?3:1;
 let correct=0,errors=0;
 for(let i=0;i<answers.length;i++){
  if(errors>=lives||!normalizeMultiplicationAttempt(answers[i],questions[i]))
   return {valid:false};
  if(mulFirstTryCorrect(questions[i],answers[i]))correct++;else errors++;
 }
 return {valid:true,correct,errors,hearts:Math.max(0,lives-errors),
  complete:errors>=lives||answers.length===MUL_EXTENDED_LIMIT,
  attempted:answers.length};
}
export function createMulExtendedQueue({storage,studentId,classId,mode,level}){
 if(!storage||!UUID.test(studentId)||!UUID.test(classId)
  ||!MUL_EXTENDED_MODES.includes(mode)||![1,2,3].includes(level))return null;
 const key='mathas.mul.school.extended.v1.'+classId+'.'+studentId+'.'+mode+'.'+level;
 function read(){
  try{
   const saved=JSON.parse(storage.getItem(key));
   return saved&&UUID.test(saved.sessionId)&&saved.mode===mode&&saved.level===level
    &&saved.answers?.length<=MUL_EXTENDED_LIMIT&&Array.isArray(saved.answers)
    &&Date.parse(saved.expiresAt)>Date.now()?saved:null;
  }catch{return null}
 }
 function save(run,answers){
  if(!UUID.test(run?.sessionId)||!Array.isArray(answers)
   ||answers.length>MUL_EXTENDED_LIMIT)return false;
  try{
   storage.setItem(key,JSON.stringify({sessionId:run.sessionId,
    expiresAt:run.expiresAt,mode,level,answers}));
   return true;
  }catch{return false}
 }
 function clear(){try{storage.removeItem(key)}catch{}}
 return Object.freeze({read,save,clear});
}
