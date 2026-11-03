import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 EXTENDED_MODES,EXTENDED_LIMIT,expectedExtendedWidth,parseExtendedChallenge,
 normalizeExtendedAttempt,extendedFirstTryCorrect,extendedEndState,createExtendedQueue
} from '../apps/objective-record/certified-extended.mjs';

const uuid='11111111-1111-4111-8111-111111111111';
const appSimple='addition-ecrite-simple';
const appMulti='addition-ecrite-multiple';
function challenge(app,mode,level){
 const width=expectedExtendedWidth(app,mode,level);
 const terms=app===appSimple?2:(mode.startsWith('hard-')?(level===3?7:6):level+2);
 const qs=Array.from({length:EXTENDED_LIMIT},(_,i)=>({
  id:'q'+(i+1),op:'add',width,addends:Array(terms).fill('1'.repeat(width))
 }));
 return {ok:true,sessionId:uuid,level,mode,width,limit:EXTENDED_LIMIT,
  revision:0,resetEpoch:0,expiresAt:'2030-01-01T00:00:00Z',questions:qs};
}
function correct(q){
 const nums=q.addends.map(x=>BigInt(x));
 const total=nums.reduce((a,b)=>a+b,0n).toString();
 const digits=[...total].reverse();
 const carries=Array.from({length:q.width},(_,c)=>{
  if(c===0)return '';
  const n=10n**BigInt(c);
  const carry=nums.reduce((sum,x)=>sum+x%n,0n)/n;
  return carry===0n?'':carry.toString();
 });
 return {id:q.id,digits,carries};
}
test('Every one of 24 combinations maps exactly to the native normal/HARD digit count',()=>{
 let n=0;
 for(const app of [appSimple,appMulti]){
  for(const mode of EXTENDED_MODES)for(let level=1;level<=3;level++){
   const c=challenge(app,mode,level);
   assert.ok(parseExtendedChallenge(c,app,mode,level));
   const a=correct(c.questions[0]);
   assert.ok(normalizeExtendedAttempt(c.questions[0],a));
   assert.equal(extendedFirstTryCorrect(c.questions[0],a),true);
   assert.equal(extendedFirstTryCorrect(c.questions[0],{
    ...a,digits:['9'===a.digits[0]?'0':'9',...a.digits.slice(1)]}),false);
   const falsified={...c,questions:c.questions.map(q=>({...q,addends:[...q.addends]}))};
   falsified.questions[0].addends[0]='99999999999999999999999';
   assert.equal(parseExtendedChallenge(falsified,app,mode,level),null);
   n++;
  }
 }
 assert.equal(n,24);
});
test('3 hearts only terminate after 3 errors, sudden after exactly one',()=>{
 const q=challenge(appSimple,'three-lives',1).questions;
 const right=correct(q[0]),wrong={...right,digits:['0',...right.digits.slice(1)]};
 const two=[right,wrong,wrong];
 assert.equal(extendedEndState('three-lives',two,q).complete,false);
 assert.deepEqual(extendedEndState('three-lives',[...two,wrong],q),
  {valid:true,complete:true,correct:1,wrong:3,hearts:0});
 assert.equal(extendedEndState('three-lives',[...two,wrong,right],q).valid,false);
 assert.equal(extendedEndState('sudden',[right,wrong],q).complete,true);
 assert.equal(extendedEndState('sudden',[right,wrong,right],q).valid,false);
});
test('Big-integer HARD carries (six- and seven-addend) stay exact',()=>{
 const width=14,q={id:'q1',op:'add',width,
  addends:['99999999999999','99999999999999','99999999999999',
   '99999999999999','99999999999999','99999999999999','99999999999999']};
 const a=correct(q);
 assert.equal(a.carries[13],'6');
 assert.equal(extendedFirstTryCorrect(q,a),true);
 assert.equal(extendedFirstTryCorrect(q,{...a,carries:a.carries.map((x,i)=>i===13?'5':x)}),false);
});
test('Retry queue is class-, pupil-, app- and mode-scoped',()=>{
 const map=new Map(),storage={
  getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)
 };
 const keys={storage,studentId:uuid,classId:'8fe170fa-9e8f-4e80-885a-b0ba68026f64',
  appKey:appSimple,mode:'sudden',level:1};
 const q=createExtendedQueue(keys),c=challenge(appSimple,'sudden',1);
 assert.ok(q.save(c,[correct(c.questions[0])]));
 assert.equal(q.read().answers.length,1);
 assert.equal(createExtendedQueue({...keys,mode:'three-lives'}).read(),null);
 q.clear();assert.equal(q.read(),null);
});
test('School Edge is proof-only, does not receive client score/XP or allow TEST',()=>{
 const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
 const edge=read('supabase/functions/connect-objective-record-school/index.ts');
 for(const action of ['start-extended-proof-v1','finish-extended-proof-v1',
  'connect_objective_record_school_issue_extended_v1',
  'connect_objective_record_school_finish_extended_v1'])assert.ok(edge.includes(action));
 for(const forbidden of ['b.score','b.rewards','b.xp','4bf3400d-a315-4ea4-a2f3-afaca24dc9b9'])
  assert.equal(edge.includes(forbidden),false);
 const html=read('apps/objective-record/eleve.html');
 for(const mode of EXTENDED_MODES)assert.ok(html.includes('value="'+mode+'"'));
 const host=read('apps/objective-record/eleve.mjs');
 assert.ok(host.includes('createCertifiedExtendedUI'));
 assert.ok(host.includes('extendedUI.hasPending()'));
});
