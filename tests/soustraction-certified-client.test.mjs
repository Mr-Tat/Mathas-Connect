import test from 'node:test';
import assert from 'node:assert/strict';
import {
 acceptSubtractionChallenge,acceptSubtractionExtended,subtractionAttemptCorrect,
 subtractionEndState,subtractionTranscriptStore
} from '../apps/soustraction-simple/certified-school.mjs';

const ID='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const question=(i,method='addBottom')=>({id:'q'+(i+1),op:'sub',a:'10234',b:'1234',method,width:5});
const challenge=(mode='classic',method='addBottom')=>({
 ok:true,sessionId:ID,revision:0,resetEpoch:0,level:2,total:4,
 mode,method,limit:120,expiresAt:'2099-01-01T00:00:00Z',
 questions:Array.from({length:mode==='classic'?4:120},(_,i)=>question(i,method))
});
test('soustraction: niveau, méthode et nombre contrôlés',()=>{
 assert.ok(acceptSubtractionChallenge(challenge(),2,4,'addBottom'));
 assert.equal(acceptSubtractionChallenge(challenge(),1,4,'addBottom'),null);
 assert.equal(acceptSubtractionChallenge(challenge(),2,4,'takeTop'),null);
 assert.ok(acceptSubtractionExtended(challenge('three-lives'),2,'three-lives','addBottom'));
});
test('soustraction: calculs vérifiés sans accepter de faux résultats',()=>{
 assert.equal(subtractionAttemptCorrect(question(0),'9000'),true);
 assert.equal(subtractionAttemptCorrect(question(0),'8999'),false);
 assert.equal(subtractionAttemptCorrect(question(0),'9x00'),false);
});
test('soustraction: les trois erreurs mettent fin à 3 vies',()=>{
 const qs=challenge('three-lives').questions;
 const responses=qs.slice(0,3).map(q=>({id:q.id,answer:'1'}));
 assert.deepEqual(subtractionEndState('three-lives',responses,qs),{
  correct:0,errors:3,complete:true,livesLeft:0
 });
 assert.equal(subtractionEndState('sudden',responses,qs),null);
});
test('soustraction: conservation et reprise isolées par profil et méthode',()=>{
 const map=new Map();
 const storage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),
  removeItem:k=>map.delete(k)};
 const s=subtractionTranscriptStore(storage,ID,ID,'classic',2,'addBottom');
 s.save({...challenge(),answers:[]});
 assert.ok(s.read());
 assert.equal(subtractionTranscriptStore(storage,ID,ID,'classic',2,'takeTop').read(),null);
 s.clear();assert.equal(s.read(),null);
});
