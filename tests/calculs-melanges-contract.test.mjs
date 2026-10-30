import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {APP_KEY,normalizeCompletion,eligible} from '../apps/calculs-melanges/completion-contract.mjs';
import {applyCompletion,empty} from '../apps/calculs-melanges/records.mjs';
import {MAX_XP,milestones} from '../apps/calculs-melanges/xp-model.mjs';
import {createPilot,buildConnectPilot,CONNECT_WRITE_READY} from '../apps/calculs-melanges/connect-pilot.mjs';
import {hydrateNativeRecords} from '../apps/calculs-melanges/connect-hydration.mjs';
const memory=()=>{const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k),m}};
const event=(total=4,changes={})=>({schemaVersion:1,appKey:APP_KEY,eventId:randomUUID(),mode:'classic',level:1,score:total,total,
 operationsSelectedAtStart:['add','sub','mul'],operationsCompleted:Array.from({length:total},(_,i)=>['add','sub','mul'][i%3]),firstTry:Array(total).fill(true),
 aidUsed:false,masterMode:false,expectedRevision:0,expectedResetEpoch:0,...changes});
test('strict contract: identities, score proof, modes, journal and immutable start settings',()=>{
 assert.ok(normalizeCompletion(event()));
 for(const change of [{schemaVersion:2},{appKey:'addition-ecrite-multiple'},{eventId:'x'},{score:3},{total:5},{firstTry:[true]},{operationsCompleted:['add']},{operationsSelectedAtStart:['add','add']},{masterMode:undefined},{mode:'training'},{mode:'hard-challenge'},{expectedResetEpoch:-1}])assert.equal(normalizeCompletion(event(4,change)),null,JSON.stringify(change));
 assert.equal(eligible(event(4,{operationsSelectedAtStart:['add']})),false);
 assert.equal(eligible(event(4,{operationsSelectedAtStart:['add','sub'],operationsCompleted:['add','sub','add','sub']})),false);
 assert.equal(eligible(event(4,{operationsCompleted:['add','add','add','add']})),true,'three selected at start remains full rate despite a lucky draw');
 assert.equal(eligible(event(4,{masterMode:true})),false);
 assert.equal(eligible(event(4,{aidUsed:true})),true,'aids follow existing policy, metadata retained');
});
test('both 4→10→20 and reverse persist three independent records and 150 XP',()=>{
 for(const order of [[4,10,20],[20,10,4]]){
  let s=empty();for(const n of order)s=applyCompletion(s,normalizeCompletion(event(n)));
  assert.deepEqual(s.classic[0],{4:4,10:10,20:20});assert.equal(milestones(s).xp,150);
  s=applyCompletion(s,event(4));assert.equal(milestones(s).xp,150);
 }
});
test('exact deltas, all 27 milestones, 594 cap; no bonus global',()=>{
 let s=empty(),before=0;
 for(const [total,score,delta] of [[4,4,28],[10,8,38],[10,10,8],[20,16,63],[20,20,13]]){
  const e=event(total,{score,firstTry:Array.from({length:total},(_,i)=>i<score)});s=applyCompletion(s,e);
  assert.equal(milestones(s).xp-before,delta);before=milestones(s).xp;
 }
 for(let level=1;level<=3;level++){
  for(const n of [4,10,20])s=applyCompletion(s,event(n,{level}));
  for(const [mode,score] of [['sudden',10],['hard',7]])s=applyCompletion(s,event(score,{level,mode,total:null}));
 }
 assert.equal(MAX_XP,594);assert.equal(milestones(s).xp,594);assert.equal(milestones(s).keys.length,27);
});
test('half-rate high record preserves full-rate proof; all-three lucky sudden draw receives both full thresholds',()=>{
 let s=applyCompletion(empty(),event(10,{score:8,firstTry:[true,true,true,true,true,true,true,true,false,false]}));
 s=applyCompletion(s,event(10,{operationsSelectedAtStart:['add'],operationsCompleted:Array(10).fill('add')}));
 assert.equal(s.classic[0][10],10);assert.equal(s.eligible.classic[0][10],8);assert.equal(s.halfEligible.classic[0][10],10);assert.equal(milestones(s).xp,42,'full pass 38 plus new half bonus 4');
 s=applyCompletion(empty(),event(10,{mode:'sudden',total:null,operationsCompleted:[...Array(5).fill('add'),'sub','mul','sub','mul','add']}));
 assert.deepEqual(milestones(s).keys,['sudden:1:10','sudden:1:5']);assert.equal(milestones(s).xp,24);
 s=applyCompletion(empty(),event(4,{masterMode:true}));assert.equal(milestones(s).xp,0);
});
test('one or two start operations earn half; later all-three earns only the missing complement once',()=>{
 for(const ops of [['add'],['add','sub']]){
  const half=normalizeCompletion(event(4,{operationsSelectedAtStart:ops,operationsCompleted:['add','add','add','add']}));
  assert.ok(half);let s=applyCompletion(empty(),half);assert.equal(milestones(s).xp,14);
  s=applyCompletion(s,half);assert.equal(milestones(s).xp,14);
  const full=normalizeCompletion(event(4,{operationsCompleted:['add','add','add','add']}));
  s=applyCompletion(s,full);assert.equal(milestones(s).xp,28);
  s=applyCompletion(s,full);s=applyCompletion(s,half);assert.equal(milestones(s).xp,28);
 }
 assert.equal(normalizeCompletion(event(4,{operationsCompleted:[],firstTry:[],score:0})),null,'checkboxes without completed calculations never constitute a result');
});
test('half classic deltas are integer XP and perfect-series totals remain exactly half',()=>{
 for(const order of [[4,10,20],[20,10,4]]){
  let s=empty();for(const n of order)s=applyCompletion(s,event(n,{operationsSelectedAtStart:['add'],operationsCompleted:Array(n).fill('add')}));
  assert.equal(milestones(s).xp,75);assert.equal(milestones(s).points['classic:1:20:pass'],32);assert.equal(milestones(s).points['classic:1:20:bonus'],6);
  for(const n of order)s=applyCompletion(s,event(n));assert.equal(milestones(s).xp,150);
 }
 let s=empty(),before=0;
 for(const [total,score,delta] of [[4,4,14],[10,8,19],[10,10,4],[20,16,32],[20,20,6]]){
  s=applyCompletion(s,event(total,{score,operationsSelectedAtStart:['add'],operationsCompleted:Array(total).fill('add'),firstTry:Array.from({length:total},(_,i)=>i<score)}));
  assert.equal(milestones(s).xp-before,delta);before=milestones(s).xp;
 }
});
test('half sudden thresholds upgrade independently and never downgrade full rights',()=>{
 let s=applyCompletion(empty(),event(10,{mode:'sudden',total:null,operationsSelectedAtStart:['add'],operationsCompleted:Array(10).fill('add')}));
 assert.equal(milestones(s).xp,12);
 s=applyCompletion(s,event(5,{mode:'sudden',total:null,operationsCompleted:Array(5).fill('add')}));assert.equal(milestones(s).xp,18);
 s=applyCompletion(s,event(10,{mode:'sudden',total:null,operationsCompleted:Array(10).fill('add')}));assert.equal(milestones(s).xp,24);
});
test('restricted normal modes then native all-three HARD remain upgradeable to the full 594 cap',()=>{
 let s=empty();
 for(let level=1;level<=3;level++){
  for(const total of [4,10,20])s=applyCompletion(s,event(total,{level,operationsSelectedAtStart:['add'],operationsCompleted:Array(total).fill('add')}));
  s=applyCompletion(s,event(10,{level,mode:'sudden',total:null,operationsSelectedAtStart:['add'],operationsCompleted:Array(10).fill('add')}));
  s=applyCompletion(s,event(7,{level,mode:'hard',total:null}));
 }
 assert.equal(milestones(s).xp,333,'HARD natively selects all three and is full rate; no invented restricted HARD mode');
 for(let level=1;level<=3;level++){
  for(const total of [4,10,20])s=applyCompletion(s,event(total,{level}));
  s=applyCompletion(s,event(10,{level,mode:'sudden',total:null}));
 }
 assert.equal(milestones(s).xp,594);assert.equal(milestones(s).keys.length,27);
 assert.equal(normalizeCompletion(event(7,{mode:'hard',total:null,operationsSelectedAtStart:['add'],operationsCompleted:Array(7).fill('add')})),null);
});
test('native hydration chooses one display record while retaining ALL series outside native cache',()=>{
 const storage=memory(),scope='connect.'+randomUUID()+'.'+randomUUID()+'.'+randomUUID();let state=empty();for(const n of [20,10,4])state=applyCompletion(state,event(n));
 assert.equal(hydrateNativeRecords({storage,scope,state,pending:1}),false);assert.equal(storage.m.size,0);
 assert.equal(hydrateNativeRecords({storage,scope,state}),true);
 const prefix='mathas.calculs-melanges.game.'+scope+'.v1:';
 assert.deepEqual(JSON.parse(storage.getItem(prefix+'mixcalc_classic_v1'))['1'],{score:20,total:20,aideVisuelle:false});
 assert.deepEqual(JSON.parse(storage.getItem(prefix+'mixcalc_connect_proofs_v1')).classic[0],{4:4,10:10,20:20});
 assert.equal(storage.getItem('mixcalc_classic_v1'),null);
});
test('queue persists until ACK, retries same event, suppresses duplicate animations and isolates pupils',async()=>{
 const storage=memory(),classId=randomUUID(),studentId=randomUUID();let online=false,calls=[],statuses=[];
 const post=async e=>{calls.push(e);if(!online)throw Error('offline');return {ok:true,eventId:e.eventId,appKey:e.appKey,storageSubject:e.expectedStudentId,revision:1,resetEpoch:0,duplicate:true,xp:{delta:28}}};
 const args={storage,classId,studentId,post,onStatus:(s,r)=>statuses.push([s,r])};let p=createPilot(args);p.initialize(0,0);
 const e=event();assert.equal(p.completed(e),true);await p.retry();assert.equal(p.pending(),1);
 assert.equal(p.completed(e),false);p=createPilot(args);p.initialize(0,0);
 const other=createPilot({...args,studentId:randomUUID()});other.initialize(0,0);assert.equal(other.pending(),0);
 online=true;await p.retry();assert.equal(p.pending(),0);assert.equal(statuses.at(-1)[1].xp.delta,0);assert.equal(calls.at(-1).eventId,e.eventId);
 assert.equal(CONNECT_WRITE_READY,false);assert.throws(()=>buildConnectPilot(args),/connect_not_ready/);
});
test('malformed HTTP-success ACK retains queue; reset quarantines old events',async()=>{
 const storage=memory(),p=createPilot({storage,classId:randomUUID(),studentId:randomUUID(),post:async()=>({ok:true}),onStatus:()=>{}});p.initialize(0,0);
 p.completed(event());await p.retry();assert.equal(p.pending(),1);p.initialize(2,1);assert.equal(p.pending(),0);assert.equal(p.quarantined(),1);assert.equal(p.completed(event()),false);
});
test('native bridge counts actual locks and emits exactly once after finalization; no training',()=>{
 const messages=[];const context={document:{addEventListener(){},dispatchEvent(){}},Event,localStorage:{getItem:()=>null},crypto:{randomUUID},WeakMap,Object,Number,Array,JSON,location:{origin:'http://local'},parent:{location:{origin:'http://local'},postMessage:e=>messages.push(e)},window:{frameElement:{getAttribute:()=>null}}};
 vm.runInNewContext(readFileSync(new URL('../apps/calculs-melanges/native-bridge.js',import.meta.url),'utf8'),context);
 const b=context.window.MathasMixedBridge,s={mode:'classic',total:4,level:1,score:4,ops:['add','sub','mul']};b.begin(s,false);assert.equal(messages.length,0);s.ops=['add'];
 for(const op of ['add','sub','add','mul'])b.solved(s,{op,firstTry:true});b.finish(s);b.finish(s);assert.equal(messages.length,1);assert.ok(normalizeCompletion(JSON.parse(JSON.stringify(messages[0].event))));
 assert.deepEqual(JSON.parse(JSON.stringify(messages[0].event.operationsSelectedAtStart)),['add','sub','mul'],'later settings cannot change the rate of an already started game');
 const t={...s,mode:'training'};b.begin(t,false);b.finish(t);assert.equal(messages.length,1);
});

test('aid marker follows the native best and a better equal-score unaided attempt',()=>{
 let s=applyCompletion(empty(),event(4,{aidUsed:true}));assert.equal(s.recordAid.classic[0][4],true);
 s=applyCompletion(s,event(4));assert.equal(s.recordAid.classic[0][4],false);
 s=applyCompletion(s,event(4,{aidUsed:true}));assert.equal(s.recordAid.classic[0][4],false);
});

test('permanent rejection and revoked session preserve the event and explain the failure',async()=>{
 for(const [status,expected] of [[403,'unauthorized'],[400,'rejected']]){
  const statuses=[],p=createPilot({storage:memory(),classId:randomUUID(),studentId:randomUUID(),post:async()=>({ok:false,status}),onStatus:s=>statuses.push(s)});p.initialize(0,0);p.completed(event());await p.retry();assert.equal(p.pending(),1);assert.equal(statuses.at(-1),expected);
 }
});

test('same JWT subject, different actual pupils: queues never mix their proofs',async()=>{
 const storage=memory(),classId=randomUUID(),studentId=randomUUID(),pupilA=randomUUID(),pupilB=randomUUID();const calls=[];
 const args={storage,classId,studentId,post:async e=>{calls.push(e);throw Error('offline')}};
 const a=createPilot({...args,pupilId:pupilA});a.initialize(0,0);a.completed(event());await a.retry();
 const b=createPilot({...args,pupilId:pupilB});b.initialize(0,0);assert.equal(b.pending(),0);assert.equal(a.pending(),1);assert.equal(calls[0].expectedStudentId,pupilA);
});
test('full queue never overwrites a proof and emits an explicit capacity status',async()=>{
 const storage=memory(),statuses=[],p=createPilot({storage,classId:randomUUID(),studentId:randomUUID(),post:async()=>{throw Error('offline')},onStatus:s=>statuses.push(s)});p.initialize(0,0);
 for(let i=0;i<100;i++)assert.equal(p.completed(event()),true);
 await p.retry();assert.equal(p.pending(),100);assert.equal(p.completed(event()),false);assert.equal(p.pending(),100);assert.equal(statuses.at(-1),'queue-full');
});
test('transport timeout releases the request without an invented ACK',async()=>{
 const {createEdgePost}=await import('../apps/calculs-melanges/edge-transport.mjs');
 let aborted=false;const post=createEdgePost({endpoint:'https://local.invalid',getToken:async()=>'synthetic',apikey:'synthetic',timeoutMs:10,
  fetchImpl:(_u,{signal})=>new Promise((_,reject)=>signal.addEventListener('abort',()=>{aborted=true;reject(new DOMException('Timeout','AbortError'))}))});
 await assert.rejects(post(event()),{name:'AbortError'});assert.equal(aborted,true);
});
test('a new event arriving at the 100-ACK boundary is drained without polling',async()=>{
 const storage=memory(),classId=randomUUID(),studentId=randomUUID();let revision=0,send,release;
 const blocked=new Promise(r=>release=r);let p;
 p=createPilot({storage,classId,studentId,post:async e=>{await blocked;revision++;return {ok:true,eventId:e.eventId,appKey:e.appKey,storageSubject:e.expectedStudentId,revision,resetEpoch:0}},onStatus:s=>{if(s==='saved'&&revision===1)p.completed(event())}});p.initialize(0,0);
 for(let i=0;i<100;i++)p.completed(event());release();await p.retry();await p.retry();assert.equal(p.pending(),0);assert.equal(revision,101);
});

test('matching numeric revisions alone cannot acknowledge another event/pupil/app',async()=>{
 for(const corrupt of ['eventId','appKey','storageSubject']){
  const storage=memory(),p=createPilot({storage,classId:randomUUID(),studentId:randomUUID(),post:async e=>({ok:true,eventId:e.eventId,appKey:e.appKey,storageSubject:e.expectedStudentId,revision:1,resetEpoch:0,[corrupt]:'wrong'})});p.initialize(0,0);p.completed(event());await p.retry();assert.equal(p.pending(),1,corrupt);
 }
});

test('completed corrections stay in the journal while firstTry determines the score',()=>{
 const e=normalizeCompletion(event(10,{score:8,operationsCompleted:[...Array(8).fill('add'),'sub','mul'],firstTry:[...Array(8).fill(true),false,false]}));assert.ok(e);assert.equal(eligible(e),true);assert.equal(milestones(applyCompletion(empty(),e)).xp,38);
});
