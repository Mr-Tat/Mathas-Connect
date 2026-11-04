import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const launcher=read('../apps/multiplication-simple/index.html');
const game=read('../apps/multiplication-simple/game-original.html');
const backend=read('../supabase/functions/connect-results/index.ts');
const migration=read('../supabase/migrations/20261028_multiplication_simple_xp_v1.sql');

test('Multiplication remains a distinct Connect app with a separate pending queue',()=>{
 assert.match(launcher,/APP='multiplication-ecrite-simple'/);
 assert.match(launcher,/mathas\.ce-multiplication\.connect\./);
 assert.match(launcher,/ce-multiplication\.pending\./);
 assert.doesNotMatch(launcher,/APP='addition-ecrite-simple'/);
});
test('The pedagogical guide and carry selectors are preserved',()=>{
 assert.match(game,/mathas-p120-guided-rail-js/);
 assert.match(game,/mathas-connect-arrows-v1/);
 assert.match(game,/#hardOperationCard/);
 assert.match(game,/\.side-carry-input:not\(:disabled\)/);
});
test('Certified result uses an issued session ID and a durable per-student queue',()=>{
 const certified=read('../apps/multiplication-simple/certified-classic.mjs');
 const edge=read('../supabase/functions/connect-multiplication-school/index.ts');
 assert.match(certified,/sessionId:challenge\.sessionId/);
 assert.match(certified,/resetEpoch/);
 assert.match(certified,/storage\.setItem\(key,JSON\.stringify/);
 assert.match(certified,/createCertifiedMultiplicationClassic/);
 assert.match(launcher,/createNativeCertifiedMultiplication/);
 assert.match(read('../apps/multiplication-simple/native-certified.mjs'),/finish-classic-v1/);
 assert.match(edge,/stale_reset_epoch/);
 assert.match(edge,/revision_conflict/);
 assert.doesNotMatch(launcher,/action:'game-record'/);
});
test('Server accepts both apps but keeps each state app-specific',()=>{
 assert.match(backend,/mul='multiplication-ecrite-simple'/);
 assert.match(backend,/selected!==app&&selected!==mul/);
 assert.match(backend,/p_app:b\.appKey/);
});
test('Parcours restart is scoped by student AND app; global XP survives',()=>{
 const restart=migration.slice(migration.indexOf('CREATE OR REPLACE FUNCTION public.connect_parcours_restart_one'));
 assert.match(restart,/where student_id=p_student and app_key=p_app/);
 assert.match(restart,/connect_xp_sync_v2\(p_student,p_app,false\)/);
 assert.match(restart,/connect_parcours_history/);
 assert.match(restart,/reset_epoch=connect_states\.reset_epoch\+1/);
});
test('Known follow-up risks remain explicitly visible until resolved',()=>{
 // This test documents current behaviour; it does not claim the risk is fixed.
 assert.match(game,/timer=setTimeout\(emit,750\)/);
 assert.match(launcher,/if\(q\.length>1000\)throw Error/);
});

test('Certified failures keep answers for an explicit retry, without client-generated XP',()=>{
 const certified=read('../apps/multiplication-simple/certified-classic.mjs');
 assert.match(certified,/queue\?\.save\(run,answers\)/);
 assert.match(certified,/Preuve conservée\. Clique/);
 assert.match(certified,/run\.finished=true/);
 assert.match(certified,/\?\s*'finish-classic-v1'\s*:\s*'finish-extended-v1'/);
 assert.match(launcher,/Anciens résultats non certifiés conservés/);
 assert.match(launcher,/student-load/);
});

test('Multiplication notifies Connect at most once, including page exit',()=>{
 assert.match(game,/function notifyConnectResult\(item\)/);
 assert.match(game,/if\(sent\)return/);
 assert.match(game,/window\.addEventListener\('pagehide',emit,\{once:true\}\)/);
 assert.match(game,/timer=setTimeout\(emit,750\)/);
 assert.equal((game.match(/notifyConnectResult\(item\);/g)||[]).length,3);
});
