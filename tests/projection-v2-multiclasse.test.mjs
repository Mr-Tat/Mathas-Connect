import test from 'node:test';
import assert from 'node:assert/strict';
import {rankMultiClass,splitProjectedRanking} from '../projection-v2-model.mjs';
const mk=(classId,name,n,start=0)=>({classId,name,students:Array.from({length:n},(_,i)=>({
 id:classId+'-'+i,name:name+' '+i,level:4,trophies:2,
 scores:[{appKey:'addition-ecrite-simple',bestScore:start+(n-i)*10}]
}))});
const A=mk('A','Phase 2 A',14,0),B=mk('B','Phase 2 B',14,100);
test('Projection : Score coché => classe jointe au défi, 20 meilleurs seulement, 10 + 10',()=>{
 const p=rankMultiClass({classes:[A,B],primaryClassId:'A',scoreClassIds:['B'],
  appKey:'addition-ecrite-simple',limit:20});
 assert.equal(p.length,20);assert.ok(p.some(x=>x.classId==='B'));
 assert.ok(p.some(x=>x.classId==='A'));assert.equal(p[0].classId,'B');
 assert.deepEqual(splitProjectedRanking(p,true).map(x=>x.length),[10,10]);
 assert.deepEqual(p.map(x=>x.position),Array.from({length:20},(_,i)=>i+1));
});
test('Projection : % coché seul ne doit jamais ajouter les scores des autres classes',()=>{
 const p=rankMultiClass({classes:[A,B],primaryClassId:'A',scoreClassIds:[],
  appKey:'addition-ecrite-simple'});
 assert.equal(p.length,14);assert.ok(p.every(x=>x.classId==='A'));
 assert.deepEqual(splitProjectedRanking(p,false).map(x=>x.length),[7,7]);
});
test('Projection : un score absent ne remplace jamais un vrai résultat',()=>{
 const C={classId:'C',name:'Autre',students:[{id:'none',name:'Pseudonyme',scores:[]}]};
 const p=rankMultiClass({classes:[A,C],primaryClassId:'A',scoreClassIds:['C'],
  appKey:'addition-ecrite-simple'});
 assert.equal(p.some(x=>x.classId==='C'),false);
});
test('Projection : score des applications jamais mélangé',()=>{
 const p=rankMultiClass({classes:[A,B],primaryClassId:'A',scoreClassIds:['B'],
  appKey:'multiplication-ecrite-simple'});
 assert.equal(p.every(x=>x.score===null),true);
 assert.equal(p.some(x=>x.classId==='B'),false);
});
