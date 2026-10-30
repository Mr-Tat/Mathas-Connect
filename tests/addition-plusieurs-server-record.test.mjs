import test from 'node:test';import assert from 'node:assert/strict';import {validateRecord} from '../apps/addition-plusieurs/server-record-contract.mjs';
const uuid='123e4567-e89b-42d3-a456-426614174000';
const base={action:'game-record',appKey:'addition-ecrite-multiple',eventId:uuid,expectedRevision:0,expectedResetEpoch:0,points:0,mode:'classic',level:1,score:4,total:4};
test('accept staged completion payload without client-side XP',()=>assert.equal(validateRecord(base).score,4));
test('reject all arbitrary XP and corrupt payloads',()=>{for(const patch of [{points:22},{appKey:'addition-ecrite-simple'},{score:5},{total:17},{level:4},{eventId:'bad'},{expectedResetEpoch:-1},{mode:'hard',total:5},{mode:'hard-challenge',total:4}])assert.equal(validateRecord({...base,...patch}),null);});
