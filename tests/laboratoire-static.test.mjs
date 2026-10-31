import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('le laboratoire reste réservé au professeur et à la classe TEST connue',()=>{
 const script=read('laboratoire.js'),html=read('laboratoire.html'),home=read('index.html');
 assert.match(script,/mathas-connect-professor-auth-v1/);
 assert.match(script,/4bf3400d-a315-4ea4-a2f3-afaca24dc9b9/);
 assert.match(script,/teacher-dashboard/);
 assert.match(script,/scoped\.classes\|\|\[\]/);
 assert.match(html,/id="fictive-confirm"/);
 assert.match(script,/api\('teacher-dashboard',\{classId:TEST_CLASS\}\)/);
 assert.doesNotMatch(script,/api\('teacher-dashboard'\)/);
 assert.match(home,/<div class="teacher-section" id="teacher-management"/);
 const management=home.split('id="teacher-management"')[1]||'';
 const landing=home.split('id="teacher-management"')[0]||'';
 assert.match(management,/class="teacher-lab-management-link" href="\.\/laboratoire\.html"/);
 assert.doesNotMatch(landing,/laboratoire\.html/);
 assert.equal((home.match(/href="\.\/laboratoire\.html"/g)||[]).length,1);
 assert.doesNotMatch(script,/service_role|SUPABASE_SERVICE_ROLE/);
});
test('le laboratoire n’autorise jamais la remise à zéro d’une classe entière',()=>{
 const script=read('laboratoire.js');
 assert.match(script,/scope:'student'/);
 assert.match(script,/repeatXp:false/);
 assert.doesNotMatch(script,/scope:'class',studentId/);
 assert.match(script,/people\.some\(s=>s\.id===p\.id\)/);
 assert.match(script,/guard\(\)/);
});
test('les cartes des quatre HUB ne sont pas modifiées par le laboratoire',()=>{
 const home=read('index.html');
 assert.match(home,/data-teacher-tab="management"/);
 assert.match(home,/data-teacher-tab="apps"/);
 assert.match(home,/data-space="phase2"/);
 assert.match(home,/data-space="2eco"/);
 const lab=read('laboratoire.js');
 assert.doesNotMatch(lab,/teacher-app-matrix-save|connect_mixed_.*open|open_hubs/);
});

test('aucun lancement de jeu depuis le laboratoire avant confirmation fictive',()=>{
 const script=read('laboratoire.js');
 assert.match(script,/student\.onclick=event=>\{if\(!consent\(\)\)/);
 assert.match(script,/teacher\.onclick=\(\)=>run\(async\(\)=>\{guard\(\);/);
});

test('connexion rapide de profil : présélection, contrôle de session et approbation native',()=>{
 const lab=read('laboratoire.js'),app=read('app.js'),home=read('index.html');
 assert.match(lab,/Se connecter avec ce profil/);
 assert.match(lab,/target\.searchParams\.set\('lab','1'\)/);
 assert.match(lab,/launch\.onclick=event=>\{/);
 assert.match(lab,/if\(!consent\(\)\)/);
 assert.match(lab,/target\.searchParams\.set\('testFirst'/);
 assert.match(app,/const testIntent=/);
 assert.match(app,/cls===labTestClass/);
 assert.match(app,/wrapper\.hidden=true;\$\('join-form'\)\.hidden=false/);
 assert.match(app,/const wrongProfile=!!testIntent/);
 assert.match(app,/\$\('continue-profile'\)\.hidden=wrongProfile/);
 assert.match(home,/id="test-profile-switch-notice"/);
 assert.doesNotMatch(lab,/signInAnonymously|signOut|auth\.admin|service_role/);
});

test('les homonymes ne peuvent pas être sélectionnés sur leur nom seul',()=>{
 const lab=read('laboratoire.js');
 assert.match(lab,/const homonyms=people\.filter/);
 assert.match(lab,/launch\.removeAttribute\('href'\)/);
 assert.match(lab,/launch\.setAttribute\('aria-disabled','true'\)/);
 assert.match(lab,/Deux profils portent le même nom/);
});

test('les badges Connecté dépendent de la session élève, et non des appareils approuvés',()=>{
 const script=read('laboratoire.js');
 assert.match(script,/const studentSb=createClient/);
 assert.match(script,/studentSession\.user\?\.is_anonymous/);
 assert.match(script,/action:'student-me',classId:TEST_CLASS/);
 assert.match(script,/data\.status==='approved'&&data\.classId===TEST_CLASS/);
 assert.match(script,/matching|const matches=people\.filter/);
 assert.match(script,/lab-connected-badge/);
});
test('les cases Afficher ne publient jamais les quatre vrais HUB',()=>{
 const lab=read('laboratoire.js'),hub=read('hub.js'),edge=read('supabase/functions/connect-lab-catalog/index.ts');
 assert.match(lab,/labCatalog\('set',\{appKey:app\.app_key,visible:wanted\}\)/);
 assert.match(lab,/checkbox\.checked=app\.visible===true/);
 assert.match(lab,/guard\(\)/);
 assert.match(hub,/if\(classId===LAB_CLASS\)/);
 assert.match(hub,/connect-lab-catalog/);
 assert.match(hub,/test_catalog_unavailable/);
 assert.doesNotMatch(edge,/connect_hub_preset_entries|update\(\{.*enabled/);
 assert.match(edge,/connect_lab_hub_visibility/);
 assert.match(edge,/user\.is_anonymous/);
 assert.match(edge,/\.from\('connect_teachers'\)/);
 assert.match(edge,/\.eq\('class_id',TEST_CLASS\)\.eq\('teacher_id',user\.id\)\.eq\('can_manage',true\)/);
 assert.match(edge,/app\.data\.enabled!==true/);
});
