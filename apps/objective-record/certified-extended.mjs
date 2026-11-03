// Browser presentation contract only. PostgreSQL independently recomputes every
// result digit, carry, end condition and XP. No client-provided scores are accepted.
export const EXTENDED_MODES=Object.freeze(['three-lives','sudden','hard-three-lives','hard-sudden']);
export const EXTENDED_LIMIT=120;
export const EXTENDED_LABELS=Object.freeze({
 'three-lives':'❤️ 3 vies','sudden':'💀 Mort subite',
 'hard-three-lives':'🔥 HARD · 3 vies','hard-sudden':'🔥 HARD · Mort subite'
});
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const WIDTHS=Object.freeze({
 'addition-ecrite-simple':{normal:[3,5,7],hard:[10,12,16]},
 'addition-ecrite-multiple':{normal:[5,6,7],hard:[9,12,14]}
});
export function expectedExtendedWidth(app,mode,level){
 const spec=WIDTHS[app];
 if(!spec||!EXTENDED_MODES.includes(mode)||![1,2,3].includes(level))return null;
 return spec[mode.startsWith('hard-')?'hard':'normal'][level-1];
}
export function parseExtendedChallenge(data,app,mode,level){
 const width=expectedExtendedWidth(app,mode,level);
 if(width===null||data?.ok!==true||!UUID.test(data.sessionId)
  ||data.mode!==mode||data.level!==level||data.width!==width
  ||data.limit!==EXTENDED_LIMIT||!Number.isSafeInteger(data.revision)||data.revision<0
  ||!Number.isSafeInteger(data.resetEpoch)||data.resetEpoch<0
  ||!Number.isFinite(Date.parse(data.expiresAt))
  ||!Array.isArray(data.questions)||data.questions.length!==EXTENDED_LIMIT)return null;
 const multi=app==='addition-ecrite-multiple',hard=mode.startsWith('hard-');
 for(const [i,q] of data.questions.entries()){
  if(q?.id!=='q'+(i+1)||q?.op!=='add'||q.width!==width
   ||!Array.isArray(q.addends))return null;
  const n=q.addends.length;
  if(multi?(hard?n!==(level===3?7:6):![level+2,level+3].includes(n)):n!==2)return null;
  if(q.addends.some(s=>typeof s!=='string'||!/^[1-9][0-9]*$/.test(s)
     ||s.length>width))return null;
  if(String(q.addends.reduce((sum,s)=>sum+BigInt(s),0n)).length>width+1)return null;
 }
 return data;
}
export function normalizeExtendedAttempt(q,answer){
 if(answer?.id!==q?.id||!Array.isArray(answer.digits)||!Array.isArray(answer.carries)
  ||Object.keys(answer).sort().join(',')!=='carries,digits,id')return null;
 const result=q.addends.reduce((sum,s)=>sum+BigInt(s),0n).toString();
 if(answer.digits.length!==result.length||answer.carries.length!==q.width
  ||!answer.digits.every(s=>typeof s==='string'&&/^[0-9]?$/.test(s))
  ||!answer.carries.every(s=>typeof s==='string'&&/^[0-7]?$/.test(s))
  ||!['','0'].includes(answer.carries[0]))return null;
 return {id:q.id,digits:[...answer.digits],carries:[...answer.carries]};
}
export function extendedFirstTryCorrect(q,raw){
 const a=normalizeExtendedAttempt(q,raw);
 if(!a)return false;
 const terms=q.addends.map(BigInt);
 const total=terms.reduce((s,n)=>s+n,0n).toString();
 for(let j=0;j<total.length;j++)if(a.digits[j]!==total[total.length-1-j])return false;
 for(let j=1;j<q.width;j++){
  const base=10n**BigInt(j);
  const n=terms.reduce((s,t)=>s+t%base,0n)/base;
  const wanted=n===0n?'':String(n);
  const actual=a.carries[j]==='0'?'':a.carries[j];
  if(actual!==wanted)return false;
 }
 return true;
}
export function extendedEndState(mode,answers,questions){
 const limit=mode.includes('three-lives')?3:1;
 let correct=0,wrong=0;
 for(let i=0;i<answers.length;i++){
  if(wrong>=limit)return {valid:false,complete:false,correct,wrong};
  if(extendedFirstTryCorrect(questions[i],answers[i]))correct++;else wrong++;
 }
 return {valid:true,complete:wrong===limit||answers.length===EXTENDED_LIMIT,
   correct,wrong,hearts:Math.max(0,limit-wrong)};
}
export function createExtendedQueue({storage,studentId,classId,appKey,mode,level}){
 if(!UUID.test(studentId)||!UUID.test(classId)
  ||expectedExtendedWidth(appKey,mode,level)===null)return null;
 const key='mathas.certified.modes.v1.'+[classId,studentId,appKey,mode,level].join('.');
 return Object.freeze({
  read(){try{const d=JSON.parse(storage.getItem(key));return d&&UUID.test(d.sessionId)
   &&Array.isArray(d.answers)&&d.answers.length<=EXTENDED_LIMIT
   &&Date.parse(d.expiresAt)>Date.now()?d:null;}catch{return null}},
  save(challenge,answers){try{storage.setItem(key,JSON.stringify({
    sessionId:challenge.sessionId,expiresAt:challenge.expiresAt,
    answers}));return true;}catch{return false}},
  clear(){try{storage.removeItem(key);}catch{}}
 });
}
