import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
const source=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const bundle=source('supabase/release-candidates/addition_multiple_locked_v1.sql');
const disable=source('supabase/release-candidates/addition_multiple_disable_only.sql');
function unwrap(sql){
 const result=sql.trim().replace(/^BEGIN;\s*$/m,'').replace(/^COMMIT;\s*$/m,'').trim();
 assert.ok(result!==sql.trim(),'candidate must have exactly one BEGIN/COMMIT wrapper');
 return result;
}
test('release bundle contains exactly the audited staging, four RPC and atomic definitions',()=>{
 for(const file of [
  'supabase/migrations/20261029_addition_multiple_catalog_stage.sql',
  'tests/postgres/addition-multiple-rpc-candidate.sql',
  'tests/postgres/addition-multiple-atomic-rpc-candidate.sql'
 ]) {
  assert.ok(bundle.includes(unwrap(source(file))),'release bundle diverged from '+file);
 }
 assert.equal((bundle.match(/^BEGIN;\s*$/gm)||[]).length,1);
 assert.equal((bundle.match(/^COMMIT;\s*$/gm)||[]).length,1);
 assert.equal((bundle.match(/CREATE OR REPLACE FUNCTION public\./g)||[]).length,5);
 for(const [name,hash] of [
  ['connect_parcours_restart_class','62194222ad2e5cfaec4999cea3f5363c'],
  ['connect_parcours_restart_one','eec598806f7950112b21920689a45baa'],
  ['connect_xp_read_v2','c5b879034329e6e03b7547e9661f642e'],
  ['connect_xp_sync_v2','d3a11bdef68483ccffa4ffe2c2b13f35']
 ]) {assert.ok(bundle.includes(name));assert.ok(bundle.includes(hash))}
 assert.match(bundle,/addition_multiple_stale_production_rpc/);
 assert.match(bundle,/addition_multiple_atomic_rpc_already_exists/);
 assert.match(bundle,/addition_multiple_preexisting_publication/);
 assert.match(bundle,/addition_multiple_postcheck_four_hubs/);
 assert.match(bundle,/addition_multiple_postcheck_permissions/);
});
test('release and emergency stop never delete pupil results or XP',()=>{
 for(const [id,sql] of [['release bundle',bundle],['disable-only',disable]]){
  assert.doesNotMatch(sql,/\b(?:DROP|TRUNCATE|DELETE)\s+(?:TABLE|FROM|public\.)/i,id);
  assert.doesNotMatch(sql,/\bUPDATE\s+public\.connect_(?:xp_credits|xp_milestones|parcours_current|parcours_history|students|enrollments)\b/i,id);
 }
 // The ONLY direct student-state UPDATE belongs to the atomic game RPC
 // and is scoped simultaneously by the authenticated pupil and new app.
 assert.equal((bundle.match(/\bUPDATE public\.connect_states\b/g)||[]).length,1);
 assert.match(bundle,/v_app constant text:='addition-ecrite-multiple'/);
 assert.match(bundle,/WHERE student_id=p_student AND app_key=v_app/);
 assert.doesNotMatch(disable,/\bUPDATE public\.connect_states\b/i);
 assert.match(disable,/UPDATE public\\.connect_apps/);
 assert.match(disable,/UPDATE public\.connect_hub_preset_entries/);
 assert.match(disable,/WHERE app_key='addition-ecrite-multiple'/g);
 assert.doesNotMatch(disable,/DROP FUNCTION|DELETE FROM/i);
});
