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
test('fin Classique sur Soustraction : écriture isolée + XP sync une fois',async()=>{
 const h=harness();h.states.set(a,{revision:1,reset_epoch:0,state_data:{classic:[{'4':4},{},{}]}});
 const x=await h.call(result(1));assert.equal(x.status,200,JSON.stringify(x.body));
 assert.equal(h.states.get(sub).state_data.classic[0][4],4);
 assert.equal(h.states.get(a).revision,1);
 assert.equal(h.xpSyncs,1);
});
test('Mort subite : deux méthodes de records séparées, historique conservé',async()=>{
 const h=harness();const first=await h.call(result(2,{mode:'sudden',score:4,total:null,method:'addBottom'}));
 assert.equal(first.status,200,JSON.stringify(first.body));
 const second=await h.call(result(3,{mode:'sudden',score:7,total:null,method:'takeTop',expectedRevision:first.body.revision}));
 assert.equal(second.status,200,JSON.stringify(second.body));
 const state=h.states.get(sub).state_data;
 assert.equal(state.suddenMethods.addBottom[0],4);
 assert.equal(state.suddenMethods.takeTop[0],7);
 assert.equal(state.sudden[0],7);
 assert.equal(state.recent[0].method,'takeTop');
 assert.equal(h.updates,2);
});
test('doublon ID idempotent et mauvais epoch refusé',async()=>{
 const h=harness();const first=await h.call(result(4));assert.equal(first.status,200);
 const second=await h.call(result(4,{expectedRevision:0}));
 assert.equal(second.status,200);assert.equal(second.body.duplicate,true);assert.equal(h.updates,1);
 const bad=await h.call(result(5,{expectedResetEpoch:1,expectedRevision:1}));
 assert.equal(bad.status,409);assert.equal(h.updates,1);
});
test('méthode Mort subite absente refusée sans écriture',async()=>{
 const h=harness();const x=await h.call(result(6,{mode:'sudden',score:3,total:null}));
 assert.equal(x.status,400);assert.equal(x.body.error,'invalid_method');assert.equal(h.updates,0);
});
test('modes limités et écriture student-save refusée',async()=>{
 const h=harness();
 const bad=await h.call(result(7,{mode:'imaginary'}));assert.equal(bad.status,400);
 const save=await h.call({action:'student-save',state:{classic:[{'4':4},{},{}]}});assert.equal(save.status,403);
 assert.equal(h.updates,0);
});
