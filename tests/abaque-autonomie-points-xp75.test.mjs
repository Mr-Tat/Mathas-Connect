import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {VERSION,conversionPoints,recordPoints,judgeCompletion} from '../apps/GRAN-abaque-m-1/connect/completion-contract.mjs';

const uuid='cda8117c-6917-416b-83c5-dbb8dfc94021';
const task=(opts={})=>({from:'m',to:'cm',source:2,answer:200,manip:false,units:false,...opts});
const event=(kind,tasks,{version=2,completed=true,tailSegments}={})=>({
 version,eventId:uuid,expectedResetEpoch:0,kind,units:[],images:[],tasks,completed,
 ...(completed?{}:{abandoned:true}),master:false,...(tailSegments?{tailSegments}:{}),
});
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('Contrat V2 : 3/2/1 classique et 3 vies ; 6/4/2 Mort subite',()=>{
 assert.equal(VERSION,4); // Nouveau contrat tout en acceptant V1/V2.
 for(const kind of ['one','three','five','lives']){
  assert.equal(conversionPoints(kind,{},2),3);
  assert.equal(conversionPoints(kind,{manip:true},2),2);
  assert.equal(conversionPoints(kind,{manip:true,units:true},2),1);
 }
 for(const [props,points] of [[{},6],[{manip:true},4],[{manip:true,units:true},2]]){
  assert.equal(conversionPoints('sudden',props,2),points);
 }
 assert.equal(recordPoints('lives',50),150);
 assert.equal(recordPoints('sudden',50),300);
 assert.equal(recordPoints('lives',50,1),50);
 assert.equal(recordPoints('sudden',50,1),100);
});
test('Activité 3 : le premier essai seul marque, usage des unités prioritaire ; une aide suffit pour les XP réduits',()=>{
 const tasks=[task(),task({manip:true}),task({manip:true,units:true}),task({answer:0,correctedAnswer:200})];
 const r=judgeCompletion(event('one',tasks));
 assert.equal(r.firstTry,3);assert.equal(r.total,4);assert.equal(r.points,6);
 assert.equal(r.assisted,true);assert.equal(r.ruleset,2);
 assert.equal(judgeCompletion(event('one',Array.from({length:4},()=>task()))).points,12);
 assert.equal(judgeCompletion(event('three',Array.from({length:12},()=>task()))).points,36);
 assert.equal(judgeCompletion(event('five',Array.from({length:20},()=>task()))).points,60);
 assert.equal(judgeCompletion(event('one',Array.from({length:4},()=>task()))).assisted,false);
});
test('Mort subite / 3 vies : arrêt, aides verrouillées et pointage certifié',()=>{
 const good=[task({manip:true,units:true}),task({manip:true}),task({manip:true}),task()];
 const sudden=judgeCompletion(event('sudden',[...good,task({answer:0})]));
 assert.equal(sudden.points,2+4+4+6);assert.equal(sudden.firstTry,4);
 assert.equal(sudden.errors,1);assert.equal(sudden.assisted,true);
 const lives=judgeCompletion(event('lives',[...good,task({answer:0}),task({answer:0}),task({answer:0})]));
 assert.equal(lives.points,1+2+2+3);assert.equal(lives.errors,3);
 assert.throws(()=>judgeCompletion(event('sudden',[task(),task({manip:true,units:true}),task({answer:0})])),/invalid_completion/);
 assert.throws(()=>judgeCompletion(event('sudden',[task(),task(),task(),task({manip:true}),task({answer:0})])),/invalid_completion/);
});
test('Anciennes preuves V1 : aucun score ou reçu ancien réinterprété',()=>{
 const v1=judgeCompletion(event('one',[task(),task({manip:true}),task({manip:true,units:true}),task()],{version:1}));
 assert.equal(v1.points,8);assert.equal(v1.ruleset,1);assert.equal('assisted' in v1,false);
 const record=judgeCompletion(event('sudden',[task(),task({answer:0})],{version:1}));
 assert.equal(record.points,2);assert.equal(record.ruleset,1);assert.equal('assisted' in record,false);
});
test('Longue partie : au-delà de dix conversions la preuve compacte conserve le bonus x2',()=>{
 const tasks=Array.from({length:10},()=>task());
 const next=judgeCompletion(event('sudden',tasks,{completed:false,tailSegments:[5]}));
 assert.equal(next.points,90);assert.equal(next.firstTry,15);assert.equal(next.assisted,false);
 const old=judgeCompletion(event('sudden',tasks,{version:1,completed:false,tailSegments:[5]}));
 assert.equal(old.points,30);assert.equal(old.firstTry,15);
});
test('XP : pourcentages validés, compléments récupérables et aucun effacement',()=>{
 const sql=read('supabase/migrations/20261116133000_abaque_autonomie_scores_xp75.sql');
 for(const [key,low,high] of [
  ['one:pass',9,12],['one:perfect',6,8],['three:pass',14,18],
  ['three:perfect',10,14],['five:pass',21,28],['five:perfect',9,12],
  ['record:15',18,24],['record:30',18,24],['record:50',18,24],
 ]){
  const escaped=key.replace(/[.*+?^\$\{\}()|[\]\\]/g,'\\$&');
  assert.match(sql,new RegExp(escaped+".*?CASE WHEN assisted THEN "+low+" ELSE "+high));
 }
 assert.equal(9+6,15);assert.equal(14+10,24);assert.equal(21+9,30);
 assert.equal(18*3,54);
 assert.equal(20+20+20+32+40+72,204);
 assert.match(sql,/aucun UPDATE|Aucun UPDATE/);
 assert.match(read('supabase/migrations/20261107223500_abaque_204xp_5perpage_records.sql'),/greatest\(r.amount,excluded.amount\)/);
 const bridge=read('apps/GRAN-abaque-m-1/connect/native-bridge.js');
 assert.match(bridge,/version:4/);
 assert.match(bridge,/page\[i\]\.manip \|\|=/);
 const html=read('apps/GRAN-abaque-m-1/index.html');
 assert.match(html,/selectedMode==='one'\?3/);
});
