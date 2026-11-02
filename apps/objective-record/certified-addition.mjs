// Client is untrusted. This validates only response shape and safeguards
// a retry transcript; PostgreSQL recomputes all digits and carries.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const int=n=>Number.isSafeInteger(n);
export const PROOF_APP='addition-ecrite-simple';
export const ADDITION_PROOF_COUNTS=Object.freeze([4,10,20]);
export const ADDITION_PROOF_WIDTH=Object.freeze({1:3,2:5,3:7});
export function acceptAdditionProofChallenge(data){
 if(data?.ok!==true||!UUID.test(data.sessionId)
   ||!int(data.revision)||data.revision<0||!int(data.resetEpoch)||data.resetEpoch<0
   ||!Object.hasOwn(ADDITION_PROOF_WIDTH,data.level)
   ||!ADDITION_PROOF_COUNTS.includes(data.total)||!Array.isArray(data.questions)
   ||data.questions.length!==data.total||!Number.isFinite(Date.parse(data.expiresAt)))return null;
 const width=ADDITION_PROOF_WIDTH[data.level],min=10**(width-1),upper=min*10;
 for(const [i,q] of data.questions.entries()){
  if(q?.id!=='q'+(i+1)||q?.op!=='add'||!int(q.a)||!int(q.b)
    ||q.a<min||q.a>=upper||q.b<min/10||q.b>=upper)return null;
 }
 return Object.freeze({
  sessionId:data.sessionId,revision:data.revision,resetEpoch:data.resetEpoch,
  level:data.level,total:data.total,expiresAt:data.expiresAt,questions:data.questions.map(q=>Object.freeze({...q})),
  reused:data.reused===true
 });
}
export function normalizeAdditionFirstAttempt(input,expectedQuestion){
 if(!input||typeof input!=='object'||Array.isArray(input)
  ||Object.keys(input).sort().join(',')!=='carries,digits,id'
  ||input?.id!==expectedQuestion?.id
  ||!Array.isArray(input.digits)||!Array.isArray(input.carries)
  ||input.digits.length!==String(expectedQuestion.a+expectedQuestion.b).length
  ||input.carries.length!==String(expectedQuestion.a).length
  ||!input.digits.every(v=>typeof v==='string'&&/^[0-9]?$/.test(v))
  ||!input.carries.every(v=>typeof v==='string'&&/^(?:|0|1)$/.test(v))
  ||!['','0'].includes(input.carries[0]))return null;
 return Object.freeze({id:input.id,digits:[...input.digits],carries:[...input.carries]});
}
export function createCertifiedAdditionQueue({storage,studentId,classId}){
 if(!UUID.test(studentId)||!UUID.test(classId))return null;
 const key='mathas.addition-certified-test.v1.'+classId+'.'+studentId;
 function read(){
  try{
   const v=JSON.parse(storage.getItem(key));
   if(!v||!UUID.test(v.sessionId)||!Array.isArray(v.answers)||v.answers.length>20
      ||!Number.isFinite(Date.parse(v.expiresAt))||Date.parse(v.expiresAt)<Date.now())return null;
   return v;
  }catch{return null}
 }
 function save(challenge,answers){
  if(!challenge||!Array.isArray(answers)||answers.length>20||!ADDITION_PROOF_COUNTS.includes(challenge.total)||answers.length>challenge.total)return false;
  const entry={sessionId:challenge.sessionId,expiresAt:challenge.expiresAt,
   level:challenge.level,total:challenge.total,answers:answers.map(x=>({id:x.id,digits:x.digits,carries:x.carries}))};
  try{storage.setItem(key,JSON.stringify(entry));return true}catch{return false}
 }
 function clear(){try{storage.removeItem(key)}catch{}}
 return Object.freeze({read,save,clear});
}
