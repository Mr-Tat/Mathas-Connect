import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../apps/GRAN-abaque-m-1/index.html',import.meta.url),'utf8');
const sql=readFileSync(new URL('../supabase/migrations/20261107204500_abaque_two_perfect_runs_bronze_silver.sql',import.meta.url),'utf8');
const start=html.indexOf(" const recordStage=(key,correct,total)=>{");
const end=html.indexOf(" const recordMode=",start);
assert.ok(start>=0&&end>start,'Le calcul de progression est présent dans l’application');
const stageCode=html.slice(start,end);

function localProgress(){
 const makeStage=()=>({passes:[],passScores:[],perfectRuns:0,failed:false,failedScore:null});
 const make=new Function(`
  const data={stage1:{passes:[],passScores:[],perfectRuns:0,failed:false,failedScore:null},
              stage2:{passes:[],passScores:[],perfectRuns:0,failed:false,failedScore:null}};
  const earnedTrophies=[];
  const color=(correct,total)=>correct===total?'green':correct/total>=.8?'orange':'red';
  const passes=key=>data[key].passes.length;
  const canRecord=()=>true;
  const earnTrophy=key=>{if(!earnedTrophies.includes(key))earnedTrophies.push(key)};
  const save=()=>{};const render=()=>{};
  const connectBinding={};const demoPreviewActive=false;
  ${stageCode}
  return {recordStage,data,earnedTrophies};
 `);
 return make();
}

test('Abaque bronze : deux réussites à 80 % débloquent mais ne donnent pas le trophée',()=>{
 const p=localProgress();
 p.recordStage('stage1',10,12);
 p.recordStage('stage1',10,12);
 assert.equal(p.data.stage1.passes.length,2);
 assert.equal(p.earnedTrophies.includes('bronze'),false);
 p.recordStage('stage1',12,12);
 assert.equal(p.data.stage1.perfectRuns,1);
 assert.equal(p.earnedTrophies.includes('bronze'),false);
 p.recordStage('stage1',12,12);
 assert.equal(p.data.stage1.perfectRuns,2);
 assert.equal(p.earnedTrophies.includes('bronze'),true);
 p.recordStage('stage1',12,12);
 assert.equal(p.earnedTrophies.filter(k=>k==='bronze').length,1);
});

test('Abaque argent : deux 8/8 distincts, indépendamment des séries à 80 %',()=>{
 const p=localProgress();
 p.recordStage('stage2',7,8);
 p.recordStage('stage2',7,8);
 assert.equal(p.data.stage2.passes.length,2);
 assert.equal(p.earnedTrophies.includes('silver'),false);
 p.recordStage('stage2',8,8);
 assert.equal(p.earnedTrophies.includes('silver'),false);
 p.recordStage('stage2',8,8);
 assert.equal(p.data.stage2.perfectRuns,2);
 assert.equal(p.earnedTrophies.includes('silver'),true);
});

test('Abaque : les 2 séries directement à 100 % donnent les 2 trophées',()=>{
 const p=localProgress();
 for(let i=0;i<2;i++){
  p.recordStage('stage1',12,12);
  p.recordStage('stage2',8,8);
 }
 assert.deepEqual(p.earnedTrophies.sort(),['bronze','silver']);
});

test('Abaque SQL : 2 preuves distinctes de 100 %, remise à zéro et XP préservés',()=>{
 assert.match(sql,/IF perfect_count>=2 THEN/);
 assert.match(sql,/receipt\.student_id=pupil/);
 assert.match(sql,/receipt\.reset_epoch=p_epoch/);
 assert.match(sql,/receipt\.judgement->>'firstTry'/);
 assert.match(sql,/receipt\.judgement->>'total'/);
 assert.match(sql,/CASE count_passes WHEN 1 THEN 8 ELSE 6 END/);
 assert.match(sql,/'perfect',6\)/);
 assert.match(sql,/segment:=segment\|\|jsonb_build_object\('perfectRuns',perfect_count\)/);
});
