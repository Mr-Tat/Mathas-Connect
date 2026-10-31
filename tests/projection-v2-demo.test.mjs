import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const doc=readFileSync(new URL('../projection-v2-demo.html',import.meta.url),'utf8');
test('projection V2 demo : 14 élèves répartis en une ou deux colonnes',()=>{
 assert.match(doc,/const names=\[.*"Nathan"\]/);
 assert.match(doc,/const split=rows\.length>7/);
 assert.match(doc,/rank-"\+position/);
 assert.match(doc,/\.ranking-col \+ \.ranking-col\{border-left:5px/);
 assert.match(doc,/\.entry\.rank-1 \.place/);
 assert.doesNotMatch(doc,/\.entry:first-child \.place/);
 assert.match(doc,/Réussite de la classe/);
 assert.match(doc,/for\(const field of \["score","percentage"\]\)/);
 assert.match(doc,/makeExploit\("trophy"/);
 assert.match(doc,/makeExploit\("perfect"/);
 assert.match(doc,/makeExploit\("top"/);
 assert.match(doc,/Math\.ceil\(rows\.length\/2\)/);
 assert.match(doc,/Niveau.*person\.level/);
 assert.match(doc,/person\.trophies/);
 assert.match(doc,/primary\.append\(name,points\)/);
});
test('projection V2 demo : rotation 90 s, score et % indépendants, Monsieur T initialement masqué',()=>{
 assert.match(doc,/let selected="addition",seconds=90/);
 assert.match(doc,/if\(--seconds<=0\)go\(1\)/);
 assert.match(doc,/for\(const field of \["score","pct"\]\)/);
 assert.match(doc,/\$\("show-teacher"\)\.checked=false/);
 assert.match(doc,/Aucune donnée n.est modifiée ici/);
 assert.doesNotMatch(doc,/supabase\.co|service_role|teacher-overview|student_id/);
 assert.match(doc,/MAQUETTE · RÉSULTATS FICTIFS/);
});
test('projection V2 demo : script inline valide en Node',()=>{
 const js=doc.match(/<script>([\s\S]*?)<\/script>/)?.[1];
 assert.ok(js);
 const result=spawnSync(process.execPath,['--check','--input-type=commonjs'],{input:js,encoding:'utf8'});
 assert.equal(result.status,0,result.stderr);
});