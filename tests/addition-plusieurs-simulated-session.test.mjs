import test from 'node:test';import assert from 'node:assert/strict';import {createSimulatedSession} from '../apps/addition-plusieurs/simulated-session.mjs';
test('end-to-end simulated classic result: queued, server ack, persisted empty queue',async()=>{
 const data=new Map(),store={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)};
 const statuses=[],sent=[];const session=createSimulatedSession({storage:store,uuid:()=> '123e4567-e89b-42d3-a456-426614174000',post:async req=>{sent.push(req);return {ok:true,revision:1,resetEpoch:0,xp:{delta:22,appXp:22,total:22}}},onStatus:s=>statuses.push(s)});
 assert.equal(session.completed({label:'Calculs · Niveau 1',score:'4/4'}),true);
 assert.equal(session.pending(),1);assert.equal((await session.flush()).remaining,0);
 assert.equal(sent[0].points,0);assert.equal(sent[0].mode,'classic');assert.equal(session.revision,1);
 assert.deepEqual(statuses,['queued','saved']);
});
test('refused result stays pending and is not awarded optimistically',async()=>{
 const m=new Map(),storage={getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v)};
 const statuses=[];const q=createSimulatedSession({storage,uuid:()=> '123e4567-e89b-42d3-a456-426614174001',post:async()=>({ok:false,status:409,error:'stale_reset_epoch'}),onStatus:s=>statuses.push(s)});
 q.completed({label:'Mort subite · Niveau 2',score:'10'});
 assert.equal((await q.flush()).remaining,1);assert.deepEqual(statuses,['queued','conflict']);
});
