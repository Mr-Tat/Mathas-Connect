import test from 'node:test';
import assert from 'node:assert/strict';

const site='https://mr-tat.github.io/Mathas-Connect/';
const cacheBust='audit='+Date.now();
const get=async path=>{
 const url=site+path+(path.includes('?')?'&':'?')+cacheBust;
 const response=await fetch(url,{headers:{'cache-control':'no-cache'},signal:AbortSignal.timeout(18000)});
 assert.equal(response.status,200,path+' : HTTP '+response.status);
 return response;
};
test('LIVE réel : page Projection V2 servie avec classe/heure et commandes déplacées',async()=>{
 const html=await (await get('projection-v2.html')).text();
 assert.match(html,/id="header-class"/);
 assert.match(html,/id="projection-clock"/);
 assert.match(html,/class="projection-actions"/);
 assert.match(html,/src="\.\/projection-v2-live\.js\?v=20261104-scores-isoles-v2"/);
 const header=html.match(/<header>[\s\S]*?<\/header>/)?.[0]||'';
 assert.doesNotMatch(header,/PROJECTION CONNECTÉE|Math.as\s+<span|load-real|live-status/);
 console.log('LIVE OK: Projection V2 en-tête, heure et contrôles');
});
test('LIVE réel : mise à jour 15 s, pause hors onglet, scores distincts',async()=>{
 const [code,model]=await Promise.all([
  get('projection-v2-live.js').then(x=>x.text()),
  get('projection-v2-model.mjs').then(x=>x.text())
 ]);
 assert.match(code,/REFRESH_INTERVAL_MS=15000/);
 assert.match(code,/document\.visibilityState==='visible'/);
 assert.match(code,/people\.length\?splitProjectedRanking\(people,multiple\):\[\]/);
 assert.match(model,/if\(score===null\)continue/);
 console.log('LIVE OK: 15 s et séparation des résultats par jeu');
});
test('LIVE réel : cartes compactes, avatar encadré et podium lisible',async()=>{
 const css=await (await get('projection-v2-avatar.css')).text();
 assert.match(css,/grid-auto-rows:minmax\(56px,auto\)/);
 assert.match(css,/\.ranking-col \.entry\{height:auto;min-height:56px/);
 assert.match(css,/\.entry \.projection-avatar\.transparent\{\s*background:transparent!important;border-color:#b1cee5/);
 assert.match(css,/\.entry:is\(\.rank-1,\.rank-2,\.rank-3\) \.points\{\s*display:inline-block/);
 console.log('LIVE OK: gabarit, cadres, scores du podium');
});
test('LIVE réel : les deux additions retrouvent les cartes, coupes et partage volontaire',async()=>{
 const [html,module,simple,multi]=await Promise.all([
  get('apps/objective-record/eleve.html').then(x=>x.text()),
  get('apps/objective-record/school-score-view.mjs').then(x=>x.text()),
  get('apps/objective-record/engines/addition-simple/game-original.html').then(x=>x.text()),
  get('apps/objective-record/engines/addition-multiple/index.html').then(x=>x.text())
 ]);
 assert.match(html,/eleve\.mjs\?v=20261104-native-records-v1/);
 assert.match(module,/export function nativeDayPoints/);
 assert.match(module,/target\.addEventListener\('click',onClick\)/);
 assert.match(module,/consent\(\)\?\.offer\(snapshot\.today\.eventId\)/);
 assert.doesNotMatch(module,/setProperty\('display','none','important'\)/);
 assert.doesNotMatch(module,/mathasSchoolScoreHistory|mathasSchoolScoreTop/);
 for(const [name,game] of [['simple',simple],['multiple',multi]]){
  assert.match(game,/id=['"]mathasPointsQuick['"]/);
  assert.match(game,/id=['"]mathasPointsDetail['"]/);
  assert.match(game,/mathas-v541-podium/);
  console.log('LIVE OK: Addition '+name+' surfaces originales et badges');
 }
});
test('LIVE réel : favicon sur les pages critiques',async()=>{
 const paths=['index.html','connexion.html','prof.html','projection-v2.html','apps/objective-record/eleve.html'];
 for(const p of paths){
  const html=await (await get(p)).text();
  assert.match(html,/<link\b[^>]*rel="icon"/i,p+' : favicon absent');
 }
 const favicon=await (await get('assets/brand/favicon.png')).arrayBuffer();
 assert.ok(favicon.byteLength>200,'favicon trop petit');
 console.log('LIVE OK: icône Math’as présente sur toutes les pages critiques');
});
