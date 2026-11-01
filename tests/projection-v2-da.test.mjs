import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const base=readFileSync(new URL('../projection-v2-demo.html',import.meta.url),'utf8');
const style=readFileSync(new URL('../essais/projection-v2-da.css',import.meta.url),'utf8');
const keys=['neon','papier','ardoise','studio'];
const script=html=>html.match(/<script>([\s\S]*?)<\/script>/)?.[1]??'';
const baseCode=script(base);

test('projection V2 : les quatre DA réutilisent strictement le moteur original de démonstration',()=>{
 assert.ok(baseCode.length>6500);
 for(const key of keys){
  const html=readFileSync(new URL('../essais/projection-v2-da-'+key+'.html',import.meta.url),'utf8');
  assert.match(html,new RegExp('data-proj-da="'+key+'"'));
  assert.match(html,/href="\.\/projection-v2-da\.css"/);
  assert.equal(script(html),baseCode,'Le JS des scores et des options doit être inchangé : '+key);
  assert.doesNotMatch(html,/Meilleures remontées|id="rises"/);
  assert.match(html,/id="ranking-list"/);
  assert.match(html,/class="left-col"/);
  assert.match(html,/class="right"/);
  assert.match(html,/✨ Nouveaux exploits/);
  assert.match(html,/MAQUETTE · RÉSULTATS FICTIFS/);
  assert.match(html,/slice\(0,16\)/);
  assert.match(html,/grid-template-rows:repeat\(var\(--row-count,8\),minmax\(0,1fr\)\)/);
  assert.match(html,/settings-left/);
  assert.match(html,/id="app-options"/);
  assert.match(html,/id="comparison-options"/);
  assert.match(html,/id="prev-app"/);
  assert.match(html,/id="next-app"/);
  assert.match(html,/id="pause"/);
  for(const variant of keys)assert.match(html,new RegExp('href="\\./projection-v2-da-'+variant+'\\.html"'));
  assert.match(html,/aria-current="page"/);
  assert.match(html,/href="\.\.\/projection-v2-demo\.html"/);
  const check=spawnSync(process.execPath,['--check','--input-type=commonjs'],{input:script(html),encoding:'utf8'});
  assert.equal(check.status,0,'Le JS V2 doit compiler : '+key+' '+check.stderr);
 }
});

test('projection V2 : quatre DA distinctes et styles de projection sans ressources externes',()=>{
 for(const key of keys)assert.match(style,new RegExp('data-proj-da="'+key+'"'));
 assert.match(style,/\.ranking-col \+ \.ranking-col/);
 assert.match(style,/\.ranking-head h1/);
 assert.match(style,/\.right \.panel/);
 assert.match(style,/\.entry/);
 assert.match(style,/\.left \.classstat\.global-success/);
 assert.match(style,/focus-visible/);
 assert.match(style,/prefers-reduced-motion/);
 assert.doesNotMatch(style,/@import|url\(|<script|supabase|fetch\(/i);
 let braces=0;
 for(const ch of style){if(ch==='{')braces++;if(ch==='}')braces--;assert.ok(braces>=0,'CSS: accolade fermante inattendue');}
 assert.equal(braces,0,'CSS: accolades équilibrées');
});

test('projection V2 : pages authentifiées et maquette historique non modifiées par les variantes',()=>{
 const live=readFileSync(new URL('../projection-v2.html',import.meta.url),'utf8');
 assert.match(live,/src="\.\/projection-v2-live\.js\?v=/);
 assert.doesNotMatch(live,/projection-v2-da\.css/);
 assert.doesNotMatch(base,/projection-v2-da\.css/);
 assert.doesNotMatch(live,/Meilleures remontées/);
 assert.doesNotMatch(base,/Meilleures remontées/);
});
