import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {summarizeCompletedGames} from '../supabase/functions/connect-projection-v2/percentages.mjs';

const rows=[
 {class_id:'a',app_key:'addition',correct:7,attempted:10},
 {class_id:'a',app_key:'addition',correct:2,attempted:5},
 {class_id:'a',app_key:'multi',correct:4,attempted:5},
 {class_id:'b',app_key:'addition',correct:1,attempted:10},
 {class_id:'a',app_key:'multi',correct:11,attempted:10}, // invalide
 {class_id:'a',app_key:'addition',correct:0,attempted:0} // non commencé
];
test('Réussite = exercices justes / exercices tentés, jamais la moyenne des taux',()=>{
 const result=summarizeCompletedGames(rows,{classId:'a',appKeys:['addition','multi','sans-jeu'],globalKeys:['addition','multi']});
 assert.deepEqual(result.counts.addition,{correct:9,attempted:15});
 assert.deepEqual(result.counts.multi,{correct:4,attempted:5});
 assert.equal(result.apps.addition,60);
 assert.equal(result.apps.multi,80);
 assert.equal(result.apps['sans-jeu'],null,'Aucun jeu terminé ≠ 0 %');
 assert.equal(result.global,65,'13 réussis sur 20 tentés, pas 70 %');
});
test('Global n’inclut que les applications cochées ; une autre classe est isolée',()=>{
 const result=summarizeCompletedGames(rows,{classId:'a',appKeys:['addition','multi'],globalKeys:['multi']});
 assert.equal(result.global,80);
 const other=summarizeCompletedGames(rows,{classId:'b',appKeys:['addition','multi']});
 assert.equal(other.global,10);
});
test('Aucune donnée ne crée un pourcentage inventé',()=>{
 const result=summarizeCompletedGames([], {classId:'a',appKeys:['addition']});
 assert.equal(result.global,null);
 assert.equal(result.apps.addition,null);
});
test('Contrat SQL : service_role uniquement, agrégation par classe et app, hors Mort subite',()=>{
 const sql=readFileSync(new URL('../supabase/release-candidates/20261104_projection_completed_games_success_percentage.sql',import.meta.url),'utf8');
 assert.match(sql,/RETURNS TABLE\(class_id uuid, app_key text, correct bigint, attempted bigint\)/);
 assert.match(sql,/e\.class_id = ANY\(p_classes\)/);
 assert.match(sql,/SUM\(e\.game_score\)::bigint/);
 assert.match(sql,/SUM\(e\.game_total\)::bigint/);
 assert.match(sql,/e\.game_score BETWEEN 0 AND e\.game_total/);
 assert.match(sql,/lower\(e\.game_mode\) NOT IN/);
 assert.match(sql,/m\.left_at IS NULL/);
 assert.match(sql,/SECURITY INVOKER/);
 assert.match(sql,/REVOKE ALL ON FUNCTION[\s\S]*?FROM PUBLIC, anon, authenticated/);
 assert.match(sql,/GRANT EXECUTE ON FUNCTION[\s\S]*?TO service_role/);
});
test('L’API professeur utilise ce contrat sous authentification, en repli sûr',()=>{
 const src=readFileSync(new URL('../supabase/functions/connect-projection-v2/index.ts',import.meta.url),'utf8');
 assert.match(src,/connect_projection_completed_attempt_counts_v1/);
 assert.match(src,/summarizeCompletedGames/);
 assert.match(src,/percentageStatus:percentages\?'completed_games_only':'exercise_telemetry_not_yet_available'/);
 assert.match(src,/if\(!teacher\.length\|\|!principal\)return deny\('forbidden',403\)/);
});
