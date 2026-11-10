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
test('lancement TEST ou deux additions scolaires : JWT approuvé, classe stricte',()=>{
 const code=read('apps/objective-record/eleve.mjs');
 const html=read('apps/objective-record/eleve.html');
 assert.match(code,/classId!==CLASS_TEST/);
 assert.match(code,/createVerifiedSessionToken\(\{auth:session\.auth,teacher\}\)/);
 const tokenCache=read('apps/objective-record/verified-session-token.mjs');
 assert.match(tokenCache,/auth\.getUser\(token\)/);
 assert.match(tokenCache,/local\?\.user\?\.id/);
 assert.match(code,/profile\.status!=='approved'\|\|profile\.classId!==classId/);
 assert.match(code,/student-me/);
 assert.match(code,/teacher-player/);
 assert.match(code,/mathas-connect-professor-auth-v1/);
 assert.match(code,/connect-results','student-load'/);
 assert.match(code,/connect-results','student-xp'/);
 assert.match(code,/hideFictionalXp\(doc\)/);
 assert.match(code,/const chooser=outer\?\.getElementById\('xp-preview-mode'\)/);
 assert.match(html,/id="xp-panel"/);

 assert.match(html,/id="app-xp"/);
 assert.match(html,/id="xp-heading-total"/);
 assert.match(html,/✨ XP acquis et à gagner/);
 assert.match(html,/Total : <strong id="app-xp">/);
 assert.doesNotMatch(html,/id="total-xp"/);
 assert.doesNotMatch(html,/id="trophies"/);
 assert.doesNotMatch(html,/id="xp-note"/);
 assert.doesNotMatch(code,/Parcours '\+data\.parcours/);
 assert.match(html,/id="connect-bar"/);
 assert.match(html,/id="bar-handle"/);
 assert.match(html,/option value="classic"/i);
 assert.match(html,/option value="three-lives"/i);
 assert.match(html,/option value="hard-sudden"/i);
 assert.match(html,/id="challenge-panel"/);
 assert.doesNotMatch(html,/<button id="challenge-toggle"/);
 assert.match(html,/id="certified-tools"/,'the native proof controller keeps its internal selectors');
 assert.match(code,/showConnectedBar\(approved\)/);
  assert.match(code,/SCHOOL_CLASSES\.has\(classId\)/);
  assert.match(code,/classId===CLASS_TEST\?'connect-objective-record-test':'connect-objective-record-school'/);
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

test('le laboratoire propose les cinq nouveaux jeux via le chemin officiel unique',()=>{
 const lab=read('laboratoire.js'),hub=read('hub.js');
 assert.match(lab,/SCHOOL_RECORD_LAUNCHER\+'\?app='\+encodeURIComponent\(testSlug\)/);
 assert.match(lab,/url\.searchParams\.set\('class',TEST_CLASS\)/);
 assert.match(lab,/student\.href=linkFor\(app\)/);
 assert.match(lab,/if\(!consent\(\)\)/);
 assert.doesNotMatch(lab,/candidateTeacher/);
 assert.doesNotMatch(hub,/XP enregistrés dans le pilote TEST/);
});
test('Monsieur T ouvre le même nouveau jeu depuis une session professeur distincte',()=>{
 const lab=read('laboratoire.js');
 const host=read('apps/objective-record/eleve.mjs');
 assert.match(lab,/const href=linkFor\(app,true\)/);
 assert.match(lab,/teacher\.disabled=!teacherReady/);
 assert.match(lab,/guard\(\);if\(!teacherReady\)throw Error/);
 assert.match(lab,/url\.searchParams\.set\('joueur','prof'\)/);
 assert.match(host,/teacher\?\{storageKey:'mathas-connect-professor-auth-v1'\}/);
 assert.match(host,/teacher\?'teacher-player':'student-me'/);
});


test('le nouvel hôte obtient un consentement explicite après ACK, pas à la fin locale du jeu',()=>{
 const host=read('apps/objective-record/eleve.mjs');
 const atomic=read('apps/objective-record/atomic-test-recorder.mjs');
 const certified=read('apps/objective-record/certified-addition-ui.mjs');
 const consent=read('projection-consent.mjs');
 assert.match(host,/import \{createProjectionConsent\} from '\.\.\/\.\.\/projection-consent\.mjs\?v=20261110-daily-share-v1'/);
 assert.match(host,/projectionConsent=createProjectionConsent\(/);
 assert.match(host,/getToken:verifiedToken/);
 assert.match(host,/studentKey:pupilId/);
 assert.match(host,/projectionConsent\?\.offer\(receipt\.eventId\)/);
 assert.match(host,/projectionConsent\?\.destroy\(\)/);
 assert.match(atomic,/onRecorded\(\{eventId:event\.eventId,appKey,duplicate:ack\.duplicate\}\)/);
 assert.ok(atomic.indexOf('const response=await send(request)')<
  atomic.indexOf('onRecorded({eventId:event.eventId,appKey,duplicate:ack.duplicate})'));
 assert.match(certified,/onRecorded\(\{eventId:current\.sessionId,appKey:PROOF_APP/);
 assert.ok(certified.indexOf('const ack=await call(\'finish-proof-v2\'')<
  certified.indexOf('onRecorded({eventId:current.sessionId,appKey:PROOF_APP'));
 assert.match(consent,/student-share-score/);
 assert.match(consent,/textContent='NON'/);
 assert.match(consent,/textContent='OUI !'/);
 assert.doesNotMatch(host,/student-share-score['"]\s*,\s*\{/);
});
