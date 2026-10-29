import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {summarizeProjection} from '../projection-model.mjs';

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const ui=read('../projection.js'),html=read('../projection.html');
const catalog=[
 {app_key:'addition-ecrite-simple',title:'Addition',featured:true},
 {app_key:'multiplication-ecrite-simple',title:'Multiplication',featured:true},
 {app_key:'soustraction-ecrite-simple',title:'Soustraction secrète',featured:false}
];
const now=new Date('2026-10-29T10:00:00');
const students=[
 {displayName:'Alice – ne jamais projeter',apps:[
  {appKey:'addition-ecrite-simple',state:{recent:[{at:'2026-10-29T09:00:00',score:4}]}},
  {appKey:'soustraction-ecrite-simple',state:{recent:[{at:'2026-10-29T09:01:00'}]}}
 ]},
 {displayName:'Benoît – ne jamais projeter',apps:[
  {appKey:'addition-ecrite-simple',state:{recent:[{at:'2026-10-28T12:00:00'}]}},
  {appKey:'multiplication-ecrite-simple',state:{recent:[{at:'2026-10-29T09:30:00'}]}}
 ]},
 {displayName:'Céline – ne jamais projeter',apps:[]}
];

test('projection : seuls les chiffres collectifs quittent le modèle',()=>{
 const output=summarizeProjection(students,catalog,now);
 assert.equal(output.total,3);
 assert.equal(output.participants,2);
 assert.equal(output.activeToday,2);
 assert.deepEqual(output.apps.map(a=>[a.title,a.recent,a.today]),[
  ['Addition',2,1],['Multiplication',1,1]
 ]);
 const serialized=JSON.stringify(output);
 for(const sensitive of ['Alice','Benoît','Céline','Soustraction secrète','displayName'])
  assert.ok(!serialized.includes(sensitive),sensitive);
});

test('projection : aucun état, dates invalides et dénominateur vide sont sûrs',()=>{
 const output=summarizeProjection([
  {displayName:'Test',apps:[{appKey:'addition-ecrite-simple',state:{recent:[{at:'pas une date'}]}}]}
 ],catalog,now);
 assert.equal(output.total,1);
 assert.equal(output.participants,1);
 assert.equal(output.activeToday,0);
 assert.equal(summarizeProjection([],catalog,now).total,0);
 assert.equal(summarizeProjection(null,null,now).apps.length,0);
});

test('projection : Soustraction invisible même si featured devient true',()=>{
 const mistaken=catalog.map(a=>({...a,featured:true}));
 const result=summarizeProjection(students,mistaken,now);
 assert.ok(!result.apps.some(a=>a.key==='soustraction-ecrite-simple'));
});

test('projection : aucune écriture serveur, rafraîchissement automatique ou identité projetée',()=>{
 assert.match(ui,/teacher-dashboard/);
 assert.match(ui,/teacher-overview/);
 assert.match(ui,/mathas-connect-professor-auth-v1/);
 assert.match(ui,/session\.user\?\.is_anonymous/);
 assert.doesNotMatch(ui,/teacher-export|game-record|teacher-parcours-restart|signInAnonymously|setInterval\s*\(/);
 assert.doesNotMatch(ui,/person\.displayName|innerHTML\s*=/);
 assert.match(ui,/window\.addEventListener\('pagehide'/);
 assert.match(ui,/getElementById\('class-choice'\)|\$\('class-choice'\)/);
 assert.match(html,/<div id="board" hidden>/);
 assert.match(html,/Aucune modification des résultats ni des XP/);
 assert.match(html,/projection\.js/);
});
