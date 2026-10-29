import test from 'node:test';import assert from 'node:assert/strict';
import {hydrateNativeRecords} from '../apps/addition-plusieurs/connect-hydration.mjs';
const a='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',b='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const scope='connect.'+a+'.'+b;
const storage=()=>{const map=new Map();return {map,getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,String(v))}};
const key=k=>'mathas.addition-plusieurs.game.'+scope+'.v1:'+k;
test('server classics, sudden, hard and progress hydrate exact native V6.0.2 storage',()=>{
 const db=storage();
 const state={
  classic:[{4:4,10:9,20:17},{10:10},{20:20}],
  sudden:[6,12,null],hard:[7,null,3],hardThree:[5,4,2],
  progress:{level2:true}
 };
 assert.equal(hydrateNativeRecords({storage:db,scope,state}),true);
 assert.deepEqual(JSON.parse(db.getItem(key('addition2_classic_v1'))),{levels:{'1':{'4':4,'10':9,'20':17},'2':{'10':10},'3':{'20':20}}});
 assert.deepEqual(JSON.parse(db.getItem(key('addition2_sudden_v1'))),{levels:{'1':6,'2':12}});
 assert.deepEqual(JSON.parse(db.getItem(key('addition2_hard_sudden_v3'))),{'1':7,'3':3});
 assert.deepEqual(JSON.parse(db.getItem(key('addition2_hard_three_v2'))),{'1':5,'2':4,'3':2});
 assert.deepEqual(JSON.parse(db.getItem(key('mathas_progression_addition_plusieurs_v1'))),{
  sudden1:true,sudden2:true,sudden3:true,perfect1:false,perfect2:true,perfect3:true,
  level2:true,level3:true,hard:false
 });
});
test('teacher reset replaces stale native records with empty server state',()=>{
 const db=storage();
 db.setItem(key('addition2_classic_v1'),JSON.stringify({levels:{1:{4:4}}}));
 db.setItem(key('addition2_hard_three_v2'),JSON.stringify({1:5}));
 hydrateNativeRecords({storage:db,scope,state:null});
 assert.deepEqual(JSON.parse(db.getItem(key('addition2_classic_v1'))),{levels:{}});
 assert.deepEqual(JSON.parse(db.getItem(key('addition2_hard_three_v2'))),{});
});
test('queued offline results must not be overwritten by stale server bests',()=>{
 const db=storage();db.setItem(key('addition2_classic_v1'),'local-new-best');
 assert.equal(hydrateNativeRecords({storage:db,scope,state:{},pending:1}),false);
 assert.equal(db.getItem(key('addition2_classic_v1')),'local-new-best');
});
test('untrusted server score or foreign namespace cannot overwrite local storage',()=>{
 const db=storage();
 for(const state of [{classic:[{4:5}]},{hardThree:[6]},{sudden:[-1]},{classic:[{20:'20'}]}])
  assert.throws(()=>hydrateNativeRecords({storage:db,scope,state}),/invalid_/);
 assert.equal(db.map.size,0);
 assert.throws(()=>hydrateNativeRecords({storage:db,scope:'libre',state:{}}),/invalid_hydration_scope/);
});
