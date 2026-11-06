import test from 'node:test';
import assert from 'node:assert/strict';
import {createVerifiedSessionToken} from '../apps/objective-record/verified-session-token.mjs';

const ID='11111111-1111-4111-8111-111111111111';
function fixture({anonymous=true}={}){
 let token='jwt-1',id=ID,remoteCalls=0,sessionCalls=0,clock=0;
 let rejectRemote=false;
 const auth={
  async getSession(){sessionCalls++;return {data:{session:token?{
   access_token:token,user:{id,is_anonymous:anonymous}
  }:null}};},
  async getUser(jwt){remoteCalls++;if(rejectRemote)return {data:{user:null},error:Error('not verified')};
   return {data:{user:{id,is_anonymous:anonymous,tokenUsed:jwt}},error:null};}
 };
 return {auth,get count(){return remoteCalls},get sessions(){return sessionCalls},
  tick:ms=>clock+=ms,now:()=>clock,setToken:x=>{token=x},
  changeId:x=>{id=x},reject:()=>{rejectRemote=true}};
}

test('the same previously verified JWT avoids the extra Auth HTTP request',async()=>{
 const f=fixture(),get=createVerifiedSessionToken({auth:f.auth,ttlMs:45_000,now:f.now});
 assert.equal(await get(),'jwt-1');
 assert.equal(await get(),'jwt-1');
 assert.equal(await get(),'jwt-1');
 assert.equal(f.count,1,'a single remote check across repeated school calls');
 assert.equal(f.sessions,3,'each API call must re-read the current session');
 f.tick(44_999);await get();assert.equal(f.count,1);
 f.tick(2);await get();assert.equal(f.count,2,'TTL expires and revalidates the user');
});
test('parallel score/profile calls coalesce the real Supabase Auth check',async()=>{
 const f=fixture(),get=createVerifiedSessionToken({auth:f.auth,now:f.now});
 assert.deepEqual(await Promise.all([get(),get(),get()]),['jwt-1','jwt-1','jwt-1']);
 assert.equal(f.count,1);
});
test('JWT rotation always forces a fresh server validation',async()=>{
 const f=fixture(),get=createVerifiedSessionToken({auth:f.auth,now:f.now});
 await get();f.setToken('jwt-2');
 assert.equal(await get(),'jwt-2');
 assert.equal(f.count,2);
});
test('identity changes, removed sessions and failed remote verification are rejected',async()=>{
 const f=fixture(),get=createVerifiedSessionToken({auth:f.auth,now:f.now});
 await get();
 f.changeId('22222222-2222-4222-8222-222222222222');
 await assert.rejects(get(),/profil connecté a changé/);
 f.setToken(null);await assert.rejects(get(),/Session Connect absente/);
 const bad=fixture();bad.reject();
 await assert.rejects(createVerifiedSessionToken({auth:bad.auth})(),/Session Connect non reconnue/);
});
test('pupil and teacher authentication modes stay separated',async()=>{
 const f=fixture({anonymous:true});
 await assert.rejects(createVerifiedSessionToken({auth:f.auth,teacher:true})(),/Session Connect non reconnue/);
 const teacher=fixture({anonymous:false});
 await createVerifiedSessionToken({auth:teacher.auth,teacher:true})();
 await assert.rejects(createVerifiedSessionToken({auth:teacher.auth,teacher:false})(),/Session Connect non reconnue/);
});
