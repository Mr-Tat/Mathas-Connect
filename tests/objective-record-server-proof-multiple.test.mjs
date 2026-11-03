import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {acceptMultiChallenge,normalizeMultiFirstAttempt,createMultiProofQueue,
 MULTI_PROOF_COUNTS,MULTI_PROOF_WIDTH} from '../apps/objective-record/certified-multiple.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const SID='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CLASS='4bf3400d-a315-4ea4-a2f3-afaca24dc9b9';
const PUPIL='11111111-1111-4111-8111-111111111111';
function sample(level,total){
 const width=MULTI_PROOF_WIDTH[level],base=10**(width-1),terms=level+2;
 return {ok:true,sessionId:SID,revision:0,resetEpoch:0,level,total,
  expiresAt:'2090-12-25T19:00:00Z',
  questions:Array.from({length:total},(_,i)=>({id:'q'+(i+1),op:'add',
   addends:Array.from({length:terms},(_,j)=>base+i+j)}))};
}
test('three native multi-addition levels x 4/10/20 server-issued questions',()=>{
 for(const level of [1,2,3])for(const total of MULTI_PROOF_COUNTS){
  const source=sample(level,total),challenge=acceptMultiChallenge(source);
  assert.ok(challenge,level+' '+total);
  assert.equal(challenge.questions.length,total);
  assert.notEqual(challenge.questions[0],source.questions[0]);
  const q=challenge.questions[0],sum=q.addends.reduce((a,b)=>a+b,0);
  const answer=normalizeMultiFirstAttempt({
   id:q.id,digits:String(sum).split('').reverse(),carries:Array(MULTI_PROOF_WIDTH[level]).fill('')
  },q,level);
  assert.ok(answer,level+' '+total);
  assert.equal(normalizeMultiFirstAttempt({...answer,score:99},q,level),null);
  assert.equal(normalizeMultiFirstAttempt({...answer,carries:[]},q,level),null);
  assert.equal(normalizeMultiFirstAttempt({...answer,id:'q99'},q,level),null);
 }
});
test('invalid challenge is rejected before touching the native engine',()=>{
 const good=sample(2,4);
 for(const invalid of [
  {...good,level:5},{...good,total:10},
  {...good,questions:good.questions.slice(1)},
  {...good,questions:[{...good.questions[0],op:'sub'},...good.questions.slice(1)]},
  {...good,questions:[{...good.questions[0],addends:[22,33]},...good.questions.slice(1)]},
  {...good,questions:[{...good.questions[0],addends:[-3,10,20,30]},...good.questions.slice(1)]},
  {...good,sessionId:'not-a-uuid'},
  {...good,expiresAt:'invalid'}
 ])assert.equal(acceptMultiChallenge(invalid),null);
});
test('retry partitioned by real pupil and school class, not client score',()=>{
 const m=new Map(),storage={
  getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)
 };
 const c=sample(3,20),answers=[{id:'q1',digits:['1'],carries:['']}];
 const a=createMultiProofQueue({storage,studentId:PUPIL,classId:CLASS});
 const b=createMultiProofQueue({storage,studentId:SID,classId:CLASS});
 assert.ok(a.save(c,answers));
 assert.equal(a.read().answers.length,1);
 assert.equal(b.read(),null);
 a.clear();assert.equal(a.read(),null);
 assert.equal(createMultiProofQueue({storage,studentId:'x',classId:CLASS}),null);
});
test('native adapter matches the exact generated engine and captures before correction',()=>{
 const game=read('apps/objective-record/engines/addition-multiple/index.html');
 const adapter=read('apps/objective-record/engines/addition-multiple/certified-multiple-patch.js');
 const w={};new Function('window',adapter)(w);
 const adapted=w.MathasCertifiedMultiPatch(game);
 assert.match(adapted,/__mathasServerCertifiedMulti/);
 assert.match(adapted,/MathasCertifiedMultipleAttempt\?\./);
 const classic=adapted.slice(adapted.indexOf('// Calculs\n    let hadError=false;'),
  adapted.indexOf('function verifyCorrections()'));
 assert.ok(classic.indexOf('MathasCertifiedMultipleAttempt?.(')>=0);
 assert.ok(classic.indexOf('MathasCertifiedMultipleAttempt?.(')<classic.indexOf('s.firstTry=false;hadError=true'));
 assert.ok(adapted.includes('proof.questions?.[session.completed+i]'));
 const wrapper=read('apps/objective-record/engines/addition-multiple/essai-objectif-record-3-vies.html');
 assert.ok(wrapper.includes('certified-multiple-patch.js'));
 assert.ok(wrapper.includes('MathasCertifiedMultiPatch(game)'));
});
test('Edge routes proof through JWT and service_role, school launch stays off',()=>{
 const edge=read('supabase/functions/connect-objective-record-test/index.ts');
 const host=read('apps/objective-record/eleve.mjs');
 const sql=read('supabase/release-candidates/objective_record_multiple_server_proof_candidate.sql');
 const routing=read('apps/objective-record/release-routing.mjs');
 for(const s of ['validMultiStart','validMultiFinish','connect_objective_record_test_issue_multi_v1',
  'connect_objective_record_test_finish_multi_v1','client.auth.getUser(token)'])assert.ok(edge.includes(s),s);
 for(const s of ["'action,answers,appKey,classId,sessionId'",
   "'action,appKey,classId,level,total'"])assert.ok(edge.includes(s),s);
 assert.ok(host.includes('certifiedMultiUI.onGameEvent(event)')||
  host.includes('activeProofUI.onGameEvent(event)'));
 assert.match(host,/call\('connect-objective-record-test',action,'addition-ecrite-multiple',payload\)/);
 assert.match(routing,/enabled:false/);
 for(const s of ['connect_enrollments','connect_teacher_players','not_test_subject',
  'proof_replay_collision','FOR UPDATE','v_session.expires_at<=now()',
  'connect_addition_multiple_record_v1','REVOKE ALL','TO service_role',
  'p_class IS DISTINCT FROM v_test'])assert.ok(sql.includes(s),s);
 assert.doesNotMatch(sql,/GRANT EXECUTE[^;]+TO (?:authenticated|anon)/i);
});
