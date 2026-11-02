import test from 'node:test';
import assert from 'node:assert/strict';
import {LAB_CLASS_ID,GAME_KEYS,validateLabContext,computeComplement,candidateRankPoints,validateThreeLivesEvidence} from '../apps/record-lab-pilot/record-contract.mjs';
test('classe TEST uniquement, session et fiche approuvées, cinq app_key séparées',()=>{
 for(const appKey of GAME_KEYS)assert.equal(validateLabContext({classId:LAB_CLASS_ID,appKey,mode:'three-lives',approved:true,sessionVerified:true,studentVerified:true,...(appKey==='melange-calculs-ecrits'?{operationsSelectedAtStart:['add','mul']}: {})}),true);
 const ok={classId:LAB_CLASS_ID,appKey:GAME_KEYS[0],mode:'sudden',approved:true,sessionVerified:true,studentVerified:true};
 for(const patch of [{classId:'other'},{approved:false},{sessionVerified:false},{studentVerified:false},{appKey:'connect-lab'},{appKey:'other'},{mode:'hard'}])assert.throws(()=>validateLabContext({...ok,...patch}));
});
test('Mélange conserve les opérations exactes de la configuration',()=>{
 const base={classId:LAB_CLASS_ID,appKey:'melange-calculs-ecrits',mode:'three-lives',approved:true,sessionVerified:true,studentVerified:true};
 for(const ops of [['add'],['sub'],['mul'],['add','sub'],['add','mul'],['sub','mul'],['add','sub','mul']])assert.ok(validateLabContext({...base,operationsSelectedAtStart:ops}));
 for(const ops of [[],['add','add'],['none'],['add','sub','mul','add']])assert.throws(()=>validateLabContext({...base,operationsSelectedAtStart:ops}));
});
test('3 vies = moitié du droit, Mort subite donne uniquement le complément; pas de double XP',()=>{
 assert.deepEqual(computeComplement({mode:'three-lives',fullCredit:10,priorAwarded:0}),{entitled:5,delta:5,nextAwarded:5});
 assert.deepEqual(computeComplement({mode:'sudden',fullCredit:10,priorAwarded:5}),{entitled:10,delta:5,nextAwarded:10});
 assert.deepEqual(computeComplement({mode:'three-lives',fullCredit:10,priorAwarded:10}),{entitled:5,delta:0,nextAwarded:10});
 assert.deepEqual(computeComplement({mode:'sudden',fullCredit:10,priorAwarded:10}),{entitled:10,delta:0,nextAwarded:10});
 assert.deepEqual(computeComplement({mode:'three-lives',fullCredit:9,priorAwarded:0}),{entitled:4,delta:4,nextAwarded:4});
 for(const input of [{mode:'sudden',fullCredit:10,priorAwarded:11},{mode:'three-lives',fullCredit:-1,priorAwarded:0},{mode:'sudden',fullCredit:NaN,priorAwarded:0}])assert.throws(()=>computeComplement(input));
});
test('le bonus de 20% ne concerne que les points du classement, jamais les XP',()=>{
 assert.equal(candidateRankPoints({mode:'sudden',basePoints:10}),12);
 assert.equal(candidateRankPoints({mode:'sudden',basePoints:11}),13);
 assert.equal(candidateRankPoints({mode:'three-lives',basePoints:10}),10);
 assert.equal(candidateRankPoints({mode:'classic',basePoints:10}),10);
});
test('fin après 3 erreurs, calculs uniques, pas d’erreur incomplète',()=>{
 const attempts=[{index:0,complete:true,correct:false},{index:1,complete:true,correct:true},{index:2,complete:true,correct:false},{index:3,complete:true,correct:false}];
 const base={heartsStart:3,wrongCompleted:3,endingHearts:0,finished:true,attempts};
 assert.equal(validateThreeLivesEvidence(base),true);
 for(const patch of [{endingHearts:1},{finished:false},{wrongCompleted:2},{attempts:[...attempts,attempts[0]]},{attempts:attempts.map((x,i)=>i===2?{...x,complete:false}:x)}])assert.throws(()=>validateThreeLivesEvidence({...base,...patch}));
});
