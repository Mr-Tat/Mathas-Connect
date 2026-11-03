// All challenge arithmetic and XP is authoritative in PostgreSQL.
// This browser module validates only the shape of the server challenge.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const MULTI_PROOF_APP='addition-ecrite-multiple';
const isInt=n=>Number.isSafeInteger(n);
export const MULTI_PROOF_WIDTH=Object.freeze({1:5,2:6,3:7});
export const MULTI_PROOF_COUNTS=Object.freeze([4,10,20]);
export function acceptMultiChallenge(data){
 if(data?.ok!==true||!UUID.test(data.sessionId)||!isInt(data.revision)||data.revision<0
  ||!isInt(data.resetEpoch)||data.resetEpoch<0||!Object.hasOwn(MULTI_PROOF_WIDTH,data.level)
  ||!MULTI_PROOF_COUNTS.includes(data.total)||!Array.isArray(data.questions)
  ||data.questions.length!==data.total||!Number.isFinite(Date.parse(data.expiresAt)))return null;
 const width=MULTI_PROOF_WIDTH[data.level];
 for(const [index,q] of data.questions.entries()){
  if(q?.id!=='q'+(index+1)||q?.op!=='add'||!Array.isArray(q.addends)
   ||q.addends.length<data.level+2||q.addends.length>data.level+3
   ||q.addends.some(n=>!isInt(n)||n<10**(width-2)||n>=10**width)
   ||q.addends.reduce((s,n)=>s+n,0)>100000000)return null;
 }
 return Object.freeze({...data,questions:data.questions.map(q=>Object.freeze({id:q.id,op:q.op,addends:Object.freeze([...q.addends])}))});
}
export function normalizeMultiFirstAttempt(raw,q,level){
 if(!raw||typeof raw!=='object'||Array.isArray(raw)
  ||Object.keys(raw).sort().join(',')!=='carries,digits,id'
  ||raw.id!==q?.id||!Object.hasOwn(MULTI_PROOF_WIDTH,level)
  ||!Array.isArray(raw.digits)||!Array.isArray(raw.carries)
  ||raw.digits.length!==String(q.addends.reduce((s,n)=>s+n,0)).length
  ||raw.carries.length!==MULTI_PROOF_WIDTH[level]
  ||!raw.digits.every(v=>typeof v==='string'&&/^[0-9]?$/.test(v))
  ||!raw.carries.every(v=>typeof v==='string'&&/^[0-5]?$/.test(v))
  ||!['','0'].includes(raw.carries[0]))return null;
 return Object.freeze({id:raw.id,digits:[...raw.digits],carries:[...raw.carries]});
}
export function createMultiProofQueue({storage,studentId,classId}){
 if(!UUID.test(studentId)||!UUID.test(classId))return null;
 const key='mathas.multiple-certified.v1.'+classId+'.'+studentId;
 function read(){try{
  const v=JSON.parse(storage.getItem(key));
  if(!v||!UUID.test(v.sessionId)||!Array.isArray(v.answers)||v.answers.length>20
   ||!Number.isFinite(Date.parse(v.expiresAt))||Date.parse(v.expiresAt)<Date.now())return null;
  return v;
 }catch{return null}}
 function save(challenge,answers){
  if(!challenge||!MULTI_PROOF_COUNTS.includes(challenge.total)
   ||!Array.isArray(answers)||answers.length>challenge.total)return false;
  try{
   storage.setItem(key,JSON.stringify({sessionId:challenge.sessionId,expiresAt:challenge.expiresAt,
    level:challenge.level,total:challenge.total,answers:answers.map(x=>({id:x.id,digits:x.digits,carries:x.carries}))}));
   return true;
  }catch{return false}
 }
 function clear(){try{storage.removeItem(key)}catch{}}
 return Object.freeze({read,save,clear});
}
