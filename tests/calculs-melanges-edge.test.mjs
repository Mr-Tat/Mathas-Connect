import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';
import {randomUUID} from 'node:crypto';
const source=fs.readFileSync(new URL('../supabase/functions/connect-results/index.ts',import.meta.url),'utf8').replace(/^import .*;\n/,'');
const classId=randomUUID(),studentId=randomUUID(),authId=randomUUID();
function harness({enabled=true,approved=true,enrolled=true,anonymous=true,managed=true,player=true,locked=false,access,strict=false,visible=true}={}){
 let handler,calls=[],tickets=new Map();
 const db={from(table){const filters={};const q={order(){return q},select(){return q},eq(k,v){filters[k]=v;return q},is(){return q},in(){return q},limit(){return q},insert(row){if(table==='connect_school_start_tickets')tickets.set(row.event_id,row);return q},async maybeSingle(){
  if(table==='connect_school_start_tickets'){
   const row=tickets.get(filters.event_id);
   return {data:row&&Object.entries(filters).every(([k,v])=>row[k]===v)?row:null,error:null};
  }
  const rows={connect_hub_preset_entries:visible?{visible:true}:null,connect_apps:enabled?{enabled:true}:null,connect_devices:approved?{student_id:studentId}:null,connect_enrollments:enrolled?{student_id:studentId}:null,
   connect_students:{id:studentId},connect_class_permissions:managed?{class_id:classId}:null,connect_teacher_players:player?{student_id:studentId}:null,connect_states:{revision:0,reset_epoch:0,state_data:{}}};
  return {data:rows[table]??null,error:null};
 }};q.then=(yes,no)=>Promise.resolve({data:[],error:null}).then(yes,no);return q;},
 async rpc(name,args){calls.push({name,args});return {data:{ok:true,revision:1,resetEpoch:0,xp:{appXp:28,total:28,delta:28}},error:null}}};
 // Ordinary cases execute the actual release candidate; only the explicit
 // emergency-lock regression compiles a locked copy.
 assert.ok(source.includes('const MIXED_SERVER_READY=true;'));
 let code=locked?source.replace('const MIXED_SERVER_READY=true;','const MIXED_SERVER_READY=false;'):source;
 if(strict)code=code.replace('const MIXED_REQUIRE_START_TICKET=false;','const MIXED_REQUIRE_START_TICKET=true;');
 const context={createClient:(_u,key)=>key==='private'?db:{auth:{getUser:async()=>({data:{user:{id:authId,is_anonymous:anonymous}},error:null})}},
 Deno:{env:{get:k=>k==='CONNECT_MIXED_ACCESS'?access:k==='SUPABASE_SERVICE_ROLE_KEY'?'private':'public'},serve:h=>handler=h},Response,Headers,Date,Intl,Number,Object,Array,Map,Set,JSON,Error,RegExp,structuredClone,crypto:{randomUUID},console};
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
test('closed, empty, invalid and foreign-pilot overrides reject every mixed RPC',async()=>{
 for(const access of ['','closed','pilot:','pilot:'+randomUUID(),'pilot:'+classId+',invalid','opne']){
  const h=harness({access});
  for(const action of ['game-record','student-load','student-xp','teacher-detail','teacher-parcours-restart','teacher-multipliers-set']){
   const r=await h.call({action});assert.equal(r.status,403);assert.equal(r.body.error,'integration_not_open_for_class');
  }
  assert.equal(h.calls.length,0);
 }
 assert.equal((await harness({access:'pilot:'+classId.toUpperCase()}).call()).status,200);
 assert.equal((await harness({access:'pilot:'+randomUUID()+', '+classId}).call()).status,200);
});
test('student release works without a new secret and retains catalogue and identity checks',async()=>{
 assert.equal((await harness({access:undefined}).call()).status,200);
 assert.equal((await harness({access:null}).call()).status,200);
 for(const cfg of [{enabled:false},{approved:false},{enrolled:false}]){
  const h=harness({...cfg,access:null});assert.equal((await h.call()).status,403);assert.equal(h.calls.length,0);
 }
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

test('mixed result selection does not block the authorized GLOBAL application matrix',async()=>{const h=harness({anonymous:false});assert.equal((await h.call({action:'teacher-app-matrix-get'})).status,200);assert.equal((await harness().call({action:'teacher-app-matrix-get'})).status,403)});

test('strict mixed start tickets are scoped to actual profile, class, mode, operations and epoch',async()=>{
 const h=harness({strict:true});
 const start={action:'game-start',expectedMultiplierLockVersion:null,expectedTableAidAllowed:true};
 assert.equal((await h.call()).body.error,'start_ticket_required');
 assert.equal((await h.call({action:'game-record-v2'})).body.error,'start_ticket_invalid');
 const issued=await h.call(start);assert.equal(issued.status,200,JSON.stringify(issued));assert.ok(issued.body.eventId);
 const event={action:'game-record-v2',eventId:issued.body.eventId};
 for(const change of [{classId:randomUUID()},{expectedResetEpoch:1},{level:2},{operationsSelectedAtStart:['add','sub']},{mode:'sudden',total:null}]){
  assert.equal((await h.call({...event,...change})).body.error,'start_ticket_invalid');
 }
 assert.equal(h.calls.length,0);
 assert.equal((await h.call(event)).status,200);assert.equal(h.calls.length,1);
 assert.equal(h.calls[0].args.p_event,issued.body.eventId);
 assert.equal((await h.call(event)).status,200,'same ticket remains available for atomic idempotent replay');
 assert.equal((await h.call({...start,expectedResetEpoch:1})).body.error,'start_parcours_changed');
 assert.equal((await h.call({...start,expectedTableAidAllowed:false})).body.error,'start_permissions_changed');
 const training=await h.call({...start,mode:'training',total:null});assert.equal(training.status,200);assert.equal(training.body.eventId,null);
});
test('hidden class forbids new pupil start, not teacher preview or TEST',async()=>{
 const start={action:'game-start',expectedMultiplierLockVersion:null,expectedTableAidAllowed:true};
 assert.equal((await harness({visible:false}).call(start)).body.error,'app_hidden_for_class');
 assert.equal((await harness({visible:false,anonymous:false}).call(start)).status,200);
 assert.equal((await harness({visible:false}).call({...start,classId:'4bf3400d-a315-4ea4-a2f3-afaca24dc9b9'})).status,200);
});
