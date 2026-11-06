import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('les deux additions en ligne : un seul bouton XP, juste après le profil',()=>{
 const host=source('apps/objective-record/eleve.mjs');
 const page=source('apps/objective-record/eleve.html');
 const native=source('apps/objective-record/native-hub-link.js');
 const routing=source('apps/objective-record/release-routing.mjs');
 assert.match(routing,/SCHOOL_ADDITIONS_ROLLOUT=Object\.freeze\(\{\s*enabled:true/);
 assert.match(host,/SERVER_PROOF_ADDITIONS=new Set\(\['addition-ecrite-simple','addition-ecrite-multiple'\]\)/);
 assert.doesNotMatch(host,/mountNativeConnectXp|mathasSchoolConnectXp/);
 assert.match(native,/profileAnchor\.insertAdjacentElement\('afterend',button\)/);
 assert.match(native,/mathas-native-connect-xp/);
 assert.match(native,/Voir le détail/);
 assert.match(native,/host\.getElementById\('xp-toggle-main'\)/);
 assert.match(host,/showXpPanel\(\)/);
 assert.match(host,/xp\?\.appXp/);
 assert.match(host,/xp\?\.max/);
 assert.match(page,/certified-results-v8/);
});
test('soustraction et multiplication : mêmes deux lignes, largeur fixe et chiffre officiel',()=>{
 for(const [path,name] of [
  ['apps/soustraction-simple/index.html','mathas-sous-connect-xp'],
  ['apps/multiplication-simple/index.html','mathas-multi-connect-xp']
 ]){
  const host=source(path);
  assert.match(host,new RegExp(name));
  assert.match(host,/mathas-xp-action-detail/);
  assert.match(host,/Voir le détail/);
  assert.match(host,/177px/);
  assert.match(host,/lastXp\?\.max/);
  assert.match(host,/lastXp\?\.appXp/);
 }
});
test('les quatre applications utilisent le podium historique certifié',()=>{
 const shared=source('apps/objective-record/school-score-view.mjs');
 const add=source('apps/objective-record/eleve.mjs');
 const mul=source('apps/multiplication-simple/index.html');
 const sub=source('apps/soustraction-simple/certified-connect.mjs');
 assert.match(shared,/renderCertifiedHistoricalPodium/);
 assert.match(shared,/MutationObserver\(renderPodium\)/);
 assert.match(shared,/history\.bestThree\.map\(cleanScoreEntry\)/);
 assert.match(add,/schoolScoreView\?\.mount\(doc\)/);
 assert.match(mul,/certifiedScoreView\?\.mount/);
 assert.match(sub,/createSchoolScoreView/);
});
