import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mixedRemainingXp} from '../apps/calculs-melanges/official-ui.mjs';
import {normalizeCompletion} from '../apps/calculs-melanges/completion-contract.mjs';
import {applyCompletion,empty} from '../apps/calculs-melanges/records.mjs';
import {milestones,MAX_XP} from '../apps/calculs-melanges/xp-model.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const proof=(mode,level=1,score=10,ops=['add','sub','mul'])=>({
 schemaVersion:1,appKey:'melange-calculs-ecrits',eventId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 mode,level,score,total:null,operationsSelectedAtStart:ops,
 operationsCompleted:Array(score+3).fill('add'),
 firstTry:[...Array(score).fill(true),false,false,false],
 aidUsed:false,masterMode:false,expectedRevision:0,expectedResetEpoch:0
});
test('Mélange connecté : 40 XP Mort subite, 20 XP trois vies, même proportion 1/2/3 opérations',()=>{
 assert.equal(MAX_XP,690);
 for(const [ops,normal,lives] of [[3,40,20],[2,20,10],[1,10,6]]){
  assert.equal(mixedRemainingXp(empty(),'sudden',1,0,ops),normal);
  assert.equal(mixedRemainingXp(empty(),'three-lives',1,0,ops),lives);
 }
 assert.equal(mixedRemainingXp(empty(),'hard-sudden',2),40);
 assert.equal(mixedRemainingXp(empty(),'hard-three-lives',2),20);
});
test('Trois erreurs sont requises, le dernier calcul doit être incorrect',()=>{
 const v=normalizeCompletion(proof('three-lives'));
 assert.ok(v);
 assert.equal(normalizeCompletion({...proof('three-lives'),firstTry:Array(13).fill(true)}),null);
 assert.equal(normalizeCompletion({...proof('three-lives'),firstTry:[...Array(10).fill(true),false,false,true]}),null);
 assert.ok(normalizeCompletion(proof('hard-three-lives')));
 assert.equal(normalizeCompletion(proof('hard-three-lives',1,10,['add'])),null);
});
test('Le palier gagné en trois vies est complété, jamais doublé, par Mort subite',()=>{
 let state=applyCompletion(empty(),normalizeCompletion(proof('three-lives')));
 assert.equal(milestones(state).xp,20);
 assert.equal(state.sudden[0],0);
 assert.equal(mixedRemainingXp(state,'three-lives',1),0);
 assert.equal(mixedRemainingXp(state,'sudden',1),20);
 const sudden={...proof('sudden'),operationsCompleted:Array(10).fill('add'),firstTry:Array(10).fill(true)};
 state=applyCompletion(state,normalizeCompletion(sudden));
 assert.equal(milestones(state).xp,40);
 assert.equal(mixedRemainingXp(state,'sudden',1),0);
});
test('Le moteur partage les mêmes conditions 80% et deux boutons côte à côte',()=>{
 const engine=read('apps/calculs-melanges/game-original.html');
 assert.match(engine,/id="mixedThreeLives"/);
 assert.match(engine,/class="mathas-mixed-survival-pair"/);
 assert.match(engine,/threeLivesBtn\.disabled=locked/);
 assert.match(engine,/MathasMixedBridge\?\.miss\(session,states\[i\]\)/);
 assert.match(engine,/MathasMixedBridge\?\.miss\(hardSession,hardState\)/);
 assert.match(engine,/hard-three-lives/);
 assert.match(engine,/Voir les défis/);
 const bridge=read('apps/calculs-melanges/native-bridge.js');
 assert.match(bridge,/miss\(s,calc\)/);
 assert.match(bridge,/hard-three-lives/);
});
test('XP serveur et verrouillés par niveau, sans ouverture d’une version élève de production',()=>{
 const sql=read('supabase/migrations/20261106083000_mixed_school_survival_three_lives_xp_v4.sql');
 const edge=read('supabase/functions/connect-results/index.ts');
 assert.match(sql,/school_mode_locked/);
 assert.match(sql,/p_mode IN \('sudden','three-lives'\)/);
 assert.match(sql,/p_first->-1 IS DISTINCT FROM 'false'/);
 assert.match(sql,/life_points:=greatest/);
 assert.match(sql,/afterxp>690/);
 assert.match(edge,/\['classic','sudden','hard','three-lives','hard-three-lives'\]/);
 const hub=read('hub.js');
 assert.match(hub,/const LAB_CLASS='4bf3400d-a315-4ea4-a2f3-afaca24dc9b9'/);
});

test('Projection Mélange : bouton Top du jour lié aux ACK certifiés et RPC atomiques',()=>{
 const host=read('apps/calculs-melanges/index.html');
 const ui=read('apps/calculs-melanges/official-ui.mjs');
 const edge=read('supabase/functions/connect-projection-v2/index.ts');
 const sql=read('supabase/migrations/20261106083500_mixed_certified_projection_shared_score_v1.sql');
 assert.match(host,/onShare:eventId=>consent\?\.offer\(eventId\)/);
 assert.doesNotMatch(host,/if\(status==='pending'&&reply\?\.eventId\)consent\?\.offer/);
 assert.match(ui,/share\.textContent='Proposer ce score ›'/);
 assert.match(ui,/lastShareId/);
 assert.match(sql,/connect_mixed_receipts/);
 assert.match(sql,/FOR UPDATE/);
 assert.match(edge,/connect_projection_mixed_share_improved_v1/);
 assert.match(edge,/connect_projection_mixed_verified_summary_v1/);
});
test('Les scores trois vies alimentent le TOP mais pas les trophées Mort subite',()=>{
 const engine=read('apps/calculs-melanges/game-original.html');
 assert.match(engine,/const sudden=\/mort subite\/i\.test\(label\),lives=\/3 vies\/i\.test\(label\)/);
 assert.match(engine,/if\(sudden\|\|lives\)/);
 assert.match(engine,/if\(points\.sudden&&!points\.hard&&points\.correct>=25\)/);
 assert.match(read('supabase/migrations/20261106083400_mixed_certified_projection_game_points.sql'),/v_game_points/);
});

test('Toutes → Tests lance bien le Mélange officiel, jamais le vieux pilot',()=>{
 const hub=read('hub.js');
 const host=read('apps/calculs-melanges/index.html');
 assert.match(hub,/const testMixed=classId===LAB_CLASS&&app\.app_key==='melange-calculs-ecrits'/);
 assert.match(hub,/testMixed\?'\.\/apps\/calculs-melanges\/'/);
 assert.match(hub,/\(testMultiplication\|\|testMixed\).*requireConnect/);
 assert.match(host,/const requireConnect=launch\.get\('requireConnect'\)==='1'/);
 assert.match(host,/!teacherPlayer&&!requireConnect&&localStorage/);
 assert.doesNotMatch(read('hub-catalog.json'),/melange-calculs-ecrits/);
});

// Les détails de l’interface Connect ne doivent pas réintroduire l’ancienne bande rétractable.
test('Mélange TEST : la bande ancienne reste cachée et le niveau/XP s’affichent dans le jeu',()=>{
 const host=read('apps/calculs-melanges/index.html');
 const ui=read('apps/calculs-melanges/official-ui.mjs');
 assert.match(host,/<div class="notice" hidden>/);
 assert.match(host,/if\(connected&&officialUi&&!blockedSession&&connected\.pending\(\)<100\)/);
 assert.match(host,/frame\.contentDocument\?\.getElementById\('mathasMixedXp'\)/);
 assert.match(host,/if\(!connected\)document\.querySelector\('\.notice'\)\.hidden=false/);
 assert.match(ui,/Niveau '\+accountLevel/);
 assert.match(ui,/totalXp<300\?Math\.floor\(totalXp\/50\)\+1/);
});

test('Mélange Connect : historique Top 3, compteur stable et détails XP alimentés par serveur',()=>{
 const host=read('apps/calculs-melanges/index.html');
 const ui=read('apps/calculs-melanges/official-ui.mjs');
 assert.match(host,/refreshOfficialHistory/);
 assert.match(host,/verifiedHistory=history/);
 assert.match(host,/officialUi\?\.update\(\{history:verifiedHistory/);
 assert.match(ui,/renderCertifiedHistoricalPodium\(doc,currentHistory\)/);
 assert.match(ui,/mathasMixedXpDetails/);
 assert.match(ui,/mathas-xp-action-detail/);
 assert.match(ui,/177px/);
 assert.match(ui,/MAX_XP/);
});
