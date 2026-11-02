import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('la nouvelle Edge impose JWT, identité réelle, appareil ou Monsieur T et classe TEST',()=>{
 const edge=read('supabase/functions/connect-objective-record-test/index.ts');
 assert.match(edge,/client\.auth\.getUser\(token\)/);
 assert.match(edge,/b\.classId!==TEST/);
 assert.match(edge,/b\.expectedStudentId\.toLowerCase\(\)!==studentId\.toLowerCase\(\)/);
 assert.match(edge,/connect_devices/);
 assert.match(edge,/connect_enrollments/);
 assert.match(edge,/connect_teacher_players/);
 assert.match(edge,/connect_class_permissions/);
 assert.match(edge,/can_manage/);
 assert.match(edge,/connect_students/);
 assert.match(edge,/is\('archived_at',null\)/);
 assert.match(edge,/connect_apps/);
 assert.match(edge,/b\.points===0/);
 assert.match(edge,/b\.rewards===null/);
 assert.match(edge,/\['classic','sudden'\]\.includes\(b\.mode\)/);
 assert.match(edge,/connect_objective_record_test_fixed_v1/);
 assert.doesNotMatch(edge,/user\.user_metadata|raw_user_meta_data/);
 assert.doesNotMatch(edge,/\.from\('connect_states'\)\.update\(/);
 assert.doesNotMatch(edge,/\.from\('connect_xp_credits'\)\.upsert\(/);
 assert.doesNotMatch(edge,/connect-record-pilot/);
});

test('aucune des trois nouvelles écritures TEST ne vise l’ancienne branche game-record',()=>{
 const host=read('apps/objective-record/eleve.mjs');
 const contract=read('apps/objective-record/native-official-record.mjs');
 const recorder=read('apps/objective-record/atomic-test-recorder.mjs');
 assert.match(host,/activeApp===ATOMIC_TEST_APP\?'connect-results':'connect-objective-record-test'/);
 assert.match(host,/expectedStudentId:pupilId/);
 assert.match(contract,/FIXED_TEST_APPS=Object\.freeze/);
 for(const app of ['addition-ecrite-simple','soustraction-ecrite-simple','multiplication-ecrite-simple']){
  assert.ok(contract.includes("'"+app+"'"));
 }
 assert.match(recorder,/!isFixedTestApp\(appKey\)/);
});

test('transaction scolaire TEST : vraie inscription, refus autres élèves et privilèges serveur exclusivement',()=>{
 const sql=read('supabase/migrations/20261102204550_objective_record_fixed_ops_test_v1.sql');
 const candidate=read('supabase/release-candidates/objective_record_fixed_ops_test_atomic_candidate.sql');
 assert.ok(sql.includes('not_test_subject'));
 assert.ok(sql.includes('connect_enrollments'));
 assert.ok(sql.includes('connect_teacher_players'));
 assert.ok(sql.includes('connect_class_permissions'));
 assert.ok(sql.includes("connect_xp_sync_v2(p_student,p_app,false)"));
 assert.ok(sql.includes('connect_objective_record_test_receipts'));
 assert.ok(sql.includes('FOR UPDATE'));
 assert.ok(sql.includes('revision_conflict'));
 assert.ok(sql.includes('stale_reset_epoch'));
 assert.ok(sql.includes("REVOKE ALL ON FUNCTION"));
 assert.ok(sql.includes('TO service_role'));
 assert.ok(sql.includes("ENABLE ROW LEVEL SECURITY"));
 assert.ok(sql.includes("p_class IS DISTINCT FROM v_test"));
 assert.ok(sql.includes("p_app NOT IN"));
 assert.doesNotMatch(sql,/GRANT\s+(?:ALL|SELECT|EXECUTE)\s+ON\s+(?:TABLE|FUNCTION)[\s\S]{0,160}\s+TO\s+(?:anon|authenticated)/i);
 assert.equal(sql.trim().replace(/^--[^\n]*\n/gm,'').trim(),
  candidate.trim().replace(/^--[^\n]*\n/gm,'').replace(/^BEGIN;\s*/, '').replace(/\s*COMMIT;$/, '').trim());
});
