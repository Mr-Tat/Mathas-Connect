import test from 'node:test';import assert from 'node:assert/strict';
import {createAuthenticatedHost,CONNECT_APP} from '../apps/addition-plusieurs/connect-host.mjs';
const classId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const student='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const teacher='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const session=(id,anonymous=true,token='token-a')=>({user:{id,is_anonymous:anonymous},access_token:token});
function backend({user=session(student),profile={ok:true,status:'approved',classId},loaded={ok:true,revision:3,resetEpoch:1,state:{}}}={}){
 let current=user;
 const calls=[],sdk=[];
 const createClient=(url,key,options)=>{sdk.push({url,key,options});return {auth:{getSession:async()=>({data:{session:current}})}}};
 const fetchImpl=async(url,opts)=>{
  const body=JSON.parse(opts.body);calls.push({url,headers:opts.headers,body});
  const data=url.endsWith('/connect-api')?profile:loaded;
  return {ok:true,json:async()=>data};
 };
 return {createClient,fetchImpl,calls,sdk,setSession:v=>{current=v}};
}
test('approved student uses existing SDK, profile authorization and real student-load action',async()=>{
 const h=backend();
 const host=await createAuthenticatedHost({classId,createClient:h.createClient,fetchImpl:h.fetchImpl});
 assert.equal(host.studentId,student);
 assert.equal(host.classId,classId);
 assert.equal(h.calls.length,1);
 assert.equal(h.calls[0].body.action,'student-me');
 assert.equal(h.sdk[0].options.auth.persistSession,true);
 assert.equal(h.sdk[0].options.auth.detectSessionInUrl,false);
 const state=await host.load();
 assert.deepEqual(state,{ok:true,revision:3,resetEpoch:1,state:{}});
 assert.deepEqual(h.calls[1].body,{action:'student-load',classId,appKey:CONNECT_APP});
 assert.equal(h.calls[1].headers.authorization,'Bearer token-a');
 h.setSession(session(student,true,'token-refreshed'));
 assert.equal(await host.getToken(),'token-refreshed');
 assert.equal(h.calls.length,2,'no polling or extra requests');
});
test('teacher uses independent professor session and verified teacher-player',async()=>{
 const h=backend({user:session(teacher,false)});
 const host=await createAuthenticatedHost({classId,teacherPlayer:true,createClient:h.createClient,fetchImpl:h.fetchImpl});
 assert.equal(h.calls[0].body.action,'teacher-player');
 assert.equal(h.sdk[0].options.auth.storageKey,'mathas-connect-professor-auth-v1');
 assert.equal(host.studentId,teacher);
});
test('auth missing, incorrect identity and unapproved profile block launch',async()=>{
 for(const user of [null,session(teacher,false)]){
  const h=backend({user});
  await assert.rejects(createAuthenticatedHost({classId,createClient:h.createClient,fetchImpl:h.fetchImpl}),/connect_session_missing/);
  assert.equal(h.calls.length,0);
 }
 const h=backend({profile:{ok:true,status:'wrong_class'}});
 await assert.rejects(createAuthenticatedHost({classId,createClient:h.createClient,fetchImpl:h.fetchImpl}),/connect_profile_not_approved/);
 assert.equal(h.calls.length,1);
});
test('session switched to another pupil prevents pending result being sent',async()=>{
 const h=backend();const host=await createAuthenticatedHost({classId,createClient:h.createClient,fetchImpl:h.fetchImpl});
 h.setSession(session(teacher,true,'token-other'));
 await assert.rejects(host.getToken(),/connect_identity_changed/);
 await assert.rejects(host.load(),/connect_identity_changed/);
 assert.equal(h.calls.length,1);
});
test('invalid class or externally directed endpoint is rejected before access',async()=>{
 const h=backend();
 await assert.rejects(createAuthenticatedHost({classId:'oops',createClient:h.createClient,fetchImpl:h.fetchImpl}),/invalid_connect_host/);
 await assert.rejects(createAuthenticatedHost({classId,baseUrl:'https://evil.example',createClient:h.createClient,fetchImpl:h.fetchImpl}),/untrusted_connect_endpoint/);
 assert.equal(h.calls.length,0);
});
