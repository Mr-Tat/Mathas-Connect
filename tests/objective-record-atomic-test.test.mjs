import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeAtomicTestCompletion,acceptNativeRecordAck,ATOMIC_TEST_APP} from '../apps/objective-record/native-official-record.mjs';
import {createAtomicTestRecorder} from '../apps/objective-record/atomic-test-recorder.mjs';
import {readFileSync} from 'node:fs';
const read=f=>readFileSync(new URL('../'+f,import.meta.url),'utf8');
const TEST='4bf3400d-a315-4ea4-a2f3-afaca24dc9b9';
const classic={phase:'finished',mode:'classic',level:2,score:9,total:10,completed:10,hard:false};
test('natif : 4, 10, 20 et Mort subite seulement pour Addition multiple',()=>{
 const p=normalizeAtomicTestCompletion({appKey:ATOMIC_TEST_APP,event:classic});
 assert.deepEqual(p,{schemaVersion:1,mode:'classic',level:2,score:9,total:10,points:0,rewards:null});
 assert.equal(normalizeAtomicTestCompletion({appKey:ATOMIC_TEST_APP,event:{...classic,score:11}}),null);
 assert.equal(normalizeAtomicTestCompletion({appKey:ATOMIC_TEST_APP,event:{...classic,completed:9}}),null);
 assert.equal(normalizeAtomicTestCompletion({appKey:ATOMIC_TEST_APP,event:{...classic,mode:'three-lives'}}),null);
 assert.equal(normalizeAtomicTestCompletion({appKey:ATOMIC_TEST_APP,event:{...classic,hard:true}}),null);
 assert.equal(normalizeAtomicTestCompletion({appKey:ATOMIC_TEST_APP,event:{...classic,phase:'review'}}),null);
 assert.equal(normalizeAtomicTestCompletion({appKey:'melange-calculs-ecrits',event:classic}),null);
 for(const n of [4,10,20]) assert.ok(normalizeAtomicTestCompletion({appKey:ATOMIC_TEST_APP,event:{...classic,score:n,total:n,completed:n}}));
 assert.ok(normalizeAtomicTestCompletion({appKey:ATOMIC_TEST_APP,event:{phase:'ended',mode:'sudden',level:1,score:12,total:null,completed:13}}));
});
test('ACK officiel obligatoire, delta fourni par le serveur uniquement',()=>{
 const eventId='11111111-1111-4111-8111-111111111111';
 const ack={ok:true,revision:1,resetEpoch:0,xp:{appXp:12,total:12,level:1,delta:12}};
 assert.equal(acceptNativeRecordAck(null,eventId),null);
 assert.equal(acceptNativeRecordAck({...ack,xp:{...ack.xp,appXp:-1}},eventId),null);
 assert.equal(acceptNativeRecordAck({...ack,revision:null},eventId),null);
 assert.equal(acceptNativeRecordAck({...ack,duplicate:true},eventId).duplicate,true);
});
test('un seul envoi avec le même eventId et reprise de la file hors ligne',async()=>{
 const data=new Map(),messages=[],calls=[];
 const storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
 const record=createAtomicTestRecorder({classId:TEST,appKey:ATOMIC_TEST_APP,subject:'fake-test-user',
  storage,send:async p=>{calls.push(p);return {ok:true,revision:1,resetEpoch:0,xp:{appXp:10,total:10,level:1,delta:10}}},
  reload:async()=>{},notify:x=>messages.push(x),isCurrent:()=>true});
 assert.ok(record.initialize({revision:0,resetEpoch:0}));
 record.onSnapshot({...classic,phase:'play'});
 record.onSnapshot(classic);
 record.onSnapshot(classic);
 await new Promise(resolve=>setTimeout(resolve,30));
 assert.equal(calls.length,1);
 assert.equal(calls[0].mode,'classic');
 assert.equal(calls[0].points,0);
 assert.equal(calls[0].expectedRevision,0);
 assert.equal(calls[0].expectedResetEpoch,0);
 assert.equal(record.hasPending(),false);
 assert.ok(messages.some(x=>x.includes('XP du profil scolaire')));
});
test('refuse des classes reelles et toutes les apps sans chemin atomique approuvé',()=>{
 const noop=()=>{},storage={getItem:()=>null,setItem:noop,removeItem:noop};
 const args={classId:TEST,appKey:ATOMIC_TEST_APP,subject:'fictif',storage,send:async()=>null,
  reload:async()=>{},notify:noop,isCurrent:()=>true};
 assert.equal(createAtomicTestRecorder({...args,classId:'8fe170fa-9e8f-4e80-885a-b0ba68026f64'}),null);
 assert.equal(createAtomicTestRecorder({...args,appKey:'melange-calculs-ecrits'}),null);
});
test('le client utilise la RPC scolaire actuelle, non le pilote, et la sauvegarde hors ligne',()=>{
 const host=read('apps/objective-record/eleve.mjs');
 assert.match(host,/connect-results','game-record'/);
 assert.match(host,/activeApp===ATOMIC_TEST_APP/);
 assert.match(host,/recorder\.onSnapshot\(event\)/);
 assert.match(host,/\$\('refresh'\)\.addEventListener/);
 assert.doesNotMatch(host,/connect-record-pilot/);
 const ledger=read('apps/objective-record/atomic-test-recorder.mjs');
 assert.match(ledger,/mathas\.record-test-native\.v1/);
 assert.match(ledger,/appKey!==ATOMIC_TEST_APP/);
});
