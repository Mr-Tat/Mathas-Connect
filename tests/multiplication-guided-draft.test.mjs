import test from 'node:test';
import assert from 'node:assert/strict';
import {createGuidedDraftStore,DRAFT_TTL_MS,MAX_DRAFT_BYTES}
 from '../apps/multiplication-simple/collective-draft.mjs';

const CLASS='4bf3400d-a315-4ea4-a2f3-afaca24dc9b9';
const A='a0000000-0000-4000-8000-000000000001';
const B='b0000000-0000-4000-8000-000000000002';
const session=(uuid='11111111-1111-4111-8111-111111111111')=>({
 sessionId:uuid,pages:[
  [{a:'106',m:5},{a:'558',m:2}],
  [{a:'247',m:6},{a:'139',m:8}]
 ]});
const cache=new Map(),storage={
 getItem:k=>cache.get(k)??null,
 setItem:(k,v)=>cache.set(k,v),
 removeItem:k=>cache.delete(k)
};
test('un brouillon appartient à l’onglet, classe, compte et séance; contient aucune réponse serveur',()=>{
 cache.clear();
 const now=Date.parse('2026-11-10T12:00:00Z');
 const alice=createGuidedDraftStore({storage,classId:CLASS,studentId:A,now:()=>now});
 const bob=createGuidedDraftStore({storage,classId:CLASS,studentId:B,now:()=>now});
 const otherClass=createGuidedDraftStore({storage,classId:'88888888-8888-4888-8888-888888888888',studentId:A,now:()=>now});
 assert.equal(alice.save(session(),1,[{index:1,operations:session().pages[1],
  states:[{answerValues:['9']}]}]),true);
 assert.equal(alice.read(session()).pageIndex,1);
 assert.equal(bob.read(session()),null);
 assert.equal(otherClass.read(session()),null);
 assert.equal(alice.read(session('22222222-2222-4222-8222-222222222222')),null);
 assert.equal(alice.read(session()),null,'nouvelle séance purge la précédente');
});
test('brouillon trop ancien, démesuré ou malformé est ignoré puis purgé',()=>{
 cache.clear();let tick=0;
 const s=session(),backup=createGuidedDraftStore({storage,classId:CLASS,studentId:A,now:()=>tick});
 assert.equal(backup.save(s,0,[]),true);
 tick=DRAFT_TTL_MS+1;
 assert.equal(backup.read(s),null);
 assert.equal(backup.save(s,0,[]),true);
 const key=[...cache.keys()][0];
 cache.set(key,'{bad json');
 assert.equal(backup.read(s),null);
 cache.set(key,'x'.repeat(MAX_DRAFT_BYTES+1));
 assert.equal(backup.read(s),null);
 assert.equal(cache.has(key),false);
});
test('le jeu reste utilisable si sessionStorage est bloqué ou plein',()=>{
 const noStorage=createGuidedDraftStore({storage:null,classId:CLASS,studentId:A});
 assert.equal(noStorage.enabled,false);
 assert.equal(noStorage.save(session(),0,[]),false);
 const denied=createGuidedDraftStore({storage:{getItem(){throw Error('denied')},setItem(){throw Error('quota')},removeItem(){}},
  classId:CLASS,studentId:A});
 assert.equal(denied.save(session(),0,[]),false);
 assert.equal(denied.read(session()),null);
});
