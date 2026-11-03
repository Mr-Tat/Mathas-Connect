import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {rankMultiClass} from '../projection-v2-model.mjs';

const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const rootClass='aaa',comparison='bbb',app='addition-ecrite-simple';
test('Le podium est un rang numérique et non une médaille dans la V2 et les cinq maquettes',()=>{
 const pages=['projection-v2.html','projection-v2-demo.html',
  'essais/projection-v2-da-neon.html','essais/projection-v2-da-papier.html',
  'essais/projection-v2-da-ardoise.html','essais/projection-v2-da-studio.html'];
 for(const page of pages){
  const text=read('../'+page);
  assert.match(text,/projection-v2-avatar\.css\?v=20261103-compactes-cadres-v4/);
 }
 const live=read('../projection-v2-live.js'),demo=read('../projection-v2-demo.html');
 assert.match(live,/rank\.textContent=String\(place\)/);
 assert.match(demo,/rank\.textContent=String\(position\)/);
 assert.doesNotMatch(live,/🥇|🥈|🥉/);
 assert.doesNotMatch(demo,/🥇|🥈|🥉/);
 const css=read('../projection-v2-avatar.css');
 assert.match(css,/\.ranking-list\.single\{[\s\S]*?max-width:550px/);
 assert.match(css,/\.entry \.player-label\{[\s\S]*?flex:0 1 auto/);
 assert.match(css,/\.entry \.points\{margin-left:0/);
 assert.match(css,/\.entry \.player-label\{/);
 assert.match(css,/\.entry \.projection-avatar\{/);
 assert.match(css,/\.entry \.projection-avatar\.transparent\{/);
 assert.match(css,/grid-auto-rows:minmax\(56px,auto\)/);
 assert.match(css,/html\[data-proj-da\] \.entry:is\(\.rank-1,\.rank-2,\.rank-3\) \.primary \.points/);
 assert.match(css,/border:2px solid #b1cee5/);
});
test('Classement conserve avatar, score et consentement, sans modifier le rang',()=>{
 const classes=[{classId:rootClass,name:'Classe A',students:[
  {id:'a1',name:'Émilie',level:3,trophies:2,avatar:{kind:'letter',value:'É',color:'transparent'},
   scores:[{appKey:app,bestScore:44}]},
  {id:'a2',name:'Pupil sans choix',visible:false,avatar:{kind:'animal',value:'fox',color:'ocean'},
   scores:[{appKey:app,bestScore:999}]},
  {id:'a3',name:'Zoé',level:1,avatar:{kind:'animal',value:'fox',color:'fuchsia'},
   scores:[{appKey:app,bestScore:61}]}
 ]},{classId:comparison,name:'Classe B',students:[
  {id:'b1',name:'Léo',avatar:{kind:'object',value:'rocket',color:'electric'},
   scores:[{appKey:app,bestScore:81}]}
 ]}];
 const rows=rankMultiClass({classes,primaryClassId:rootClass,scoreClassIds:[comparison],appKey:app});
 assert.deepEqual(rows.map(r=>[r.id,r.position,r.score]),[['b1',1,81],['a3',2,61],['a1',3,44]]);
 assert.deepEqual(rows.map(r=>r.avatar.kind),['object','animal','letter']);
 assert.equal(rows[2].avatar.value,'É');
 assert.ok(!rows.some(r=>r.id==='a2'));
});
test('L’API ne divulgue les avatars que si la projection du prénom est autorisée',()=>{
 const edge=read('../supabase/functions/connect-projection-v2/index.ts');
 assert.match(edge,/select\('id,display_name,public_alias,projection_opt_in,avatar_kind,avatar_value,avatar_color,archived_at'\)/);
 assert.match(edge,/if\(!\(p\.projection_opt_in===true\|\|approvedScore\|\|\(showTeacher&&id===teacherId\)\)\)return null/);
 assert.match(edge,/if\(id===teacherId&&!showTeacher\)return null/);
 assert.match(edge,/avatar:\{kind:p\.avatar_kind\|\|'letter',value:p\.avatar_value\|\|null,color:p\.avatar_color\|\|'transparent'\}/);
 assert.match(edge,/if\(!await ownClasses\(user\.id,classIds\)\)return deny\('forbidden',403\)/);
 assert.doesNotMatch(edge,/Math\.random\(\)|public\.connect_students.*update\(/);
});
