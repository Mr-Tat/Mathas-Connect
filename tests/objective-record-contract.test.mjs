import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalOperations,confirmedRemaining,referenceTopUp,normalizeLifeJournal,referenceRankingPoints} from '../apps/objective-record/contract.mjs';
const base={appKey:'melange-calculs-ecrits',level:2,operations:['add','sub'],approvedSession:true,
 acknowledgedRead:true,resetEpoch:7,rulesetVersion:3};
const reply={ok:true,active:true,version:1,appKey:base.appKey,level:base.level,
 operations:['sub','add'],resetEpoch:7,rulesetVersion:3,
 remaining:{4:28,10:46,20:76,'three-lives':12,sudden:24}};
const all=[['add'],['sub'],['mul'],['add','sub'],['add','mul'],['sub','mul'],['add','sub','mul']];
test('Mélange: sept combinaisons exactes, 3 niveaux, et mises à jour de sélection',()=>{
 for(let level=1;level<=3;level++)for(const ops of all){
  const ctx={...base,level,operations:ops};
  const result={...reply,level,operations:ops};
  assert.equal(confirmedRemaining(result,ctx)['4'],28);
  assert.equal(confirmedRemaining(result,{...ctx,operations:['add',...(ops.includes('sub')?['sub']:[])]})===null,ops.join(',')!==['add',...(ops.includes('sub')?['sub']:[]).join(','));
  assert.equal(confirmedRemaining({...result,operations:['add','mul']},ctx)===null,ops.join(',')!=='add,mul');
 }
});
test('fail closed sans approbation, lecture, version, époque ou valeurs fiables',()=>{
 for(const ctx of [{...base,approvedSession:false},{...base,acknowledgedRead:false},
 {...base,level:1},{...base,resetEpoch:8},{...base,operations:['add','mul']}])
   assert.equal(confirmedRemaining(reply,ctx),null);
 for(const change of [{remaining:{...reply.remaining,4:null}},{remaining:{...reply.remaining,10:-1}},
 {version:2},{rulesetVersion:4},{active:false},{operations:['sub']}, {remaining:{...reply.remaining,sudden:'20'}}])
   assert.equal(confirmedRemaining({...reply,...change},base),null);
 assert.equal(confirmedRemaining(reply,base)['three-lives'],12);
 assert.equal(confirmedRemaining({...reply,remaining:{4:0,10:0,20:0,'three-lives':0,sudden:0}},base)['4'],0);
});
test('projections hors Mélange: aucune opération, uniquement réponse serveur',()=>{
 const ctx={...base,appKey:'addition-ecrite-multiple',operations:null,rulesetVersion:1};
 const resp={...reply,appKey:ctx.appKey,operations:[],rulesetVersion:1};
 assert.equal(confirmedRemaining(resp,ctx)['20'],76);
 assert.equal(confirmedRemaining({...resp,operations:['add']},ctx),null);
 assert.equal(canonicalOperations(['mul','add'],true).join(','),'add,mul');
 assert.equal(canonicalOperations(['add','add'],true),null);
});
test('demi-droit et complément idempotent, aucun trophée 3 vies',()=>{
 assert.deepEqual(referenceTopUp({full:10,alreadyCredited:0,mode:'three-lives'}),{cap:5,delta:5,trophyEligible:false});
 assert.equal(referenceTopUp({full:10,alreadyCredited:5,mode:'three-lives'}).delta,0);
 assert.equal(referenceTopUp({full:10,alreadyCredited:5,mode:'sudden'}).delta,5);
 assert.equal(referenceTopUp({full:10,alreadyCredited:10,mode:'sudden'}).delta,0);
 assert.equal(referenceTopUp({full:10,alreadyCredited:10,mode:'three-lives'}).delta,0);
 assert.equal(referenceTopUp({full:7,alreadyCredited:3,mode:'sudden'}).delta,4);
 assert.equal(referenceTopUp({full:7,alreadyCredited:0,mode:'three-lives'}).cap,3);
});
test('journal: réponses incomplètes refusées, paires indépendantes, 3e erreur finale, anti double-clic',()=>{
 const steps=[{id:'a',complete:true,validated:true,correct:false,firstTry:false},
 {id:'b',complete:true,validated:true,correct:true,firstTry:true},
 {id:'c',complete:true,validated:true,correct:false,firstTry:false},
 {id:'d',complete:true,validated:true,correct:false,firstTry:false}];
 assert.deepEqual(normalizeLifeJournal({steps,score:1,level:2,operations:null}),{
 score:1,errors:3,ended:true,completed:4,operationsSelectedAtStart:[]});
 assert.equal(normalizeLifeJournal({steps:[...steps,steps[1]],score:2,level:2}),null);
 assert.equal(normalizeLifeJournal({steps:[steps[0],steps[0]],score:0,level:2}),null);
 assert.equal(normalizeLifeJournal({steps:[{...steps[0],complete:false}],score:0,level:2}),null);
 assert.equal(normalizeLifeJournal({steps:[{...steps[0],firstTry:true}],score:0,level:2}),null);
});
test('score classement bloqué tant que la politique comparabilité et arrondi non approuvée',()=>{
 assert.equal(referenceRankingPoints(11,'sudden',null),null);
 assert.equal(referenceRankingPoints(11,'sudden',{comparabilityApproved:false,unit:'correct-calculation',rounding:'floor'}),null);
 const policy={comparabilityApproved:true,unit:'correct-calculation',rounding:'floor'};
 assert.equal(referenceRankingPoints(11,'sudden',policy),13);
 assert.equal(referenceRankingPoints(11,'three-lives',policy),11);
 assert.equal(referenceRankingPoints(11,'classic',policy),11);
});
