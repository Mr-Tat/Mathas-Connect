import test from 'node:test';import assert from 'node:assert/strict';import {APP_KEY,normalizeCompletion} from '../apps/addition-plusieurs/completion-contract.mjs';
test('classique 4, 10, 20 x 3 niveaux',()=>{for(const level of [1,2,3])for(const total of [4,10,20]){const r=normalizeCompletion({label:`Calculs · Niveau ${level}`,score:`${total}/${total}`});assert.deepEqual([r.appKey,r.mode,r.level,r.score,r.total],[APP_KEY,'classic',level,total,total]);}});
test('mort subite, hard défi et hard mort subite',()=>{for(const level of [1,2,3]){assert.equal(normalizeCompletion({label:`Mort subite · Niveau ${level}`,score:'7'}).mode,'sudden');assert.equal(normalizeCompletion({label:`HARD NIV ${level} · 5 calculs`,score:'4/5'}).mode,'hard-challenge');assert.equal(normalizeCompletion({label:`HARD NIV ${level} · Mort subite · 6 chiffres`,score:'3'}).mode,'hard');}});
test('reject incomplete, spoofed, negative and impossible results',()=>{for(const x of [{label:'Calculs · Niveau 1',score:'5/4'},{label:'Calculs · Niveau 4',score:'4/4'},{label:'HARD NIV 2 · 5 calculs',score:'6/5'},{label:'Mort subite · Niveau 1',score:'-1'},{label:'Calculs · Niveau 1',score:'4/5'},{label:'HARD NIV 2 · Mort subite',score:'2'},null])assert.equal(normalizeCompletion(x),null);});

test('native V3 trophy snapshot accompanies a completion without affecting XP points',()=>{
 const raw={version:3,mastery:{4:[true,false,false],10:[false,false,false],20:[false,false,false]},
 sudden:[false,false,false],hardAwards:{bronze:[false,false,false],silver:[false,false,false],gold:[false,false,false]},
 scoreOne:{bronze:false,silver:false,gold:false},unlockedGold:false};
 const event=normalizeCompletion({label:'Calculs · Niveau 1',score:'4/4',rewards:raw});
 assert.deepEqual(event.rewards,raw);
 assert.equal(event.points,undefined);
 const invalid={...raw,hardAwards:{...raw.hardAwards,gold:['yes']}};
 const noAwards=normalizeCompletion({label:'Calculs · Niveau 1',score:'4/4',rewards:invalid});
 assert.equal(noAwards.rewards,undefined);
});
