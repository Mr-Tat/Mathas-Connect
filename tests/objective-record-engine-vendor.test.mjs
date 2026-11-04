import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const jobs=[
 ['addition-simple','essai-mode-score-3-vies.html','game-original.html'],
 ['addition-multiple','essai-objectif-record-3-vies.html','index.html'],
 ['soustraction','essai-objectif-record-3-vies.html','index.html'],
 ['multiplication','essai-objectif-record-3-vies.html','index.html'],
 ['melange','essai-objectif-record-3-vies.html','index.html']
];
test('les cinq moteurs d origine sont présents et lisibles sur le même domaine',()=>{
 const host=read('apps/objective-record/eleve.mjs');
 for(const [slug,wrapper,core] of jobs){
  const dir='apps/objective-record/engines/'+slug+'/';
  assert.ok(statSync(new URL('../'+dir+core,import.meta.url)).size>100000,slug);
  const s=read(dir+wrapper);
  assert.match(s,/MathasLabV2\.patch\(/);
  assert.match(s,/frame\.srcdoc=game/);
  assert.match(s,/lab-objectif-record-v2\.js/);
  assert.ok(s.includes("fetch('./"+core+"'"),slug);
  assert.ok(host.includes('./engines/'+slug+'/'+wrapper),slug);
 }
});
test('aucun moteur de la V finale ne dépend d un iframe externe',()=>{
 const host=read('apps/objective-record/eleve.mjs');
 assert.doesNotMatch(host,/https:\/\/mr-tat\.github\.io\/(?:CE-Addition-simple|addition-ecrite-multiple|soustraction-ecrite|Multiplication-simple|Melange-calculs-ecrits-1)\//);
 assert.match(host,/classId!==CLASS_TEST/);
 assert.doesNotMatch(host,/connect-record-pilot/);
});


test('deux additions : Objectif record garde son sous-titre et sa couronne ; commandes accessibles sous Connect',()=>{
 const nav=read('apps/objective-record/native-hub-link.js');
 for(const file of ['apps/objective-record/engines/addition-simple/essai-mode-score-3-vies.html',
   'apps/objective-record/engines/addition-multiple/essai-objectif-record-3-vies.html']){
  const source=read(file);
  assert.match(source,/Pour marquer un plus gros score !/);
  assert.match(source,/html body #menuScreen\.menu-panel > \.mathas-menu-zone-launch\{margin-bottom:10px!important\}/,
    'la marge vide de 72px entre les cartes et Écrire les dizaines d abord disparaît sur PC');
  assert.match(source,/@media\(max-width:980px\)\{html body #menuScreen\.menu-panel > \.mathas-menu-zone-launch\{margin-bottom:8px!important\}\}/,
    'aucun grand vide entre les cartes et le réglage sur mobile');
  assert.match(source,/mode-icon" aria-hidden="true">👑/);
   assert.doesNotMatch(source,/3 erreurs possibles/,'pas de détail d’erreurs dans le bouton');
   assert.match(source,/Moitié des XP/,'étiquette 3-vies présente');
   assert.match(source,/score-mode-half-xp\{/,'pastille sombre 3-vies');
  assert.match(source,/<h3 class="mode-title">Objectif record<\/h3>/);
  assert.doesNotMatch(source,/score-mode-cup" aria-hidden="true">🏆/);
  assert.match(source,/if\(suddenDesc&&!suddenDesc\.textContent\.trim\(\)\)/,
    'le script moteur ne doit plus écraser le sous-titre après le chargement');
  assert.match(source,/native-hub-link\.js\?v=20261104-xp-right-of-profile/,
    'le nouvel emplacement natif charge le fichier actualisé');
 }
 assert.match(nav,/function installEmbeddedConnectHud\(frame\)/);
 assert.match(nav,/nativeTitle\.append\(titleVersion\)/,'la version suit le titre');
 assert.match(nav,/nativeVersion\.cloneNode\(true\)/,'aucune version figée en dur');
 assert.match(nav,/mathas-brand-row > \.app-version-pill/,'ancienne version masquée à côté du logo');
 assert.match(nav,/\.mathas-connect-title-version/,'nouvelle pastille près du titre');
 assert.match(nav,/getElementById\('mathas-native-connect-profile'\)/,'le bouton XP suit le profil Connect');
 assert.match(nav,/profileAnchor\.insertAdjacentElement\('afterend',button\)/);
 assert.match(nav,/querySelector\('main\.app > header \.mathas-brand-row'\)/);
 assert.match(nav,/id='mathas-native-connect-profile'/);
 assert.match(nav,/id='mathas-native-connect-xp'/);
 assert.match(nav,/grid-column:1!important;grid-row:1!important/);
 assert.match(nav,/grid-column:2!important;grid-row:1!important/);
 assert.match(nav,/grid-column:2!important;grid-row:2!important/);
 assert.doesNotMatch(nav,/--mathas-connect-actions-top/,'les boutons reviennent à leur placement natif');
 const html=read('apps/objective-record/eleve.html');
 const host=read('apps/objective-record/eleve.mjs');
 assert.match(html,/html\.mathas-native-connect-hud #connect-bar/);
 assert.match(html,/html\.mathas-native-connect-hud #bar-handle/);
 assert.match(host,/document\.documentElement\.classList\.toggle\('mathas-native-connect-hud'/);
});
