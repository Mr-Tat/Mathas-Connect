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
 assert.match(js,/enabled\(\)\.length===3\?\[ranked\]:splitProjectedRanking/);
 assert.doesNotMatch(html,/id="prev-app"|id="next-app"|id="pause"|id="projection-refresh-dot"/);
});
test('Projection V2 : rafraîchissement toutes les 20 s, sans changement automatique de page',()=>{
 assert.match(js,/const REFRESH_INTERVAL_MS=20000;/);
 assert.match(js,/refreshCycleStartedAt=now;nextRefreshAt=now\+REFRESH_INTERVAL_MS/);
 assert.match(js,/setInterval\(tickProjection,250\)/);
 assert.match(js,/Date\.now\(\)>=nextRefreshAt/);
 assert.match(js,/if\(ticket===refreshTicket&&connected&&hasLoaded\)startRefreshCycle\(\)/);
 assert.match(js,/function pauseRefreshCycle\(\)/);
 assert.match(js,/function resumeRefreshCycle\(\)/);
 assert.match(html,/projection-v2-live\.js\?v=20261108-daily-v1/);
 assert.match(html,/id="projection-refresh-progress"/);
 assert.match(html,/id="projection-refresh-fill"/);
 assert.match(html,/role="progressbar"/);
 assert.doesNotMatch(html,/id="projection-refresh-countdown"|id="projection-refresh-label"/);
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
 assert.match(js,/const avatar=projectedAvatar\(p\)/);
 assert.match(js,/playerLabel\.append\(name\)/);
 assert.match(js,/detail\.append\(avatar,copy,points\)/);
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
 assert.doesNotMatch(html,/id="settings-top"/);
 assert.match(html,/id="load-real"/);
 assert.match(html,/Réussite de la classe/);
 assert.match(html,/Nouveaux exploits/);
 assert.match(html,/id="comparison-results"/);
 assert.match(js,/Parties Classique terminées uniquement/);
 assert.match(html,/\.ranking-board \.ranking-head\{position:sticky;top:0/);
});

test('Projection V2 : thème à gauche, classe centrée plus visible, MAJ et barre côte à côte',()=>{
 assert.match(html,/<header class="projection-header">/);
 const header=html.match(/<header class="projection-header">[\s\S]*?<\/header>/)?.[0];
 assert.ok(header,'En-tête absent');
 assert.ok(header.indexOf('id="projection-theme"')<header.indexOf('id="header-class"'));
 assert.ok(header.indexOf('id="header-class"')<header.indexOf('id="load-real"'));
 assert.ok(header.indexOf('id="load-real"')<header.indexOf('id="projection-refresh-progress"'));
 assert.doesNotMatch(header,/settings-top|⚙ Applications/);
 assert.match(html,/grid-template-areas:"theme class refresh";align-items:center/);
 assert.match(header,/<div class="projection-class-and-mode">[\s\S]*?id="header-class"[\s\S]*?id="score-mode-switch"[\s\S]*?<\/div>/);
 assert.match(html,/\.projection-class-and-mode\{\s*grid-area:class;display:flex;align-items:center/);
 assert.match(html,/\.score-mode-switch\{\s*display:flex;flex:0 0 auto;flex-direction:column/);
 assert.match(html,/grid-template-areas:"theme refresh" "class class"/);
 assert.match(html,/grid-template-areas:"theme" "class" "refresh"/);
 assert.match(html,/font-size:clamp\(22px,2\.1vw,31px\);font-weight:950/);
 assert.match(html,/MAJ auto/);
 assert.match(html,/\.projection-auto-refresh\{\s*display:flex;flex:0 0 104px/);
 assert.match(html,/\.projection-auto-label\{[\s\S]*?font-size:9px;font-weight:600/);
 assert.match(html,/\.projection-refresh-progress\{\s*display:block;height:4px/);
 assert.match(html,/background:color-mix\(in srgb,var\(--v-soft,#c8deed\) 49%,transparent\)/);
 assert.doesNotMatch(html,/background:var\(--v-accent,#ffdc81\);\s*border-radius:inherit;transform:scaleX\(0\)/);
 assert.match(js,/fill\.style\.transform='scaleX\('\+fraction\+'\)'/);
 assert.match(js,/aria-valuetext/);
 assert.match(js,/refreshPausedAt/);
});

test('Projection V2 : aucun timer actif si tableau non visible, reprise sans rattrapage',()=>{
 assert.match(js,/let refreshTickerId=null/);
 assert.match(js,/function stopRefreshTicker\(\)/);
 assert.match(js,/clearInterval\(refreshTickerId\)/);
 assert.match(js,/function startRefreshTicker\(\)/);
 assert.match(js,/document\.visibilityState!=='visible'\|\|\$\('settings'\)\.open\)return/);
 assert.match(js,/if\(document\.visibilityState!=='visible'\)\{\s*stopRefreshTicker\(\)/);
 assert.match(js,/resumeRefreshCycle\(\);\s*startRefreshTicker\(\)/);
 assert.match(js,/dialog\.showModal\(\);pauseRefreshCycle\(\);stopRefreshTicker\(\)/);
 assert.match(js,/dialog\.close\(\);resumeRefreshCycle\(\);startRefreshTicker\(\)/);
});

test('Projection V2 : noms mis en gras dans les événements, sans HTML injecté',()=>{
 assert.match(js,/function exploit\(type,message,appTitle=null\)/);
 assert.match(js,/name\.className='event-student'/);
 assert.match(js,/name\.textContent=message\.slice\(0,split\)/);
 assert.match(js,/action\.className='event-action'/);
 assert.match(js,/action\.textContent=labels\[type\]/);
 assert.match(js,/text\.append\(name,action\)/);
 assert.match(js,/trophy:' gagne un nouveau trophée'/);
 assert.match(js,/perfect:' réussit une série parfaite'/);
 assert.match(js,/sudden:' dépasse 10 bonnes réponses en Mort subite'/);
 assert.match(js,/top:' réalise un score du Top 5'/);
 assert.match(js,/rise:' remonte de '/);
 assert.doesNotMatch(js,/text\.innerHTML\s*=/);
 assert.match(html,/\.event-text \.event-student\{font-weight:900;color:inherit\}/);
 assert.doesNotMatch(js,/MEILLEURS SCORES · PÉRIODE DE PROJECTION/);
 assert.match(html,/projection-v2-live\.js\?v=20261108-daily-v1/);
});

test('Projection V2 : cadre 24px carré, score centré, chiffres en gras',()=>{
 assert.match(js,/detail\.className='entry-details'/);
 assert.match(js,/copy\.className='entry-copy'/);
 assert.match(js,/detail\.append\(avatar,copy,points\)/);
 assert.match(js,/levelLabel\.textContent='Niv\.'/);
 assert.match(js,/levelValue\.className='meta-value'/);
 assert.match(js,/trophiesValue\.className='meta-value'/);
 assert.match(js,/minor\.setAttribute\('aria-label','Niveau '/);
 assert.match(html,/\.entry-details\{\s*display:flex;align-items:center/);
 assert.match(html,/\.entry-details \.projection-avatar\{\s*flex:0 0 24px;width:24px;height:24px/);
 assert.match(html,/\.entry-details \.points\{\s*flex:0 0 auto;align-self:center/);
 assert.match(html,/\.entry-copy \.minor \.meta-value\{[\s\S]*?font-size:11px;font-weight:850/);
 assert.match(html,/\.entry-copy \.player-label strong\{[\s\S]*?text-overflow:ellipsis/);
 assert.match(html,/projection-v2-avatar\.css\?v=20261104-podium-soft-contrast-v9/);
});

test('Projection V2 : les rangs et couleurs suivent les scores, même pendant une remontée',()=>{
 assert.match(js,/import \{rankMultiClass,splitProjectedRanking,withScoreTies\}/);
 assert.match(js,/const ranked=withScoreTies\(people\)/);
 assert.match(js,/const place=p\.position,key=playerKey\(p\)/);
 assert.match(js,/row\.className='entry rank-'\+place/);
 assert.match(js,/rank\.textContent=String\(place\)/);
});

test('Projection V2 : % pondérés, source limitée aux parties Classique et rafraîchissement des options',()=>{
 assert.match(html,/id="percentage-scope"/);
 assert.match(js,/percentageStatus==='completed_games_only'/);
 assert.match(js,/Parties Classique terminées uniquement/);
 assert.match(js,/abandons exclus/);
 assert.match(js,/if\(field==='percentageApps'\)await refresh\(\)/);
 assert.match(js,/options\[field\]=before;cb\.checked=!cb\.checked;buildSettings\(\);return/);
});
