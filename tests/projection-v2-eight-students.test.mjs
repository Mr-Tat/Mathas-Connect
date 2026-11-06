import test from 'node:test';
import assert from 'node:assert/strict';
import {splitProjectedRanking} from '../projection-v2-model.mjs';

test('Projection : de 0 à 8 élèves, une colonne avec une ou deux applications',()=>{
 for(const n of [0,1,7,8]){
  const rows=Array.from({length:n},(_,i)=>({id:i}));
  assert.deepEqual(splitProjectedRanking(rows).map(group=>group.length),[n]);
 }
});
test('Projection : à partir de 9 élèves, deux colonnes équilibrées',()=>{
 for(const [n,expected] of [[9,[5,4]],[15,[8,7]],[16,[8,8]]]){
  const rows=Array.from({length:n},(_,i)=>({id:i}));
  assert.deepEqual(splitProjectedRanking(rows).map(group=>group.length),expected);
 }
});
