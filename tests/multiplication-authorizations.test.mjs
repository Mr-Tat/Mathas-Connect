import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('le portail remplace Autres par Autorisations sans dépendre des résultats',()=>{
 const html=read('index.html'),app=read('app.js');
 assert.match(html,/data-teacher-tab="authorizations">Autorisations/);
 assert.match(html,/id="teacher-authorizations"/);
 assert.doesNotMatch(html,/id="teacher-other"/);
 assert.match(html,/id="auth-class"/);
 assert.match(html,/id="auth-student"/);
 assert.match(html,/id="auth-multipliers"/);
 assert.match(html,/name="auth-aid"/);
 assert.match(app,/const teacherTabs=\['home','apps','authorizations','results','management'\]/);
 assert.match(app,/call\('teacher-dashboard',\{classId\}\)/);
 assert.match(app,/resultCall\('teacher-multipliers-get',\{classId,appKey\}\)/);
 assert.match(app,/resultCall\('teacher-table-aid-get',\{classId,appKey\}\)/);
 assert.match(app,/showTeacherTab\('authorizations'\)/);
});
test('la configuration des multiplicateurs reste facultativement étendue par les élèves',()=>{
 const html=read('index.html'),native=read('apps/multiplication-simple/game-original.html');
 assert.match(html,/Il peut en ajouter d’autres de 2 à 9/);
 assert.match(native,/teacherMultiplierLock/);
 assert.match(native,/selectedMultipliers=new Set/);
 assert.match(native,/teacher-required/);
});
test('permission de tables transmise à la session certifiée avec héritage classe puis élève',()=>{
 const edge=read('supabase/functions/connect-results/index.ts');
 const host=read('apps/multiplication-simple/index.html');
 const native=read('apps/multiplication-simple/game-original.html');
 const migration=read('supabase/migrations/20261106024500_multiplication_tables_aid_permissions.sql');
 assert.match(edge,/teacher-table-aid-get/);
 assert.match(edge,/teacher-table-aid-set/);
 assert.match(edge,/if\(!await managed\(\)/);
 assert.match(edge,/tableAidAllowed=\(tableSettings\|\|\[\]\)\.find/);
 assert.match(edge,/tableAidAllowed\}\:\{\}\)/);
 assert.match(host,/tableAidAllowed=x\.tableAidAllowed!==false/);
 assert.match(host,/window\.__mathasTablesAidAllowed=/);
 assert.match(native,/function openTables\(\)\{if\(window\.__mathasTablesAidAllowed===false\)return;/);
 assert.match(native,/hardTablesBtn\.style\.display='none'/);
 assert.match(migration,/ENABLE ROW LEVEL SECURITY/);
 assert.match(migration,/REVOKE ALL/);
});

test('les multiplicateurs des calculs mélangés gardent leur panneau historique',()=>{
 const app=read('app.js');
 assert.match(app,/function mixedMultiplierLockPanel\(/);
 assert.match(app,/if\(appKey==='melange-calculs-ecrits'\)return mixedMultiplierLockPanel/);
 assert.match(app,/function multiplierLockPanel\(/);
});
