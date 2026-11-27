import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';

const file=readFileSync(new URL('../supabase/functions/connect-results/index.ts',import.meta.url),'utf8');
const source=stripTypeScriptTypes(file.replace(/^import .*;\n/,''),{mode:'strip'});
const klass='22222222-2222-4222-8222-222222222222';
const student='33333333-3333-4333-8333-333333333333';
const authId='44444444-4444-4444-8444-444444444444';
const sub='soustraction-ecrite-simple';
const mul='multiplication-ecrite-simple';
const a='addition-ecrite-simple';

function harness(){
 let handler, updates=0, xpSyncs=0;
 const states=new Map();
 const query=(table)=>{
  let mode='read',payload=null,filters={};
  const q={
   select(){return q},
   eq(k,v){filters[k]=v;return q},
   is(){return q},
   limit(){return q},
   update(v){mode='update';payload=v;return q},
   insert(v){mode='insert';payload=v;return q},
   async maybeSingle(){
    if(table==='connect_devices')return {data:{student_id:student},error:null};
    if(table==='connect_enrollments')return {data:{student_id:student},error:null};
    if(table==='connect_students')return {data:{id:student},error:null};
    if(table!=='connect_states')throw Error('unexpected table '+table);
    const k=filters.app_key,old=states.get(k);
    if(mode==='update'){
     if(!old||old.revision!==filters.revision||old.reset_epoch!==filters.reset_epoch)return {data:null,error:null};
     const next={...old,...payload};states.set(k,next);updates++;
     return {data:{revision:next.revision},error:null};
    }
    return {data:old??null,error:null};
   },
   async single(){
    if(table!=='connect_states'||mode!=='insert')throw Error('bad insert');
    if(states.has(payload.app_key))return {data:null,error:{code:'23505'}};
    states.set(payload.app_key,{...payload,reset_epoch:0});updates++;
    return {data:{revision:payload.revision},error:null};
   },
  };
  return q;
 };
 const db={from:query,async rpc(name,{p_app}){
  if(name==='connect_trophy_rewards_v1')return {data:null,error:null};
  if(name!=='connect_xp_sync_v2')throw Error(name);
  xpSyncs++;return {data:{appXp:22,total:22,level:1,delta:22,app:p_app},error:null};
 }};
 const auth={auth:{getUser:async()=>({data:{user:{id:authId,is_anonymous:true}},error:null})}};
 const ctx=vm.createContext({createClient:(url,key)=>key==='priv'?db:auth,
  Deno:{env:{get:k=>k==='SUPABASE_SERVICE_ROLE_KEY'?'priv':'pub'},serve:h=>{handler=h}},
  Date,Intl,Response,Headers,Request,crypto:globalThis.crypto,TextEncoder,URL,
  structuredClone,JSON,Object,Array,Number,Map,Set,Error,RegExp});
 vm.runInContext(source,ctx);
 async function call(data){
  const req=new Request('https://fiction.test/',{method:'POST',headers:{authorization:'Bearer FAKE'},body:JSON.stringify({classId:klass,appKey:sub,...data})});
  const res=await handler(req);return {status:res.status,body:await res.json()};
 }
 return {call,states,get updates(){return updates},get xpSyncs(){return xpSyncs}};
}
const id=n=>'11111111-1111-4111-8111-'+String(n).padStart(12,'0');
const result=(n,rest={})=>({action:'game-record',eventId:id(n),expectedRevision:0,expectedResetEpoch:0,mode:'classic',level:1,score:4,total:4,points:20,...rest});
// The positive certified path (including real PostgreSQL and Chromium) is exercised
// by soustraction-edge-postgres.runtime.test.mjs. This endpoint must never credit it.
for(const appKey of [sub,mul,a,'addition-ecrite-multiple']){
 test('Écriture directe interdite : '+appKey,async()=>{
  const h=harness();h.states.set(a,{revision:1,reset_epoch:0,state_data:{classic:[{'4':4},{},{}]}});
  for(const classId of [klass,'4bf3400d-a315-4ea4-a2f3-afaca24dc9b9','8fe170fa-9e8f-4e80-885a-b0ba68026f64']){
   for(const payload of [result(1),result(1,{mode:'sudden',method:'takeTop',total:null}),result(2,{mode:'imaginary',expectedResetEpoch:99})]){
    const x=await h.call({...payload,appKey,classId});
    assert.equal(x.status,403,JSON.stringify(x.body));
    assert.equal(x.body.error,'server_proof_required');
   }
  }
  assert.equal(h.states.get(a).revision,1);
  assert.equal(h.updates,0);assert.equal(h.xpSyncs,0);
 });
}
test('student-save ne peut pas fabriquer un résultat certifié',async()=>{
 const h=harness();
 const x=await h.call({action:'student-save',state:{classic:[{'4':4},{},{}]}});
 assert.equal(x.status,403);assert.equal(h.updates,0);assert.equal(h.xpSyncs,0);
});
