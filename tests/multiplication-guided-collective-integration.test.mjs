import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('pont collectif strictement conditionnel Connect, moteur original préservé',()=>{
 const host=source('apps/multiplication-simple/index.html');
 const bridge=source('apps/multiplication-simple/collective-native-bridge.js');
 const native=source('apps/multiplication-simple/game-original.html');
 assert.match(host,/mode==='connected'[\s\S]*?collective-native-bridge\.js/);
 assert.match(host,/html\.split\(marker\)\.length!==2/);
 assert.match(native,/primaryBtn\.onclick=handlePrimary;/);
 assert.match(bridge,/startSession\('training'\)/);
 assert.match(bridge,/this\.active=false/);
 assert.doesNotMatch(bridge,/connect_xp|student-save|student-score|school_receipts/);
});
test('serveur : les élèves ne modifient pas la séance et ne transmettent aucune réponse',()=>{
 const edge=source('supabase/functions/connect-guided-multiplication/index.ts');
 const sql=source('supabase/migrations/20261110130000_guided_multiplication_classroom.sql');
 assert.match(edge,/user\.is_anonymous===true\)return fail\('teacher_only'/);
 assert.match(edge,/connect_class_permissions/);
 assert.match(edge,/connect_hub_preset_entries/);
 assert.doesNotMatch(edge,/connect_xp_credits|connect_projection_score_events|answers/);
 assert.match(sql,/enable row level security/);
 assert.match(sql,/revoke all.*anon,authenticated/);
});
