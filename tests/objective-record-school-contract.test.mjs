import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {schoolAdditionsLaunch,SCHOOL_ADDITIONS_ROLLOUT}
 from '../apps/objective-record/release-routing.mjs';
const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const school='8fe170fa-9e8f-4e80-885a-b0ba68026f64';
const pilot='4bf3400d-a315-4ea4-a2f3-afaca24dc9b9';
const release={enabled:true,proofRpcsReady:true,hostedJwtVerified:true,projectionVerified:true};
test('The two additions ship independently; other 3 apps, TEST, and missing flags stay legacy',()=>{
 assert.equal(SCHOOL_ADDITIONS_ROLLOUT.enabled,false);
 for(const appKey of ['addition-ecrite-simple','addition-ecrite-multiple']){
  assert.equal(schoolAdditionsLaunch({classId:school,appKey,legacyUrl:'old'}),'old');
  assert.match(schoolAdditionsLaunch({classId:school,appKey,legacyUrl:'old',rollout:release}),/objective-record\/eleve.html\?app=addition-/);
  assert.equal(schoolAdditionsLaunch({classId:pilot,appKey,legacyUrl:'old',rollout:release}),'old');
  for(const key of Object.keys(release))
   assert.equal(schoolAdditionsLaunch({classId:school,appKey,legacyUrl:'old',rollout:{...release,[key]:false}}),'old');
 }
 for(const appKey of ['soustraction-ecrite-simple','multiplication-ecrite-simple','melange-calculs-ecrits'])
  assert.equal(schoolAdditionsLaunch({classId:school,appKey,legacyUrl:'old',rollout:release}),'old');
 const hub=read('hub.js');
 assert.match(hub,/schoolAdditionsLaunch\(\{classId,appKey:app\.app_key,legacyUrl:/);
});
test('School Edge accepts only authenticated, enrolled, approved pupils or authorized teacher players',()=>{
 const s=read('supabase/functions/connect-objective-record-school/index.ts');
 for(const term of ['auth.getUser(token)','connect_devices','connect_enrollments','connect_class_permissions',
   'connect_teacher_players','connect_students','connect_apps','proof_only','valid(b.sessionId)'])assert.ok(s.includes(term),term);
 assert.ok(!s.includes(pilot));
 assert.ok(!s.includes('b.score'));
 assert.ok(!s.includes('b.rewards'));
 assert.ok(!s.includes('b.expectedStudentId'));
 for(const fn of ['issue_add_v1','finish_add_v1','issue_multi_v1','finish_multi_v1'])
  assert.ok(s.includes('connect_objective_record_school_'+fn));
 const host=read('apps/objective-record/eleve.mjs');
 assert.match(host,/classId===CLASS_TEST\?'connect-objective-record-test':'connect-objective-record-school'/);
 assert.match(host,/SCHOOL_CLASSES\.has\(classId\)/);
 assert.match(host,/nativeRecordAllowed=appKey=>isWritableTestApp\(appKey\)&&!SERVER_PROOF_ADDITIONS\.has\(appKey\)/);
});
const migrations=[
 '20261103120000_school_certified_additions_tables.sql',
 '20261103120010_school_addition_simple_atomic_record.sql',
 '20261103120020_school_addition_simple_issue.sql',
 '20261103120030_school_addition_simple_finish.sql',
 '20261103120040_school_addition_multiple_issue.sql',
 '20261103120050_school_addition_multiple_finish.sql'
].map(x=>read('supabase/migrations/'+x));
test('School proof DB is isolated from LAB, with RLS, private RPCs, server arithmetic and idempotent receipts',()=>{
 const all=migrations.join('\n');
 for(const term of ['ENABLE ROW LEVEL SECURITY','REVOKE ALL','TO service_role',
  'connect_objective_record_school_proof_sessions','connect_objective_record_school_receipts',
  'connect_objective_record_school_class_allowed_v1','proof_replay_collision','answers_hash',
  'connect_xp_sync_v2','connect_addition_multiple_record_v1'])
  assert.ok(all.includes(term),term);
 for(const fn of ['fixed_v1','issue_add_v1','finish_add_v1','issue_multi_v1','finish_multi_v1'])
  assert.ok(all.includes('FUNCTION public.connect_objective_record_school_'+fn+'('),fn);
 for(const name of ['issue_add_v1','finish_add_v1','issue_multi_v1','finish_multi_v1'])
  assert.ok(all.includes('GRANT EXECUTE ON FUNCTION public.connect_objective_record_school_'+name));
 assert.ok(!all.includes('connect_objective_record_test_'));
 assert.ok(!all.includes(pilot));
 assert.ok(all.includes('p_mode IS DISTINCT FROM \'classic\''));
 assert.ok(all.includes('p_app IS DISTINCT FROM \'addition-ecrite-simple\''));
});
