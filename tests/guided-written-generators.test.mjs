import test from 'node:test';
import assert from 'node:assert/strict';
import {WRITTEN_GUIDED_APPS,maxDigitsForLevel,addendCountForLevel,generateOperation,generatePage,additionCarries,borrowPattern} from '../supabase/functions/connect-guided-written/generators.mjs';
test('Générateurs des trois guidés, deux calculs par page',()=>{
 for(const app of WRITTEN_GUIDED_APPS)for(const level of [1,2,3]){
  const pages=generatePage(app,level);
  assert.equal(pages.length,2);
  for(const op of pages){
   const width=maxDigitsForLevel(level,app);
   if(app==='addition-ecrite-multiple'){
    assert.equal(op.addends.length,addendCountForLevel(level));
    assert.equal(Math.max(...op.addends.map(x=>x.length)),width);
    assert.ok(op.addends.every(x=>/^\d+$/.test(x)));
   }else{
    assert.equal(op.a.length,width);
    assert.ok(/^\d+$/.test(op.b));
    if(app==='soustraction-ecrite-simple')assert.ok(BigInt(op.a)>BigInt(op.b));
   }
  }
 }
});
test('Reports des additions à plusieurs termes : jusqu’à 4',()=>{
 assert.deepEqual(additionCarries(['999','999','999','999','999']).incoming,[0,4,4]);
 assert.deepEqual(additionCarries(['247','35']).incoming,[0,1,0]);
});
test('Emprunts : le générateur distingue bien les deux cas',()=>{
 assert.deepEqual(borrowPattern('352','187'),[true,true,false]);
 assert.deepEqual(borrowPattern('890','120'),[false,false,false]);
 assert.equal(borrowPattern('100','999'),null);
});
test('Opérations illégales refusées',()=>{
 assert.throws(()=>generateOperation('multiplication-ecrite-simple',1),/invalid_guided_generator/);
 assert.throws(()=>generateOperation('addition-ecrite-simple',4),/invalid_guided_generator/);
});

test('Performance de génération : 10 pages de chaque niveau et application',()=>{
 const samples=[];
 for(const app of WRITTEN_GUIDED_APPS)for(const level of [1,2,3]){
  let slowest=0;
  for(let i=0;i<10;i++){
   const started=performance.now();
   const page=generatePage(app,level);
   const duration=performance.now()-started;
   slowest=Math.max(slowest,duration);
   assert.equal(page.length,2);
   // Limite large pour les machines CI partagées : détecte une boucle
   // de génération pathological, sans fixer les temps réels des PC.
   assert.ok(duration<2500,app+' niveau '+level+' : page lente '+duration.toFixed(0)+' ms');
  }
  samples.push(app+' N'+level+' maximum '+slowest.toFixed(1)+'ms');
 }
 console.log('Bench indicatif sur runner CI : '+samples.join(' ; '));
});
