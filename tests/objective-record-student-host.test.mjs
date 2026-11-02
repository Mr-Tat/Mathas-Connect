import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {permanentTrophyCount,studentHostContract} from '../apps/objective-record/student-host-contract.mjs';
const read=f=>readFileSync(new URL('../'+f,import.meta.url),'utf8');
const xp={ok:true,appXp:22,total:78,level:2};
const loaded={ok:true,revision:2,resetEpoch:0};
const appKey='addition-ecrite-simple';
test('lectures Connect réelles valides, aucun XP inventé',()=>{
 assert.deepEqual(studentHostContract({xp,loaded,appKey}),{appXp:22,total:78,level:2,revision:2,resetEpoch:0});
 for(const replacement of [null,{...xp,ok:false},{...xp,appXp:-1},{...xp,appXp:79},{...xp,total:NaN},{...xp,level:0}]){
  assert.equal(studentHostContract({xp:replacement,loaded,appKey}),null);
 }
 for(const replacement of [{...loaded,revision:-1},{...loaded,resetEpoch:null},{...loaded,ok:false}]){
  assert.equal(studentHostContract({xp,loaded:replacement,appKey}),null);
 }
 assert.equal(studentHostContract({xp,loaded,appKey:'unlisted-app'}),null);
});
test('les 25 trophées permanents sont comptés depuis la forme native officielle',()=>{
 const complete={
  version:3,
  mastery:{'4':[true,true,true],'10':[true,true,true],'20':[true,true,true]},
  sudden:[true,true,true],
  hardAwards:{bronze:[true,true,true],silver:[true,true,true],gold:[true,true,true]},
  scoreOne:{bronze:true,silver:true,gold:true},
  unlockedGold:true
 };
 assert.equal(permanentTrophyCount(complete),25);
 const partial=structuredClone(complete);
 partial.mastery['4']=[true,false,false];
 partial.sudden=[false,false,false];
 partial.scoreOne.gold=false;
 assert.equal(permanentTrophyCount(partial),19);
 assert.equal(permanentTrophyCount(null),null);
 assert.equal(permanentTrophyCount({...complete,version:2}),null);
 assert.equal(permanentTrophyCount({...complete,sudden:[]}),null);
 assert.equal(permanentTrophyCount({...complete,hardAwards:{}}),null);
});
test('lancement de la page exclusivement sous classe TEST et JWT approuvé',()=>{
 const code=read('apps/objective-record/eleve.mjs');
 const html=read('apps/objective-record/eleve.html');
 assert.match(code,/classId!==CLASS_TEST/);
 assert.match(code,/session\.auth\.getUser\(\)/);
 assert.match(code,/profile\.status!=='approved'\|\|profile\.classId!==classId/);
 assert.match(code,/student-me/);
 assert.match(code,/teacher-player/);
 assert.match(code,/mathas-connect-professor-auth-v1/);
 assert.match(code,/connect-results','student-load'/);
 assert.match(code,/connect-results','student-xp'/);
 assert.match(code,/hideFictionalXp\(doc\)/);
 assert.match(code,/const chooser=outer\?\.getElementById\('xp-preview-mode'\)/);
 assert.match(html,/XP globaux/);
 assert.match(html,/aucun résultat n’est envoyé sans preuve serveur/i);
 assert.doesNotMatch(code,/connect-record-pilot/);
 assert.doesNotMatch(code,/action:\s*['"](?:game-record|record|student-save)['"]/);
 assert.doesNotMatch(code,/\/functions\/v1\/connect-record-pilot/);
 assert.doesNotMatch(code,/connect_xp_credits|connect_trophy_achievements/);
 assert.doesNotMatch(html,/XP pilote/);
});
test('cinq vrais moteurs de démonstration accessibles sous une unique page élève',()=>{
 const code=read('apps/objective-record/eleve.mjs');
 for(const slug of ['addition-simple','addition-multiple','soustraction','multiplication','melange'])
  assert.ok(code.includes("'"+slug+"'"),slug);
 assert.match(code,/if\(seq!==generation\)/);
 assert.match(code,/clearInterval\(watching\)/);
 assert.match(code,/\$\('gameFrame'\)\.src=GAME_URLS\[slug\]\[1\]/);
});

test('les cinq cartes TEST proposent le nouveau lanceur sans remplacer le pilote',()=>{
 const lab=read('laboratoire.js');
 assert.match(lab,/Hôte élève · XP officiels \(lecture seule\)/);
 assert.match(lab,/new URL\('\.\/apps\/objective-record\/eleve\.html',location\.href\)/);
 assert.match(lab,/target\.searchParams\.set\('class',TEST_CLASS\)/);
 assert.match(lab,/if\(!verified\|\|!consent\(\)\)/);
 assert.match(lab,/const pilotSlug=recordPilotSlugByApp\[app\.app_key\]/);
 assert.match(lab,/buttons\.append\(student\)/);
});

test('Monsieur T peut ouvrir le nouvel hôte depuis sa session séparée, après activation',()=>{
 const lab=read('laboratoire.js');
 const host=read('apps/objective-record/eleve.mjs');
 assert.match(lab,/Hôte Monsieur T · lecture seule/);
 assert.match(lab,/candidateTeacher\.disabled=!teacherReady/);
 assert.match(lab,/guard\(\);if\(!teacherReady\)throw Error/);
 assert.match(lab,/teacherUrl\.searchParams\.set\('joueur','prof'\)/);
 assert.match(lab,/candidateTeacher\.classList\.add\('teacher-game'\)/);
 assert.match(host,/teacher\?\{storageKey:'mathas-connect-professor-auth-v1'\}/);
 assert.match(host,/teacher\?'teacher-player':'student-me'/);
});
