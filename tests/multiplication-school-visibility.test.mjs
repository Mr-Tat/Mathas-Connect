import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MULTIPLICATION_TEST_CLASS,MULTIPLICATION_SCHOOL_PRESETS,
 multiplicationSchoolPreset,mayStartMultiplicationSchoolProof}
 from '../supabase/functions/connect-multiplication-school/school-visibility.mjs';

const edge=readFileSync(
 new URL('../supabase/functions/connect-multiplication-school/index.ts',import.meta.url),'utf8');
const pairs=[
 ['8fe170fa-9e8f-4e80-885a-b0ba68026f64','observation'],
 ['71f5f4a5-3f25-4ec7-ac29-c33d2e6b395e','phase1'],
 ['1b021ed9-4846-4203-9c7b-4b5fa8d7adab','phase2'],
 ['0d8ba828-59cc-468b-a4b8-7b2a1af10b88','phase2b'],
 ['a9195199-0a28-4e86-99ce-47b36dd6e646','2eco']
];
test('TEST class alone can start while all five school presets are hidden',()=>{
 assert.equal(MULTIPLICATION_TEST_CLASS,'4bf3400d-a315-4ea4-a2f3-afaca24dc9b9');
 assert.equal(Object.keys(MULTIPLICATION_SCHOOL_PRESETS).length,5);
 assert.equal(mayStartMultiplicationSchoolProof(MULTIPLICATION_TEST_CLASS,null),true);
 for(const [cls,slug] of pairs){
  assert.equal(multiplicationSchoolPreset(cls),slug);
  assert.equal(mayStartMultiplicationSchoolProof(cls,false),false);
  assert.equal(mayStartMultiplicationSchoolProof(cls,null),false);
  assert.equal(mayStartMultiplicationSchoolProof(cls,true),true);
 }
});
test('invalid or foreign classes are denied even if a catalog flag is true',()=>{
 for(const cls of ['',undefined,'11111111-1111-4111-8111-111111111111']){
  assert.equal(multiplicationSchoolPreset(cls),null);
  assert.equal(mayStartMultiplicationSchoolProof(cls,true),false);
 }
});
test('authenticated Edge uses the same mapping and checks preset visibility server-side',()=>{
 assert.match(edge,/getUser\(token\)/);
 assert.match(edge,/\.eq\('state','approved'\)/);
 assert.match(edge,/\.eq\('class_id',cls\)\.is\('left_at',null\)/);
 assert.match(edge,/\.eq\('app_key',APP\)/);
 assert.match(edge,/if\(start&&cls!==MULTIPLICATION_TEST_CLASS\)/);
 assert.match(edge,/db\.from\('connect_hub_preset_entries'\)\.select\('visible'\)/);
 assert.match(edge,/\.eq\('preset_slug',preset\)\.eq\('app_key',APP\)/);
 assert.match(edge,/mayStartMultiplicationSchoolProof\(cls,entry\?\.visible===true\)/);
 assert.match(edge,/school_app_not_open_for_class/);
 assert.match(edge,/if\(app\?\.enabled!==true\)return deny\('app_disabled',403\)/); // catalog global status is separately checked
 assert.doesNotMatch(edge,/SERVICE_ROLE_KEY[^\n]*authorization/i);
});
test('school hide during a session prevents new challenges but not proven finish',()=>{
 assert.match(edge,/const start=classicStart\|\|extendedStart,finish=classicFinish\|\|extendedFinish/);
 assert.match(edge,/if\(start&&cls!==MULTIPLICATION_TEST_CLASS\)/);
});


test('official school Multiplication links use certified native launcher, with explicit Connect in school mode',()=>{
 const hub=readFileSync(new URL('../hub.js',import.meta.url),'utf8');
 const launcher=readFileSync(new URL('../apps/multiplication-simple/index.html',import.meta.url),'utf8');
 assert.match(hub,/SCHOOL_CLASS_IDS\.includes\(classId\)&&app\.app_key==='multiplication-ecrite-simple'/);
 assert.match(hub,/schoolMultiplication\?'\.\/apps\/multiplication-simple\/'/);
 assert.match(hub,/schoolMultiplication && !inFreeMode\(\) && target\.origin===location\.origin/);
 assert.match(hub,/if\(testMultiplication && target\.origin===location\.origin\)/);
 assert.match(hub,/target\.searchParams\.set\('requireConnect','1'\)/);
 assert.match(launcher,/const isTestClass=classId==='4bf3400d-a315-4ea4-a2f3-afaca24dc9b9'/);
 assert.match(launcher,/Connexion Connect obligatoire pour les résultats officiels de multiplication/);
 assert.match(launcher,/Se connecter à ma classe/);
 assert.match(launcher,/if\(isTestClass\)\{/);
 assert.match(launcher,/target\.searchParams\.set\('lab','1'\)/);
 assert.match(launcher,/connectionCheckRequired\|\|teacherPlayer\|\|requireConnect/);
});
