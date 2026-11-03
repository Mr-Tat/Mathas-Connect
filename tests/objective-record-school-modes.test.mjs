import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createCertifiedScoreModesUI} from '../apps/objective-record/certified-score-modes-ui.mjs';
const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const simple='addition-ecrite-simple',multi='addition-ecrite-multiple';
const base='apps/objective-record/engines/';
test('Native score adapters use exact anchors, BigInt HARD and capture before free-mode correction',()=>{
 const w={};new Function('window',read('apps/objective-record/certified-score-modes-patch.js'))(w);
 const multiAdapter={};
 new Function('window',read(base+'addition-multiple/certified-multiple-patch.js'))(multiAdapter);
 for(const [kind,filename] of [['simple',base+'addition-simple/game-original.html'],
   ['multi',base+'addition-multiple/index.html']]){
  let game=read(filename);
  if(kind==='multi')game=multiAdapter.MathasCertifiedMultiPatch(game);
  // Both original wrappers inject the same 3-lives branch before sudden.
  const needle="    if(session.mode==='sudden'){\n      let newly=0;";
  assert.equal(game.split(needle).length-1,1,kind);
  game=game.replace(needle,
   "    if(session.mode==='three-lives'){\n      let right=0,lost=0;\n    }\n"+needle);
  const patched=w.MathasCertifiedModesPatch(game,kind);
  assert.match(patched,/window\.__mathasServerCertifiedModes/);
  assert.match(patched,/MathasCertifiedModeAttempt/);
  assert.match(patched,/BigInt\(b\)/);
  assert.ok(patched.indexOf('window.MathasCertifiedModeAttempt?.({id:state.proofId')
   <patched.indexOf("if(session.mode==='three-lives'){"),kind+' capture ordering');
  assert.equal(patched.split('window.MathasCertifiedModeAttempt?.({id:state.proofId').length-1,1);
  assert.throws(()=>w.MathasCertifiedModesPatch('bogus native',kind),/Certificat modes/);
 }
});
test('Wrappers import the private native adapter after the original scoreboard patch',()=>{
 for(const path of [base+'addition-simple/essai-mode-score-3-vies.html',
   base+'addition-multiple/essai-objectif-record-3-vies.html']){
  const s=read(path);
  assert.match(s,/certified-score-modes-patch\.js/);
  assert.match(s,/MathasCertifiedModesPatch\(game/);
  assert.ok(s.indexOf('MathasCertifiedModesPatch(game')>s.indexOf('MathasLabV2.patch(game'));
 }
});
test('School Edges expose only proof endpoints, never direct browser points or XP',()=>{
 const edge=read('supabase/functions/connect-objective-record-school/index.ts');
 for(const term of ['start-mode-v1','finish-mode-v1',
   'connect_objective_record_school_issue_mode_v1','connect_objective_record_school_finish_mode_v1'])
  assert.ok(edge.includes(term));
 for(const forbidden of ['b.score','b.xp','b.rewards'])assert.ok(!edge.includes(forbidden));
 const host=read('apps/objective-record/eleve.mjs');
 assert.match(host,/certifiedScoreModes\.bind/);
 assert.match(host,/certifiedScoreModes\.onGameEvent/);
 assert.match(host,/certifiedScoreModes\.retry/);
});
test('SQL: private sessions, no anonymous writes, server grading and half-credit cap',()=>{
 const files=[
 '20261103130000_additions_modes_private_sessions.sql',
 '20261103130010_additions_three_lives_half_xp.sql',
 '20261103130020_additions_issue_score_modes.sql',
 '20261103130030_additions_record_score_modes.sql',
 '20261103130040_additions_finish_score_modes.sql'
 ].map(x=>read('supabase/migrations/'+x));
 for(const term of ['ENABLE ROW LEVEL SECURITY','REVOKE ALL','TO service_role'])assert.ok(files.join('\n').includes(term));
 assert.match(files[1],/three-lives:5/);
 assert.match(files[1],/then 0 else r\.points end/);
 assert.match(files[1],/then 0 else b\.points end/);
 assert.match(files[4],/mode_terminal_mismatch/);
 assert.match(files[4],/v_wrong=v_max_wrong/);
 assert.match(files[3],/connect_xp_sync_v2/);
});
test('UI refuses native score and awards XP only after a server-signed verified grade',async()=>{
 const classId='8fe170fa-9e8f-4e80-885a-b0ba68026f64';
 const questions=Array.from({length:64},(_,i)=>({id:'q'+(i+1),op:'add',addends:['456','789']}));
 const cfg={generation:1,activeApp:simple,pupilId:'11111111-1111-4111-8111-111111111111',classId};
 const storage=new Map(),record=[],alerts=[];
 const win={};let captured=null;
 const modeButton={id:'startSudden',closest:selector=>selector==='button'?modeButton:null,
  click:()=>captured({target:modeButton,preventDefault(){},stopImmediatePropagation(){}})};
 const doc={getElementById:key=>key==='menuScreen'?{}:{value:'3'},
  addEventListener:(name,handler)=>{if(name==='click')captured=handler},
  contains:()=>true};
 let launches=0;
 modeButton.click=()=>{launches++;captured({target:modeButton,preventDefault(){},stopImmediatePropagation(){}})};
 const gate=createCertifiedScoreModesUI({
  getContext:()=>cfg,storage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),
    removeItem:k=>storage.delete(k)},
  notify:x=>alerts.push(x),refresh:async()=>{},
  onRecorded:x=>record.push(x),
  call:async(action,payload)=>{
   if(action==='start-mode-v1')return {ok:true,sessionId:'22222222-2222-4222-8222-222222222222',
    mode:'sudden',level:1,questions,expiresAt:'2099-01-01T00:00:00Z'};
   if(action==='finish-mode-v1')return {ok:true,proofVerified:true,
    verifiedScore:0,xp:{delta:0},duplicate:false};
   throw Error('unexpected action');
  }
 });
 gate.bind(win,doc);
 assert.equal(gate.onGameEvent({mode:'sudden',score:99,phase:'ended',hard:false,level:1}),false);
 captured({target:modeButton,preventDefault(){},stopImmediatePropagation(){}});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(launches,1);
 assert.equal(win.__mathasServerCertifiedModes.mode,'sudden');
 win.MathasCertifiedModeAttempt({id:'q1',digits:['0','0','0','0'],carries:['','','']});
 assert.equal(gate.onGameEvent({mode:'sudden',phase:'ended',hard:false,level:1,score:999}),true);
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(record.length,1);
 assert.match(alerts.at(-1),/vérifié/);
});
