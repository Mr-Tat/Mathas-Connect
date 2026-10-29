import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('../tests/postgres/addition-multiple-rpc-candidate.sql',import.meta.url),'utf8');
test('four existing protected RPCs now permit addition multiple',()=>{
 const functions=[...sql.matchAll(/CREATE OR REPLACE FUNCTION public\.([^(]+)/g)].map(x=>x[1]);
 assert.deepEqual(functions,['connect_parcours_restart_class','connect_parcours_restart_one','connect_xp_read_v2','connect_xp_sync_v2']);
 assert.equal((sql.match(/'addition-ecrite-multiple'/g)||[]).length,4);
 assert.equal((sql.match(/'soustraction-ecrite-simple'/g)||[]).length,4);
 assert.match(sql,/p_app NOT IN/);
});
test('no student modification executed by this staging test',()=>{
 assert.match(sql,/DRAFT ONLY/);
 assert.doesNotMatch(sql,/\bTRUNCATE\b|\bDROP TABLE\b|\bDELETE FROM\b/i);
});
