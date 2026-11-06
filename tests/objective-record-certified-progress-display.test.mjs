import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {schoolOfficialResultRecords,schoolProgressSnapshot} from '../apps/objective-record/school-official-unlocks.mjs';
import {renderCertifiedTodayPoints,nativeDayPoints} from '../apps/objective-record/school-score-view.mjs';

const source=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const state={classic:[{'4':4,'10':9}, {}, {}],sudden:[null,null,null],
 rewards:{version:3},progress:{level2:true,sudden1:true}};

test('les résultats classiques authentifiés remplissent le tableau du niveau 1',()=>{
 const profile=schoolProgressSnapshot('addition-ecrite-simple',state);
 assert.ok(profile?.active);
 assert.deepEqual(profile.records.classics[0],{'4':4,'10':9});
 assert.deepEqual(profile.records.classics[1],{});
 assert.deepEqual(profile.records.suddens,[null,null,null]);
 assert.deepEqual(profile.records.visibleLevels,[true,true,false]);
 assert.equal(profile.records.hardUnlocked,false);
});

test('aucun score inventé ou non valide ne devient visible',()=>{
 const profile=schoolOfficialResultRecords({
  classic:[{'4':8,'10':-3,'20':20}, {},{}],
  sudden:[-1,null,6],hard:[null,-3,0],progress:{}
 });
 assert.deepEqual(profile.classics[0],{'20':20});
 assert.deepEqual(profile.suddens,[null,null,6]);
 assert.deepEqual(profile.hardRows,[{level:3,score:0}]);
});

test('les deux moteurs natifs lisent la grille sur le snapshot de l élève, pas sur le localStorage',()=>{
 for(const [slug,kind,file,app] of [
  ['addition-simple','add','game-original.html','addition-ecrite-simple'],
  ['addition-multiple','multi','index.html','addition-ecrite-multiple']
 ]){
  const sourcePath='apps/objective-record/engines/'+slug+'/';
  const patch=source(sourcePath+'lab-objectif-record-v2.js');
  const html=source(sourcePath+file);
  const context={window:{}};
  runInNewContext(patch,context);
  const compiled=context.window.MathasLabV2.patch(html,kind);
  const start=compiled.indexOf(' function records(){');
  const end=compiled.indexOf(' const esc=v=>',start);
  assert.ok(start>0&&end>start,slug);
  const factory=new Function('window','URL',compiled.slice(start,end)+'\nreturn records;');
  const profile=schoolProgressSnapshot(app,state);
  const school={
   parent:{location:{href:'https://example.org/?connect=1'},
    parent:{MathasConnectOfficialSchoolProgress:profile}}
  };
  const results=factory(school,URL)();
  assert.equal(results.classics[0]['4'],4,slug);
  assert.equal(results.classics[0]['10'],9,slug);
  assert.equal(results.visibleLevels[1],true,slug);
  assert.notStrictEqual(results,profile.records,'lecture isolée du snapshot');
  const missing=factory({parent:{location:{href:'https://example.org/?connect=1'},parent:{}}},URL)();
  assert.deepEqual(missing.classics,[{},{},{}],'pas de repli vers un profil local');
 }
});

test('le top du jour officiel remplace le 0 local sans écriture en base',()=>{
 const box={children:[],value:'0'};
 Object.defineProperty(box,'textContent',{
  get(){return this.children.length?this.children[0].textContent:this.value},
  set(v){this.value=v;this.children=[]}
 });
 Object.defineProperty(box,'firstElementChild',{get(){return this.children[0]??null}});
 box.append=function(node){this.children.push(node)};
 const doc={
  querySelector:selector=>selector==='#mathasPointsQuick [data-points="daily"]'?box:null,
  createElement:()=>({textContent:''})
 };
 const history={ok:true,events:[],bestThree:[],boardBest:0,
  todayBest:{eventId:'11111111-1111-4111-8111-111111111111',
   mode:'classic',score:9,total:10,points:27,at:new Date().toISOString()}};
 assert.equal(nativeDayPoints({querySelector:()=>box}),0);
 assert.equal(renderCertifiedTodayPoints(doc,history),true);
 assert.equal(nativeDayPoints({querySelector:()=>box}),27);
 assert.equal(renderCertifiedTodayPoints(doc,history),true);
 assert.equal(box.children.length,1,'ne recrée pas le DOM inutilement');
 assert.equal(renderCertifiedTodayPoints(doc,{ok:false,...history,ok:false}),false);
});

test('l hôte actualise et met en cache la grille et le score du jour',()=>{
 const host=source('apps/objective-record/eleve.mjs');
 const html=source('apps/objective-record/eleve.html');
 const scoreboard=source('apps/objective-record/school-score-view.mjs');
 assert.match(host,/school-official-unlocks\.mjs\?v=20261106-certified-results-v2/);
 assert.match(host,/school-score-view\.mjs\?v=20261106-fullscreen-share-v3/);
 assert.match(host,/window\.MathasConnectOfficialSchoolProgress=lastOfficialProgress/);
 assert.match(html,/eleve\.mjs\?v=20261106-fast-certified-start-v1/);
 assert.match(scoreboard,/MutationObserver\(renderToday\)/);
 assert.match(scoreboard,/renderCertifiedTodayPoints\(documentRef,remote,state\)/);
});
