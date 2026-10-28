import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const game=read('../apps/multiplication-simple/game-original.html');
const launcher=read('../apps/multiplication-simple/index.html');
const teacher=read('../app.js');
const backend=read('../supabase/functions/connect-results/index.ts');
const migration=read('../supabase/migrations/20261028_multiplier_locks.sql');
test('teacher lock uses private DB and checks authorizations',()=>{
 assert.match(migration,/enable row level security/);
 assert.match(migration,/revoke all .*anon, authenticated/);
 assert.match(backend,/teacher-multipliers-set/);
 assert.match(backend,/if\(!await managed\(\)\)return deny/);
 assert.match(backend,/not_enrolled/);
});
test('effective student lock prefers personal override to class',()=>{
 assert.match(backend,/scope_key===studentId/);
 assert.match(backend,/scope_key==='class'/);
 assert.match(launcher,/multiplierLock=Array\.isArray\(x\.multiplierLock\)/);
});
test('teacher required tables are always selected and cannot be unchecked, including HARD',()=>{
 // Depuis le changement sur main : l'élève peut ajouter des tables LIBRES.
 // Les tables fixées par l'enseignant restent obligatoires, y compris en HARD.
 assert.match(game,/const teacherMultiplierLock=Array\.isArray/);
 assert.match(game,/teacherMultiplierLock\.includes\(n\)/);
 assert.match(game,/b\.disabled=required/);
 assert.match(game,/teacherMultiplierLock\.forEach\(n=>selectedMultipliers\.add\(n\)\)/);
 assert.match(game,/hardState=generateMultiplication\(hardSession\.digits,\[\.\.\.selectedMultipliers\],false\)/);
});
test('teacher controls in results for class and individual pupil',()=>{
 assert.match(teacher,/function multiplierLockPanel/);
 assert.match(teacher,/teacher-multipliers-get/);
 assert.match(teacher,/teacher-multipliers-set/);
 assert.match(teacher,/multiplierLockPanel\(container,studentId\)/);
});
test('scripts still parse',()=>{
 const scripts=[...game.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
 for(const s of scripts)new Script(s[1]);
});
