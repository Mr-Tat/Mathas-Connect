import test from 'node:test';
import assert from 'node:assert/strict';
import {validPage,validSession,canAdvance,canReachPage,mandatoryBlocker} from '../apps/multiplication-simple/collective-contract.mjs';
const fixture={ok:true,active:true,sessionId:'00000000-0000-4000-8000-000000000001',
 revision:1,level:1,carryMethod:'top',pages:[[{a:'106',m:5},{a:'558',m:2}]],pageIndex:0,
 teacherPageIndex:0,requiredPages:[],allowSkip:true};
test('questions certifiées, pagination professeur et pages obligatoires valides',()=>{
 assert.equal(validSession(fixture),true);
 assert.equal(validSession({...fixture,pageIndex:2}),false);
 assert.equal(validSession({...fixture,teacherPageIndex:1}),false);
 assert.equal(validSession({...fixture,requiredPages:[4]}),false);
 assert.equal(validPage([{a:'1e9',m:3},{a:'558',m:2}]),false);
});
test('pas de passage avant l’ouverture du professeur, indépendamment des réponses',()=>{
 assert.equal(canReachPage({current:0,target:1,unlocked:0}),false);
 assert.equal(canReachPage({current:0,target:1,unlocked:1}),true);
 assert.equal(canReachPage({current:0,target:2,unlocked:2}),true);
 assert.equal(canAdvance(false,true,0,1),true);
});
test('chaque page obligatoire bloque le franchissement tant que deux calculs ne sont pas réussis',()=>{
 const args={requiredPages:[0,2],isFinished:i=>i===0};
 assert.equal(canReachPage({current:0,target:1,unlocked:3,...args}),true);
 assert.equal(canReachPage({current:1,target:2,unlocked:3,...args}),true);
 assert.equal(canReachPage({current:2,target:3,unlocked:3,...args}),false);
 assert.equal(mandatoryBlocker({target:3,...args}),2);
 assert.equal(canReachPage({current:2,target:1,unlocked:3,...args}),true);
 assert.equal(canReachPage({current:2,target:3,unlocked:3,requiredPages:[0,2],isFinished:()=>true}),true);
});
test('un élève ne peut pas contourner une page obligatoire via Dernière page',()=>{
 assert.equal(canReachPage({current:0,target:3,unlocked:3,requiredPages:[1],isFinished:()=>false}),false);
 assert.equal(mandatoryBlocker({target:3,requiredPages:[1],isFinished:()=>false}),1);
});
