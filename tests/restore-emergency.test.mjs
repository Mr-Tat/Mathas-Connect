import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';

const edge=readFileSync(new URL('../supabase/functions/connect-results/index.ts',import.meta.url),'utf8');
const start=edge.indexOf('function normalizeRewards(');
const end=edge.indexOf('Deno.serve(',start);
assert.ok(start>=0&&end>start,'Pure restore functions found');
const source=stripTypeScriptTypes(edge.slice(start,end),{mode:'strip'});
const context=vm.createContext({
 structuredClone, Date, Intl, Array, Object, Map, Set, Number, JSON, Error,
 int:(n,min,max)=>Number.isSafeInteger(n)&&n>=min&&n<=max,
 valid:v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v),
 belgianDay:()=> '2026-10-24'
});
vm.runInContext(source,context);
const restore=(now,old)=>JSON.parse(JSON.stringify(vm.runInContext(
 'restorePreviewState('+JSON.stringify(now)+','+JSON.stringify(old)+')',context
)));
const empty=()=>({classic:[{},{},{}],sudden:[null,null,null],hard:[null,null,null],recent:[],bestPoints:null,todayBest:null,progress:{},ids:[],topThree:[],hardThree:[null,null,null],rewards:null});
const awards=()=>({mastery:{4:[false,false,false],10:[true,false,false],20:[false,false,false]},sudden:[false,false,false],hardAwards:{bronze:[false,false,false],silver:[false,false,false],gold:[false,false,false]},scoreOne:{bronze:false,silver:false,gold:false},unlockedGold:false});
test('newer record is never replaced by an older backup',()=>{
 const now=empty(),old=empty();now.bestPoints=180;old.bestPoints=90;
 now.classic[0][10]=9;old.classic[0][10]=8;
 const r=restore(now,old);assert.equal(r.after.bestPoints,180);assert.equal(r.after.classic[0][10],9);
});
test('older permanent trophy and unlock are recovered',()=>{
 const now=empty(),old=empty();old.rewards=awards();old.progress.level2=true;
 const r=restore(now,old);assert.equal(r.after.rewards.mastery['10'][0],true);assert.equal(r.after.progress.level2,true);
});
test('same backup is idempotent for permanent records',()=>{
 const now=empty(),old=empty();old.bestPoints=90;old.topThree=[90];old.classic[0][4]=4;
 const first=restore(now,old).after,second=restore(first,old).after;
 assert.deepEqual(second,first);
});
test('invalid classic score is rejected',()=>{
 const now=empty(),old=empty();old.classic[0][10]=11;
 assert.throws(()=>restore(now,old),/invalid_import|classic/);
});
test('recent games are deduplicated, limit 3',()=>{
 const now=empty(),old=empty();
 const event={mode:'classic',level:1,score:3,total:4,points:20,at:'2026-10-21T10:00:00Z'};
 now.recent=[event];old.recent=[event];
 assert.equal(restore(now,old).after.recent.length,1);
});
test('previous day is not reclassified as today',()=>{
 const now=empty(),old=empty();old.todayBest={day:'2026-10-20',points:100};
 assert.equal(restore(now,old).after.todayBest,null);
});
test('restore entrypoints require teacher permissions and revision compare-and-set',()=>{
 assert.match(edge,/if\(!await managed\(\)\|\|!valid\(b.studentId\)/);
 assert.match(edge,/if\(rev!==b.expectedRevision\|\|epoch!==b.expectedResetEpoch\)/);
 assert.match(edge,/\.eq\('revision',rev\)\.eq\('reset_epoch',epoch\)/);
 assert.match(edge,/b.previewDigest!==digest/);
});
