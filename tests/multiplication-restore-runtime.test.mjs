import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const source=readFileSync(new URL('../apps/multiplication-simple/index.html',import.meta.url),'utf8');
const begin=source.indexOf('function apply(state){'),end=source.indexOf('function clearConnectedScoreCache()',begin);
assert.ok(begin>=0&&end>begin,'restore function must be present');
const applySource=source.slice(begin,end);
function restore(state){
 const items=new Map();
 runInNewContext(applySource+';apply(state)',{state,put:(key,value)=>items.set(key,value),Intl,Date,Number});
 return items;
}
test('Multiplication restoration preserves three distinct classic totals per level',()=>{
 const m=restore({classic:[{4:4,10:9,20:18},{4:3,10:10,20:19},{4:2,10:8,20:17}]});
 const c=m.get('multi1_classic_v1');
 assert.equal(Object.keys(c).length,9);
 for(const [level,values] of [[1,[4,9,18]],[2,[3,10,19]],[3,[2,8,17]]]){
  for(const [index,total] of [4,10,20].entries()){
   assert.deepEqual(JSON.parse(JSON.stringify(c[level+'|2-3-4-5-6-7-8-9|connect-'+total])),{score:values[index],total});
  }
 }
});
test('Multiplication restoration keeps HARD challenge and sudden separate',()=>{
 const m=restore({sudden:[5,10,12],hard:[3,6,8],hardThree:[4,5,3]});
 assert.equal(m.get('multi1_sudden_v1')['2|2-3-4-5-6-7-8-9'],10);
 assert.equal(m.get('multi1_hard_sudden_v1')['2'],6);
 assert.equal(m.get('multi1_hard_three_v1')['2'],5);
});
test('Empty new parcours creates no phantom classic records',()=>{
 const c=restore({classic:[{},{},{}],progress:{}}).get('multi1_classic_v1');
 assert.deepEqual(Object.keys(c),[]);
});
