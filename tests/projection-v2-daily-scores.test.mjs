import test from 'node:test';
import assert from 'node:assert/strict';
import {brusselsDayKey,brusselsDaySearchWindow,summarizeDailyPublishedScores,publishedScoreKey} from '../supabase/functions/connect-projection-v2/daily-scores.mjs';
const A='class-A',B='class-B',APP='addition-ecrite-simple';
const now=Date.parse('2026-11-08T20:30:00Z');
const event=(event_id,student_id,points,played_at='2026-11-08T11:00:00Z',extras={})=>({
 event_id,student_id,class_id:A,app_key:APP,game_points:points,game_score:1000,
 played_at,captured_at:played_at,...extras
});
const consent=e=>({event_id:e.event_id,student_id:e.student_id,
 class_id:e.class_id,app_key:e.app_key});
const lookup=(m,student='S1',cls=A)=>m.get(publishedScoreKey(cls,student,APP));

test('jour belge : passage à minuit en CET, CEST et changement d’heure',()=>{
 assert.equal(brusselsDayKey('2026-11-08T22:59:00Z'),'2026-11-08');
 assert.equal(brusselsDayKey('2026-11-08T23:01:00Z'),'2026-11-09');
 assert.equal(brusselsDayKey('2026-07-05T21:59:00Z'),'2026-07-05');
 assert.equal(brusselsDayKey('2026-07-05T22:01:00Z'),'2026-07-06');
 assert.equal(brusselsDayKey('2026-03-29T01:15:00Z'),'2026-03-29');
 assert.equal(brusselsDayKey('2026-10-25T01:15:00Z'),'2026-10-25');
 assert.equal(brusselsDaySearchWindow(now).day,'2026-11-08');
});
test('score du jour : meilleur événement DU JOUR explicitement partagé, aucun score privé',()=>{
 const low=event('e1','S1',23),high=event('e2','S1',45);
 const privateHigh=event('e3','S1',999);
 const yesterday=event('e4','S1',98,'2026-11-07T17:00:00Z');
 const other=event('e5','S2',35);
 const otherClass=event('e6','S1',600,undefined,{class_id:B});
 const map=summarizeDailyPublishedScores({events:[low,high,privateHigh,yesterday,other,otherClass],
  consents:[low,high,privateHigh,yesterday,other,otherClass].filter(e=>e.event_id!=='e3').map(consent),
  nowMs:now});
 assert.equal(lookup(map),45);
 assert.equal(lookup(map,'S2'),35);
 assert.equal(lookup(map,'S1',B),600,'autre classe isolée');
 assert.equal(map.size,3);
});
test('reset de relevé : aucun score antérieur ni ancienne capture réutilisée',()=>{
 const early=event('e1','S1',100,'2026-11-08T08:00:00Z');
 const oldCapture=event('e2','S1',900,'2026-11-08T12:00:00Z',{captured_at:'2026-11-08T09:00:00Z'});
 const valid=event('e3','S1',25,'2026-11-08T13:00:00Z');
 const period={class_id:A,app_key:APP,score_since:'2026-11-08T10:00:00Z'};
 const map=summarizeDailyPublishedScores({events:[early,oldCapture,valid],
  consents:[early,oldCapture,valid].map(consent),periods:[period],nowMs:now});
 assert.equal(lookup(map),25);
});
test('preuve et identité : le consentement doit correspondre à événement, élève, classe et application',()=>{
 const one=event('id','S1',40);
 const mismatched=[{...consent(one),student_id:'S2'},
 {...consent(one),app_key:'soustraction-ecrite-simple'},
 {...consent(one),class_id:B}];
 assert.equal(summarizeDailyPublishedScores({events:[one],consents:mismatched,nowMs:now}).size,0);
 const forced=event('forged','S1',8000,undefined,{captured_at:'not-a-date'});
 assert.equal(summarizeDailyPublishedScores({events:[forced],consents:[consent(forced)],nowMs:now}).size,0);
});
test('jour courant seulement ; jeu récent non publié et score historique ne sont pas projetés',()=>{
 const yesterday=event('y','S1',220,'2026-11-07T20:00:00Z');
 const tomorrow=event('t','S1',350,'2026-11-08T23:01:00Z');
 const noShare=event('notshared','S1',900);
 const map=summarizeDailyPublishedScores({events:[yesterday,tomorrow,noShare],
  consents:[yesterday,tomorrow].map(consent),nowMs:now});
 assert.equal(map.size,0);
});
test('points issus des mêmes colonnes que le record officiel, sans doublons ni XP cumulés',()=>{
 const noPoints=event('score','S1',0,undefined,{game_score:16});
 const points=event('points','S1',32,undefined,{game_score:16});
 const map=summarizeDailyPublishedScores({events:[noPoints,points],
  consents:[noPoints,points].map(consent),nowMs:now});
 assert.equal(lookup(map),32);
});
