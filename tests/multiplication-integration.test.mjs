import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import {Script} from 'node:vm';
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const engine=read('../apps/multiplication-simple/game-original.html');
const launcher=read('../apps/multiplication-simple/index.html');
test('engine and all local images are independent of old Multiplication website',()=>{
 for(const name of ['logo-m.png','logo-mot.webp','illustration.webp']){
  assert.ok(statSync(new URL('../apps/multiplication-simple/'+name,import.meta.url)).size>1000);
  assert.ok(engine.includes('./'+name));
 }
 assert.ok(!launcher.includes('https://mr-tat.github.io/Multiplication-simple/'));
});
test('classic launcher stores data separately from original Multiplication',()=>{
 assert.ok(launcher.includes('mathas.ce-multiplication.libre.v1:'));
 assert.ok(launcher.includes('/^(multi1_|mathas_)/'));
 assert.ok(!launcher.includes('connect-results'));
 assert.ok(!launcher.includes('game-record'));
});
test('guide layout remains present and arrow navigation is installed',()=>{
 for(const token of ['mathas-connect-arrows-v1','getBoundingClientRect','mathas-p120-guided-rail-js','mathas-hint-overlay'])
  assert.ok(engine.includes(token),token);
});
test('all inline engine scripts parse',()=>{
 const scripts=[...engine.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
 assert.ok(scripts.length>=30);
 for(const [i,m] of scripts.entries())assert.doesNotThrow(()=>new Script(m[1],{filename:'multiplication-'+i+'.js'}));
});
test('multiplication has its own score keys and did not inherit Addition',()=>{
 assert.ok(engine.includes('"appId":"multiplication-simple"'));
 assert.ok(engine.includes('"lastWork":"multi1_last_work"'));
 assert.ok(!engine.includes('"appId":"addition-simple"'));
});
