import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('les deux additions en ligne exposent un bouton XP visible dans le jeu natif',()=>{
 const host=source('apps/objective-record/eleve.mjs');
 const page=source('apps/objective-record/eleve.html');
 const routing=source('apps/objective-record/release-routing.mjs');
 assert.match(routing,/SCHOOL_ADDITIONS_ROLLOUT=Object\.freeze\(\{\s*enabled:true/);
 assert.match(host,/SERVER_PROOF_ADDITIONS=new Set\(\['addition-ecrite-simple','addition-ecrite-multiple'\]\)/);
 assert.match(host,/mountNativeConnectXp\(doc\);/);
 assert.match(host,/mathasSchoolConnectXp/);
 assert.match(host,/showXpPanel\(\)/);
 assert.match(host,/lastOfficialXp\?\.appXp/);
 assert.match(host,/lastOfficialXp\?\.max/);
 assert.match(host,/Voir le détail/);
 assert.match(page,/xp-online-four-v3/);
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
