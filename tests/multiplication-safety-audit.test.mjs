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
test('Results include an event ID and a reset epoch; queue is durable locally',()=>{
 assert.match(launcher,/const eventId=crypto\.randomUUID\(\)/);
 assert.match(launcher,/expectedResetEpoch:resetEpoch/);
 assert.match(launcher,/localStorage\.setItem\(queueKey,JSON\.stringify\(q\)\)/);
 assert.match(launcher,/e\.expectedResetEpoch!==resetEpoch/);
 assert.match(launcher,/stale_reset_epoch/);
 assert.match(launcher,/revision_conflict/);
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
 assert.match(game,/MathasPilotBridge\?\.completed\?\.\(item\),750/);
 assert.match(launcher,/if\(q\.length>1000\)throw Error/);
});

test('Synchronization failures are shown and do not silently stop the queue',()=>{
 assert.match(launcher,/syncWarning='Synchronisation interrompue/);
 assert.match(launcher,/syncWarning='ATTENTION : sauvegarde locale impossible/);
 assert.match(launcher,/catch\(error\)\{syncWarning=/);
 assert.match(launcher,/window\.addEventListener\('online',\(\)=>/);
});
