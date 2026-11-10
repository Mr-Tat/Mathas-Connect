import test from 'node:test';
import assert from 'node:assert/strict';
import {validPage,validSession,canAdvance} from '../apps/multiplication-simple/collective-contract.mjs';
const fixture={ok:true,active:true,sessionId:'00000000-0000-4000-8000-000000000001',
 revision:1,level:1,carryMethod:'top',pages:[[{a:'106',m:5},{a:'558',m:2}]],pageIndex:0,allowSkip:false};
test('questions certifiées de séance et pagination valide',()=>{
 assert.equal(validSession(fixture),true);
 assert.equal(validSession({...fixture,pageIndex:2}),false);
 assert.equal(validPage([{a:'1e9',m:3},{a:'558',m:2}]),false);
});
test('élève : pas de saut avant ouverture professeur',()=>{
 assert.equal(canAdvance(true,false,0,0),false);
 assert.equal(canAdvance(false,false,0,1),false);
 assert.equal(canAdvance(true,false,0,1),true);
 assert.equal(canAdvance(false,true,0,1),true);
});
