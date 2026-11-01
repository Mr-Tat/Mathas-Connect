import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {runInNewContext} from 'node:vm';
const doc=readFileSync(new URL('../projection-v2-demo.html',import.meta.url),'utf8');
test('projection V2 demo : 14 élèves répartis en une ou deux colonnes',()=>{
 assert.match(doc,/const names=\[.*"Nathan"\]/);
 assert.match(doc,/slice\(0,16\)/);
 assert.match(doc,/seconds=30/);
 assert.match(doc,/split=rows\.length>7/);
 assert.match(doc,/rank-"\+position/);
 assert.match(doc,/\.ranking-col \+ \.ranking-col\{border-left:5px/);
 assert.match(doc,/column\.style\.setProperty\("--row-count"/);
 assert.match(doc,/\.entry\.rank-1 \.place/);
 assert.doesNotMatch(doc,/\.entry:first-child \.place/);
 assert.match(doc,/Réussite de la classe/);
 assert.match(doc,/id="header-class" class="header-class"/);
 assert.match(doc,/Phase 2 A<\/div>/);
 assert.doesNotMatch(doc,/id="ranking-note"/);
 assert.doesNotMatch(doc,/class="ranking-guide"/);
 assert.match(doc,/\.ranking-head\{min-height:69px;padding:6px 12px 7px\}/);
 assert.match(doc,/addPct\(card,"Global",c\.pct,true,true\)/);
 assert.match(doc,/class="projection-stage"/);
 assert.match(doc,/\.projection-stage\{height:100vh;height:100dvh/);
 assert.doesNotMatch(doc,/class="ranking-footer"/);
 assert.doesNotMatch(doc,/<h2>↔ Autres classes<\/h2>/);
 assert.match(doc,/\.compare-row \.classstat\.global-success\{[^}]*padding:4px 7px/);
 assert.match(doc,/\.compare-row \.classstat\.global-success \.headline strong\{font-size:15px/);
 assert.match(doc,/\.compare-row > strong\{[^}]*text-align:center;font-size:14px;font-weight:900/);
 assert.match(doc,/\.compare-panel\{background:#344a60/);
 assert.match(doc,/\.compare-line\{[^}]*font-size:11px/);
 assert.match(doc,/\.compare-row \.classstat\.global-success \.track\{display:none\}/);
 assert.match(doc,/if\(!compact\)row\.append\(track\)/);
 assert.match(doc,/<footer>[\s\S]*id="rotation-label"[\s\S]*id="time-left"[\s\S]*id="next-app"/);
 assert.match(doc,/for\(const field of \["score","percentage"\]\)/);
 assert.match(doc,/makeExploit\("trophy"/);
 assert.match(doc,/makeExploit\("perfect"/);
 assert.match(doc,/makeExploit\("top"/);
 assert.doesNotMatch(doc,/Meilleures remontées|id="rises"/);
 assert.match(doc,/makeSpectacularRise\("Adam",7,4,92,116\)/);
 assert.match(doc,/\.right\{display:grid;gap:12px;grid-template-rows:minmax\(0,1fr\);min-width:0\}/);
 assert.match(doc,/const cut=Math\.ceil\(rows\.length\/2\)/);
 assert.match(doc,/Niveau.*person\.level/);
 assert.match(doc,/person\.trophies/);
 assert.match(doc,/primary\.append\(name,points\)/);
});
test('projection V2 demo : rotation 30 s, score et % indépendants, Monsieur T initialement masqué',()=>{
 assert.match(doc,/let selected="addition",seconds=30/);
 assert.match(doc,/if\(--seconds<=0\)go\(1\)/);
 assert.match(doc,/for\(const field of \["score","pct"\]\)/);
 assert.match(doc,/\$\("show-teacher"\)\.checked=false/);
 assert.match(doc,/Aucune donnée n.est modifiée ici/);
 assert.doesNotMatch(doc,/supabase\.co|service_role|teacher-overview|student_id/);
 assert.match(doc,/MAQUETTE · RÉSULTATS FICTIFS/);
});
test('projection V2 demo : exploit Mort subite uniquement au-delà de 10 réponses',()=>{
 assert.match(doc,/makeSuddenExploit\("Inès",11\)/);
 assert.match(doc,/sudden:\["🔥","sudden"\]/);
 assert.match(doc,/\.event\.sudden \.event-icon/);
 const source=doc.match(/function makeSuddenExploit\(name,correct\)\{[\s\S]*?\n\}/)?.[0];
 assert.ok(source);
 const fn=runInNewContext(source+'; makeSuddenExploit',{makeExploit:(type,message)=>({type,message})});
 for(const count of [0,9,10,10.5,-1,NaN])assert.equal(fn('Inès',count),null);
 const result=fn('Inès',11);
 assert.equal(result.type,'sudden');
 assert.match(result.message,/Inès dépasse 10 bonnes réponses en Mort subite : 11/);
 assert.match(fn('Inès',12).message,/12/);
});

test('projection V2 : remontée remarquable seulement avec +3 places et un record supérieur',()=>{
 const source=doc.match(/function makeSpectacularRise\(name,previousRank,newRank,previousBest,newBest\)\{[\s\S]*?\n\}/)?.[0];
 assert.ok(source);
 const fn=runInNewContext(source+'; makeSpectacularRise',{makeExploit:(type,message)=>({type,message})});
 assert.match(fn('Adam',7,4,92,116).message,/3 places grâce à un nouveau record/);
 for(const params of [
  ['Adam',7,5,92,116], // 2 places ne suffisent pas.
  ['Adam',7,4,92,92],  // pas de nouveau record.
  ['Adam',7,4,92,80],  // le score a baissé.
  ['Adam',2,0,92,116], // rang impossible.
  ['Adam',7,4,NaN,116],
  ['',7,4,92,116]
 ])assert.equal(fn(...params),null,JSON.stringify(params));
});

test('projection V2 demo : script inline valide en Node',()=>{
 const js=doc.match(/<script>([\s\S]*?)<\/script>/)?.[1];
 assert.ok(js);
 const result=spawnSync(process.execPath,['--check','--input-type=commonjs'],{input:js,encoding:'utf8'});
 assert.equal(result.status,0,result.stderr);
});