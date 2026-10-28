import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const script=readFileSync(new URL('../scripts/backup-weekly.mjs',import.meta.url),'utf8');
test('All 25 Connect tables are included in encrypted backup',()=>{
 const match=script.match(/const tables=\[([^\n]+)\];/);
 assert.ok(match);
 const tables=[...match[1].matchAll(/'([^']+)'/g)].map(x=>x[1]);
 assert.equal(tables.length,25);
 assert.equal(new Set(tables).size,25);
 for(const table of ['connect_parcours_current','connect_parcours_history','connect_parcours_xp_bonus'])assert.ok(tables.includes(table));
});
test('Fail closed when backup pagination reaches safety limit',()=>assert.match(script,/limite 50 000 lignes atteinte/));
test('Encryption and private destination are required',()=>{
 assert.match(script,/AES-GCM/);
 assert.match(script,/metadata\.private!==true/);
});
