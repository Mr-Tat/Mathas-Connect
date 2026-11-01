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
  assert.match(html,/href="\.\/projection-v2-da\.css\?v=podium-2"/);
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


test('projection V2 : podium or argent bronze appliqué à la carte entière dans chaque DA',()=>{
 for(const rank of [1,2,3]){
  assert.match(style,new RegExp('\\.entry\\.rank-'+rank+'\\{\\s*background:linear-gradient\\('));
  assert.match(style,new RegExp('\\.entry\\.rank-'+rank+' \\.place\\{background:'));
 }
 assert.match(style,/\.entry:is\(\.rank-1,\.rank-2,\.rank-3\) :is\(\.primary strong,\.points,\.minor,\.class-mark\)/);
 assert.match(style,/color:#233342!important/);
});

test('projection V2 : dégradé de treize paliers du rang 4 au rang 16, par palette',()=>{
 const expected=[0,8,17,25,33,42,50,58,67,75,83,92,100];
 for(let rank=4;rank<=16;rank++)
  assert.match(style,new RegExp('\\.entry\\.rank-'+rank+'\\{--rank-fade:'+expected[rank-4]+'%\\}'));
 assert.match(style,/color-mix\(in srgb,var\(--rank-start\) calc\(100% - var\(--rank-fade\)\),var\(--rank-end\) var\(--rank-fade\)\)/);
 for(const key of keys){
  const section=style.split('html[data-proj-da="'+key+'"]{').slice(-1)[0].split('}')[0];
  for(const variable of ['rank-start','rank-end','rank-start-border','rank-end-border','rank-start-tag','rank-end-tag'])
   assert.match(section,new RegExp('--'+variable+':#[0-9a-fA-F]{6}'));
 }
});

test('projection V2 : quatre signatures typographiques à contraste constant sans polices externes',()=>{
 const families={
  neon: 'Trebuchet MS',
  papier: 'Georgia',
  ardoise: 'Verdana',
  studio: 'Impact'
 };
 for(const [key,font] of Object.entries(families)){
  const prefix='html[data-proj-da="'+key+'"]';
  assert.ok(style.includes(prefix+' body{font-family:'),'Police de corps absente : '+key);
  assert.ok(style.includes(prefix+' :is(header strong,.ranking-head h1,.panel h2){'),'Police de titre absente : '+key);
  assert.ok(style.includes(prefix+' :is(.primary strong,.points){'),'Police de noms et score absente : '+key);
  assert.ok(style.includes(font),'Font stack absent : '+key);
 }
 assert.doesNotMatch(style,/@font-face|fonts\\.googleapis|fonts\\.gstatic|@import|url\\(/i);
});
