import test from 'node:test';import assert from 'node:assert/strict';import {createQueue} from '../apps/addition-plusieurs/offline-queue.mjs';import {createSync} from '../apps/addition-plusieurs/sync-protocol.mjs';
const memory=()=>{const data=new Map();return {getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)}};
const make=()=>createQueue(memory(),'mathas.addition-plusieurs.connect.test.student');
test('accept only durable server acknowledgement, no double send',async()=>{let q=make(),calls=0;q.enqueue({eventId:'a',expectedRevision:0,expectedResetEpoch:0});q.enqueue({eventId:'b',expectedRevision:0,expectedResetEpoch:0});let sync=createSync({queue:q,post:async()=>{calls++;return {ok:true,revision:calls,resetEpoch:0}}});let [a,b]=await Promise.all([sync.flush(),sync.flush()]);assert.equal(calls,2);assert.equal(a.remaining,0);assert.equal(b.remaining,0);assert.equal(await sync.flush().then(x=>x.accepted),0)});
test('network failure retains all unsent events',async()=>{let q=make();q.enqueue({eventId:'a'});const s=createSync({queue:q,post:async()=>{throw Error('offline')}});assert.equal((await s.flush()).remaining,1)});
test('409 revision/reset epoch stops without removing queued event',async()=>{let q=make(),conflicts=0;q.enqueue({eventId:'a'});const s=createSync({queue:q,post:async()=>({ok:false,status:409,error:'stale_reset_epoch'}),onConflict:()=>conflicts++});assert.equal((await s.flush()).remaining,1);assert.equal(conflicts,1)});
test('unverified success is not an acknowledgement',async()=>{let q=make();q.enqueue({eventId:'a'});const s=createSync({queue:q,post:async()=>({ok:true})});assert.equal((await s.flush()).remaining,1)});

test('second queued event uses newly acknowledged revision and reset epoch',async()=>{
 const q=make();q.enqueue({eventId:'a',expectedRevision:4,expectedResetEpoch:2});q.enqueue({eventId:'b',expectedRevision:4,expectedResetEpoch:2});
 const sent=[];const sync=createSync({queue:q,post:async entry=>{sent.push({...entry});return {ok:true,revision:sent.length+4,resetEpoch:2}}});
 assert.equal((await sync.flush()).remaining,0);
 assert.equal(sent[0].expectedRevision,4);
 assert.equal(sent[1].expectedRevision,5);
 assert.equal(sent[1].expectedResetEpoch,2);
});

test('unexpected server epoch cannot discard pending results',async()=>{
 const q=make();q.enqueue({eventId:'a',expectedRevision:3,expectedResetEpoch:1});
 let conflicts=0;
 const sync=createSync({queue:q,post:async()=>({ok:true,revision:4,resetEpoch:2}),onConflict:()=>conflicts++});
 assert.equal((await sync.flush()).remaining,1);assert.equal(conflicts,1);
});
test('nonadvancing revision retains event',async()=>{
 const q=make();q.enqueue({eventId:'a',expectedRevision:3,expectedResetEpoch:1});
 const sync=createSync({queue:q,post:async()=>({ok:true,revision:3,resetEpoch:1})});
 assert.equal((await sync.flush()).remaining,1);
});

test('queued event from older parcours is never rebased after first acknowledgement',async()=>{
 const q=make();q.enqueue({eventId:'a',expectedRevision:0,expectedResetEpoch:2});q.enqueue({eventId:'b',expectedRevision:0,expectedResetEpoch:1});
 let sent=0,conflicts=0;
 const sync=createSync({queue:q,post:async()=>{sent++;return {ok:true,revision:1,resetEpoch:2}},onConflict:()=>conflicts++});
 const result=await sync.flush();
 assert.equal(sent,1);assert.equal(result.remaining,1);assert.equal(conflicts,1);
 assert.equal(q.read()[0].eventId,'b');
});

test('idempotent server duplicate is acknowledged without second XP award',async()=>{
 const q=make();q.enqueue({eventId:'already-saved',expectedRevision:6,expectedResetEpoch:2});
 let saved=0;const sync=createSync({queue:q,post:async()=>({ok:true,duplicate:true,revision:6,resetEpoch:2,xp:{delta:0}}),onAck:()=>saved++});
 const result=await sync.flush();assert.equal(result.remaining,0);assert.equal(saved,1);
});
test('fake duplicate with lower revision or new epoch stays queued',async()=>{
 for(const response of [{ok:true,duplicate:true,revision:5,resetEpoch:2},{ok:true,duplicate:true,revision:6,resetEpoch:3}]){
  const q=make();q.enqueue({eventId:'x',expectedRevision:6,expectedResetEpoch:2});
  const result=await createSync({queue:q,post:async()=>response}).flush();
  assert.equal(result.remaining,1);
 }
});

test('separate flush after acknowledgement uses current server revision',async()=>{
 const q=make();let revision=0,epoch=1;const sent=[];
 const sync=createSync({queue:q,getState:()=>({revision,resetEpoch:epoch}),
   post:async e=>{sent.push({...e});return {ok:true,revision:e.expectedRevision+1,resetEpoch:epoch}},
   onAck:(_e,response)=>{revision=response.revision}});
 q.enqueue({eventId:'first',expectedRevision:0,expectedResetEpoch:1});
 assert.equal((await sync.flush()).remaining,0);
 q.enqueue({eventId:'second',expectedRevision:0,expectedResetEpoch:1});
 assert.equal((await sync.flush()).remaining,0);
 assert.equal(sent[1].expectedRevision,1);
 assert.equal(revision,2);
});
