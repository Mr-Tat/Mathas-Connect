import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 acceptMultiplicationChallenge,acceptMultiplicationExtendedChallenge,
 expectedMultiplicationWidth,multiplicationEndState,normalizeMultiplicationAttempt,
 multiplicationAttemptCorrect,multiplicationQueue,restoreMultiplicationTranscript
} from '../apps/multiplication-simple/certified-classic.mjs';

const repoFile=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const CLS='4bf3400d-a315-4ea4-a2f3-afaca24dc9b9';
const STUDENT='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const SESSION='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
function sample(q={id:'q1',op:'mul',a:'249',m:9,width:3}){
 return {ok:true,sessionId:SESSION,revision:0,resetEpoch:0,
  expiresAt:new Date(Date.now()+30*60_000).toISOString(),
  level:1,total:4,questions:Array.from({length:4},(_,i)=>({...q,id:'q'+(i+1)}))};
}
test('native challenge must be issued by server and respect allowed tables',()=>{
 assert.ok(acceptMultiplicationChallenge(sample(),1,4,[9]));
 assert.equal(acceptMultiplicationChallenge(sample(),1,4,[2,3]),null);
 assert.equal(acceptMultiplicationChallenge(sample(),2,4,[9]),null);
 assert.equal(acceptMultiplicationChallenge({...sample(),sessionId:'wrong'},1,4,[9]),null);
 assert.equal(acceptMultiplicationChallenge({...sample(),questions:[]},1,4,[9]),null);
});
test('249 × 9: carries are 8 then 4, and digits are little-endian',()=>{
 const q=sample().questions[0],raw={
  id:'q1',digits:['1','4','2','2'],carries:['','8','4']};
 assert.deepEqual(normalizeMultiplicationAttempt(q,raw),raw);
 assert.equal(multiplicationAttemptCorrect(q,raw),true);
 assert.equal(multiplicationAttemptCorrect(q,{...raw,carries:['','8','3']}),false);
 assert.equal(multiplicationAttemptCorrect(q,{...raw,digits:['1','4','2','1']}),false);
});
test('native optional carry: empty is accepted, but an entered wrong carry is an error',()=>{
 const q={id:'q1',op:'mul',a:'249',m:9,width:3};
 const v=normalizeMultiplicationAttempt(q,{id:'q1',digits:['1','4','2','2'],carries:['','','4']});
 assert.ok(v);
 assert.equal(multiplicationAttemptCorrect(q,v),true,'no penalty for optional unwritten carry');
 assert.equal(multiplicationAttemptCorrect(q,{...v,carries:['','0','4']}),false);
 assert.equal(multiplicationAttemptCorrect(q,{...v,carries:['','7','4']}),false);
 assert.equal(multiplicationAttemptCorrect(q,{...v,digits:['1','4','2','1']}),false);
 assert.equal(normalizeMultiplicationAttempt(q,{...v,carries:['','','10']}),null);
});
test('no carry: empty and zero are equivalent for correct computation',()=>{
 const q={id:'q1',op:'mul',a:'123',m:2,width:3};
 for(const carries of [['','',''],['','0','0']])
  assert.equal(multiplicationAttemptCorrect(q,{id:'q1',digits:['6','4','2'],carries}),true);
});
test('session transcript queue is isolated by class and account; duplicate not silently discarded',()=>{
 const memory=new Map();
 const store={getItem:k=>memory.get(k)||null,
  setItem:(k,v)=>{memory.set(k,v)},removeItem:k=>{memory.delete(k)}};
 const queue=multiplicationQueue(store,STUDENT,CLS),q=sample();
 assert.ok(queue);
 assert.equal(queue.save(q,[{id:'q1',digits:['1','4','2','2'],carries:['','8','4']}]),true);
 assert.equal(queue.read()?.answers.length,1);
 assert.equal(multiplicationQueue(store,'invalid',CLS),null);
 queue.clear();assert.equal(queue.read(),null);
});

test('interrupted certified multiplication restores the ORIGINAL issued challenge, not a new one',()=>{
 const memory=new Map(),store={getItem:k=>memory.get(k)||null,
  setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};
 const challenge={...sample(),multipliers:[9],method:'side',tensFirst:true};
 const q=multiplicationQueue(store,STUDENT,CLS);
 const answer={id:'q1',digits:['1','4','2','2'],carries:['','8','4']};
 assert.equal(q.save(challenge,[answer]),true);
 const saved=q.read();
 assert.equal(saved.questions.length,4,'les questions serveur sont conservées');
 assert.equal(saved.sessionId,SESSION,'le défi original est préservé');
 const restored=restoreMultiplicationTranscript(saved,'classic');
 assert.ok(restored);
 assert.equal(restored.sessionId,SESSION);
 assert.equal(restored.answers.length,1);
 assert.equal(restored.method,'side');
 assert.equal(restored.tensFirst,true);
 assert.equal(restored.finished,false);
 assert.equal(multiplicationQueue(store,STUDENT,'11111111-1111-4111-8111-111111111111').read(),null);
 assert.equal(multiplicationQueue(store,'cccccccc-cccc-4ccc-8ccc-cccccccccccc',CLS).read(),null);
});

test('completed but unacknowledged proof remains re-sendable; invalid and old queues cannot masquerade as certified',()=>{
 const memory=new Map(),store={getItem:k=>memory.get(k)||null,
  setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};
 const q=multiplicationQueue(store,STUDENT,CLS),challenge={...sample(),multipliers:[9]};
 const answers=challenge.questions.map((x)=>({id:x.id,digits:['1','4','2','2'],carries:['','','']}));
 assert.equal(q.save(challenge,answers),true);
 assert.equal(restoreMultiplicationTranscript(q.read(),'classic')?.finished,true);
 const corrupt={...q.read(),questions:[{id:'q1',op:'mul',a:'17',m:2,width:2}]};
 assert.equal(restoreMultiplicationTranscript(corrupt,'classic'),null);
 const tampered={...q.read(),answers:[{...answers[0],digits:['?',...answers[0].digits.slice(1)]}]};
 assert.equal(restoreMultiplicationTranscript(tampered,'classic'),null);
 const old={sessionId:SESSION,expiresAt:challenge.expiresAt,level:1,total:4,mode:'classic',answers};
 assert.equal(restoreMultiplicationTranscript(old,'classic'),null,'ne pas inventer les questions d’une vieille preuve');
 assert.equal(q.read()?.answers.length,4,'une tentative invalide ne détruit pas le reçu conservé');
});

test('an interrupted HARD session can be restored with the exact 120-question server envelope',()=>{
 const memory=new Map(),store={getItem:k=>memory.get(k)||null,
  setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};
 const challenge={...sample(),mode:'hard-sudden',level:3,width:16,total:120,limit:120,
  questions:Array.from({length:120},(_,i)=>({id:'q'+(i+1),op:'mul',a:'9999999999999999',m:9,width:16})),
  multipliers:[9]};
 const q=multiplicationQueue(store,STUDENT,CLS,'hard-sudden',3);
 const answer={id:'q1',digits:(BigInt(challenge.questions[0].a)*9n).toString().split('').reverse(),
  carries:Array(16).fill('')};
 assert.equal(q.save(challenge,[answer]),true);
 assert.ok(restoreMultiplicationTranscript(q.read(),'hard-sudden'));
 assert.equal(restoreMultiplicationTranscript(q.read(),'three-lives'),null);
 assert.equal(restoreMultiplicationTranscript(q.read(),'hard-sudden').finished,false);
});

test('SQL school proof only serves exact app; no direct anon or browser grade endpoint',()=>{
 const sql=repoFile('supabase/migrations/20261104110000_school_multiplication_classic_certified_v1.sql');
 const edge=repoFile('supabase/functions/connect-multiplication-school/index.ts');
 const launch=repoFile('apps/multiplication-simple/index.html');
 assert.match(sql,/school_mul_finish_classic_v1/);
 assert.match(sql,/public.connect_xp_sync_v2/);
 assert.match(sql,/proof_replay_collision/);
 assert.match(sql,/REVOKE ALL ON FUNCTION public.connect_objective_record_school_mul_finish_classic_v1/);
 assert.match(sql,/TO service_role/);
 assert.match(edge,/user\.is_anonymous===true/);
 assert.match(edge,/auth\.getUser\(token\)/);
 assert.match(edge,/teacher_player_missing/);
 assert.match(edge,/finish-classic-v1/);
 assert.doesNotMatch(edge,/b\.score|b\.points|b\.rewards/);
 assert.match(launch,/event\.stopImmediatePropagation\(\)/);
 assert.doesNotMatch(launch,/action:'game-record'/);
 assert.match(launch,/certifiedScoreView\?\.recorded\(receipt\.eventId\)/);
  assert.match(launch,/action:'student-score-history'/);
});

test('LAB Tests en ligne : Multiplication impose la vraie session Connect avant une partie',()=>{
 const lab=repoFile('laboratoire.js');
 const launcher=repoFile('apps/multiplication-simple/index.html');
 assert.match(lab,/app\.app_key==='multiplication-ecrite-simple'\)url\.searchParams\.set\('requireConnect','1'\)/);
 assert.match(lab,/const href=app\.app_key==='multiplication-ecrite-simple'\?'\.\/apps\/multiplication-simple\/'/,
  'Le LAB doit lancer le moteur V7 certifié, pas l ancien hôte Objectif record');
 assert.match(lab,/SCHOOL_RECORD_LAUNCHER/,
  'les autres applications conservent leur routage existant');
 assert.match(launcher,/const requireConnect=query\.get\('requireConnect'\)==='1'/);
 assert.match(launcher,/!teacherPlayer&&!requireConnect&&localStorage\.getItem/);
 assert.match(launcher,/connectionCheckRequired\|\|teacherPlayer\|\|requireConnect/);
 assert.match(launcher,/Se connecter avec un élève fictif TEST/);
 assert.match(launcher,/if\(requireConnect\)\{/);
});

test('extended 120-question challenges support exact HARD 16 digits',()=>{
 const q={id:'q1',op:'mul',a:'9999999999999999',m:9,width:16};
 const data={...sample(q),mode:'hard-sudden',level:3,width:16,limit:120,
  questions:Array.from({length:120},(_,i)=>({...q,id:'q'+(i+1)}))};
 assert.equal(expectedMultiplicationWidth('hard-sudden',3),16);
 assert.equal(expectedMultiplicationWidth('three-lives',1),3);
 const accepted=acceptMultiplicationExtendedChallenge(data,3,'hard-sudden',[2,3,4,5,6,7,8,9]);
 assert.ok(accepted);
 const product=BigInt(q.a)*BigInt(q.m),digits=product.toString().split('').reverse();
 const carries=Array.from({length:16},(_,j)=>j===0?'':String(
  (BigInt(q.a)%(10n**BigInt(j))*BigInt(q.m))/(10n**BigInt(j))));
 const response={id:'q1',digits,carries};
 assert.equal(multiplicationAttemptCorrect(q,response),true);
 assert.equal(product.toString(),'89999999999999991');
 assert.equal(multiplicationEndState('hard-sudden',[response],data.questions).complete,false);
});
test('an error ends sudden immediately, but three-lives requires three errors',()=>{
 const q={id:'q1',op:'mul',a:'249',m:9,width:3};
 const questions=Array.from({length:120},(_,i)=>({...q,id:'q'+(i+1)}));
 const wrong=i=>({id:'q'+(i+1),digits:['0','0','0','0'],carries:['','','']});
 assert.deepEqual(multiplicationEndState('sudden',[wrong(0)],questions),{
  valid:true,complete:true,correct:0,wrong:1,lives:0});
 assert.equal(multiplicationEndState('three-lives',[wrong(0),wrong(1)],questions).complete,false);
 assert.equal(multiplicationEndState('three-lives',[wrong(0),wrong(1),wrong(2)],questions).complete,true);
 assert.equal(multiplicationEndState('hard-sudden',[wrong(0),wrong(1)],questions).valid,false);
});
test('no school can award old game-record without a server-issued multiplication proof',()=>{
 const results=repoFile('supabase/functions/connect-results/index.ts');
 const launcher=repoFile('apps/multiplication-simple/index.html');
 assert.match(results,/b\.appKey===addMulti\|\|b\.appKey===mul/);
 const proof=repoFile('apps/multiplication-simple/certified-classic.mjs');
 assert.match(proof,/start-extended-v1/);
 assert.match(launcher,/createNativeCertifiedMultiplication/);
 assert.match(launcher,/mathasMultiThreeLives/);
 assert.match(launcher,/mathas-multi-hard-three-lives/);
});
