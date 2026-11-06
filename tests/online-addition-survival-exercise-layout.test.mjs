import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('les deux additions conservent le calcul certifié pour Mort subite et 3 vies',()=>{
 const host=source('apps/objective-record/eleve.mjs');
 const proof=source('apps/objective-record/certified-extended-ui.mjs');
 assert.ok(host.includes('extendedUI.startNative(choice.mode,choice.level)'));
 assert.ok(host.includes('extendedUI.onGameEvent(event)'));
 assert.ok(proof.includes("start-extended-proof-v1"));
 assert.ok(proof.includes("finish-extended-proof-v1"));
 assert.ok(proof.includes("extendedFirstTryCorrect(q,attempt)"));
 assert.ok(host.includes("certified-extended-ui.mjs?v=20261106-native-survival-v1"));
});
test('le calcul posé reprend le trait continu et le clavier tactile du moteur natif',()=>{
 const page=source('apps/objective-record/eleve.html');
 const proof=source('apps/objective-record/certified-extended-ui.mjs');
 assert.ok(proof.includes("workspace.append(exercise,pad)"));
 assert.ok(proof.includes("extended-calc-box"));
 assert.ok(proof.includes("extended-result-bar"));
 assert.ok(proof.includes("extended-key-confirm"));
 assert.ok(proof.includes("verifyButton.click();return;"));
 assert.ok(proof.includes("var(--extended-column-width)"));
 assert.ok(page.includes(".extended-grid-scroll{"));
 assert.ok(page.includes("overflow-x:auto"));
 assert.ok(page.includes(".extended-keypad-title{"));
 assert.ok(page.includes("@media(max-width:860px)"));
 const adapter=source('apps/objective-record/native-certified-survival-patch.js');
 assert.match(adapter,/MathasCertifiedSurvivalPatch/);
 assert.match(adapter,/MathasCertifiedExtendedAttempt/);
 for(const wrapper of ['addition-simple/essai-mode-score-3-vies.html','addition-multiple/essai-objectif-record-3-vies.html']){
  const original=source('apps/objective-record/engines/'+wrapper);
  assert.match(original,/MathasCertifiedSurvivalPatch/);
 }

});
