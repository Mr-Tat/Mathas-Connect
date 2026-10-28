import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const launcher=readFileSync(new URL('../apps/soustraction-simple/index.html',import.meta.url),'utf8');
const start=launcher.indexOf("const queueKey='ce-soustraction.pending.'");
const end=launcher.indexOf('let draining=false',start);
assert.ok(start>0 && end>start);
const functions=launcher.slice(start,end);
function harness(){
 const map=new Map();
 const localStorage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)};
 const context=vm.createContext({localStorage,classId:'22222222-2222-4222-8222-222222222222',session:{user:{id:'33333333-3333-4333-8333-333333333333'}},Date,JSON,Error,Array});
 vm.runInContext(functions+String.raw`;globalThis.bridge={readQueue,saveQueue,removeQueuedEvent,archiveOldEvent,staleQueue,staleCount};`,context);
 return {bridge:context.bridge,map};
}
test('acquitter un ID ne supprime pas une autre partie ajoutée durant un envoi',()=>{
 const h=harness();h.bridge.saveQueue([{eventId:'premiere',expectedResetEpoch:0}]);
 h.bridge.saveQueue([...h.bridge.readQueue(),{eventId:'deuxieme',expectedResetEpoch:0}]);
 h.bridge.removeQueuedEvent('premiere');
 assert.deepEqual(JSON.parse(JSON.stringify(h.bridge.readQueue())).map(e=>e.eventId),['deuxieme']);
});
test('ancien parcours archivé avant retrait et rejouable uniquement à part',()=>{
 const h=harness();const old={eventId:'ancienne',expectedResetEpoch:0};
 h.bridge.saveQueue([old,{eventId:'courante',expectedResetEpoch:1}]);
 h.bridge.archiveOldEvent(old);
 assert.deepEqual(JSON.parse(JSON.stringify(h.bridge.readQueue())).map(e=>e.eventId),['courante']);
 assert.equal(h.bridge.staleCount(),1);
 assert.equal(h.bridge.staleQueue()[0].reason,'reset-epoch-changed');
 h.bridge.archiveOldEvent(old);
 assert.equal(h.bridge.staleCount(),1);
});
test('si archivage local impossible, ne pas retirer le résultat ancien',()=>{
 const h=harness();const old={eventId:'ancienne',expectedResetEpoch:0};h.bridge.saveQueue([old]);
 const original=h.map.set.bind(h.map);
 h.map.set=(k,v)=>{if(k.endsWith('.previous-parcours.v1'))throw new Error('quota');return original(k,v)};
 assert.throws(()=>h.bridge.archiveOldEvent(old),/quota/);
 assert.equal(h.bridge.readQueue().length,1);
});

test('une file locale illisible n’est jamais remplacée par un tableau vide',()=>{
 const h=harness();const key=[...h.map.keys()][0]||'ce-soustraction.pending.22222222-2222-4222-8222-222222222222.33333333-3333-4333-8333-333333333333.v3';
 h.map.set(key,'{invalid');
 assert.throws(()=>h.bridge.readQueue());
 assert.throws(()=>h.bridge.saveQueue([{eventId:'new'}]));
 assert.equal(h.map.get(key),'{invalid');
});
