// Offline validation of server-authored arithmetic. PostgreSQL remains
// authoritative for every digit, carry, terminal condition and XP receipt.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MODES=new Set(['three-lives','sudden','hard-three-lives','hard-sudden']);
const APPS=new Set(['addition-ecrite-simple','addition-ecrite-multiple']);
export const MAX_ADVANCED_QUESTIONS=64;
export const ADVANCED_MODES=Object.freeze([...MODES]);
export function advancedWidth(appKey,mode,level){
 if(!APPS.has(appKey)||!MODES.has(mode)||![1,2,3].includes(level))return null;
 if(mode.startsWith('hard-'))return appKey==='addition-ecrite-simple'?
  {1:10,2:12,3:16}[level]:{1:9,2:12,3:14}[level];
 return appKey==='addition-ecrite-simple'?{1:3,2:5,3:7}[level]:level+4;
}
const isDecimal=s=>typeof s==='string'&&/^[1-9][0-9]{0,15}$/.test(s);
export function acceptAdvancedChallenge(data,appKey,expectedMode,expectedLevel){
 const width=advancedWidth(appKey,expectedMode,expectedLevel);
 if(!width||data?.ok!==true||!UUID.test(data.sessionId)||data.appKey!==appKey
  ||data.mode!==expectedMode||data.level!==expectedLevel
  ||data.maxQuestions!==MAX_ADVANCED_QUESTIONS||!Array.isArray(data.questions)
  ||data.questions.length!==MAX_ADVANCED_QUESTIONS
  ||!Number.isSafeInteger(data.revision)||data.revision<0
  ||!Number.isSafeInteger(data.resetEpoch)||data.resetEpoch<0
  ||!Number.isFinite(Date.parse(data.expiresAt)))return null;
 const hard=expectedMode.startsWith('hard-');
 const termsExpected=appKey==='addition-ecrite-simple'?2:hard?(expectedLevel===3?7:6):expectedLevel+2;
 const questions=[];
 for(const [index,q] of data.questions.entries()){
  if(q?.id!=='q'+(index+1)||q.op!=='add'||!Array.isArray(q.addends)
   ||q.addends.length!==termsExpected||q.addends.some(t=>!isDecimal(t)||t.length>width))
   return null;
  questions.push(Object.freeze({id:q.id,addends:Object.freeze([...q.addends]),op:'add'}));
 }
 return Object.freeze({
  sessionId:data.sessionId,appKey,mode:expectedMode,level:expectedLevel,
  maxQuestions:MAX_ADVANCED_QUESTIONS,questions:Object.freeze(questions),
  revision:data.revision,resetEpoch:data.resetEpoch,
  reused:data.reused===true,expiresAt:data.expiresAt
 });
}
export function advancedExpected(q,appKey,mode,level){
 const width=advancedWidth(appKey,mode,level);
 if(!q||!width||!Array.isArray(q.addends))return null;
 const values=q.addends.map(s=>BigInt(s));const sum=values.reduce((a,b)=>a+b,0n);
 const digits=Array.from({length:String(sum).length},(_,j)=>String((sum/10n**BigInt(j))%10n));
 const carries=[''];
 for(let j=1;j<width;j++){
  const factor=10n**BigInt(j);
  const carry=values.reduce((acc,v)=>acc+v%factor,0n)/factor;
  carries.push(carry===0n?'':String(carry));
 }
 return {digits,carries};
}
export function normalizeAdvancedAttempt(raw,q,appKey,mode,level){
 const exp=advancedExpected(q,appKey,mode,level);
 if(!exp||!raw||typeof raw!=='object'||Array.isArray(raw)
  ||Object.keys(raw).sort().join(',')!=='carries,digits,id'
  ||raw.id!==q.id||!Array.isArray(raw.digits)||!Array.isArray(raw.carries)
  ||raw.digits.length!==exp.digits.length||raw.carries.length!==exp.carries.length
  ||raw.digits.some(x=>typeof x!=='string'||!/^\d?$/.test(x))
  ||raw.carries.some(x=>typeof x!=='string'||!/^[0-6]?$/.test(x))
  ||!['','0'].includes(raw.carries[0]))return null;
 return Object.freeze({id:q.id,digits:[...raw.digits],carries:[...raw.carries]});
}
export function advancedIsCorrect(attempt,q,appKey,mode,level){
 const expected=advancedExpected(q,appKey,mode,level);
 if(!expected||!attempt)return false;
 return expected.digits.every((d,i)=>d===attempt.digits[i])
  &&expected.carries.every((d,i)=>d===attempt.carries[i]||(d===''&&attempt.carries[i]==='0'));
}
export function advancedStopReason({mode,answers,questions,appKey,level}){
 if(!MODES.has(mode)||!Array.isArray(answers)||answers.length>MAX_ADVANCED_QUESTIONS
  ||answers.length===0)return null;
 const limit=mode.endsWith('lives')?3:1;
 const errors=answers.filter((a,i)=>!advancedIsCorrect(a,questions[i],appKey,mode,level)).length;
 return errors>=limit?'lost-lives':answers.length===MAX_ADVANCED_QUESTIONS?'question-cap':null;
}
export function createAdvancedProofQueue({storage,studentId,classId,appKey}){
 if(!UUID.test(studentId)||!UUID.test(classId)||!APPS.has(appKey))return null;
 const key='mathas.advanced-proof.v1.'+[classId,studentId,appKey].join('.');
 return Object.freeze({
  read(){
   try{
    const raw=JSON.parse(storage.getItem(key)||'null');
    if(!raw||!UUID.test(raw.sessionId)||!MODES.has(raw.mode)
      ||!Array.isArray(raw.answers)||raw.answers.length>64
      ||Date.parse(raw.expiresAt)<=Date.now())return null;
    return raw;
   }catch{return null;}
  },
  save(run){
   try{
    storage.setItem(key,JSON.stringify({sessionId:run.sessionId,
     mode:run.mode,level:run.level,expiresAt:run.expiresAt,
     answers:run.answers.map(a=>({id:a.id,digits:a.digits,carries:a.carries})),
     finished:run.finished===true}));
    return true;
   }catch{return false;}
  },
  clear(){try{storage.removeItem(key)}catch{}}
 });
}
