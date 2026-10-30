import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const teacher=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const hub=readFileSync(new URL('../hub.js',import.meta.url),'utf8');
const edge=readFileSync(new URL('../supabase/functions/connect-results/index.ts',import.meta.url),'utf8');
test('Addition multiple professor results enabled for direct-link teacher tests',()=>{
 assert.match(teacher,/const ADD_MULTI_TEACHER_READY=true/);
 assert.match(teacher,/const additionMultipleAllowed=appKey=>ADD_MULTI_TEACHER_READY&&appKey==='addition-ecrite-multiple'/);
 assert.match(teacher,/\(ADD_MULTI_TEACHER_READY\?\[multiTeacherMeta\]:\[\]\)/);
 assert.match(teacher,/additionMultipleAllowed\(app\.app_key\)/);
 assert.match(teacher,/additionMultipleAllowed\(\$\('results-app'\)\.value\)/);
 assert.match(teacher,/additionMultipleAllowed\(appKey\)/);
 assert.match(edge,/const ADD_MULTI_SERVER_READY=true/);
});
test('teacher sees native classic, sudden, hard and challenge records once approved',()=>{
 assert.match(teacher,/state\.classic\?\.\[i\]/);
 assert.match(teacher,/state\.sudden\?\.\[i\]/);
 assert.match(teacher,/state\.hard\?\.\[i\]/);
 assert.match(teacher,/state\.hardThree\?\.\[i\]/);
 assert.match(edge,/if\(b\.action==='teacher-overview'\)/);
});

test('teacher launches Addition multiple with its selected class and professor profile, whether from matrix or HUB',()=>{
 // A raw launch_url from the teacher Applications matrix is otherwise free mode.
 assert.ok(teacher.includes("app.app_key==='soustraction-ecrite-simple'||app.app_key==='addition-ecrite-multiple'"));
 assert.ok(teacher.includes("if(!teacherPlayerActive){event.preventDefault()"));
 assert.ok(teacher.includes("target.searchParams.set('class',currentClass)"));
 assert.ok(teacher.includes("target.searchParams.set('joueur','prof')"));
 // The HUB also preserves the teacher session after Jouer avec Monsieur T.
 assert.ok(hub.includes("'soustraction-ecrite-simple','addition-ecrite-multiple'].includes(app.app_key)) target.searchParams.set('joueur','prof')"));
 assert.ok(hub.includes("if (classId && target.origin === location.origin) target.searchParams.set('class', classId)"));
 // Neither file adds the game to static fallback: visibility stays per-space.
 assert.ok(hub.includes("data.apps.map(a=>({...a,image_url:"));
});
