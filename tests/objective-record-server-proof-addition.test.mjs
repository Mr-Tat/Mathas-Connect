import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {acceptAdditionProofChallenge,normalizeAdditionFirstAttempt,
 createCertifiedAdditionQueue} from '../apps/objective-record/certified-addition.mjs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const challenge={ok:true,sessionId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 revision:2,resetEpoch:0,level:1,total:4,
 expiresAt:'2090-12-25T19:00:00Z',
 questions:Array.from({length:4},(_,i)=>({id:'q'+(i+1),op:'add',a:123+i,b:456+i}))};
test('server-issued 4-question challenge is checked before native launch',()=>{
 const out=acceptAdditionProofChallenge(challenge);
 assert.equal(out.questions.length,4);
 for(const bad of [{...challenge,ok:false},{...challenge,questions:[...challenge.questions.slice(0,3)]},
  {...challenge,questions:[...challenge.questions.slice(0,3),{id:'q4',op:'sub',a:200,b:100}]},
  {...challenge,sessionId:'fake'},{...challenge,revision:-1},{...challenge,expiresAt:'invalid'}])
  assert.equal(acceptAdditionProofChallenge(bad),null);
});
test('first-try digits and carries are captured exactly once, never a client score',()=>{
 const q=challenge.questions[0];
 const first={id:q.id,digits:['9','7','5'],carries:['','','']};
 const out=normalizeAdditionFirstAttempt(first,q);
 assert.deepEqual(out,first);
 assert.notEqual(out,first);
 for(const bad of [{...first,score:99},{...first,digits:['9','7']},
  {...first,carries:['','2','']},{...first,id:'q2'},null])
  assert.equal(normalizeAdditionFirstAttempt(bad,q),null);
});
test('pending answers isolated by approved pupil and classroom, with expiry',()=>{
 const mem=new Map();
 const storage={getItem:k=>mem.get(k)??null,setItem:(k,v)=>mem.set(k,v),removeItem:k=>mem.delete(k)};
 const st1='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',st2='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
 const cl='4bf3400d-a315-4ea4-a2f3-afaca24dc9b9';
 const q1=createCertifiedAdditionQueue({storage,studentId:st1,classId:cl});
 const q2=createCertifiedAdditionQueue({storage,studentId:st2,classId:cl});
 assert.ok(q1.save(challenge,[]));
 assert.equal(q1.read().sessionId,challenge.sessionId);
 assert.equal(q2.read(),null);
 q1.clear();assert.equal(q1.read(),null);
 assert.equal(createCertifiedAdditionQueue({storage,studentId:'invalid',classId:cl}),null);
});
test('true native engine receives issued calculations and captures first submission before correction',()=>{
 const engine=read('apps/objective-record/engines/addition-simple/game-original.html');
 const host=read('apps/objective-record/eleve.mjs');
 const ui=read('apps/objective-record/certified-addition-ui.mjs');
 const edge=read('supabase/functions/connect-objective-record-test/index.ts');
 assert.match(engine,/window\.__mathasServerCertified/);
 assert.match(engine,/proofCaptured=false/);
 assert.match(engine,/MathasCertifiedAttempt\?\./);
 assert.ok(engine.indexOf('MathasCertifiedAttempt?.(')<engine.indexOf('s.firstTry=false;hadError=true'));
 assert.match(host,/certifiedUI\.bind\(inside\.contentWindow,doc\)/);
 assert.match(host,/certifiedUI\.onGameEvent\(event\)/);
 assert.match(host,/certifiedUI\.reset\(\)/);
 assert.match(host,/certifiedUI\.hasPending\(\)/);
 assert.match(ui,/call\('start-proof',\{\}\)/);
 assert.match(ui,/call\('finish-proof',\{sessionId:current\.sessionId,answers:current\.answers\}\)/);
 assert.match(ui,/ack\.proofVerified!==true/);
 assert.match(edge,/connect_objective_record_test_issue_add_v1/);
 assert.match(edge,/connect_objective_record_test_finish_add_v1/);
 assert.doesNotMatch(edge,/user\.user_metadata|raw_user_meta_data/);
});
test('SQL is strictly private, TEST-scoped, grades all 4 digits/carries and atomically consumes receipt',()=>{
 const sql=read('supabase/release-candidates/objective_record_addition_server_proof_candidate.sql');
 for(const term of ['ENABLE ROW LEVEL SECURITY','FROM PUBLIC,anon,authenticated',
  'TO service_role','proof_test_only','not_test_subject','v_session.expires_at<=now()',
  'proof_replay_collision','stale_reset_epoch','v_expected_carry',
  'v_correct THEN v_score:=v_score+1',
  'public.connect_objective_record_test_fixed_v1','result=v_ack'])
  assert.ok(sql.includes(term),term);
 assert.doesNotMatch(sql,/GRANT\s+EXECUTE[\s\S]*?TO\s+authenticated/i);
 assert.doesNotMatch(sql,/DROP\s+TABLE/i);
});
