import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {acceptAdvancedChallenge,advancedWidth,advancedExpected,
 normalizeAdvancedAttempt,advancedIsCorrect,advancedStopReason,
 createAdvancedProofQueue,MAX_ADVANCED_QUESTIONS} from '../apps/objective-record/certified-advanced.mjs';
import {createAdvancedProofUI} from '../apps/objective-record/certified-advanced-ui.mjs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const UUID='11111111-1111-4111-8111-111111111111';
const APPS=['addition-ecrite-simple','addition-ecrite-multiple'];
const MODES=['three-lives','sudden','hard-three-lives','hard-sudden'];
function challenge(appKey,mode,level){
 const width=advancedWidth(appKey,mode,level),hard=mode.startsWith('hard');
 const count=appKey==='addition-ecrite-simple'?2:hard?(level===3?7:6):level+2;
 const terms=Array.from({length:count},(_,i)=>i===0?'9'.repeat(width):'1'.repeat(width));
 return {ok:true,sessionId:UUID,appKey,mode,level,maxQuestions:64,
  questions:Array.from({length:64},(_,i)=>({id:'q'+(i+1),op:'add',addends:terms})),
  revision:0,resetEpoch:0,expiresAt:'2099-01-01T00:00:00Z'};
}
test('24 native advanced variants use server-authored digit/carry math, including BigInt 16 digits',()=>{
 let combos=0;
 for(const appKey of APPS)for(const mode of MODES)for(const level of [1,2,3]){
  const raw=challenge(appKey,mode,level),s=acceptAdvancedChallenge(raw,appKey,mode,level);
  assert.ok(s,appKey+mode+level);
  assert.equal(s.questions.length,MAX_ADVANCED_QUESTIONS);
  const q=s.questions[0],exp=advancedExpected(q,appKey,mode,level);
  assert.equal(typeof q.addends[0],'string');
  assert.ok(exp.digits.length>=advancedWidth(appKey,mode,level));
  assert.equal(exp.carries.length,advancedWidth(appKey,mode,level));
  const a=normalizeAdvancedAttempt({id:q.id,digits:[...exp.digits],carries:[...exp.carries]},q,appKey,mode,level);
  assert.equal(advancedIsCorrect(a,q,appKey,mode,level),true);
  const bad=normalizeAdvancedAttempt({...a,digits:a.digits.map((x,i)=>i===0?(x==='0'?'1':'0'):x)},q,appKey,mode,level);
  assert.equal(advancedIsCorrect(bad,q,appKey,mode,level),false);
  const numErrors=mode.endsWith('lives')?3:1;
  const seq=Array.from({length:numErrors+1},(_,i)=>{
   const qi=s.questions[i];
   const e=advancedExpected(qi,appKey,mode,level);
   return normalizeAdvancedAttempt({id:qi.id,digits:[...e.digits],carries:[...e.carries]},
    qi,appKey,mode,level);
  });
  assert.equal(advancedStopReason({mode,appKey,level,questions:s.questions,answers:seq}),null);
  const withErrors=seq.map((x,i)=>i===0?x:{...x,digits:x.digits.map((d,j)=>j===0?(d==='0'?'1':'0'):d)});
  assert.equal(advancedStopReason({mode,appKey,level,questions:s.questions,answers:withErrors}),'lost-lives');
  combos++;
 }
 assert.equal(combos,24);
});
test('Rejects tampered app key, mode, question values, digits and corrupt offline storage',()=>{
 const c=challenge('addition-ecrite-multiple','hard-sudden',3);
 assert.equal(acceptAdvancedChallenge({...c,appKey:'addition-ecrite-simple'},c.appKey,c.mode,c.level),null);
 assert.equal(acceptAdvancedChallenge({...c,questions:c.questions.slice(0,63)},c.appKey,c.mode,c.level),null);
 assert.equal(acceptAdvancedChallenge({...c,questions:[{...c.questions[0],addends:['01']},...c.questions.slice(1)]},c.appKey,c.mode,c.level),null);
 const store=new Map(),storage={getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)};
 const q=createAdvancedProofQueue({storage,studentId:UUID,classId:UUID,appKey:c.appKey});
 const proof=acceptAdvancedChallenge(c,c.appKey,c.mode,c.level);
 assert.equal(q.save({...proof,answers:[],finished:false}),true);
 assert.equal(q.read().sessionId,UUID);
 q.clear();assert.equal(q.read(),null);
 assert.equal(createAdvancedProofQueue({storage,studentId:'bad',classId:UUID,appKey:c.appKey}),null);
});
test('The authenticated advanced controller is a real importable module',()=>{
 assert.equal(typeof createAdvancedProofUI,'function');
});
test('Native advanced patch has exact structural hooks for both games',()=>{
 const js=read('apps/objective-record/engines/certified-advanced-patch.js');
 const sandbox={window:{}};runInNewContext(js,sandbox,{timeout:1000});
 assert.equal(typeof sandbox.window.MathasCertifiedAdvancedPatch,'function');
 const base=[
  "  function generateAddition(maxDigits){",
  "    if(session.mode==='three-lives'){\n      let right=0,lost=0;",
  "  function handlePrimary(){",
  "  function hardPrimaryAction(){",
  "    hardState=CFG.type==='addition'?additionState(hardSession.spec):subtractionState(hardSession.spec);",
  "    if(r.correct){\n      markAllGood();"
 ].join('\n');
 const simple=sandbox.window.MathasCertifiedAdvancedPatch(base,'simple');
 assert.match(simple,/MathasAdvancedAttempt/);
 assert.match(simple,/MathasCertified/);
 assert.match(simple,/advanced_question_unavailable/);
 const multiple=sandbox.window.MathasCertifiedAdvancedPatch(base.replace('  function generateAddition(maxDigits){',''),'multiple');
 assert.match(multiple,/hard_proof_unavailable/);
 for(const path of ['apps/objective-record/engines/addition-simple/essai-mode-score-3-vies.html',
  'apps/objective-record/engines/addition-multiple/essai-objectif-record-3-vies.html']){
  const html=read(path);
  assert.match(html,/certified-advanced-patch\.js/);
  assert.match(html,/MathasCertifiedAdvancedPatch/);
 }
});
test('School Edge has hard JWT/class contracts and cannot trust client scores',()=>{
 const edge=read('supabase/functions/connect-objective-record-school/index.ts');
 for(const action of ['start-advanced-v1','finish-advanced-v1','connect_objective_record_advanced_issue_v1',
  'connect_objective_record_advanced_finish_v1','getUser(token)','not_enrolled',
  'proof_only'])assert.ok(edge.includes(action),action);
 assert.ok(!edge.includes('b.score'));
 const host=read('apps/objective-record/eleve.mjs');
 assert.match(host,/createAdvancedProofUI/);
 assert.match(host,/advancedProofUI\.bind/);
 assert.match(host,/advancedProofUI\.onGameEvent/);
 const sql=['20261103110000_advanced_additions_proof_ledger.sql',
 '20261103110010_advanced_additions_issue_v1.sql',
 '20261103110020_advanced_additions_atomic_award.sql',
 '20261103110030_advanced_additions_finish_v1.sql'].map(x=>read('supabase/migrations/'+x)).join('\n');
 assert.match(sql,/ENABLE ROW LEVEL SECURITY/);
 assert.match(sql,/REVOKE ALL ON FUNCTION public.connect_objective_record_advanced_finish_v1/);
 assert.match(sql,/advanced_stop_rule_broken/);
 assert.match(sql,/proof_replay_collision/);
 assert.match(sql,/connect_xp_sync_v2/);
});
