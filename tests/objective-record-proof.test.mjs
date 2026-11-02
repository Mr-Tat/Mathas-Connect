import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyServerTranscript} from '../apps/objective-record/server-proof.mjs';
const SID='11111111-1111-4111-8111-111111111111';
const EID='55555555-5555-4555-8555-555555555555';
const result=q=>q.op==='add'?q.a+q.b:q.op==='sub'?q.a-q.b:q.a*q.b;
const combos=[['add'],['sub'],['mul'],['add','sub'],['add','mul'],['sub','mul'],['add','sub','mul']];
const fixture=(ops=['add','sub'],level=2,mode='three-lives',count=12)=>{
 const questions=Array.from({length:count},(_,i)=>{
  const op=ops[i%ops.length],a=20+i,b=2+(i%6);
  return {id:'q'+i,op,a,b};
 });
 return {sessionId:SID,studentId:EID,appKey:'melange-calculs-ecrits',
  resetEpoch:7,rulesetVersion:3,level,operations:ops,mode,questions};
};
const answer=(session,i,right=true)=>({
 questionId:session.questions[i].id,
 value:result(session.questions[i])+(right?0:1)
});
const pack=(s,correctness)=>({
 sessionId:s.sessionId,finished:true,
 answers:correctness.map((right,i)=>answer(s,i,right))
});
test('Mélange : 7 combinaisons exactes x 3 niveaux, sans score fourni par le client',()=>{
 for(const level of [1,2,3])for(const ops of combos){
  const s=fixture(ops,level,'sudden',12);
  const r=verifyServerTranscript(s,pack(s,Array(12).fill(true)));
  assert.ok(r,level+' '+ops);
  assert.equal(r.score,12);
  assert.equal(r.errors,0);
  assert.equal(r.endedBy,'question-limit');
  assert.deepEqual(r.operations,ops);
  assert.deepEqual(r.candidateRecordMilestones,['record:5','record:10']);
 }
});
test('3 vies : première erreur par calcul complet, la 3e arrête immédiatement',()=>{
 const s=fixture(['add','mul'],1,'three-lives',20);
 const flags=[true,true,true,true,true,false,true,true,true,true,true,false,false];
 const r=verifyServerTranscript(s,pack(s,flags));
 assert.equal(r.score,10);
 assert.equal(r.errors,3);
 assert.equal(r.completed,13);
 assert.equal(r.endedBy,'mistake-limit');
 assert.equal(r.trophyEligible,false);
 assert.deepEqual(r.candidateRecordMilestones,['record:5','record:10']);
 assert.equal(verifyServerTranscript(s,pack(s,[...flags,true])),null);
});
test('mort subite : la première erreur arrête, sans multiplication du score XP',()=>{
 const s=fixture(['sub'],3,'sudden',20);
 const r=verifyServerTranscript(s,pack(s,[true,true,true,true,true,true,false]));
 assert.equal(r.score,6);
 assert.equal(r.errors,1);
 assert.equal(r.endedBy,'mistake-limit');
 assert.deepEqual(r.candidateRecordMilestones,['record:5']);
 assert.equal(r.trophyEligible,true);
 assert.equal(verifyServerTranscript(s,pack(s,[true,true,true,true,true,true,false,true])),null);
});
test('absence ou incomplétude de calcul : aucun événement de partie validé',()=>{
 const s=fixture(['add'],2,'three-lives',10);
 assert.equal(verifyServerTranscript(s,pack(s,[true,true])),null);
 assert.equal(verifyServerTranscript(s,{...pack(s,Array(10).fill(true)),finished:false}),null);
 assert.equal(verifyServerTranscript(s,{...pack(s,Array(10).fill(true)),finished:true,score:10}),null);
 const wrong=pack(s,Array(10).fill(true));
 wrong.answers[2]={questionId:'q2',value:null};
 assert.equal(verifyServerTranscript(s,wrong),null);
 wrong.answers[2]={questionId:'q2',value:1,complete:false};
 assert.equal(verifyServerTranscript(s,wrong),null);
});
test('refuse la falsification des questions, IDs, sélection, mode et réponses',()=>{
 const s=fixture(['add','mul'],2,'three-lives',3);
 const ok=pack(s,[true,true,true]);
 assert.equal(verifyServerTranscript(s,{...ok,questions:s.questions}),null);
 assert.equal(verifyServerTranscript(s,{...ok,mode:'sudden'}),null);
 assert.equal(verifyServerTranscript(s,{...ok,answers:ok.answers.map(x=>({...x,correct:true}))}),null);
 assert.equal(verifyServerTranscript(s,{...ok,answers:[ok.answers[0],ok.answers[0],ok.answers[2]]}),null);
 assert.equal(verifyServerTranscript({...s,operations:['sub']},ok),null);
 assert.equal(verifyServerTranscript({...s,questions:[s.questions[0],s.questions[0]]},ok),null);
 assert.equal(verifyServerTranscript({...s,level:9},ok),null);
 assert.equal(verifyServerTranscript({...s,questions:[{...s.questions[0],op:'sub'},...s.questions.slice(1)]},ok),null);
 assert.equal(verifyServerTranscript({...s,questions:[{...s.questions[0],a:-1},...s.questions.slice(1)]},ok),null);
 const overflow=fixture(['mul'],2,'three-lives',3);
 overflow.questions[0]={...overflow.questions[0],a:100000000,b:100000000};
 assert.equal(verifyServerTranscript(overflow,pack(overflow,[true,true,true])),null);
});
test('règles arithmétiques adaptées par application et session issue du serveur',()=>{
 const map=[
  ['addition-ecrite-simple','add'],['addition-ecrite-multiple','add'],
  ['soustraction-ecrite-simple','sub'],['multiplication-ecrite-simple','mul']
 ];
 for(const [appKey,op] of map){
  const s={...fixture([op],1,'three-lives',4),appKey,operations:[]};
  assert.equal(verifyServerTranscript(s,pack(s,[true,true,true,true])).score,4);
  assert.equal(verifyServerTranscript({...s,questions:[{...s.questions[0],op:op==='add'?'mul':'add'},...s.questions.slice(1)]},pack(s,[true,true,true,true])),null);
 }
 const s={...fixture(['add'],2,'three-lives',4),appKey:'unknown-game'};
 assert.equal(verifyServerTranscript(s,pack(s,[true,true,true,true])),null);
});

test('séries scolaires 4 / 10 / 20 : 5 moteurs, jalons uniquement depuis les réponses vérifiées',()=>{
 const games=[
  ['addition-ecrite-simple',['add']],
  ['addition-ecrite-multiple',['add']],
  ['soustraction-ecrite-simple',['sub']],
  ['multiplication-ecrite-simple',['mul']],
  ['melange-calculs-ecrits',['add','sub','mul']]
 ];
 for(const [appKey,ops] of games)for(const count of [4,10,20]){
  const session={...fixture(ops,2,'classic',count),appKey,total:count,
   operations:appKey==='melange-calculs-ecrits'?ops:[]};
  const perfect=verifyServerTranscript(session,pack(session,Array(count).fill(true)));
  assert.ok(perfect,appKey+' '+count);
  assert.equal(perfect.score,count);
  assert.equal(perfect.endedBy,'question-limit');
  assert.equal(perfect.trophyEligible,false);
  assert.deepEqual(perfect.candidateRecordMilestones,
   count===4?['classic:4:perfect']:
   count===10?['classic:10:pass','classic:10:bonus']:
   ['classic:20:pass','classic:20:bonus']);
  const partially=verifyServerTranscript(session,pack(session,Array.from({length:count},(_,i)=>i!==0)));
  assert.ok(partially);
  assert.equal(partially.score,count-1);
  assert.deepEqual(partially.candidateRecordMilestones,
   count===4?[]:count===10?['classic:10:pass']:['classic:20:pass']);
  assert.equal(verifyServerTranscript(session,pack(session,Array(count-1).fill(true))),null);
  assert.equal(verifyServerTranscript({...session,total:count===4?10:4},pack(session,Array(count).fill(true))),null);
  assert.equal(verifyServerTranscript({...session,total:null},pack(session,Array(count).fill(true))),null);
  assert.equal(verifyServerTranscript(session,{...pack(session,Array(count).fill(true)),score:count}),null);
 }
});
test('les limites des parties 3 vies et Mort subite ne changent pas avec le contrat classique',()=>{
 const s=fixture(['add'],2,'three-lives',12);
 assert.equal(verifyServerTranscript({...s,total:10},pack(s,Array(12).fill(true))),null);
 assert.ok(verifyServerTranscript(s,pack(s,Array(12).fill(true))));
 const sudden=fixture(['add'],2,'sudden',12);
 assert.equal(verifyServerTranscript({...sudden,total:4},pack(sudden,Array(12).fill(true))),null);
 assert.equal(verifyServerTranscript(sudden,pack(sudden,[false,true])),null);
});
