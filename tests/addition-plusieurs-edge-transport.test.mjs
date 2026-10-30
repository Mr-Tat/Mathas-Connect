import test from 'node:test';import assert from 'node:assert/strict';import {createEdgePost} from '../apps/addition-plusieurs/edge-transport.mjs';
test('auth token provided only per event; no polling and one HTTP post',async()=>{
 let calls=0,auth=0;const post=createEdgePost({endpoint:'https://example.test/functions/v1/connect-results',apikey:'public',getToken:async()=>{auth++;return 'token'},fetchImpl:async(_url,opts)=>{calls++;assert.equal(opts.method,'POST');assert.equal(opts.headers.authorization,'Bearer token');return {ok:true,json:async()=>({ok:true,revision:1,resetEpoch:0})}}});
 assert.equal((await post({eventId:'x'})).revision,1);assert.equal(calls,1);assert.equal(auth,1);
});
test('403 and unverified success never imply saved event',async()=>{
 const base={endpoint:'https://example.test/f',apikey:'public',getToken:async()=> 'token'};
 assert.deepEqual(await createEdgePost({...base,fetchImpl:async()=>({ok:false,status:403,json:async()=>({error:'app_disabled'})})})({}),{ok:false,status:403,error:'app_disabled'});
 assert.equal((await createEdgePost({...base,fetchImpl:async()=>({ok:true,status:200,json:async()=>({})})})({})).ok,false);
});
