import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('Autorisations propose Mélange avec configuration par classe et élève',()=>{
 const page=read('index.html'),admin=read('app.js'),edge=read('supabase/functions/connect-results/index.ts');
 assert.match(page,/<option value="melange-calculs-ecrits">Calculs écrits mélangés<\/option>/);
 assert.match(admin,/const classId=cls\.value,appKey=\$\('auth-app'\)\.value/);
 assert.match(admin,/resultCall\(action,\{classId,appKey:\$\('auth-app'\)\.value/);
 assert.match(admin,/\$\('auth-app'\)\.onchange/);
 assert.match(edge,/connect_mixed_multiplier_locks.*select\('scope_key,multipliers,updated_at'\)/s);
 assert.match(edge,/connect_mixed_table_aid/);
});
test('Mélange applique les tables de départ et conserve les ajouts des élèves',()=>{
 const engine=read('apps/calculs-melanges/game-original.html');
 const host=read('apps/calculs-melanges/index.html');
 const bridge=read('apps/calculs-melanges/native-bridge.js');
 assert.match(engine,/teacherMultiplierVersion/);
 assert.match(engine,/s\.teacherMultiplierVersion===teacherMultiplierVersion&&m\.length/);
 assert.match(engine,/teacherMultiplierVersion:appliedTeacherMultiplierVersion/);
 assert.match(engine,/teacher-required/);
 assert.match(host,/multiplierLockVersion=loaded\.multiplierLockVersion/);
 assert.match(host,/data-multiplier-lock-version/);
 assert.match(bridge,/__mathasMixedMultiplierVersion/);
});
test('Mélange respecte le refus d’afficher les tables, sans interdire la réglette',()=>{
 const engine=read('apps/calculs-melanges/game-original.html');
 const bridge=read('apps/calculs-melanges/native-bridge.js');
 const host=read('apps/calculs-melanges/index.html');
 const sql=read('supabase/migrations/20261106083300_mixed_teacher_multiplier_and_table_aid_scope.sql');
 assert.match(engine,/name!=='tables'\|\|window\.__mathasMixedTeacherAllowTables!==false/);
 assert.match(bridge,/__mathasMixedTeacherAllowTables/);
 assert.match(host,/data-table-aid-allowed/);
 assert.match(sql,/ENABLE ROW LEVEL SECURITY/);
 assert.match(sql,/REVOKE ALL/);
});
