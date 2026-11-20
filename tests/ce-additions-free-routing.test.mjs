import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SCHOOL_CLASS_IDS,schoolAdditionsLaunch,SCHOOL_RECORD_LAUNCHER} from '../apps/objective-record/release-routing.mjs';

const hub=readFileSync(new URL('../hub.js',import.meta.url),'utf8');
const games=[
 ['addition-ecrite-simple','https://mr-tat.github.io/CE-Addition-simple/','addition-simple'],
 ['addition-ecrite-multiple','https://mr-tat.github.io/Mathas-Connect/apps/addition-plusieurs/','addition-multiple']
];

test('HUB libre : les deux additions ouvrent leur moteur natif, pas Objectif record',()=>{
 for(const classId of SCHOOL_CLASS_IDS){
  for(const [appKey,legacyUrl,slug] of games){
   assert.equal(schoolAdditionsLaunch({classId,appKey,legacyUrl,freeMode:true}),legacyUrl);
   assert.equal(schoolAdditionsLaunch({classId,appKey,legacyUrl}),
    SCHOOL_RECORD_LAUNCHER+'?app='+slug,
    'un élève Connect conserve le lanceur scolaire certifié');
  }
 }
 assert.match(hub,/const freeAddition=inFreeMode\(\)\&\&\['addition-ecrite-simple','addition-ecrite-multiple'\]/);
 assert.match(hub,/testSlug=.*!freeAddition\?/,
  'le même repli libre doit s’appliquer à la classe TEST');
 assert.match(hub,/new URL\(freeAddition\?app\.launch_url:/,
  'la priorité du mode libre doit précéder le routage TEST');
 assert.match(hub,/freeMode:freeAddition/);
});
