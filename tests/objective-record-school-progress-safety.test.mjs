import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {createExtendedQueue} from '../apps/objective-record/certified-extended.mjs';

const source=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('les deux additions utilisent les trophées certifiés dans le moteur natif, sans écraser le mode libre',()=>{
 for(const [slug,filename,mode,app] of [
  ['addition-simple','game-original.html','add','addition-ecrite-simple'],
  ['addition-multiple','index.html','multi','addition-ecrite-multiple']
 ]){
  const lab=source('apps/objective-record/engines/'+slug+'/lab-objectif-record-v2.js');
  const game=source('apps/objective-record/engines/'+slug+'/'+filename);
  const globals={window:{}};
  runInNewContext(lab,globals);
  const patched=globals.window.MathasLabV2.patch(game,mode);
  const at=patched.indexOf('function readTrophies(){');
  assert.ok(at>=0,slug);
  const override=patched.slice(at,at+850);
  assert.match(override,/window\.parent\.parent\.MathasConnectOfficialTrophies/);
  assert.ok(override.includes("official.appKey==='"+app+"'"));
  assert.match(override,/return JSON\.parse\(JSON\.stringify\(official\.rewards\)\)/);
  assert.match(override,/if\(school\)/);
  assert.match(override,/return freshTrophies\(\)/);
  assert.ok(override.indexOf('return freshTrophies()')<
    override.indexOf('const base=freshTrophies()'),slug);
  assert.match(patched,/window\.MathasPoints=\{parse,read,readTrophies,record,render/);
 }
});

test('sauvegarde de preuve : session et réponses conservées pendant la validité',()=>{
 const saved=new Map(),storage={
  getItem:k=>saved.get(k)??null,
  setItem:(k,v)=>{saved.set(k,v)},
  removeItem:k=>saved.delete(k)
 };
 const cfg={
  storage,studentId:'11111111-1111-4111-8111-111111111111',
  classId:'22222222-2222-4222-8222-222222222222',
  appKey:'addition-ecrite-simple',mode:'sudden',level:1
 };
 const queue=createExtendedQueue(cfg);
 const challenge={
  sessionId:'33333333-3333-4333-8333-333333333333',
  expiresAt:'2099-01-01T10:00:00Z'
 };
 const answers=[{id:'q1',digits:['1','2','3'],carries:['','','']}];
 assert.equal(queue.save(challenge,answers),true);
 const reloaded=createExtendedQueue(cfg).read();
 assert.equal(reloaded?.sessionId,challenge.sessionId);
 assert.deepEqual(reloaded?.answers,answers);
 assert.equal(createExtendedQueue({...cfg,studentId:'44444444-4444-4444-8444-444444444444'}).read(),null,
  'un autre élève ne doit jamais reprendre cette session');
});

test('API reprise : droits, identité, durée, version et validation de la sauvegarde',()=>{
 const edge=source('supabase/functions/connect-objective-record-school/index.ts');
 const browser=source('apps/objective-record/certified-extended-ui.mjs');
 assert.match(edge,/resume-extended-proof-v1/);
 assert.match(edge,/eq\('student_id',student\)/);
 assert.match(edge,/eq\('class_id',cls\)/);
 assert.match(edge,/eq\('app_key',b\.appKey\)/);
 assert.match(edge,/eq\('session_id',b\.sessionId\)/);
 assert.match(edge,/pending\.consumed_at/);
 assert.match(edge,/Date\.parse\(pending\.expires_at\)<=Date\.now\(\)/);
 assert.match(edge,/revision!==Number\(state\?\.revision\?\?0\)/);
 assert.match(edge,/epoch!==Number\(state\?\.reset_epoch\?\?0\)/);
 assert.ok(browser.indexOf("resume-extended-proof-v1")<
  browser.indexOf("start-extended-proof-v1"),'récupérer avant de créer une session');
 assert.match(browser,/window\.addEventListener\('beforeunload',warnWhilePlaying\)/);
 assert.match(browser,/les réponses restent sauvegardées/);
});

test('les correctifs sont en cache versionnée sans changer les règles de score',()=>{
 const host=source('apps/objective-record/eleve.mjs');
 const html=source('apps/objective-record/eleve.html');
 assert.match(host,/abandon-safe-render-v5/);
 assert.match(host,/resumable-school-v1/);
 assert.match(html,/certification-safe-v9/);
});
