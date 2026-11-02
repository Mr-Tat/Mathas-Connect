import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const jobs=[
 ['addition-simple','essai-mode-score-3-vies.html','game-original.html'],
 ['addition-multiple','essai-objectif-record-3-vies.html','index.html'],
 ['soustraction','essai-objectif-record-3-vies.html','index.html'],
 ['multiplication','essai-objectif-record-3-vies.html','index.html'],
 ['melange','essai-objectif-record-3-vies.html','index.html']
];
test('les cinq moteurs d origine sont présents et lisibles sur le même domaine',()=>{
 const host=read('apps/objective-record/eleve.mjs');
 for(const [slug,wrapper,core] of jobs){
  const dir='apps/objective-record/engines/'+slug+'/';
  assert.ok(statSync(new URL('../'+dir+core,import.meta.url)).size>100000,slug);
  const s=read(dir+wrapper);
  assert.match(s,/MathasLabV2\.patch\(/);
  assert.match(s,/frame\.srcdoc=game/);
  assert.match(s,/lab-objectif-record-v2\.js/);
  assert.ok(s.includes("fetch('./"+core+"'"),slug);
  assert.ok(host.includes('./engines/'+slug+'/'+wrapper),slug);
 }
});
test('aucun moteur de la V finale ne dépend d un iframe externe',()=>{
 const host=read('apps/objective-record/eleve.mjs');
 assert.doesNotMatch(host,/https:\/\/mr-tat\.github\.io\/(?:CE-Addition-simple|addition-ecrite-multiple|soustraction-ecrite|Multiplication-simple|Melange-calculs-ecrits-1)\//);
 assert.match(host,/classId!==CLASS_TEST/);
 assert.doesNotMatch(host,/connect-record-pilot/);
});
