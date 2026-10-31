import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const manifest=JSON.parse(read('apps/calculs-melanges/source-manifest.json'));
const game=read('apps/calculs-melanges/game-original.html');
test('original immutable source is traced, images copied identically; native V6 and teaching modes retained',()=>{
 assert.equal(createHash('sha256').update(game).digest('hex'),manifest.integratedIndexSha256);
 assert.equal(manifest.commit,'e11c88b4e449e8cdb17b0fee78c7daa6ea5bf279');assert.equal(manifest.indexBlob,'3d2ad6c8de9cdc67cd4464f4b43da2513d17c489');
 for(const file of ['illustration.webp','logo-m.png','logo-mot.webp'])assert.equal(createHash('sha256').update(readFileSync(new URL('../apps/calculs-melanges/'+file,import.meta.url))).digest('hex'),manifest.files[file]);
 for(const fragment of ['V6.0.2','"appId":"melange-calculs"','addBottom','takeTop',"mulMethod==='side'",'"1":3,"2":5,"3":7','"1":10,"2":12,"3":16'])assert.ok(game.includes(fragment),fragment);
 assert.match(game,/if\(mode==='challenge'\)return/);
 for(const script of game.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi))new vm.Script(script[1]);
});
test('compiled student release retains server activation and hidden catalogues',()=>{
 const bridge=read('apps/calculs-melanges/native-bridge.js'),host=read('apps/calculs-melanges/index.html'),scope=read('apps/calculs-melanges/storage-scope.js');
 assert.equal((game.match(/MathasMixedBridge\?\.finish/g)||[]).length,3);assert.equal((game.match(/MathasMixedBridge\?\.begin/g)||[]).length,2);
 assert.doesNotMatch(bridge,/setInterval|Storage\.prototype|fetch\(/);
 assert.match(scope,/mixcalc_\|mix_hard_\|mathas_/);
 assert.match(host,/e.source!==frame.contentWindow\|\|e.origin!==location.origin/);
 assert.match(read('apps/calculs-melanges/connect-pilot.mjs'),/CONNECT_WRITE_READY=true/);
 assert.match(read('supabase/functions/connect-results/index.ts'),/MIXED_SERVER_READY=true/);
 assert.ok(read('supabase/functions/connect-results/index.ts').includes("Deno.env.get('CONNECT_MIXED_ACCESS')??'open'"));
 assert.match(read('app.js'),/MIXED_TEACHER_READY=true/);
 assert.doesNotMatch(read('hub-catalog.json'),/melange-calculs-ecrits/);
});
test('candidate SQL adds only own functions, hidden presets, server proofs and isolated multipliers',()=>{
 const sql=read('supabase/release-candidates/calculs_melanges_locked_v1.sql');
 assert.doesNotMatch(sql,/CREATE OR REPLACE|UPDATE public.connect_(students|xp_credits)/i);
 assert.match(sql,/BEGIN;/);assert.match(sql,/COMMIT;/);assert.match(sql,/mixed_already_exists_review_required/);
 assert.match(sql,/connect_mixed_receipts/);assert.match(sql,/connect_mixed_multiplier_locks/);assert.match(sql,/p_master/);assert.match(sql,/invalid_proof/);
 assert.match(sql,/FROM PUBLIC,anon,authenticated/);assert.match(sql,/TO service_role/);
 const thumbnail=new URL('../assets/miniatures/melange-calculs-ecrits.webp',import.meta.url);assert.ok(statSync(thumbnail).size<200000);assert.equal(readFileSync(thumbnail).toString('ascii',8,12),'WEBP');
});
