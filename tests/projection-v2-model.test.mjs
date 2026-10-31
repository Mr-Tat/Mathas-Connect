import test from 'node:test';
import assert from 'node:assert/strict';
import {rankApplication,splitRanking,classScore,summarizeStartedExercises,resetScorePeriod} from '../projection-v2-model.mjs';

const students=Array.from({length:14},(_,i)=>({id:'id'+i,classId:'A',publicName:'Élève '+i,level:3,trophies:2}));
const events=[
 {classId:'A',appKey:'addition',studentId:'id0',value:30,at:'2026-10-01T12:00:00Z'},
 {classId:'A',appKey:'addition',studentId:'id0',value:20,at:'2026-10-10T12:00:00Z'},
 {classId:'A',appKey:'addition',studentId:'id1',value:21,at:'2026-10-10T12:00:00Z'},
 {classId:'A',appKey:'multiplication',studentId:'id0',value:5000,at:'2026-10-10T12:00:00Z'},
 {classId:'B',appKey:'addition',studentId:'id0',value:9999,at:'2026-10-10T12:00:00Z'}
];
test('projection : meilleur score par appli et classe, jamais XP ni points cumulés',()=>{
 const p=rankApplication({students,events,classId:'A',appKey:'addition',since:'2026-09-01T00:00:00Z'});
 assert.equal(p[0].id,'id0');assert.equal(p[0].score,30);
 assert.equal(p[1].id,'id1');assert.equal(p[1].score,21);
 assert.equal(p.filter(x=>x.score===null).length,12);
 assert.equal(classScore(p),51);
});
test('projection : période de score isolée, reset A/addition sans toucher B/multiplication',()=>{
 const periods=[{classId:'A',appKey:'addition',since:'2026-09-01T00:00:00Z'},{classId:'A',appKey:'multiplication',since:'2026-09-01T00:00:00Z'},{classId:'B',appKey:'addition',since:'2026-09-01T00:00:00Z'}];
 const next=resetScorePeriod(periods,'A','addition','2026-10-05T00:00:00Z');
 assert.equal(periods[0].since,'2026-09-01T00:00:00Z');
 assert.deepEqual(next.slice(1),periods.slice(1));
 const p=rankApplication({students,events,classId:'A',appKey:'addition',since:next[0].since});
 assert.equal(p[0].id,'id1');assert.equal(p.find(x=>x.id==='id0').score,20);
});
test('projection : 7 élèves une colonne, 8 à 14 deux colonnes',()=>{
 assert.deepEqual(splitRanking(students.slice(0,7)).map(x=>x.length),[7]);
 assert.deepEqual(splitRanking(students.slice(0,8)).map(x=>x.length),[4,4]);
 assert.deepEqual(splitRanking(students).map(x=>x.length),[7,7]);
 assert.deepEqual(splitRanking(students.concat(students)).map(x=>x.length),[7,7]);
});
test('projection : % exact sur exercices réellement commencés, sans Mort subite ni doublons',()=>{
 const q=[
 {classId:'A',appKey:'addition',studentId:'id0',exerciseId:'q1',mode:'classic',started:true,correct:false},
 {classId:'A',appKey:'addition',studentId:'id0',exerciseId:'q1',mode:'classic',started:true,correct:true},
 {classId:'A',appKey:'addition',studentId:'id1',exerciseId:'q2',mode:'hard',started:true,correct:false},
 {classId:'A',appKey:'addition',studentId:'id1',exerciseId:'q3',mode:'sudden',started:true,correct:true},
 {classId:'B',appKey:'addition',studentId:'id1',exerciseId:'q4',mode:'classic',started:true,correct:false},
 {classId:'A',appKey:'multiplication',studentId:'id1',exerciseId:'q5',mode:'classic',started:true,correct:false}
 ];
 assert.deepEqual(summarizeStartedExercises({events:q,classId:'A',appKeys:['addition']}),{started:2,correct:1,percentage:50});
 assert.deepEqual(summarizeStartedExercises({events:q,classId:'A',appKeys:['addition','multiplication']}),{started:3,correct:1,percentage:33.3});
 assert.deepEqual(summarizeStartedExercises({events:q,classId:'B',appKeys:['addition']}),{started:1,correct:0,percentage:0});
 assert.equal(summarizeStartedExercises({events:q,classId:'A',appKeys:['soustraction']}).percentage,null);
});
test('projection : Monsieur T masqué par défaut, niveaux et trophées sans mutation',()=>{
 const people=[...students,{id:'teacher',classId:'A',publicName:'Monsieur T',isTeacher:true,level:5,trophies:9}];
 const hidden=rankApplication({students:people,events,classId:'A',appKey:'addition',since:'2026-09-01T00:00:00Z'});
 const shown=rankApplication({students:people,events,classId:'A',appKey:'addition',since:'2026-09-01T00:00:00Z',includeTeacher:true});
 assert.equal(hidden.length,14);assert.equal(shown.length,15);
 assert.equal(shown.find(x=>x.id==='teacher').level,5);
 assert.equal(shown.find(x=>x.id==='teacher').trophies,9);
});
