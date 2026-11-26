import test from 'node:test';
import assert from 'node:assert/strict';
import {questionSequence,verifySequence} from '../apps/DIV-Milieu-de-segment-1/connect/seeded-questions.mjs';
const seed='12345678-1234-4321-8765-123456789abc';
test('séquence reproductible, mélange et cycles illimités',()=>{for(const [id,size] of [['gi2',20],['g3',72],['mix',10]]){const next=questionSequence(id,seed),items=Array.from({length:size*4},()=>({n:next()}));for(let i=0;i<4;i++)assert.equal(new Set(items.slice(i*size,(i+1)*size).map(x=>x.n)).size,size);verifySequence({activity:id,items},seed);items[0].n=-1;assert.throws(()=>verifySequence({activity:id,items},seed),/invalid_sequence/)}});
