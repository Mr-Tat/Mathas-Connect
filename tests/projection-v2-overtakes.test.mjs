import test from 'node:test';
import assert from 'node:assert/strict';
import {createOvertakeTracker,detectOvertakes} from '../projection-v2-overtakes.mjs';

const keys=['A','B','C','D','E','F'];
const snapshot=(appKey='soustraction-ecrite-simple',scores=[100,90,80,70,60,50],context='A:period-1')=>({
 appKey,context,
 rows:keys.map((id,i)=>({id,classId:'class-a',name:'Élève '+id,level:4,
  trophies:2,avatar:null,score:scores[i]}))
  .sort((a,b)=>b.score-a.score||a.name.localeCompare(b.name,'fr'))
});
const changed=()=>snapshot('soustraction-ecrite-simple',[100,90,80,70,130,50]);
test('Une montée de 5e à 1re produit quatre passages certifiés du même jeu',()=>{
 const moves=detectOvertakes(snapshot(),changed());
 assert.equal(moves.length,1);
 assert.equal(moves[0].name,'Élève E');
 assert.equal(moves[0].fromRank,5);
 assert.equal(moves[0].toRank,1);
 assert.equal(moves[0].gained,4);
 assert.equal(moves[0].oldScore,60);
 assert.equal(moves[0].newScore,130);
});
test('Une file reste séparée par application, même lors de plusieurs actualisations',()=>{
 const tracker=createOvertakeTracker();
 const initialAddition=snapshot('addition-ecrite-simple');
 const initialSubtraction=snapshot();
 assert.equal(tracker.observe(initialAddition).reset,true);
 assert.equal(tracker.observe(initialSubtraction).reset,true);
 assert.equal(tracker.pending('soustraction-ecrite-simple'),0);
 assert.equal(tracker.observe(changed()).count,1);
 assert.equal(tracker.pending('addition-ecrite-simple'),0);
 assert.equal(tracker.pending('soustraction-ecrite-simple'),1);
 assert.equal(tracker.shown('soustraction-ecrite-simple').rows[4].id,'E',
  'Le tableau conserve les anciennes positions tant que le jeu est caché');
 assert.equal(tracker.shown('addition-ecrite-simple').rows[0].id,'A');
 const second=snapshot('soustraction-ecrite-simple',[100,90,80,70,135,50]);
 assert.equal(tracker.observe(second).count,0);
 assert.equal(tracker.pending('soustraction-ecrite-simple'),2,
  'Une nouvelle valeur est conservée après la remontée déjà en attente');
 const first=tracker.take('soustraction-ecrite-simple');
 assert.equal(first.moves[0].gained,4);
 assert.equal(tracker.finish('soustraction-ecrite-simple',first),true);
 assert.equal(tracker.pending('soustraction-ecrite-simple'),1);
 assert.equal(tracker.shown('soustraction-ecrite-simple').rows[0].id,'E');
 assert.equal(tracker.finish('soustraction-ecrite-simple',tracker.take('soustraction-ecrite-simple')),true);
 assert.equal(tracker.pending('soustraction-ecrite-simple'),0);
 assert.equal(tracker.observe(second).count,0,'L’actualisation identique ne rejoue rien');
 assert.equal(tracker.pending('soustraction-ecrite-simple'),0);
});
test('Un changement de période, classe comparée ou population ne fabrique pas de remontée',()=>{
 const tracker=createOvertakeTracker();
 tracker.observe(snapshot());
 tracker.observe(changed());
 assert.equal(tracker.pending('soustraction-ecrite-simple'),1);
 assert.equal(tracker.observe({...changed(),context:'A:period-2'}).reset,true);
 assert.equal(tracker.pending('soustraction-ecrite-simple'),0);
 const removed={...changed(),context:'A:period-2',rows:changed().rows.slice(1)};
 assert.equal(tracker.observe(removed).reset,true);
 assert.equal(tracker.pending('soustraction-ecrite-simple'),0);
});
test('Pas de faux exploit si le score personnel ne progresse pas',()=>{
 const before=snapshot();
 const after=snapshot('soustraction-ecrite-simple',[80,70,60,50,60,40]);
 assert.deepEqual(detectOvertakes(before,after),[]);
 assert.deepEqual(detectOvertakes(before,{...changed(),context:'other'}),[]);
});
test('Une animation achevée ne se rejoue pas au retour sur sa page',()=>{
 const tracker=createOvertakeTracker();
 tracker.observe(snapshot());
 tracker.observe(changed());
 const job=tracker.take('soustraction-ecrite-simple');
 assert.ok(job?.moves?.length);
 assert.equal(tracker.finish('soustraction-ecrite-simple',job),true);
 assert.equal(tracker.take('soustraction-ecrite-simple'),null);
 tracker.drop('soustraction-ecrite-simple');
 assert.equal(tracker.shown('soustraction-ecrite-simple'),null);
 assert.equal(tracker.observe(changed()).reset,true);
 assert.equal(tracker.pending('soustraction-ecrite-simple'),0);
});

test('Une égalité ne fabrique pas une remontée spectaculaire fictive',()=>{
 const before=snapshot('addition-ecrite-simple',[150,140,140,140,140,120]);
 const challenger=before.rows.find(p=>p.id==='F');
 challenger.name='Aardvark';
 const after={...before,rows:before.rows.map(p=>({...p,
  score:p.id==='F'?140:p.score})).sort((a,b)=>b.score-a.score||a.name.localeCompare(b.name,'fr'))};
 const moves=detectOvertakes(before,after);
 assert.equal(moves.length,1);
 assert.equal(moves[0].fromIndex,5);
 assert.equal(moves[0].toIndex,1);
 assert.equal(moves[0].fromRank,3);
 assert.equal(moves[0].toRank,2);
 assert.equal(moves[0].gained,1,'Il gagne un rang distinct, pas quatre rangs imaginaires');
 assert.equal(moves[0].newScore,140);
});
