import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';
import {webcrypto} from 'node:crypto';

const text=fs.readFileSync(new URL('../supabase/functions/connect-results/index.ts',import.meta.url),'utf8').replace(/^import .*;\n/,'');
const source=stripTypeScriptTypes(text,{mode:'strip'});
const teacher='11111111-1111-4111-8111-111111111111',klass='22222222-2222-4222-8222-222222222222',student='33333333-3333-4333-8333-333333333333';
const empty=()=>({classic:[{},{},{}],sudden:[null,null,null],hard:[null,null,null],recent:[],bestPoints:null,todayBest:null,progress:{},ids:[],topThree:[],hardThree:[null,null,null],rewards:null});
function startHarness({allowed=true,enrolled=true}={}){
 const records={connect_states:{revision:2,reset_epoch:0,state_data:{...empty(),bestPoints:120,topThree:[120]}}};
 let writes=0,handler;
 const db={from(table){
  const filters={};let action='select',payload=null;
  const q={
   select(){return q},eq(k,v){filters[k]=v;return q},is(){return q},limit(){return q},
   update(v){action='update';payload=v;return q},insert(v){action='insert';payload=v;return q},
   async maybeSingle(){
    if(table==='connect_class_permissions')return {data:allowed?{class_id:klass}:null,error:null};
    if(table==='connect_enrollments')return {data:enrolled?{id:student}:null,error:null};
    if(table==='connect_students')return {data:enrolled?{id:student}:null,error:null};
    if(table==='connect_xp_milestones')return {data:[],error:null};
    if(table!=='connect_states')throw Error('unexpected table '+table);
    const previous=records.connect_states;
    if(action==='update'){
     if(!previous||previous.revision!==filters.revision||previous.reset_epoch!==filters.reset_epoch)return {data:null,error:null};
     records.connect_states={...previous,...payload};writes++;return {data:{revision:payload.revision},error:null};
    }
    return {data:previous,error:null};
   }
  };
  q.single=async()=>({data:null,error:{code:'unexpected_insert'}});
  return q;
 }};
 db.rpc=async()=>({data:{appXp:0,delta:0,total:0,level:1},error:null});
 const auth={auth:{getUser:async()=>({data:{user:{id:teacher,is_anonymous:false}},error:null})}};
 const ctx=vm.createContext({createClient:(_u,key)=>key==='private'?db:auth,
  Deno:{env:{get:k=>k==='SUPABASE_SERVICE_ROLE_KEY'?'private':'public'},serve:h=>{handler=h}},
  crypto:webcrypto,TextEncoder,Response,Headers,URL,Intl,Date,Number,Object,Array,
  Map,Set,JSON,Error,RegExp,structuredClone});
 vm.runInContext(source,ctx);
 async function call(action,body={}){
  const req=new Request('https://fiction.test',{method:'POST',headers:{authorization:'Bearer FICTION', 'content-type':'application/json'},body:JSON.stringify({
   action,classId:klass,studentId:student,appKey:'addition-ecrite-simple',
   backupFormat:'mathas-connect-class-backup-v2',backupProjectRef:'awmhpfofacaglewammxt',
   backupRevision:1,backupResetEpoch:0,backupState:{...empty(),bestPoints:80,topThree:[80],progress:{level2:true}},...body
  })});
  const resp=await handler(req);return {status:resp.status,body:await resp.json()};
 }
 return {call,records,get writes(){return writes}};
}
test('professeur autorisé : prévisualisation puis récupération fusionnelle',async()=>{
 const h=startHarness();const p=await h.call('teacher-restore-preview');
 assert.equal(p.status,200);assert.equal(p.body.changed,true);
 assert.equal(p.body.after.bestPoints,120);
 const a=await h.call('teacher-restore-apply',{previewDigest:p.body.previewDigest,expectedRevision:2,expectedResetEpoch:0,confirmed:true,confirmationPhrase:'RESTAURER',safetyBackupExported:true});
 assert.equal(a.status,200,JSON.stringify(a));assert.equal(h.writes,1);assert.equal(h.records.connect_states.revision,3);
 assert.equal(h.records.connect_states.state_data.progress.level2,true);
});
test('professeur non gestionnaire : refus sans écriture',async()=>{
 const h=startHarness({allowed:false});const x=await h.call('teacher-restore-preview');assert.equal(x.status,403);assert.equal(h.writes,0);
});
test('élève non inscrit : refus sans écriture',async()=>{
 const h=startHarness({enrolled:false});const x=await h.call('teacher-restore-preview');assert.equal(x.status,403);assert.equal(h.writes,0);
});
test('sans copie de sécurité déclarée : refus',async()=>{
 const h=startHarness();const p=await h.call('teacher-restore-preview');
 const x=await h.call('teacher-restore-apply',{previewDigest:p.body.previewDigest,expectedRevision:2,expectedResetEpoch:0,confirmed:true,confirmationPhrase:'RESTAURER'});
 assert.equal(x.status,403);assert.equal(h.writes,0);
});
test('conflit de révision : refus',async()=>{
 const h=startHarness();const p=await h.call('teacher-restore-preview');
 const x=await h.call('teacher-restore-apply',{previewDigest:p.body.previewDigest,expectedRevision:1,expectedResetEpoch:0,confirmed:true,confirmationPhrase:'RESTAURER',safetyBackupExported:true});
 assert.equal(x.status,409);assert.equal(h.writes,0);
});
test('sauvegarde différente après prévisualisation : refus',async()=>{
 const h=startHarness();const p=await h.call('teacher-restore-preview');
 const x=await h.call('teacher-restore-apply',{previewDigest:p.body.previewDigest,expectedRevision:2,expectedResetEpoch:0,confirmed:true,confirmationPhrase:'RESTAURER',safetyBackupExported:true,backupState:{...empty(),bestPoints:999,topThree:[999]}});
 assert.equal(x.status,409);assert.equal(h.writes,0);
});
