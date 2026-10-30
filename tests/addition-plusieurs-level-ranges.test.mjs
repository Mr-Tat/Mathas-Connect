// Test the actual published native calculation generators, without touching XP,
// Supabase, student scores, or changing the original completion contract.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const game=readFileSync(new URL('../apps/addition-plusieurs/game-original.html',import.meta.url),'utf8');
function between(start,end){
 const a=game.indexOf(start),b=game.indexOf(end,a+start.length);
 assert.ok(a>=0&&b>a,'native generator boundary changed: '+start);
 return game.slice(a,b);
}
const levelRules=between('function addendCountForLevel(level)','function fillAddendSelect(s)');
const classicGenerator=between('function pow10(n)','/* SESSION */');
const classic=vm.runInNewContext(levelRules+'\n'+classicGenerator+
 '\n({addendCountForLevel,minimumDigitsForLevel,generateAddition})',{
 Math,rnd:(a,b)=>Math.floor(Math.random()*(b-a+1))+a
});
const configStart='window.MathasAppConfig=';
const configLine=game.split('\n').find(line=>line.includes(configStart));
assert.ok(configLine,'native app configuration');
const config=JSON.parse(configLine.slice(configLine.indexOf(configStart)+configStart.length,configLine.lastIndexOf(';')));
const hardGenerator=between('function randDigit(first=false)','function subtractionState(spec)');
const hard=vm.runInNewContext(hardGenerator+'\n({additionState})',{Math,BigInt});

test('normal levels always have fixed 3/4/5 addends and correct inclusive digit ranges',()=>{
 for(const [level,min,max,terms] of [[1,3,5,3],[2,3,6,4],[3,4,7,5]]){
  assert.equal(classic.addendCountForLevel(level),terms);
  assert.equal(classic.minimumDigitsForLevel(level),min);
  const observed=new Set();
  for(let i=0;i<35;i++){
   const item=classic.generateAddition(max,terms,min);
   assert.equal(item.addends.length,terms,'fixed number of addends');
   assert.equal(item.count,max,'carry grid width unchanged');
   assert.equal(item.result,item.addends.reduce((a,b)=>a+b,0),'arithmetic');
   assert.equal(item.answerCount,String(item.result).length);
   for(const value of item.addends){
    const digits=String(value).length;observed.add(digits);
    assert.ok(digits>=min&&digits<=max,'unexpected normal length '+digits);
   }
  }
  assert.ok(observed.has(min),'minimum digit count must actually be generated in level '+level);
  assert.ok(observed.has(max),'maximum digit count must actually be generated in level '+level);
 }
});
test('HARD uses 5/6/7 addends and exactly 7–9, 8–10, 10–12 digits respectively',()=>{
 assert.equal(config.hard.type,'addition');
 assert.deepEqual(Array.from(config.hard.levels,x=>[x.level,x.digits,x.addends]),
  [[1,9,5],[2,10,6],[3,12,7]]);
 for(const spec of config.hard.levels){
  const min=spec.digits-2, observed=new Set();
  for(let i=0;i<35;i++){
   const item=hard.additionState(spec);
   assert.equal(item.addends.length,spec.addends);
   assert.equal(item.count,spec.digits);
   assert.equal(item.result,item.addends.reduce((sum,n)=>sum+BigInt(n),0n).toString());
   for(const value of item.addends){
    const digits=value.length;observed.add(digits);
    assert.ok(digits>=min&&digits<=spec.digits,'unexpected HARD length '+digits);
   }
  }
  assert.ok(observed.has(min),'HARD minimum must be generated '+spec.level);
  assert.ok(observed.has(spec.digits),'HARD maximum must be generated '+spec.level);
 }
});
test('menu follows level, not unused manual count selector; no XP or original keys changed',()=>{
 assert.match(game,/sharedNote\.textContent=\x60Niveau \$\{level\} : \$\{representative\} nombres de/);
 assert.match(game,/states=\[0,1\]\.map\(\(\)=>\{const addendCount=addendCountForLevel\(session\.level\)/);
 for(const key of ['addition2_classic_v1','addition2_sudden_v1','addition2_hard_sudden_v3'])
  assert.ok(game.includes(key));
});
