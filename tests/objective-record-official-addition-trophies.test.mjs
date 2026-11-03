import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {officialAdditionRewards} from '../apps/objective-record/official-addition-trophies.mjs';
import {permanentTrophyCount} from '../apps/objective-record/student-host-contract.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const blank=()=>({
 version:3,mastery:{4:[false,false,false],10:[false,false,false],20:[false,false,false]},
 sudden:[false,false,false],hardAwards:{
  bronze:[false,false,false],silver:[false,false,false],gold:[false,false,false]
 },scoreOne:{bronze:false,silver:false,gold:false},unlockedGold:false
});
test('Only authenticated Connect native addition trophies use the 25 permanent awards',()=>{
 for(const app of ['addition-ecrite-simple','addition-ecrite-multiple']){
  const source=blank();source.mastery[4][0]=true;source.sudden[1]=true;
  source.hardAwards.gold[2]=true;source.scoreOne.bronze=true;source.unlockedGold=true;
  const snapshot=officialAdditionRewards(app,source);
  assert.equal(permanentTrophyCount(snapshot),5);
  assert.deepEqual(snapshot.mastery[4],[true,false,false]);
  source.mastery[4][0]=false;
  assert.equal(snapshot.mastery[4][0],true,'no mutation from caller');
  assert.ok(Object.isFrozen(snapshot.mastery[4]));
  assert.equal(snapshot.unlockedGold,true);
 }
 assert.equal(officialAdditionRewards('melange-calculs-ecrits',blank()),null);
 assert.equal(officialAdditionRewards('addition-ecrite-simple',null),null);
 assert.equal(officialAdditionRewards('addition-ecrite-simple',{...blank(),sudden:['yes']}),null);
});
test('official host does not show fictional local trophies if Connect returns no rewards',()=>{
 const host=read('apps/objective-record/eleve.mjs');
 assert.match(host,/MathasConnectOfficialTrophies=null/);
 assert.match(host,/rewards:officialAdditionRewards\(appKey,loaded\.state\?\.rewards\)/);
 assert.match(host,/SERVER_PROOF_ADDITIONS.has\(appKey\)/);
 for(const path of [
  'apps/objective-record/engines/addition-simple/lab-objectif-record-v2.js',
  'apps/objective-record/engines/addition-multiple/lab-objectif-record-v2.js'
 ]){
  const s=read(path);
  assert.match(s,/MathasConnectOfficialTrophies/);
  assert.match(s,/if\(!official\.rewards\)/);
  assert.match(s,/t=\{\.\.\.t,\.\.\.official\.rewards\}/);
  assert.match(s,/mathas-connect-official-trophies-unavailable/);
  assert.ok(s.indexOf('official?.active===true')<s.indexOf('pilot?.active'),
   'official record must win over pilot/local fake');
 }
});

test('new school additions with zero trophy achievements receive an official empty registry',()=>{
 const edge=read('supabase/functions/connect-results/index.ts');
 assert.match(edge,/EMPTY_SCHOOL_ADDITION_TROPHIES/);
 assert.match(edge,/selected===app\|\|selected===addMulti/);
 assert.match(edge,/const awards=permanent\?\?/);
 assert.match(edge,/if\(trophyError\)return deny\('trophies_unavailable',503\)/);
 // The full empty snapshot is not a partial trophy count or an XP award.
 assert.match(edge,/mastery:\{'4':\[false,false,false\]/);
 assert.match(edge,/unlockedGold:false/);
 assert.ok(edge.indexOf("if(trophyError)return deny('trophies_unavailable',503)",edge.indexOf("const awards=permanent")-500)>-1);
});
