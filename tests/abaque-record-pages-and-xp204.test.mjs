import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../apps/GRAN-abaque-m-1/index.html',import.meta.url),'utf8');
const bootstrap=readFileSync(new URL('../apps/GRAN-abaque-m-1/connect/bootstrap.mjs',import.meta.url),'utf8');
const sql=readFileSync(new URL('../supabase/migrations/20261107223500_abaque_204xp_5perpage_records.sql',import.meta.url),'utf8');
const a=html.indexOf('function finishRecordAnswer(){'),b=html.indexOf('function finishPage(',a);
assert.ok(a>=0&&b>a,'Le validateur de conversions record est présent');
const code=html.slice(a,b);

function simulate(variant){
 const build=new Function(`
 let locked=false,selectedMode='sudden',recordStep=0,runCorrect=0,runQuestions=0,suddenStreak=0,runScore=0,runFinished=false,lives=3,pageNumber=0,recordVariant=variant;
 const nodes=new Map(), $=id=>{if(!nodes.has(id))nodes.set(id,{textContent:'',classList:{add(){},remove(){}}});return nodes.get(id)};
 const proof={first:[],page:[],complete:0};
 let series=Array.from({length:5},()=>({answer:'',result:10,status:'pending',usedManip:false,usedUnits:false,earnedPoints:null}));
 const window={MATHAS_ABAQUE_PROOF:{first:tasks=>proof.first.push(tasks.map(t=>t.answer)),page:tasks=>proof.page.push(tasks.map(t=>t.answer)),complete:()=>{proof.complete++}},
  MATHAS_PROGRESS:{recordSudden:()=>{},recordScore:()=>({})},MATHAS_CELEBRATE:{toast:()=>{},modal:()=>{}}};
 const calcPoints=()=>variant==='sudden'?2:1,recordMode=()=>variant;
 const scoreView=()=>{},renderLives=()=>{},renderOne=()=>{},updateKeypadAction=()=>{},setActive=()=>{},startMode=()=>{};
 ${code}
 return {answer(value){series[recordStep].answer=String(value);finishRecordAnswer()},
  state(){return {locked,recordStep,runCorrect,runQuestions,suddenStreak,runScore,runFinished,lives,proof}}};
 `);
 return build()(variant);
}

test('Record : exactement cinq conversions par page, validées une à une',()=>{
 assert.match(html,/return Array\.from\(\{length:5\},\(_,index\)=>/);
 assert.match(html,/renderOne\(recordStep\);\s*setActive\(recordStep\)/);
 for(const [variant,expected] of [['lives',5],['sudden',10]]){
  const app=simulate(variant);
  for(let i=0;i<5;i++)app.answer(10);
  const state=app.state();
  assert.equal(state.runQuestions,5);
  assert.equal(state.runCorrect,5);
  assert.equal(state.runScore,expected);
  assert.equal(state.locked,true);
  assert.equal(state.runFinished,false);
  assert.equal(state.proof.page.length,5);
  assert.equal(state.proof.complete,0);
 }
});

test('Record : Mort subite stoppe à une erreur, 3 vies stoppe à trois',()=>{
 let app=simulate('sudden');
 app.answer(0);
 assert.equal(app.state().runFinished,true);
 assert.equal(app.state().proof.complete,1);
 assert.equal(app.state().runQuestions,1);
 app=simulate('lives');
 app.answer(0);
 assert.equal(app.state().lives,2);
 assert.equal(app.state().runFinished,false);
 app.answer(0);app.answer(0);
 assert.equal(app.state().lives,0);
 assert.equal(app.state().runFinished,true);
 assert.equal(app.state().proof.complete,1);
 assert.equal(app.state().runQuestions,3);
});

test('XP : 32 au format 3 pages, 24 par palier partagé 15/30/50 et plafond 204',()=>{
 assert.match(sql,/three:perfect',14\)/);
 assert.match(sql,/'three',32-coalesce/);
 for(const goal of [15,30,50]){
  assert.match(sql,new RegExp(`first_good>=${goal}`));
  assert.match(sql,new RegExp(`'record:${goal}',24`));
 }
 assert.match(sql,/IF earned_after>204/);
 assert.match(sql,/'max',204/);
 assert.match(sql,/'xpMax',204/);
 assert.match(bootstrap,/three:32,five:40,lives:72,sudden:72/);
 assert.match(bootstrap,/value\.xp\?\.max===204/);
 assert.match(html,/5 conversions par page · 24 XP aux paliers de 3, 6 et 10 pages/);
});
