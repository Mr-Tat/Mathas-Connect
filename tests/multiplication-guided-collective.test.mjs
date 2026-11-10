import test from 'node:test';
import assert from 'node:assert/strict';
import {validPage,validSession,mayMoveForward,canAdvance,latestUnlockedPage}
 from '../apps/multiplication-simple/collective-contract.mjs';

const sample={ok:true,active:true,sessionId:'00000000-0000-4000-8000-000000000001',
 revision:1,level:1,carryMethod:'top',pages:[
  [{a:'106',m:5},{a:'558',m:2}],
  [{a:'247',m:6},{a:'139',m:8}],
  [{a:'218',m:4},{a:'325',m:2}]
 ],pageIndex:0,requiredPages:[false,false,false]};
const check=(session,from,to,finished=[])=>mayMoveForward({
 session,from,to,isFinished:i=>finished.includes(i)
});

test('le professeur peut relire ses pages sans les recréer : pageIndex != dernière page',()=>{
 assert.equal(validSession(sample),true);
 assert.equal(latestUnlockedPage(sample),2);
 assert.equal(validSession({...sample,pageIndex:2}),true);
 assert.equal(validSession({...sample,pageIndex:3}),false);
 assert.equal(validPage([{a:'2e3',m:3},{a:'139',m:8}]),false);
});
test('par défaut l’élève avance sans avoir terminé ses opérations',()=>{
 assert.equal(check(sample,0,1),true);
 assert.equal(check(sample,0,2),true);
 assert.equal(canAdvance(false,false,0,2),true);
 assert.equal(check(sample,2,3),false);
});
test('une page obligatoire doit être terminée avant de la quitter',()=>{
 const required={...sample,requiredPages:[false,true,false]};
 assert.equal(check(required,0,1),true);
 assert.equal(check(required,1,2),false);
 assert.equal(check(required,1,2,[1]),true);
 assert.equal(check(required,0,2),false,'impossible de sauter une page obligatoire non validée');
 assert.equal(check(required,0,2,[1]),true);
 assert.equal(canAdvance(false,true,1,2),false);
});
test('le retour en arrière reste libre et les pages obligatoires restent indexées',()=>{
 const required={...sample,requiredPages:[true,true,false]};
 assert.equal(check(required,0,1),false);
 assert.equal(check(required,0,1,[0]),true);
 assert.equal(check(required,0,2,[0]),false);
 assert.equal(check(required,0,2,[0,1]),true);
 assert.equal(check(required,1,2,[1]),false,'obligation antérieure : bloque même depuis une page ultérieure');
 assert.equal(check(required,1,2,[0,1]),true,'les deux obligations réussies libèrent la suite');
 assert.equal(validSession({...required,requiredPages:[true]}),false);
});
