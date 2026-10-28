import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
const src=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const game=src('../apps/multiplication-simple/game-original.html');
const launcher=src('../apps/multiplication-simple/index.html');
const backend=src('../supabase/functions/connect-results/index.ts');
const migration=src('../supabase/migrations/20261028_multiplication_simple_xp_v1.sql');
test('shared client has separate identities and all the XP UI',()=>{
 assert.match(launcher,/APP='multiplication-ecrite-simple'/);
 assert.match(launcher,/mathas.ce-multiplication.connect/);
 assert.match(launcher,/ce-multiplication.pending/);
 assert.match(launcher,/ce-xp-meter/);
 assert.match(launcher,/xp-details/);
 assert.doesNotMatch(launcher,/APP='addition-ecrite-simple'/);
});
test('results hook exists for classic, sudden and both HARD modes',()=>{
 assert.ok(game.includes('window.parent.MathasPilotBridge?.completed?.(item)'));
 assert.ok(game.split('window.parent.MathasPilotBridge?.completed?.(item)').length===4);
});
test('server authorizes only explicit apps and reads XP for the requested one',()=>{
 assert.match(backend,/mul='multiplication-ecrite-simple'/);
 assert.match(backend,/p_app:b.appKey,p_include_milestones:true/);
 assert.match(backend,/selected!==app&&selected!==mul/);
 assert.match(migration,/multiplication-ecrite-simple/);
 assert.match(migration,/connect_xp_award_rules/);
});
test('all embedded scripts compile and keyboard guides remain',()=>{
 const scripts=[...game.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
 assert.ok(scripts.length>=30);
 for(const [i,chunk] of scripts.entries())assert.doesNotThrow(()=>new Script(chunk[1],{filename:'game-'+i}));
 assert.match(game,/mathas-connect-arrows-v1/);
 assert.match(game,/mathas-p120-guided-rail-js/);
});
