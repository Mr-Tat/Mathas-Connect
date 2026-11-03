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
 assert.match(engine,/proofCaptured:false/);
 assert.match(engine,/MathasCertifiedAttempt\?\./);
 const classBranch=engine.slice(engine.indexOf('// Keep the FIRST submitted digits'),
 engine.indexOf('function verifyCorrections()'));
 assert.ok(classBranch.indexOf('MathasCertifiedAttempt?.(')>=0);
 assert.ok(classBranch.indexOf('MathasCertifiedAttempt?.(')<classBranch.indexOf('s.firstTry=false;hadError=true'));
 assert.match(host,/activeProofUI\.bind\(inside\.contentWindow,doc\)/);
 assert.match(host,/activeProofUI\.onGameEvent\(event\)/);
 assert.match(host,/certifiedUI\.reset\(\)/);
 assert.match(host,/certifiedUI\.hasPending\(\)/);
 assert.match(ui,/call\('start-proof-v2',\{level,total\}\)/);
 assert.match(ui,/call\('finish-proof-v2',\{sessionId:current\.sessionId,answers:current\.answers\}\)/);
 assert.match(ui,/ack\?\.proofVerified!==true/);
 assert.match(edge,/connect_objective_record_test_issue_add_v1/);
 assert.match(edge,/connect_objective_record_test_finish_add_v1/);
 assert.doesNotMatch(edge,/user\.user_metadata|raw_user_meta_data/);
});
test('SQL is strictly private, TEST-scoped, grades all 4 digits/carries and atomically consumes receipt',()=>{
 const sql=read('supabase/release-candidates/objective_record_addition_server_proof_candidate.sql');
 const deploy=read('supabase/migrations/20261103000500_objective_record_addition_server_proof_test_v1.sql');
 assert.equal(deploy,sql);
 for(const term of ['ENABLE ROW LEVEL SECURITY','FROM PUBLIC,anon,authenticated',
  'TO service_role','proof_test_only','not_test_subject','v_session.expires_at<=now()',
  'proof_replay_collision','v_session.reset_epoch','v_expected_carry',
  'v_correct THEN v_score:=v_score+1',
  'public.connect_objective_record_test_fixed_v1','result=v_ack'])
  assert.ok(sql.includes(term),term);
 assert.doesNotMatch(sql,/GRANT\s+EXECUTE[\s\S]*?TO\s+authenticated/i);
 assert.doesNotMatch(sql,/DROP\s+TABLE/i);
});

test('proof start/finish use JWT-derived pupil without requiring a client pupil ID',()=>{
 const edge=read('supabase/functions/connect-objective-record-test/index.ts');
 assert.match(edge,/const validProofStart=proofStart/);
 assert.match(edge,/Object\.keys\(b\)\.sort\(\)\.join\(','\)==='action,appKey,classId'/);
 assert.match(edge,/const validProofFinish=proofFinish/);
 assert.match(edge,/Object\.keys\(b\)\.sort\(\)\.join\(','\)==='action,answers,appKey,classId,sessionId'/);
 assert.match(edge,/\(record&&b\.expectedStudentId\.toLowerCase\(\)!==studentId\.toLowerCase\(\)\)/);
 assert.doesNotMatch(edge,/if\(!validId\(studentId\)\|\|b\.expectedStudentId\.toLowerCase/);
 assert.match(edge,/p_student:studentId,p_class:TEST/);
});


test('certified additions accept all nine level/count variants with full-width carry fields',()=>{
 for(const level of [1,2,3]){
  const width=({1:3,2:5,3:7})[level];
  const base=10**(width-1);
  for(const total of [4,10,20]){
   const questions=Array.from({length:total},(_,i)=>({
    id:'q'+(i+1),op:'add',a:base+i,b:base+i
   }));
   const c=acceptAdditionProofChallenge({...challenge,level,total,questions});
   assert.ok(c,'level '+level+' total '+total);
   assert.equal(c.questions.length,total);
   assert.equal(c.level,level);
   const sample={id:'q1',digits:String(2*base).split('').reverse(),
    carries:Array(width).fill('')};
   assert.deepEqual(normalizeAdditionFirstAttempt(sample,questions[0]),sample);
   assert.equal(normalizeAdditionFirstAttempt({...sample,carries:[]},questions[0]),null);
  }
 }
 const bad={...challenge,level:4};
 assert.equal(acceptAdditionProofChallenge(bad),null);
});
test('v2 Edge routes require class TEST, exact allowed lengths, and JWT-only student identity',()=>{
 const edge=read('supabase/functions/connect-objective-record-test/index.ts');
 const sql=read('supabase/migrations/20261103013500_objective_record_addition_proof_all_classic_v2.sql');
 assert.match(edge,/const validProofStartV2=proofStartV2/);
 assert.match(edge,/const validProofFinishV2=proofFinishV2/);
 assert.match(edge,/\[1,2,3\]\.includes\(b\.level\)/);
 assert.match(edge,/\[4,10,20\]\.includes\(b\.total\)/);
 assert.match(edge,/\[4,10,20\]\.includes\(b\.answers\.length\)/);
 assert.match(edge,/connect_objective_record_test_issue_add_v2/);
 assert.match(edge,/connect_objective_record_test_finish_add_v2/);
 assert.match(edge,/record&&b\.expectedStudentId/);
 assert.match(sql,/v_session\.total-1 LOOP/);
 assert.match(sql,/v_width-1 LOOP/);
 assert.match(sql,/not_test_subject/);
 assert.match(sql,/proof_replay_collision/);
 assert.match(sql,/connect_objective_record_test_fixed_v1/);
 assert.match(sql,/TO service_role/);
 assert.doesNotMatch(sql,/GRANT EXECUTE[^;]+TO (?:authenticated|anon)/i);
});

test('proof finish Edge validation accepts actual sessionId payload, rejects extra client-controlled claims',()=>{
 const edge=read('supabase/functions/connect-objective-record-test/index.ts');
 const ui=read('apps/objective-record/certified-addition-ui.mjs');
 assert.match(ui,/call\('finish-proof-v2',\{sessionId:current\.sessionId,answers:current\.answers\}\)/);
 const validId=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
 const validate=(name,b)=>{
  const match=edge.match(new RegExp('const '+name+'=([\\s\\S]*?);'));
  assert.ok(match,name+' predicate must exist');
  // Execute exactly the TypeScript Edge's JavaScript-compatible guard, not
  // a duplicate test-side whitelist that could drift from deployed behavior.
  const actual=new Function('b','validId',
   "const proofFinish=b?.action==='finish-proof'; const proofFinishV2=b?.action==='finish-proof-v2'; return Boolean("+match[1]+");");
  return actual(b,validId);
 };
 const base={appKey:'addition-ecrite-simple',classId:'4bf3400d-a315-4ea4-a2f3-afaca24dc9b9',
  sessionId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'};
 for(const total of [4,10,20]){
  const request={...base,action:'finish-proof-v2',answers:Array.from({length:total},(_,i)=>({id:'q'+(i+1),digits:[],carries:[]}))};
  assert.equal(validate('validProofFinishV2',request),true,'v2 valid series '+total);
  assert.equal(validate('validProofFinishV2',{...request,sessionId:undefined}),false,'session id required');
  assert.equal(validate('validProofFinishV2',{...request,score:total}),false,'client cannot send score');
  assert.equal(validate('validProofFinishV2',{...request,expectedStudentId:base.sessionId}),false,'student bound by JWT');
  assert.equal(validate('validProofFinishV2',{...request,answers:request.answers.slice(0,3)}),false,'unapproved series size');
 }
 const v1={...base,action:'finish-proof',answers:[{},{},{},{}]};
 assert.equal(validate('validProofFinish',v1),true,'legacy v1 finish still supported');
 assert.equal(validate('validProofFinish',{...v1,sessionId:'missing'}),false);
 assert.equal(validate('validProofFinish',{...v1,answers:[{}]}),false);
 assert.equal(validate('validProofFinish',{...v1,score:4}),false);
});
