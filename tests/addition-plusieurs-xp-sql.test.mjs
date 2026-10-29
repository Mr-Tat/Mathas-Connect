import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {RULES,MAX_XP} from '../apps/addition-plusieurs/xp-model.mjs';
const sql=readFileSync(new URL('../supabase/migrations/20261029_addition_multiple_catalog_stage.sql',import.meta.url),'utf8');
test('SQL reward rows match modeled nine rules and 474 XP',()=>{
 const matches=[...sql.matchAll(/\('addition-ecrite-multiple','(classic:[^']+|sudden:[^']+|hard:[^']+)',(\d+)\)/g)];
 assert.equal(matches.length,9);
 const map=new Map(matches.map(m=>[m[1],+m[2]]));
 const expected=new Map([['classic:4:perfect',RULES.perfect4],['classic:10:pass',RULES.pass10],['classic:10:bonus',RULES.bonus10],['classic:20:pass',RULES.pass20],['classic:20:bonus',RULES.bonus20],['sudden:5',RULES.sudden5],['sudden:10',RULES.sudden10],['hard:3',RULES.hard3],['hard:7',RULES.hard7]]);
 assert.deepEqual(map,expected);
 assert.equal(3*[...map.values()].reduce((a,b)=>a+b,0),MAX_XP);
});
test('catalog is staged hidden and migration has no destructive statements',()=>{
 assert.match(sql,/VALUES \('addition-ecrite-multiple'[\s\S]*?false,'calculs_ecrits',false,40/);
 assert.doesNotMatch(sql,/\b(?:TRUNCATE|DELETE|DROP|ALTER|UPDATE)\b/i);
});
