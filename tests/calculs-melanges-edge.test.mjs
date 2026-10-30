import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';
import {randomUUID} from 'node:crypto';
const source=fs.readFileSync(new URL('../supabase/functions/connect-results/index.ts',import.meta.url),'utf8').replace(/^import .*;\n/,'');
const classId=randomUUID(),studentId=randomUUID(),authId=randomUUID();
function harness({enabled=true,approved=true,enrolled=true,anonymous=true,managed=true,player=true,locked=false}={}){
 let handler,calls=[];
 const db={from(table){const q={select(){return q},eq(){return q},is(){return q},in(){return q},limit(){return q},async maybeSingle(){
  const rows={connect_apps:enabled?{enabled:true}:null,connect_devices:approved?{student_id:studentId}:null,connect_enrollments:enrolled?{student_id:studentId}:null,
   connect_students:{id:studentId},connect_class_permissions:managed?{class_id:classId}:null,connect_teacher_players:player?{student_id:studentId}:null,connect_states:{revision:0,reset_epoch:0,state_data:{}}};
  return {data:rows[table]??null,error:null};
 }};q.then=(yes,no)=>Promise.resolve({data:[],error:null}).then(yes,no);return q;},
 async rpc(name,args){calls.push({name,args});return {data:{ok:true,revision:1,resetEpoch:0,xp:{appXp:28,total:28,delta:28}},error:null}}};
 const code=locked?source:source.replace('const MIXED_SERVER_READY=false;','const MIXED_SERVER_READY=true;');
 const context={createClient:(_u,key)=>key==='private'?db:{auth:{getUser:async()=>({data:{user:{id:authId,is_anonymous:anonymous}},error:null})}},
 Deno:{env:{get:k=>k==='SUPABASE_SERVICE_ROLE_KEY'?'private':'public'},serve:h=>handler=h},Response,Headers,Date,Intl,Number,Object,Array,Map,Set,JSON,Error,RegExp,structuredClone,console};
 vm.runInNewContext(stripTypeScriptTypes(code,{mode:'strip'}),context);
 async function call(body={},token='FICTION'){
  const r=await handler(new Request('http://fiction.local',{method:'POST',headers:token?{authorization:'Bearer '+token}:{},body:JSON.stringify({classId,appKey:'melange-calculs-ecrits',action:'game-record',expectedStudentId:studentId,schemaVersion:1,eventId:randomUUID(),mode:'classic',level:1,score:4,total:4,points:0,expectedRevision:0,expectedResetEpoch:0,aidUsed:false,masterMode:false,operationsSelectedAtStart:['add','sub','mul'],operationsCompleted:['add','sub','add','sub'],firstTry:[true,true,true,true],...body})}));
  return {status:r.status,body:await r.json()};
 }
 return {call,calls};
}
test('compiled production lock rejects every mixed operation, even if catalogue enabled',async()=>{
 const h=harness({locked:true});for(const action of ['game-record','student-load','student-xp','teacher-detail','teacher-parcours-restart','teacher-multipliers-set'])assert.equal((await h.call({action})).status,403);assert.equal(h.calls.length,0);
});
test('missing JWT, unapproved device, foreign class and disabled catalogue never call atomic RPC',async()=>{
 assert.equal((await harness().call({},null)).status,401);
 for(const cfg of [{approved:false},{enrolled:false},{enabled:false}]){const h=harness(cfg);assert.equal((await h.call()).status,403);assert.equal(h.calls.length,0)}
});
test('authenticated pupil identity is derived from JWT, browser points rejected',async()=>{
 const h=harness();const r=await h.call({studentId:randomUUID()});assert.equal(r.status,200);assert.equal(h.calls[0].args.p_student,studentId);assert.equal(h.calls[0].name,'connect_mixed_record_v1');
 assert.equal((await h.call({points:594})).status,400);assert.equal(h.calls.length,1);
});
test('teacher player requires real managing teacher AND its separate player identity',async()=>{
 for(const cfg of [{anonymous:false,managed:false},{anonymous:false,player:false}]){const h=harness(cfg);assert.equal((await h.call({joueur:'prof'})).status,403);assert.equal(h.calls.length,0)}
 assert.equal((await harness({anonymous:false}).call()).status,200);
});
test('teacher reset denies pupils and wrong class, calls mixed-only RPC for manager',async()=>{
 assert.equal((await harness().call({action:'teacher-parcours-restart',scope:'class',repeatXp:false})).status,403);
 const h=harness({anonymous:false});assert.equal((await h.call({action:'teacher-parcours-restart',scope:'class',repeatXp:false})).status,200);assert.equal(h.calls[0].name,'connect_mixed_restart_class_v1');assert.equal(h.calls[0].args.p_app,'melange-calculs-ecrits');
});

test('same JWT reassigned to another pupil rejects old queued proofs before RPC',async()=>{const h=harness();const r=await h.call({expectedStudentId:randomUUID()});assert.equal(r.status,409);assert.equal(r.body.error,'identity_binding_conflict');assert.equal(h.calls.length,0)});
