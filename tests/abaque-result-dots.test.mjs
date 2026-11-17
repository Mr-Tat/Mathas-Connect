import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {judgeCompletion} from '../apps/GRAN-abaque-m-1/connect/completion-contract.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const id='00000000-0000-4000-8000-000000000213';
const good=(opt={})=>({from:'m',to:'cm',source:2,answer:200,manip:false,units:false,...opt});
const event=(kind,tasks,version=2)=>({version,eventId:id,expectedResetEpoch:0,kind,completed:true,master:false,tasks});
test('Couleurs certifiées : vert, bleu, mauve, rouge selon le premier essai',()=>{
 const result=judgeCompletion(event('one',[
  good(),good({manip:true}),good({manip:true,units:true}),
  good({answer:0,correctedAnswer:200,manip:true,units:true})
 ]));
 assert.deepEqual(result.resultDots,['green','blue','purple','red']);
 assert.equal(result.firstTry,3);assert.equal(result.points,6);
 assert.equal(result.assisted,true);
});
test('12 et 20 conversions : couleurs ordonnées, un mauvais essai reste rouge',()=>{
 for(const [kind,total] of [['three',12],['five',20]]){
  const tasks=Array.from({length:total},(_,i)=>i%4===0?good()
   :i%4===1?good({manip:true}):i%4===2?good({manip:true,units:true})
   :good({answer:0,correctedAnswer:200}));
  const r=judgeCompletion(event(kind,tasks));
  assert.equal(r.resultDots.length,total);
  assert.deepEqual(r.resultDots.slice(0,4),['green','blue','purple','red']);
  assert.equal(r.firstTry,total*3/4);
 }
});
test('Anciennes preuves V1 restent inchangées : ni conversion rétrocoloriée ni XP différent',()=>{
 const r=judgeCompletion(event('one',[good(),good({manip:true}),good({units:true,manip:true}),good({answer:0})],1));
 assert.equal(r.points,6);
 assert.equal(r.firstTry,3);
 assert.equal('resultDots' in r,false);
});
test('Pas de pastilles pour Mort subite ni 3 vies',()=>{
 for(const kind of ['sudden','lives']){
  const tasks=[good(),...Array.from({length:kind==='lives'?3:1},()=>good({answer:0}))];
  const r=judgeCompletion(event(kind,tasks));
  assert.equal('resultDots' in r,false);
 }
});
test('L’application affiche bien 4/12/20 ronds et les quatre couleurs, sans toucher aux points',()=>{
 const html=read('apps/GRAN-abaque-m-1/index.html');
 assert.equal((html.match(/class="modeDots"/g)||[]).length,3);
 for(const code of ['green','red','blue','purple','empty'])
  assert.ok(html.includes('.homeModeBtn .modeDot.'+code),code);
 assert.match(html,/Convertis les longueurs, aides facultatives\./);
 assert.match(html,/data\.modeDots/);
 assert.match(html,/runDots\.push/);
 assert.match(html,/recordMode\(selectedMode,runCorrect,total,runDots,!runUsedHelp\)/);
 assert.match(html,/runDots\.push\(ex\.status!=='good'\?'red'/);
 const sql=read('supabase/migrations/20261116111500_abaque_classic_result_dots.sql');
 const normalized=sql.replaceAll("''","'");
 assert.match(normalized,/first_good>=coalesce\(\(scores->>kind\)::bigint,-1\)/);
 assert.match(normalized,/jsonb_array_length\(p_result->'resultDots'\)<>total/);
 assert.match(normalized,/WHERE d\.v<>'red'\)<>first_good/);
 assert.doesNotMatch(sql,/DELETE FROM|DROP TABLE|TRUNCATE TABLE/);
});
