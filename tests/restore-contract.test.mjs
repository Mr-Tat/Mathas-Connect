// Static safety gates for the draft: does NOT test PostgreSQL transactions.
// Run: node --test tests/restore-contract.test.mjs
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('../supabase/drafts/restore_atomic_v1_NOT_DEPLOYED.sql',import.meta.url),'utf8');
const edge=readFileSync(new URL('../supabase/functions/connect-results/index.ts',import.meta.url),'utf8');
test('restore apply stays denied in the branch edge',()=>assert.match(edge,/return deny\('restore_apply_not_enabled',403\)/));
test('preview and audit are in private schema',()=>{
 assert.match(sql,/CREATE SCHEMA IF NOT EXISTS connect_internal/);
 assert.match(sql,/REVOKE ALL ON SCHEMA connect_internal FROM PUBLIC, anon, authenticated/);
 assert.match(sql,/CREATE TABLE IF NOT EXISTS connect_internal\.restore_previews/);
 assert.match(sql,/CREATE TABLE IF NOT EXISTS connect_internal\.restore_audit/);
});
test('write and prewrite journal are in one transactional RPC',()=>{
 const fn=sql.split('CREATE OR REPLACE FUNCTION public.connect_restore_apply_v1(')[1];
 assert.ok(fn);
 assert.ok(fn.indexOf('INSERT INTO connect_internal.restore_audit')<fn.indexOf('UPDATE public.connect_states'));
 assert.match(fn,/FOR UPDATE/);
 assert.match(fn,/revision_conflict/);
 assert.match(fn,/pg_advisory_xact_lock/);
});
test('previews expire, are one-time, and bind to teacher, class, student, app and backup',()=>{
 assert.match(sql,/expires_at <= created_at \+ interval '10 minutes'/);
 assert.match(sql,/p.used_at IS NOT NULL OR p.expires_at<=now\(\)/);
 assert.match(sql,/p.actor_id<>p_actor_id OR p.class_id<>p_class_id OR p.student_id<>p_student_id/);
 assert.match(sql,/p.app_key<>p_app_key OR p.backup_sha256<>p_backup_sha256/);
 assert.match(sql,/UPDATE connect_internal.restore_previews SET used_at=now\(\)/);
});
test('RPCs cannot be invoked by anonymous and authenticated roles',()=>{
 const revokes=sql.match(/REVOKE ALL ON FUNCTION public\.connect_restore_(prepare|apply)_v1\([^\n]+ FROM PUBLIC, anon, authenticated/g)||[];
 assert.equal(revokes.length,2);
});
