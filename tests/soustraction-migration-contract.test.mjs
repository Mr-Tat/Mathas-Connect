import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('../supabase/migrations/20261028_soustraction_connect_v1.sql',import.meta.url),'utf8');
test('migration : le catalogue utilise une URL HTTPS absolue',()=>{
 const insert=sql.match(/INSERT INTO public\.connect_apps[^;]*;/i)?.[0];
 assert.ok(insert,'insert catalogue');
 assert.match(insert,/https:\/\/mr-tat\.github\.io\/Mathas-Connect\/apps\/soustraction-simple\/illustration\.webp/);
 assert.doesNotMatch(insert,/'\.\/apps\//);
});
test('migration : la grille XP Soustraction comporte neuf jalons explicites et totalise 474 XP',()=>{
 const insert=sql.match(/INSERT INTO public\.connect_xp_award_rules[\s\S]*?ON CONFLICT\(app_key,award_key\) DO NOTHING;/i)?.[0];
 assert.ok(insert,'grille XP');
 const pairs=[...insert.matchAll(/'soustraction-ecrite-simple','([^']+)',(\d+)\)/g)];
 assert.equal(pairs.length,9);
 assert.equal(new Set(pairs.map(m=>m[1])).size,9);
 assert.equal(pairs.reduce((total,m)=>total+Number(m[2]),0)*3,474);
 assert.ok(pairs.some(m=>m[1]==='sudden:5'));
 assert.ok(pairs.some(m=>m[1]==='hard:7'));
});
