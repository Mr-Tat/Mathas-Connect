import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('le laboratoire reste réservé au professeur et à la classe TEST connue',()=>{
 const script=read('laboratoire.js'),html=read('laboratoire.html'),home=read('index.html');
 assert.match(script,/mathas-connect-professor-auth-v1/);
 assert.match(script,/4bf3400d-a315-4ea4-a2f3-afaca24dc9b9/);
 assert.match(script,/teacher-dashboard/);
 assert.match(script,/r\.classes\|\|\[\]/);
 assert.match(html,/id="fictive-confirm"/);
 assert.match(home,/laboratoire\.html/);
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
