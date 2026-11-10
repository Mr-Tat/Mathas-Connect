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


test('fin de séance : action fermée à la génération du professeur, sans déconnexion',()=>{
 const edge=source('supabase/functions/connect-guided-multiplication/index.ts');
 const ui=source('apps/multiplication-simple/collective-ui.mjs');
 const host=source('apps/multiplication-simple/index.html');
 const migration=source('supabase/migrations/20261110142000_guided_multiplication_host_presence.sql');
 assert.match(edge,/mayRenewGuidedHost/);
 assert.match(edge,/session_owned_by_other_page/);
 assert.match(edge,/b\.action==='resume'/);
 assert.match(edge,/close_requested_at/);
 assert.match(ui,/addEventListener\('pagehide'/);
 assert.match(ui,/if\(event\.persisted/);
 assert.match(ui,/addEventListener\('visibilitychange'/);
 assert.match(host,/keepalive:true/);
 assert.match(host,/action:'closing'/);
 assert.match(host,/authorization:'Bearer '\+guidedCloseToken/);
 assert.doesNotMatch(ui,/auth\.signOut|student-save|student-xp|connect_xp_credits/);
 assert.match(migration,/host_page_id uuid/);
});


test('le clavier natif ne contourne pas les pages obligatoires',()=>{
 const host=source('apps/multiplication-simple/index.html');
 assert.match(host,/mathasNativeHandlePrimary=handlePrimary/);
 assert.match(host,/handlePrimary=function/);
 assert.match(host,/MathasGuidedBridge\\?\\.onContinue/);
});
test('une page obligatoire se décide côté professeur sur une page déjà ouverte',()=>{
 const server=source('supabase/functions/connect-guided-multiplication/index.ts');
 const migration=source('supabase/migrations/20261110152500_guided_multiplication_pages_required.sql');
 const ui=source('apps/multiplication-simple/collective-ui.mjs');
 assert.match(server,/b\\.action==='set-required'/);
 assert.match(server,/b\\.action==='set-page'/);
 assert.match(server,/teacher_page_index/);
 assert.match(server,/required_pages/);
 assert.match(migration,/required_pages integer\\[\\]/);
 assert.match(ui,/canReachPage/);
 assert.match(ui,/resetSaved/);
 assert.doesNotMatch(ui,/Élève au tableau/);
});
