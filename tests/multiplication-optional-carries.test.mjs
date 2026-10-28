import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const html=readFileSync(new URL('../apps/multiplication-simple/game-original.html',import.meta.url),'utf8');
function extract(name,next){
 const start=html.indexOf('function '+name+'(');
 assert.ok(start>=0,name+' not found');
 const end=html.indexOf('function '+next+'(',start);
 assert.ok(end>start);
 return html.slice(start,end);
}
const normal=extract('evaluate','markErrors');
const hard=extract('evalHard','markHardErrors');
test('classic accepts correct result without any carry (top or side)',()=>{
 for(const carryMethod of ['top','side']){
  const states=[{answerCount:2,answerValues:['4','2'],count:2,incoming:[0,1],carryValues:['',''],sideCarryValues:['','']}];
  const r=runInNewContext(normal+';evaluate(0)',{states,expectedDigits:()=>['4','2'],carryMethod});
  assert.equal(r.filled,true);assert.equal(r.correct,true);
 }
});
test('classic rejects a WRONG entered carry',()=>{
 for(const carryMethod of ['top','side']){
  const states=[{answerCount:2,answerValues:['4','2'],count:2,incoming:[0,1],carryValues:['','2'],sideCarryValues:['','2']}];
  const r=runInNewContext(normal+';evaluate(0)',{states,expectedDigits:()=>['4','2'],carryMethod});
  assert.equal(r.correct,false);
 }
});
test('HARD accepts omitted carry but rejects incorrect answer',()=>{
 for(const carryMethod of ['top','side']){
  const hardState={result:'24',answerCount:2,answerValues:['4','2'],count:2,incoming:[0,1],carryValues:['',''],sideCarryValues:['','']};
  const ctx={hardState,carryMethod};
  assert.equal(runInNewContext(hard+';evalHard()',ctx).correct,true);
  hardState.answerValues=['4','3'];
  assert.equal(runInNewContext(hard+';evalHard()',ctx).correct,false);
 }
});
