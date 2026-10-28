import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
const src=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const game=src('../apps/multiplication-simple/game-original.html');
const launcher=src('../apps/multiplication-simple/index.html');
const backend=src('../supabase/functions/connect-results/index.ts');
const migration=src('../supabase/migrations/20261028_multiplication_simple_xp_v1.sql');
test('shared client has separate identities and all the XP UI',()=>{
 assert.match(launcher,/APP='multiplication-ecrite-simple'/);
 assert.match(launcher,/mathas.ce-multiplication.connect/);
 assert.match(launcher,/ce-multiplication.pending/);
 assert.match(launcher,/ce-xp-meter/);
 assert.match(launcher,/xp-details/);
 assert.doesNotMatch(launcher,/APP='addition-ecrite-simple'/);
});
test('results hook exists for classic, sudden and both HARD modes',()=>{
 assert.ok(game.includes('window.parent.MathasPilotBridge?.completed?.(item)'));
 assert.equal((game.match(/notifyConnectResult\\(item\\);/g)||[]).length,3);
});
test('server authorizes only explicit apps and reads XP for the requested one',()=>{
 assert.match(backend,/mul='multiplication-ecrite-simple'/);
 assert.match(backend,/p_app:b.appKey,p_include_milestones:true/);
 assert.match(backend,/selected!==app&&selected!==mul/);
 assert.match(migration,/multiplication-ecrite-simple/);
 assert.match(migration,/connect_xp_award_rules/);
});
test('all embedded scripts compile and keyboard guides remain',()=>{
 const scripts=[...game.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
 assert.ok(scripts.length>=30);
 for(const [i,chunk] of scripts.entries())assert.doesNotThrow(()=>new Script(chunk[1],{filename:'game-'+i}));
 assert.match(game,/mathas-connect-arrows-v1/);
 assert.match(game,/mathas-p120-guided-rail-js/);
});

test('restarting a parcours affects only the selected application',()=>{
 const restart=migration.slice(migration.indexOf('CREATE OR REPLACE FUNCTION public.connect_parcours_restart_one'));
 assert.match(restart,/where student_id=p_student and app_key=p_app/);
 assert.match(restart,/where s\.id=p_student/);
 assert.match(restart,/values\(p_student,p_app,previous_number/);
 assert.match(restart,/on conflict\(student_id,app_key\)/);
 const classRestart=migration.slice(migration.indexOf('CREATE OR REPLACE FUNCTION public.connect_parcours_restart_class'),migration.indexOf('CREATE OR REPLACE FUNCTION public.connect_parcours_restart_one'));
 assert.match(classRestart,/connect_parcours_restart_one\(p_teacher,p_class,member\.id,p_app,p_repeat_xp\)/);
 const teacher=src('../app.js');
 assert.ok(teacher.includes("appKey:$('results-app').value"));
 assert.match(teacher,/resultCall\('teacher-parcours-restart',\{scope,studentId,repeatXp:xp\.checked,appKey\}\)/);
});

test('teacher selector lists both apps and backup restore is isolated',()=>{
 const html=src('../index.html'),teacher=src('../app.js');
 assert.match(html,/<option value="multiplication-ecrite-simple">/);
 assert.match(teacher,/appKey:o\.app\.appKey/);
 assert.match(teacher,/\.filter\(x=>x\.appKey===o\.app\.appKey\)/);
 assert.match(backend,/\!\[app,mul\]\.includes\(b\.appKey\)/);
 assert.match(backend,/x\.appKey!==b\.appKey/);
});
test('HARD arrow navigation uses its actual DOM and side carry navigation',()=>{
 assert.match(game,/hard\?current\.closest\('#hardOperationCard'\)/);
 assert.match(game,/\.side-carry-input:not\(:disabled\)/);
 assert.match(game,/window\.parent\.MathasPilotBridge\?\.completed\?\.\(item\),750/);
});
test('repeated XP cap supports at least two full parcours',()=>{
 const sql=src('../supabase/migrations/20261028_xp_multi_parcours_cap.sql');
 assert.match(sql,/xp_credited <= 10000000/);
});

test('restore rejects unrelated app keys, and professor sees HARD five-score',()=>{
 assert.match(backend,/!\[app,mul\]\.includes\(b\.appKey\)/);
 assert.doesNotMatch(backend,/\[b\.appKey,mul\]/);
 assert.match(backend,/hardThree:state\.hardThree\?\?null/);
 const teacher=src('../app.js');
 assert.match(teacher,/HARD 5 calculs/);
 assert.match(teacher,/state\.hardThree\?\.\[i\]/);
});
