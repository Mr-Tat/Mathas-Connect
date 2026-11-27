import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {grantNativeTeacherAccess} from '../apps/teacher-free-native.mjs';
import {schoolProgressSnapshot,schoolModeAllowed} from '../apps/objective-record/school-official-unlocks.mjs';
import {canPlay,initialState,applyJudgement} from '../apps/DIV-Milieu-de-segment-1/connect/reward-contract.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('Teacher access patches native gates, does not use Master or fake storage',()=>{
 for(const p of ['apps/multiplication-simple/game-original.html','apps/soustraction-simple/game-original.html','apps/calculs-melanges/game-original.html','apps/addition-plusieurs/game-original.html','apps/objective-record/engines/addition-simple/game-original.html','apps/objective-record/engines/addition-multiple/index.html']){
  const raw=read(p);assert.equal(grantNativeTeacherAccess(raw,false),raw);
  const html=grantNativeTeacherAccess(raw,true);
  assert.equal((html.match(/if\(!raw&&\(window\.__masterMode\|\|window\.__mathasTeacherFree===true\)\)/g)||[]).length,2,p);
  assert.match(html,/Object.defineProperty\(window,"__mathasTeacherFree",\{value:true\}\)/,p);
  assert.equal(html.includes('window.__mathasTeacherFree=true'),false,p);
  assert.equal(html.split('window.__masterMode=true').length,raw.split('window.__masterMode=true').length,p);
 }
});
test('All school addition modes open to authenticated professor, actual records untouched',()=>{
 for(const app of ['addition-ecrite-simple','addition-ecrite-multiple']){
  const student=schoolProgressSnapshot(app,{}),teacher=schoolProgressSnapshot(app,{},{teacherFree:true});
  assert.deepEqual(teacher.progress,student.progress);assert.deepEqual(teacher.hardRecords,student.hardRecords);assert.deepEqual(teacher.records,student.records);
  for(const mode of ['classic','sudden','three-lives','hard-sudden','hard-three-lives'])for(const level of [1,2,3]){
    assert.equal(schoolModeAllowed(teacher,mode,level),true);
    assert.equal(schoolModeAllowed(student,mode,level),mode==='classic'&&level===1);
  }
  assert.equal(schoolModeAllowed(teacher,'bogus',1),false);assert.equal(schoolModeAllowed(teacher,'classic',4),false);
 }
});
test('Milieu: all activities and challenges independent of class cap for teacher, reward remains genuine',()=>{
 const blank=initialState();
 for(const k of ['even','odd','mix','gi1','gi2','decimal1','decimal2','decimal3','g1','g2','g3'])assert.equal(canPlay(blank,k,null,true,4),true,k);
 for(const k of ['gi2','g3'])for(const mode of ['sudden','lives']){
  assert.equal(canPlay(blank,k,mode,true,4),true);
  assert.equal(canPlay(blank,k,mode,false,4),false);
 }
 assert.equal(canPlay(blank,'even','sudden',true),false);
 assert.deepEqual(blank,initialState());
});
