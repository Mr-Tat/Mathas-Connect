import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const teacher=readFileSync(new URL('../app.js',import.meta.url),'utf8');
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
