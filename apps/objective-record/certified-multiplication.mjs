// Multiplication simple : contrat strict des questions certifiées Connect.
// Le serveur reste seul autorisé à vérifier les réponses et attribuer XP/trophées.
export const MULTIPLICATION_PROOF_APP='multiplication-ecrite-simple';
export const MULTIPLICATION_WIDTH=Object.freeze({1:3,2:5,3:7});
export const MULTIPLICATION_COUNTS=Object.freeze([4,10,20]);
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const integer=n=>Number.isSafeInteger(n);
export function validMultipliers(values){
 return Array.isArray(values)&&values.length>=1&&values.length<=8
  &&values.every(n=>integer(n)&&n>=2&&n<=9)&&new Set(values).size===values.length;
}
export function acceptMultiplicationChallenge(data){
 if(data?.ok!==true||!UUID.test(data.sessionId)
  ||!integer(data.revision)||data.revision<0
  ||!integer(data.resetEpoch)||data.resetEpoch<0
  ||!Object.hasOwn(MULTIPLICATION_WIDTH,data.level)
  ||!MULTIPLICATION_COUNTS.includes(data.total)
  ||!Array.isArray(data.questions)||data.questions.length!==data.total
  ||!Number.isFinite(Date.parse(data.expiresAt)))return null;
 const width=MULTIPLICATION_WIDTH[data.level];
 for(const [i,q] of data.questions.entries()){
  if(q?.id!=='q'+(i+1)||q.op!=='mul'
   ||typeof q.a!=='string'||!/^[1-9][0-9]+$/.test(q.a)
   ||q.a.length<width-1||q.a.length>width||q.width!==q.a.length
   ||!integer(q.m)||q.m<2||q.m>9)return null;
 }
 return Object.freeze({sessionId:data.sessionId,revision:data.revision,
  resetEpoch:data.resetEpoch,level:data.level,total:data.total,
  expiresAt:data.expiresAt,reused:data.reused===true,
  questions:data.questions.map(q=>Object.freeze({...q}))});
}
export function normalizeMultiplicationAttempt(raw,question){
 if(!raw||typeof raw!=='object'||Array.isArray(raw)
  ||Object.keys(raw).sort().join(',')!=='carries,digits,id'
  ||raw.id!==question?.id||!Array.isArray(raw.digits)||!Array.isArray(raw.carries)
  ||raw.digits.length!==String(BigInt(question.a)*BigInt(question.m)).length
  ||raw.carries.length!==question.a.length
  ||!raw.digits.every(x=>typeof x==='string'&&/^[0-9]?$/.test(x))
  ||!raw.carries.every(x=>typeof x==='string'&&/^[0-8]?$/.test(x))
  ||!['','0'].includes(raw.carries[0]))return null;
 return Object.freeze({id:raw.id,digits:[...raw.digits],carries:[...raw.carries]});
}
export function createMultiplicationQueue({storage,studentId,classId}){
 if(!UUID.test(studentId)||!UUID.test(classId)||!storage)return null;
 const key='mathas.multiplication-certified-test.v1.'+classId+'.'+studentId;
 function read(){
  try{
   const value=JSON.parse(storage.getItem(key));
   return value&&UUID.test(value.sessionId)&&Array.isArray(value.answers)
    &&value.answers.length<=20&&Number.isFinite(Date.parse(value.expiresAt))
    &&Date.parse(value.expiresAt)>Date.now()?value:null;
  }catch{return null}
 }
 function save(challenge,answers){
  if(!challenge||!Array.isArray(answers)
   ||!MULTIPLICATION_COUNTS.includes(challenge.total)
   ||answers.length>challenge.total)return false;
  try{
   storage.setItem(key,JSON.stringify({sessionId:challenge.sessionId,
    expiresAt:challenge.expiresAt,level:challenge.level,total:challenge.total,
    answers:answers.map(a=>({id:a.id,digits:a.digits,carries:a.carries}))}));
   return true;
  }catch{return false}
 }
 function clear(){try{storage.removeItem(key)}catch{}}
 return Object.freeze({read,save,clear});
}
