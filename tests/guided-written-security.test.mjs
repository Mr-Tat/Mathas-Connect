import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const edge=readFileSync(new URL('../supabase/functions/connect-guided-written/index.ts',import.meta.url),'utf8');
const ddl=readFileSync(new URL('../supabase/migrations/20261112_guided_written_sessions.sql',import.meta.url),'utf8');
test('Serveur : élève lecture seule, identité et classe vérifiées par JWT/autorisation',()=>{
 assert.match(edge,/auth\.auth\.getUser\(token\)/);
 assert.match(edge,/user\.is_anonymous===true/);
 assert.match(edge,/b\.action!=='status'&&user\.is_anonymous===true/);
 for(const table of ['connect_devices','connect_enrollments','connect_students','connect_class_permissions','connect_apps','connect_hub_preset_entries'])
  assert.ok(edge.includes(table),table);
});
test('Sessions isolées par app_key et classe, modifications enseignant protégées',()=>{
 assert.match(edge,/WRITTEN_GUIDED_APPS\.includes\(b\.appKey\)/);
 assert.match(edge,/\.eq\('app_key',appKey\)\.eq\('class_id',cls\)/);
 assert.match(edge,/current\.teacher_id!==user\.id/);
 assert.match(edge,/session_owned_by_other_tab/);
 assert.match(edge,/session_owned_by_other_page/);
 assert.match(edge,/mayRenewGuidedHost/);
 assert.match(edge,/\.eq\('revision',current\.revision\)/);
});
test('Base : aucune donnée de copie élève ; table privée et RLS',()=>{
 assert.match(ddl,/enable row level security/);
 assert.match(ddl,/revoke all on table public\.connect_guided_written_sessions from public, anon, authenticated/);
 assert.match(ddl,/primary key \(app_key,class_id\)/);
 for(const forbidden of ['answer_values','student_id','xp_awarded','score_awarded','trophy_id'])
  assert.ok(!ddl.toLowerCase().includes(forbidden),forbidden);
});
