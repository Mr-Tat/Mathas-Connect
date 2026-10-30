import test from 'node:test';import assert from 'node:assert/strict';import {createQueue} from '../apps/addition-plusieurs/offline-queue.mjs';
function mem(){const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v)}}
test('pending event survives reload; duplicate ignored; ack only matching event',()=>{const storage=mem(),key='mathas.addition-plusieurs.connect.class.student.v1';let q=createQueue(storage,key);assert.equal(q.enqueue({eventId:'a'}),true);assert.equal(q.enqueue({eventId:'b'}),true);assert.equal(q.enqueue({eventId:'a'}),false);q=createQueue(storage,key);assert.equal(q.count(),2);assert.equal(q.acknowledge('a'),true);assert.deepEqual(q.read().map(x=>x.eventId),['b']);assert.equal(q.acknowledge('a'),false);});
test('reject global namespace, corrupt item and overflowing queue',()=>{const storage=mem();assert.throws(()=>createQueue(storage,'mathas.scores'));const q=createQueue(storage,'mathas.addition-plusieurs.connect.test');assert.throws(()=>q.enqueue({}));for(let i=0;i<100;i++)q.enqueue({eventId:String(i)});assert.throws(()=>q.enqueue({eventId:'extra'}));});

test('teacher reset quarantines old pending events without mixing the new parcours',()=>{
 const storage=mem(),key='mathas.addition-plusieurs.connect.classA.studentB.v1';
 let queue=createQueue(storage,key);
 queue.enqueue({eventId:'old1',expectedResetEpoch:0});
 queue.enqueue({eventId:'old2',expectedResetEpoch:0});
 queue.enqueue({eventId:'new',expectedResetEpoch:2});
 assert.equal(queue.quarantineEpoch(2),2);
 assert.deepEqual(queue.read().map(x=>x.eventId),['new']);
 assert.equal(queue.archivedCount(),2);
 queue=createQueue(storage,key);
 assert.equal(queue.archivedCount(),2);
 assert.equal(queue.quarantineEpoch(2),0);
 assert.deepEqual(queue.read().map(x=>x.eventId),['new']);
});
test('failed quarantine archive write cannot erase pending progress',()=>{
 const map=new Map();let block=false;
 const storage={getItem:k=>map.get(k)??null,setItem(k,v){if(block&&k.endsWith('.previous-parcours.v1'))throw Error('quota');map.set(k,v)}};
 const q=createQueue(storage,'mathas.addition-plusieurs.connect.class.student.v1');
 q.enqueue({eventId:'keep',expectedResetEpoch:0});
 block=true;
 assert.throws(()=>q.quarantineEpoch(1),/quota/);
 assert.deepEqual(q.read().map(x=>x.eventId),['keep']);
});
