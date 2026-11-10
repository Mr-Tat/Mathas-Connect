import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 schoolScoreSnapshot, canShareBestScore, scoreShareStatus
} from '../apps/objective-record/school-score-view.mjs';

const source=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const eventId='11111111-1111-4111-8111-111111111111';
const today=()=>new Date().toISOString();
const fixture=(mode,boardBest,boardTodayBest,points=14)=>({
 ok:true,boardBest,boardTodayBest,events:[],bestThree:[],
 todayBest:{eventId,mode,score:7,total:20,points,at:today()}
});

test('le classement du jour accepte les cinq modes, même sous le record historique',()=>{
 for(const mode of ['classic','sudden','three-lives','hard-sudden','hard-three-lives']){
  const snapshot=schoolScoreSnapshot(fixture(mode,60,0));
  assert.equal(snapshot.today.mode,mode);
  assert.equal(snapshot.boardBest,60);
  assert.equal(snapshot.boardTodayBest,0);
  assert.equal(canShareBestScore(snapshot),true,mode);
  assert.equal(scoreShareStatus(snapshot),'send',mode);
 }
});
test('une publication du jour confirmée est reconnaissable à la réouverture',()=>{
 const snapshot=schoolScoreSnapshot(fixture('sudden',60,14));
 assert.equal(canShareBestScore(snapshot),false);
 assert.equal(scoreShareStatus(snapshot),'sent');
});
test('aucune deuxième proposition si le meilleur du jour déjà publié est supérieur',()=>{
 const snapshot=schoolScoreSnapshot(fixture('three-lives',60,17,14));
 assert.equal(canShareBestScore(snapshot),false);
 assert.equal(scoreShareStatus(snapshot),'unavailable');
});
test('ancien serveur sans boardTodayBest : ne jamais autoriser un partage incertain',()=>{
 const snapshot=schoolScoreSnapshot({...fixture('sudden',60,0),boardTodayBest:undefined});
 assert.equal(snapshot.boardTodayBest,null);
 assert.equal(canShareBestScore(snapshot),false);
 assert.equal(scoreShareStatus(snapshot),'unavailable');
});
test('preuve événementielle obligatoire et aucun score inventé par le navigateur',()=>{
 const snapshot=schoolScoreSnapshot({
  ...fixture('sudden',60,0),
  todayBest:{...fixture('sudden',60,0).todayBest,eventId:null}
 });
 assert.equal(canShareBestScore(snapshot),false);
 assert.equal(scoreShareStatus(snapshot),'unavailable');
});
test('le code SQL garde les verrous de classe, preuve, reset et consentement',()=>{
 const sql=source('supabase/migrations/20261110120000_projection_written_daily_best_consent.sql');
 assert.equal((sql.match(/CREATE OR REPLACE FUNCTION/g)||[]).length,6);
 assert.equal((sql.match(/INTO v_previous,v_today/g)||[]).length,3);
 assert.equal((sql.match(/'boardTodayBest'/g)||[]).length,9);
 assert.match(sql,/TIME ZONE 'Europe\/Brussels'/);
 assert.match(sql,/v_points<=v_today/);
 assert.match(sql,/connect_projection_score_periods/);
 assert.match(sql,/connect_projection_score_consents/);
 assert.match(sql,/proofVerified/);
 assert.doesNotMatch(sql,/UPDATE public\.connect_states|DELETE FROM public\.connect_projection_score_events|TRUNCATE/i);
});
test('la pastille passe à envoyé seulement à la réception du succès API',()=>{
 const ui=source('apps/objective-record/school-score-view.mjs');
 const consent=source('projection-consent.mjs');
 assert.match(ui,/Meilleur score déjà envoyé/);
 assert.match(ui,/confirmedEvent=eventId/);
 assert.match(ui,/result==='sent'/);
 assert.match(consent,/emit\(eventId,'sent'\)/);
 assert.match(consent,/onResult\(fn\)/);
});
