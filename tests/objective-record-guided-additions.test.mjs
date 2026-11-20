import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const src=read('apps/objective-record/guided-written-native-patch.js');
const host=read('apps/objective-record/eleve.mjs');
const bridge=read('apps/objective-record/guided-written-school.mjs');
const simple=read('apps/objective-record/engines/addition-simple/essai-mode-score-3-vies.html');
const multiple=read('apps/objective-record/engines/addition-multiple/essai-objectif-record-3-vies.html');

test('les deux moteurs Objectif record scolaires injectent le guidé, après leurs patchs certifiés',()=>{
 for(const [html,key] of [[simple,'addition-ecrite-simple'],[multiple,'addition-ecrite-multiple']]){
  assert.match(html,/guided-written-native-patch\.js/);
  assert.match(html,new RegExp("if\\(hostedByConnect&&typeof window\\.MathasWrittenGuidedNativePatch==='function'\\)"));
  assert.ok(html.indexOf('MathasCertifiedSurvivalPatch(game,')<html.indexOf("MathasWrittenGuidedNativePatch(game,'"+key+"')"));
  assert.ok(html.indexOf("MathasWrittenGuidedNativePatch(game,'"+key+"')")<html.indexOf('frame.srcdoc=game'));
 }
});

test('le nouvel adaptateur conserve les chemins natifs, les preuves officielles et le backend partagé',()=>{
 assert.match(host,/mountWrittenGuidedClass/);
 assert.match(host,/connect-guided-written/);
 assert.match(host,/SERVER_PROOF_ADDITIONS\.has\(activeApp\)&&pupilId/);
 assert.match(host,/!doc\.__mathasWrittenGuidedAttached/);
 assert.match(host,/keepalive:true/);
 assert.match(host,/installNativeCertifiedLaunch\(doc,activeApp,launchOfficial\)/);
 assert.match(host,/createAdditionProofUI/);
 assert.match(host,/createMultipleProofUI/);
 assert.match(bridge,/createAdditionSimpleCollective/);
 assert.match(bridge,/createAdditionMultipleCollective/);
 assert.match(bridge,/!isCurrent\(\)/);
});

test('le patch du pont natif est limité aux deux additions et échoue sans casser le moteur',async()=>{
 const calls=[];
 const sandbox={
  window:{},
  console:{warn:()=>{}},
  fetch:async path=>{
   calls.push(path);
   return {ok:true,text:async()=>"window.MathasGuidedBridge={isCollectiveActive(){return true}};"};
  }
 };
 vm.runInNewContext(src,sandbox);
 const patch=sandbox.window.MathasWrittenGuidedNativePatch;
 const marker="primaryBtn.addEventListener('click',handlePrimary);";
 const game="<script>const phase='review';"+marker+"</script>";
 const unsupported=await patch(game,'soustraction-ecrite-simple');
 assert.equal(unsupported,game);
 assert.equal(calls.length,0);
 for(const [app,path] of [
  ['addition-ecrite-simple','../../guided-addition-simple/collective-native-bridge.js'],
  ['addition-ecrite-multiple','../../../addition-plusieurs/collective-native-bridge.js']
 ]){
  const patched=await patch(game,app);
  assert.ok(calls.at(-1).startsWith(path));
  assert.equal((patched.match(/MathasGuidedBridge/g)||[]).length>=2,true);
  assert.ok(patched.includes('mathasGuidedOriginalPrimary'));
  assert.ok(!patched.includes(marker));
 }
 assert.equal(await patch('un autre moteur','addition-ecrite-simple'),'un autre moteur');
});

test('une panne réseau du pont n’empêche pas le guidé individuel ni les autres modes',async()=>{
 const sandbox={window:{},console:{warn:()=>{}},fetch:async()=>{throw Error('offline')}};
 vm.runInNewContext(src,sandbox);
 const marker="primaryBtn.addEventListener('click',handlePrimary);";
 assert.equal(await sandbox.window.MathasWrittenGuidedNativePatch(marker,'addition-ecrite-simple'),marker);
});
