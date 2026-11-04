import test from 'node:test';
import assert from 'node:assert/strict';
import {rankMultiClass,splitProjectedRanking} from '../projection-v2-model.mjs';
const mk=(classId,name,n,start=0)=>({classId,name,students:Array.from({length:n},(_,i)=>({
 id:classId+'-'+i,name:name+' '+i,level:4,trophies:2,
 scores:[{appKey:'addition-ecrite-simple',bestScore:start+(n-i)*10}]
}))});
const A=mk('A','Phase 2 A',14,0),B=mk('B','Phase 2 B',14,100);
test('Projection : Score coché => classe jointe au défi, 16 meilleurs seulement, 8 + 8',()=>{
 const p=rankMultiClass({classes:[A,B],primaryClassId:'A',scoreClassIds:['B'],
  appKey:'addition-ecrite-simple',limit:16});
 assert.equal(p.length,16);assert.ok(p.some(x=>x.classId==='B'));
 assert.ok(p.some(x=>x.classId==='A'));assert.equal(p[0].classId,'B');
 assert.deepEqual(splitProjectedRanking(p,true).map(x=>x.length),[8,8]);
 assert.deepEqual(splitProjectedRanking(p.slice(0,10),true).map(x=>x.length),[5,5]);
 const distinct=[...new Set(p.map(x=>x.score))];
 assert.deepEqual(p.map(x=>x.position),p.map(x=>distinct.indexOf(x.score)+1),
  'Chaque score différent reçoit un rang, les ex aequo partagent le leur');
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
 assert.deepEqual(p,[],'un jeu sans score publié ne réutilise aucune carte d’un autre jeu');
 assert.deepEqual(splitProjectedRanking(p,false),[[]]);
});
test('Projection : chaque jeu n’affiche que ses vrais joueurs, sans héritage de l’addition',()=>{
 const classes=[{classId:'A',name:'A',students:[
  {id:'add',name:'Addition uniquement',scores:[{appKey:'addition-ecrite-simple',bestScore:123}]},
  {id:'sub',name:'Soustraction uniquement',scores:[{appKey:'soustraction-ecrite-simple',bestScore:45}]},
  {id:'both',name:'Deux scores',scores:[
   {appKey:'addition-ecrite-simple',bestScore:75},
   {appKey:'soustraction-ecrite-simple',bestScore:18}]},
  {id:'missing',name:'Aucun record',scores:[]},
  {id:'invalid',name:'Score non valide',scores:[{appKey:'soustraction-ecrite-simple',bestScore:null}]}
 ]}];
 const addition=rankMultiClass({classes,primaryClassId:'A',appKey:'addition-ecrite-simple'});
 const subtraction=rankMultiClass({classes,primaryClassId:'A',appKey:'soustraction-ecrite-simple'});
 const multiplication=rankMultiClass({classes,primaryClassId:'A',appKey:'multiplication-ecrite-simple'});
 assert.deepEqual(addition.map(x=>[x.id,x.score]),[['add',123],['both',75]]);
 assert.deepEqual(subtraction.map(x=>[x.id,x.score]),[['sub',45],['both',18]]);
 assert.deepEqual(multiplication,[]);
 assert.ok(addition.every(x=>x.score!==null));
 assert.ok(subtraction.every(x=>x.score!==null));
});

test('Projection : scores égaux dans une même classe ou entre classes => même podium',()=>{
 const classes=[
  {classId:'A',name:'A',students:[
   {id:'a1',name:'Amine',scores:[{appKey:'addition-ecrite-simple',bestScore:150}]},
   {id:'a2',name:'Emma',scores:[{appKey:'addition-ecrite-simple',bestScore:130}]},
   {id:'a3',name:'Hugo',scores:[{appKey:'addition-ecrite-simple',bestScore:110}]},
   {id:'a4',name:'Lina',scores:[{appKey:'addition-ecrite-simple',bestScore:90}]}
  ]},
  {classId:'B',name:'B',students:[
   {id:'b1',name:'Zoé',scores:[{appKey:'addition-ecrite-simple',bestScore:150}]},
   {id:'b2',name:'Théo',scores:[{appKey:'addition-ecrite-simple',bestScore:130}]},
   {id:'b3',name:'Yanis',scores:[{appKey:'addition-ecrite-simple',bestScore:110}]}
  ]}
 ];
 const rows=rankMultiClass({classes,primaryClassId:'A',scoreClassIds:['B'],
  appKey:'addition-ecrite-simple'});
 assert.deepEqual(rows.map(x=>[x.score,x.position]),[
  [150,1],[150,1],[130,2],[130,2],[110,3],[110,3],[90,4]
 ]);
 assert.deepEqual(rows.map(x=>x.classId),['A','B','A','B','A','B','A']);
});
