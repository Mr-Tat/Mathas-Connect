import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 acceptMultiplicationChallenge,normalizeMultiplicationAttempt,
 multiplicationAttemptCorrect,multiplicationQueue
} from '../apps/multiplication-simple/certified-classic.mjs';

const repoFile=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const CLS='4bf3400d-a315-4ea4-a2f3-afaca24dc9b9';
const STUDENT='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const SESSION='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
function sample(q={id:'q1',op:'mul',a:'249',m:9,width:3}){
 return {ok:true,sessionId:SESSION,revision:0,resetEpoch:0,
  expiresAt:new Date(Date.now()+30*60_000).toISOString(),
  level:1,total:4,questions:Array.from({length:4},(_,i)=>({...q,id:'q'+(i+1)}))};
}
test('native challenge must be issued by server and respect allowed tables',()=>{
 assert.ok(acceptMultiplicationChallenge(sample(),1,4,[9]));
 assert.equal(acceptMultiplicationChallenge(sample(),1,4,[2,3]),null);
 assert.equal(acceptMultiplicationChallenge(sample(),2,4,[9]),null);
 assert.equal(acceptMultiplicationChallenge({...sample(),sessionId:'wrong'},1,4,[9]),null);
 assert.equal(acceptMultiplicationChallenge({...sample(),questions:[]},1,4,[9]),null);
});
test('249 × 9: carries are 8 then 4, and digits are little-endian',()=>{
 const q=sample().questions[0],raw={
  id:'q1',digits:['1','4','2','2'],carries:['','8','4']};
 assert.deepEqual(normalizeMultiplicationAttempt(q,raw),raw);
 assert.equal(multiplicationAttemptCorrect(q,raw),true);
 assert.equal(multiplicationAttemptCorrect(q,{...raw,carries:['','8','3']}),false);
 assert.equal(multiplicationAttemptCorrect(q,{...raw,digits:['1','4','2','1']}),false);
});
test('a missing carry is an incorrect first attempt, not an invalid transcript',()=>{
 const q={id:'q1',op:'mul',a:'249',m:9,width:3};
 const v=normalizeMultiplicationAttempt(q,{id:'q1',digits:['1','4','2','2'],carries:['','','4']});
 assert.ok(v);
 assert.equal(multiplicationAttemptCorrect(q,v),false);
 assert.equal(normalizeMultiplicationAttempt(q,{...v,carries:['','','10']}),null);
});
test('no carry: empty and zero are equivalent for correct computation',()=>{
 const q={id:'q1',op:'mul',a:'123',m:2,width:3};
 for(const carries of [['','',''],['','0','0']])
  assert.equal(multiplicationAttemptCorrect(q,{id:'q1',digits:['6','4','2'],carries}),true);
});
test('session transcript queue is isolated by class and account; duplicate not silently discarded',()=>{
 const memory=new Map();
 const store={getItem:k=>memory.get(k)||null,
  setItem:(k,v)=>{memory.set(k,v)},removeItem:k=>{memory.delete(k)}};
 const queue=multiplicationQueue(store,STUDENT,CLS),q=sample();
 assert.ok(queue);
 assert.equal(queue.save(q,[{id:'q1',digits:['1','4','2','2'],carries:['','8','4']}]),true);
 assert.equal(queue.read()?.answers.length,1);
 assert.equal(multiplicationQueue(store,'invalid',CLS),null);
 queue.clear();assert.equal(queue.read(),null);
});
test('SQL school proof only serves exact app; no direct anon or browser grade endpoint',()=>{
 const sql=repoFile('supabase/migrations/20261104110000_school_multiplication_classic_certified_v1.sql');
 const edge=repoFile('supabase/functions/connect-multiplication-school/index.ts');
 const launch=repoFile('apps/multiplication-simple/index.html');
 assert.match(sql,/school_mul_finish_classic_v1/);
 assert.match(sql,/public.connect_xp_sync_v2/);
 assert.match(sql,/proof_replay_collision/);
 assert.match(sql,/REVOKE ALL ON FUNCTION public.connect_objective_record_school_mul_finish_classic_v1/);
 assert.match(sql,/TO service_role/);
 assert.match(edge,/user\.is_anonymous===true/);
 assert.match(edge,/auth\.getUser\(token\)/);
 assert.match(edge,/teacher_player_missing/);
 assert.match(edge,/finish-classic-v1/);
 assert.doesNotMatch(edge,/b\.score|b\.points|b\.rewards/);
 assert.match(launch,/event\.stopImmediatePropagation\(\)/);
 assert.doesNotMatch(launch,/action:'game-record'/);
 assert.match(launch,/certifiedConsent\?\.offer\(receipt\.eventId\)/);
});
