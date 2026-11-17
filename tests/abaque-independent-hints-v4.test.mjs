import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {VERSION,conversionPoints,judgeCompletion} from '../apps/GRAN-abaque-m-1/connect/completion-contract.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const id='e2e42645-6c22-40cc-9a89-2a6c9f1a5c44';
const task=(flags={})=>({from:'m',to:'cm',source:2,answer:200,manip:false,units:false,...flags});
const proof=(kind,flags={},version=4)=>({version,eventId:id,expectedResetEpoch:0,kind,units:[],images:[],
 tasks:Array.from({length:{one:4,three:12,five:20}[kind]},()=>task(flags)),completed:true,master:false});

test('V4 : aides indépendantes, trois barèmes progressifs',()=>{
 assert.equal(VERSION,4);
 const expected={one:[3,3,3,3],three:[3,3,2,2],five:[3,2,1,0],
  lives:[3,1,2,1],sudden:[6,2,4,2]};
 for(const [mode,points] of Object.entries(expected)){
  assert.deepEqual([{}, {units:true},{manip:true},{manip:true,units:true}]
   .map(flags=>conversionPoints(mode,flags)),points,mode);
 }
});
test('Abaque seul accepté et trophée interdit même si aide gratuite',()=>{
 for(const kind of ['one','three','five']){
  const result=judgeCompletion(proof(kind,{units:true}));
  assert.equal(result.firstTry,result.total);
  assert.equal(result.assisted,true);
  assert.equal(result.cleanPerfect,false);
  assert.equal(result.points,({one:12,three:36,five:40})[kind]);
 }
 for(const kind of ['one','three','five'])assert.equal(judgeCompletion(proof(kind)).cleanPerfect,true);
});
test('Anciens résultats V2 et V3 inchangés',()=>{
 assert.equal(conversionPoints('one',{manip:true,units:true},2),1);
 assert.equal(conversionPoints('one',{manip:true,units:true},3),2);
 assert.equal(conversionPoints('three',{manip:true,units:true},3),1);
 assert.equal(judgeCompletion(proof('one',{manip:true},3)).cleanPerfect,true);
 assert.throws(()=>judgeCompletion(proof('one',{units:true},3)),/invalid_completion/);
});
test('Connect : position, autonomie et verrous 75 % / professeur restent',()=>{
 const h=read('apps/GRAN-abaque-m-1/index.html');
 const j=h.indexOf('<div class="t3Controls"><div class="t3HelpControls">');
 assert.ok(j>=0);
 assert.ok(h.indexOf('class="btn t3HelpBtn t3UnitsBtn"',j)<h.indexOf('class="btn t3HelpBtn t3Open"',j));
 assert.match(h,/if\(ex\.open\|\|ex\.units\)renderBoard\(i\)/);
 assert.match(h,/const openAbacus=\(\)=>\{ex\.units=true;ex\.usedUnits=true;ex\.helpUsed=true;runUsedHelp=true/);
 assert.match(h,/Les aides gratuites restent facultatives/);
 assert.match(h,/recordMode\(selectedMode,runCorrect,total,runDots,!runUsedHelp\)/);
 assert.match(h,/case 'stage1_only':teacherAllows=what==='stage1'/);
 assert.match(h,/case 'through_2':teacherAllows=what==='stage1'\|\|what==='stage2'/);
 assert.match(h,/case 'all_open':teacherAllows=true/);
 assert.match(h,/case 'mastery_80':return pedagogicalUnlock\(what\)/);
 assert.match(h,/best\*4>=total\*3/);
 assert.match(h,/return teacherAllows&&\(!\['one','three','five','sudden','lives'\]\.includes\(what\)\|\|progressiveUnlocked\(what\)\)/);
});
test('Nouvelle preuve certifiée V4 et migration SQL sans réécriture des anciens scores',()=>{
 const bridge=read('apps/GRAN-abaque-m-1/connect/native-bridge.js');
 const sql=read('supabase/migrations/20261117110002_abaque_independent_hints_v4.sql');
 assert.match(bridge,/version:4/);
 assert.match(sql,/NOT IN \(''1'',''2'',''3'',''4''\)/);
 assert.match(sql,/p_result->>''ruleset'' IN \(''3'',''4''\)/);
 assert.doesNotMatch(sql,/DELETE FROM|DROP TABLE|TRUNCATE TABLE/);
});
