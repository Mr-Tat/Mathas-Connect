import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MIXED_TEST_APP,normalizeMixedTestCompletion,isMixedTestTerminal}
 from '../apps/objective-record/mixed-test-proof.mjs';
import {createAtomicTestRecorder,isWritableTestApp}
 from '../apps/objective-record/atomic-test-recorder.mjs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const TEST='4bf3400d-a315-4ea4-a2f3-afaca24dc9b9';
const sourceEvent={phase:'finished',mode:'classic',level:1,score:3,total:4,completed:4,hard:false,
 mixedProof:{mode:'classic',level:1,score:3,total:4,
 operationsSelectedAtStart:['add','sub','mul'],operationsCompleted:['add','sub','mul','sub'],
 firstTry:[true,true,false,true],aidUsed:false,masterMode:false}};
test('les cinq jeux se branchent à un registre atomique TEST, jamais aux classes réelles',()=>{
 for(const key of ['addition-ecrite-simple','addition-ecrite-multiple','soustraction-ecrite-simple',
 'multiplication-ecrite-simple',MIXED_TEST_APP]) assert.equal(isWritableTestApp(key),true);
 const args={classId:TEST,appKey:MIXED_TEST_APP,subject:'fictif',storage:{getItem:()=>null,setItem(){},removeItem(){}},
 send:async()=>({ok:false}),reload:async()=>{},notify:()=>{},isCurrent:()=>true};
 assert.ok(createAtomicTestRecorder(args));
 assert.equal(createAtomicTestRecorder({...args,classId:'8fe170fa-9e8f-4e80-885a-b0ba68026f64'}),null);
 assert.equal(isWritableTestApp('abc'),false);
});
test('Mélange : mode Classique finit avec phase finished et journal exact des 3 opérations',()=>{
 assert.equal(isMixedTestTerminal(sourceEvent),true);
 const result=normalizeMixedTestCompletion({appKey:MIXED_TEST_APP,event:sourceEvent});
 assert.deepEqual(result,{
  schemaVersion:1,mode:'classic',level:1,score:3,total:4,points:0,rewards:null,
  operationsSelectedAtStart:['add','sub','mul'],
  operationsCompleted:['add','sub','mul','sub'],firstTry:[true,true,false,true],
  aidUsed:false,masterMode:false
 });
 assert.equal(normalizeMixedTestCompletion({appKey:'soustraction-ecrite-simple',event:sourceEvent}),null);
 assert.equal(normalizeMixedTestCompletion({appKey:MIXED_TEST_APP,event:{...sourceEvent,phase:'ended'}}),null);
});
test('Mélange : Mort subite exige uniquement les opérations réussies, aucun droit 3 vies ou HARD',()=>{
 const e={phase:'ended',mode:'sudden',level:2,score:2,total:null,completed:2,hard:false,
  mixedProof:{mode:'sudden',level:2,score:2,total:null,
   operationsSelectedAtStart:['sub','mul'],operationsCompleted:['sub','mul'],
   firstTry:[true,true],aidUsed:false,masterMode:false}};
 assert.ok(normalizeMixedTestCompletion({appKey:MIXED_TEST_APP,event:e}));
 for(const bad of [
  {...e,mode:'three-lives'}, {...e,hard:true},
  {...e,mixedProof:{...e.mixedProof,operationsCompleted:['sub','mul','add']}},
  {...e,mixedProof:{...e.mixedProof,firstTry:[false,true]}},
  {...e,mixedProof:{...e.mixedProof,operationsSelectedAtStart:['add','add']}},
  {...e,mixedProof:{...e.mixedProof,aidUsed:'false'}},
  {...e,mixedProof:{...e.mixedProof,masterMode:1}},
 ])assert.equal(normalizeMixedTestCompletion({appKey:MIXED_TEST_APP,event:bad}),null);
});
test('journal du moteur Mélange : opérateurs saisis au début, enregistrés après correction',()=>{
 const engine=read('apps/objective-record/engines/melange/index.html');
 const lab=read('apps/objective-record/engines/melange/lab-objectif-record-v2.js');
 const host=read('apps/objective-record/eleve.mjs');
 assert.match(engine,/operationsSelectedAtStart:\[\.\.\.session\.ops\]/);
 assert.match(engine,/recordMixedTestSolved\(states\[i\]\)/);
 assert.match(engine,/if\(session\.mode==='classic'\)recordMixedTestSolved\(states\[i\]\)/);
 assert.match(engine,/function finishClassic\(\)\{publishMixedTestCompletion\(\)/);
 assert.match(engine,/function endSudden\(i\)\{publishMixedTestCompletion\(\)/);
 assert.match(lab,/phase,completed:session\.completed/);
 assert.match(host,/inside\.contentWindow\.__mathasMixedTestFinished/);
 assert.match(host,/activeApp===ATOMIC_TEST_APP\|\|activeApp===MIXED_TEST_APP/);
 assert.match(host,/projectionConsent\?\.offer\(receipt\.eventId\)/);
 assert.doesNotMatch(host,/connect-record-pilot/);
});
test('reçu Mélange durable : un seul POST après fin native, événement projetable',async()=>{
 const data=new Map(),sent=[],consented=[];
 const store={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
 const r=createAtomicTestRecorder({classId:TEST,appKey:MIXED_TEST_APP,subject:'eleve-fictif',storage:store,
  send:async x=>{sent.push(x);return {ok:true,revision:1,resetEpoch:0,
   xp:{appXp:22,total:22,level:1,delta:22}}},
  reload:async()=>{},notify:()=>{},isCurrent:()=>true,onRecorded:o=>consented.push(o)});
 assert.ok(r.initialize({revision:0,resetEpoch:0}));
 r.onSnapshot({...sourceEvent,phase:'answering'});
 r.onSnapshot(sourceEvent);
 r.onSnapshot(sourceEvent);
 await new Promise(resolve=>setTimeout(resolve,50));
 assert.equal(sent.length,1);
 assert.deepEqual(sent[0].operationsSelectedAtStart,['add','sub','mul']);
 assert.equal(sent[0].firstTry.filter(Boolean).length,3);
 assert.equal(sent[0].expectedRevision,0);
 assert.equal(consented.length,1);
 assert.equal(consented[0].eventId,sent[0].eventId);
 assert.equal(r.hasPending(),false);
});
