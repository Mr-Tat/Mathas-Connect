import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const html=readFileSync(new URL('../projection-v2.html',import.meta.url),'utf8');
const js=readFileSync(new URL('../projection-v2-live.js',import.meta.url),'utf8');

test('Projection V2 : chargement explicite du professeur et données protégées',()=>{
 assert.match(html,/id="load-real"/);
 assert.match(js,/storageKey:'mathas-connect-professor-auth-v1'/);
 assert.match(js,/import \{classId,classLabel\} from '.\/connect-context\.js'/);
 assert.match(js,/teacher-dashboard/);
 assert.match(js,/connect-projection-v2','teacher-load'/);
 assert.doesNotMatch(js,/signInAnonymously|localStorage\.setItem/);
});
test('Projection V2 : un, deux ou trois panneaux visibles et séparés',()=>{
 assert.match(js,/const MAX_VISIBLE_APPS=3;/);
 assert.match(js,/const enabled=\(\)=>apps\.filter/);
 assert.match(js,/\.slice\(0,MAX_VISIBLE_APPS\)/);
 assert.match(js,/function createRankingCard\(app\)/);
 assert.match(js,/function paintRanking\(appKey,people\)/);
 assert.match(js,/function playApp\(appKey\)/);
 assert.match(js,/playingKeys=new Map\(\)/);
 assert.match(html,/id="ranking-board"/);
 assert.match(html,/data-app-count="1"/);
 assert.match(html,/\.ranking-board\[data-app-count="2"\]\{--app-columns:2\}/);
 assert.match(html,/\.ranking-board\[data-app-count="3"\]\{--app-columns:3\}/);
 assert.match(html,/border:3px solid #9ebfe0/);
 assert.match(html,/\.projection-main\[data-app-count="3"\] \.ranking-board \.ranking-list\{grid-template-columns:minmax\(0,1fr\)\}/);
 assert.match(js,/enabled\(\)\.length===3\?\[people\]:splitProjectedRanking/);
 assert.doesNotMatch(html,/id="prev-app"|id="next-app"|id="pause"|id="projection-refresh-dot"/);
});
test('Projection V2 : rafraîchissement toutes les 20 s, sans changement automatique de page',()=>{
 assert.match(js,/const REFRESH_INTERVAL_MS=20000;/);
 assert.match(js,/nextRefreshAt=Date\.now\(\)\+REFRESH_INTERVAL_MS/);
 assert.match(js,/setInterval\(tickProjection,1000\)/);
 assert.match(js,/if\(document\.visibilityState==='visible'&&!\$\('settings'\)\.open\)void refresh\(\)/);
 assert.match(html,/projection-v2-live\.js\?v=20261104-validated-percent-v1/);
 assert.match(html,/id="projection-refresh-countdown"/);
 assert.match(html,/id="projection-refresh-label"/);
 assert.doesNotMatch(js,/startCycle\(|function next\(|secondsRemaining|playCurrentApp/);
});
test('Projection V2 : jusqu’à 16 élèves et animations indépendantes',()=>{
 assert.match(js,/limit:16/);
 assert.match(js,/rankMultiClass/);
 assert.match(js,/splitProjectedRanking/);
 assert.match(js,/cardFor\(appKey\)/);
 assert.match(js,/findRow:key=>rowFor\(appKey,key\)/);
 assert.match(js,/onArrival:movement=>addSpectacularRise\(appKey,movement\)/);
 assert.match(js,/localRises\.set\(appKey,history\.slice\(0,5\)\)/);
 assert.match(js,/playerLabel\.append\(projectedAvatar\(p\),name\)/);
 assert.match(js,/primary\.append\(playerLabel,points\)/);
 assert.match(js,/row\.style\.setProperty\('--rank-progress'/);
 assert.match(js,/column\.style\.setProperty\('--row-count'/);
 assert.match(html,/Aucun score enregistré pour cette application/);
});
test('Projection V2 : au moins une application et trois au maximum, sans limiter les %',()=>{
 assert.match(js,/cb\.disabled=\(cb\.checked&&options\.scoreApps\.length<=1\)/);
 assert.match(js,/!cb\.checked&&options\.scoreApps\.length>=MAX_VISIBLE_APPS/);
 assert.match(js,/for\(const field of \['scoreApps','percentageApps'\]\)/);
 assert.match(js,/remote\.scoreApps\.includes\(app\.key\)/);
 assert.match(js,/options\.comparisonDisplay/);
 assert.match(js,/return n===null\?'— %'/);
 assert.match(html,/id="percentage-scope"/);
 assert.match(js,/percentageStatus==='completed_games_only'/);
 assert.match(js,/Les parties abandonnées ne sont pas encore comptées/);
 assert.match(js,/for\(const app of apps\.filter\(a=>options\.percentageApps\.includes\(a\.key\)\)\)/);
});
test('Projection V2 : reset isolé, confidentialité, déconnexion et syntaxe',()=>{
 assert.match(html,/id="reset-password" type="password"/);
 assert.match(js,/teacher-reset-score'/);
 assert.match(js,/appKey:pendingReset,password/);
 assert.match(js,/SIGNED_OUT/);
 assert.match(js,/clearBoard\('Session professeur terminée/);
 assert.match(js,/window\.addEventListener\('pagehide'/);
 assert.doesNotMatch(js,/connect_parcours_restart|teacher-parcours-restart|reset_epoch/);
 const c=spawnSync(process.execPath,['--check','--input-type=module'],{input:js,encoding:'utf8'});
 assert.equal(c.status,0,c.stderr);
});
test('Projection V2 : les quatre thèmes et l’accès aux réglages sont conservés',()=>{
 assert.match(html,/id="projection-theme"/);
 assert.match(html,/id="settings-left"/);
 assert.match(html,/id="settings-top"/);
 assert.match(html,/Réussite de la classe/);
 assert.match(html,/Nouveaux exploits/);
 assert.match(html,/id="comparison-results"/);
 assert.match(js,/Mesure des exercices réellement entamés|exercices réellement entamés/);
 assert.match(html,/\.ranking-board \.ranking-head\{position:sticky;top:0/);
});
