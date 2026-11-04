import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 validMultipliers,acceptMultiplicationChallenge,normalizeMultiplicationAttempt,
 createMultiplicationQueue
} from '../certified-multiplication.mjs';

const sample=()=>({
 ok:true,sessionId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 revision:0,resetEpoch:0,level:1,total:4,expiresAt:'2099-01-01T00:00:00.000Z',
 questions:[
  {id:'q1',op:'mul',a:'345',m:8,width:3},
  {id:'q2',op:'mul',a:'56',m:9,width:2},
  {id:'q3',op:'mul',a:'789',m:7,width:3},
  {id:'q4',op:'mul',a:'47',m:5,width:2}
 ]
});
test('le défi de multiplication certifiée doit être signé et dans le barème des niveaux',()=>{
 const challenge=acceptMultiplicationChallenge(sample());
 assert.equal(challenge?.questions.length,4);
 const bad=sample();bad.questions[0].m=10;
 assert.equal(acceptMultiplicationChallenge(bad),null);
 bad.questions[0].m=8;bad.questions[0].width=7;
 assert.equal(acceptMultiplicationChallenge(bad),null);
 bad.questions[0].width=3;bad.expiresAt='invalide';
 assert.equal(acceptMultiplicationChallenge(bad),null);
 assert.equal(validMultipliers([2,3,7,9]),true);
 assert.equal(validMultipliers([3,3]),false);
 assert.equal(validMultipliers([1,2]),false);
 assert.equal(validMultipliers([]),false);
});
test('la première réponse conserve le format exact chiffre par chiffre et report',()=>{
 const question=sample().questions[0];
 const attempt={id:'q1',digits:['0','6','7','2'],carries:['','4','3']};
 assert.deepEqual(normalizeMultiplicationAttempt(attempt,question),attempt);
 assert.equal(normalizeMultiplicationAttempt({...attempt,id:'q2'},question),null);
 assert.equal(normalizeMultiplicationAttempt({...attempt,digits:['0','6']},question),null);
 assert.equal(normalizeMultiplicationAttempt({...attempt,carries:['','9','3']},question),null);
 assert.equal(normalizeMultiplicationAttempt({...attempt,carries:['4','4','3']},question),null);
});
test('le brouillon certifié est strictement lié à un joueur, une classe et une session',()=>{
 const entries=new Map(),storage={
  getItem:key=>entries.get(key)??null,
  setItem:(key,value)=>entries.set(key,value),
  removeItem:key=>entries.delete(key)
 };
 const queue=createMultiplicationQueue({storage,
  studentId:sample().sessionId,classId:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'});
 assert.ok(queue);
 const proof=acceptMultiplicationChallenge(sample());
 const answer={id:'q1',digits:['0','6','7','2'],carries:['','4','3']};
 assert.equal(queue.save(proof,[answer]),true);
 assert.deepEqual(queue.read()?.answers,[answer]);
 queue.clear();assert.equal(queue.read(),null);
 assert.equal(createMultiplicationQueue({storage,studentId:'faux',classId:sample().sessionId}),null);
});
test('le raccordement TEST ne contourne pas le verrou des vraies classes ni le score natif',()=>{
 const host=readFileSync(new URL('../eleve.mjs',import.meta.url),'utf8');
 assert.match(host,/classId!==CLASS_TEST&&!SERVER_PROOF_ADDITIONS\.has\(activeApp\)/);
 assert.match(host,/const SERVER_PROOF_APPS=new Set\(\[\.\.\.SERVER_PROOF_ADDITIONS,MULTIPLICATION_PROOF_APP\]\)/);
 assert.match(host,/connect-multiplication-school/);
 const ui=readFileSync(new URL('../certified-multiplication-ui.mjs',import.meta.url),'utf8');
 assert.match(ui,/ctx\.classId!==TEST_CLASS/);
 assert.match(ui,/ack\?\.proofVerified!==true/);
 assert.match(ui,/normalizeMultiplicationAttempt/);
});
test('le moteur conserve ses réglages natifs et la preuve de première réponse',()=>{
 const native=readFileSync(new URL('../engines/multiplication/index.html',import.meta.url),'utf8');
 for(const selector of ['id="multiplierPicker"','id="tensFirstToggle"','name="carryMethod"'])
  assert.ok(native.includes(selector),selector);
 assert.match(native,/__mathasServerCertifiedMul/);
 assert.match(native,/MathasCertifiedMulAttempt/);
 assert.match(native,/MathasCertifiedMulFinished/);
 assert.match(native,/certifiedConnect\(\)/);
 const wrap=readFileSync(new URL('../engines/multiplication/essai-objectif-record-3-vies.html',import.meta.url),'utf8');
 assert.match(wrap,/embeddedConnect/);
 assert.match(wrap,/multiplication-controls-relief/);
});
