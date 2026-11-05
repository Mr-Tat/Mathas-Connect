import test from 'node:test';
import assert from 'node:assert/strict';
import {officialMultiplicationCups,indicativeMultiplicationCups} from '../apps/multiplication-simple/school-ui.mjs';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

function rewards(){
 return {version:3,
  mastery:{4:[false,false,false],10:[false,false,false],20:[false,false,false]},
  sudden:[false,false,false],
  hardAwards:{bronze:[false,false,false],silver:[false,false,false],gold:[false,false,false]},
  scoreOne:{bronze:false,silver:false,gold:false},unlockedGold:false};
}

test('no official server rewards means no invented trophy badges',()=>{
 assert.equal(officialMultiplicationCups(null,'classic',1),null);
 assert.equal(officialMultiplicationCups({version:1},'classic',1),null);
 assert.equal(officialMultiplicationCups(rewards(),'classic',4),null);
 assert.equal(officialMultiplicationCups(rewards(),'hard-three-lives',1),null);
});

test('classic needs all three native perfect series for ONE bronze trophy',()=>{
 const r=rewards();
 assert.deepEqual(officialMultiplicationCups(r,'classic',1).map(x=>x.earned),[false]);
 r.mastery[4][0]=true;r.mastery[10][0]=true;
 assert.equal(officialMultiplicationCups(r,'classic',1)[0].earned,false);
 r.mastery[20][0]=true;
 const trophy=officialMultiplicationCups(r,'classic',1);
 assert.equal(trophy.length,1,'do not turn 4/10/20 milestones into three trophies');
 assert.equal(trophy[0].key,'mastery:1');
 assert.equal(trophy[0].color,'bronze');
 assert.equal(trophy[0].earned,true);
});

test('Mort subite, TOP DU JOUR et HARD affichent les trois coupes officielles indépendantes',()=>{
 const r=rewards();
 r.sudden[1]=true;
 const sudden=officialMultiplicationCups(r,'sudden',2);
 assert.deepEqual(sudden.map(x=>x.color),['bronze','silver','gold']);
 assert.deepEqual(sudden.map(x=>x.earned),[false,true,false]);
 assert.deepEqual(officialMultiplicationCups(r,'sudden',1),sudden,'niveau courant sans incidence sur le trio');
 r.scoreOne.gold=true;
 assert.deepEqual(officialMultiplicationCups(r,'score').map(x=>x.earned),[false,false,true]);
 r.hardAwards.silver[2]=true;
 const cups=officialMultiplicationCups(r,'hard-sudden',3);
 assert.deepEqual(cups.map(x=>x.key),['hard:bronze:3','hard:silver:3','hard:gold:3']);
 assert.deepEqual(cups.map(x=>x.earned),[false,true,false]);
});

test('sans état serveur, les trois zones ont des indicateurs neutres mais aucun acquis fictif',()=>{
 for(const [mode,level,count] of [['score',undefined,3],['sudden',1,3],['classic',1,1],['hard-sudden',2,3]]){
  const visual=indicativeMultiplicationCups(mode,level);
  assert.equal(visual.length,count,mode);
  assert.ok(visual.every(x=>x.earned===null),mode);
 }
 assert.equal(indicativeMultiplicationCups('classic',4),null);
 assert.equal(indicativeMultiplicationCups('three-lives',1),null);
 const source=read('apps/multiplication-simple/school-ui.mjs');
 assert.match(source,/if\(connected\)renderCups\(doc,rewards\)/);
 assert.match(source,/spec\.earned===null\?'unknown'/);
 assert.match(source,/Statut en attente de confirmation Connect/);
});

test('menu scolaire compact et identité Connect lisible sans message de progression tronqué',()=>{
 const ui=read('apps/multiplication-simple/school-ui.mjs');
 const launcher=read('apps/multiplication-simple/index.html');
 assert.match(ui,/min-height:124px!important/);
 assert.doesNotMatch(ui,/min-height:154px!important/);
 assert.match(launcher,/statusLabel\.textContent='● Connecté · '\+\(studentName\|\|'Compte élève'\);/);
 assert.doesNotMatch(launcher,/\+\(initial\?'':' · Nouvelle progression Connect'\)/);
});

test('native game still owns its 20 visual trophies; buttons never create server awards',()=>{
 const game=read('apps/multiplication-simple/game-original.html');
 const ui=read('apps/multiplication-simple/school-ui.mjs');
 const launcher=read('apps/multiplication-simple/index.html');
 assert.match(game,/20\/20 récompenses/);
 assert.match(ui,/rewards:initial\?\.rewards|officialMultiplicationCups/);
 assert.match(launcher,/rewards:initial\?\.rewards/);
 assert.doesNotMatch(ui,/connect_trophy_achievements|student-share-score|game-record/);
});
