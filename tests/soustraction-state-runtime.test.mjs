import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';
const file=readFileSync(new URL('../supabase/functions/connect-results/index.ts',import.meta.url),'utf8');
const edge=stripTypeScriptTypes(file.replace(/^import .*;\n/,''),{mode:'strip'});
const ctx=vm.createContext({Deno:{env:{get:()=>''},serve:()=>{}},createClient:()=>({}),structuredClone,Intl,Date,Map,Set,JSON,Error,RegExp,Number,Object,Array});
vm.runInContext(edge,ctx);
const make=()=>({classic:[{},{},{}],sudden:[null,null,null],hard:[null,null,null],hardThree:[null,null,null],recent:[],ids:[],topThree:[],progress:{},
 suddenMethods:{addBottom:[4,null,null],takeTop:[9,null,null]}});
test('soustraction : normaliser garde chaque technique distincte',()=>{
 const state=ctx.validate(make());
 assert.equal(state.suddenMethods.addBottom[0],4);
 assert.equal(state.suddenMethods.takeTop[0],9);
});
test('soustraction : restauration par maximum, jamais écraser une technique',()=>{
 const current=ctx.validate(make());
 const old=make();old.suddenMethods.addBottom=[8,null,null];old.suddenMethods.takeTop=[2,null,null];
 old.topThree=[];
 const merged=ctx.mergeHistorical(current,ctx.validate(old));
 assert.equal(merged.suddenMethods.addBottom[0],8);
 assert.equal(merged.suddenMethods.takeTop[0],9);
});
test('soustraction : la méthode de partie récente survit à une normalisation',()=>{
 const a=make();a.recent=[{eventId:'11111111-1111-4111-8111-111111111111',mode:'sudden',level:1,score:4,total:null,points:32,at:'2026-10-28T15:00:00Z',method:'takeTop'}];
 const state=ctx.validate(a);
 assert.equal(state.recent[0].method,'takeTop');
});
test('soustraction : refuser les valeurs de records hors bornes',()=>{
 const a=make();a.suddenMethods.takeTop[0]=-1;
 assert.throws(()=>ctx.validate(a),/suddenMethods/);
});
