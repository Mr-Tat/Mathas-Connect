import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const sql=read('supabase/migrations/20261116094000_abaque_projection_explicit_verified_scores.sql');
const api=read('supabase/functions/connect-projection-v2/index.ts');
const screen=read('projection-v2-live.js');
const bootstrap=read('apps/GRAN-abaque-m-1/connect/bootstrap.mjs');
const share=read('apps/GRAN-abaque-m-1/connect/projection-share.mjs');

test('L’Abaque est un sixième classement, sans faux pourcentages et sans perdre les cinq jeux',()=>{
 for(const key of ['addition-ecrite-simple','multiplication-ecrite-simple','soustraction-ecrite-simple',
  'addition-ecrite-multiple','melange-calculs-ecrits','abaque-longueurs']){
  assert.ok(api.includes(key),key);assert.ok(screen.includes(key),key);
 }
 assert.match(screen,/MAX_VISIBLE_APPS=3/);
 assert.match(api,/const percentageKeys=keys\.filter\(k=>k!=='abaque-longueurs'\)/);
 assert.match(screen,/const percentageKeys=allKeys\.filter\(k=>k!=='abaque-longueurs'\)/);
 assert.match(screen,/field==='percentageApps'&&app\.key==='abaque-longueurs'/);
 assert.match(api,/connect_projection_abaque_summary_v1/);
 assert.match(api,/connect_projection_abaque_share_v1/);
});
test('Aucun score non consenti : seulement un reçu arithmétique serveur, dans la classe et le parcours',()=>{
 assert.match(sql,/connect_abaque_receipts/);
 assert.match(sql,/reset_epoch=v_epoch/);
 assert.match(sql,/v_receipt\.judgement->>'eligible' IS DISTINCT FROM 'true'/);
 assert.match(sql,/v_kind NOT IN \('one','three','five','lives','sudden'\)/);
 assert.match(sql,/connect_enrollments/);
 assert.match(sql,/connect_teacher_players/);
 assert.match(sql,/connect_projection_score_consents/);
 assert.match(sql,/connect_projection_score_events/);
 assert.match(sql,/not_improved/);
 assert.match(sql,/score_reset/);
 assert.match(sql,/FOR UPDATE/);
 assert.match(sql,/REVOKE ALL ON FUNCTION public\.connect_projection_abaque_share_v1/);
 assert.doesNotMatch(sql,/DELETE FROM|TRUNCATE TABLE|DROP TABLE/);
});
test('Consentement : dialogue grand écran Oui/Non, même apparence, jamais automatique',()=>{
 assert.match(share,/Envoyer ton score au tableau/);
 assert.match(share,/yes\.id='abaque-share-yes'/);
 assert.match(share,/no\.id='abaque-share-no'/);
 assert.match(share,/actions\.append\(yes,no\)/);
 assert.match(share,/dialog\.showModal\(\)/);
 assert.match(share,/no\.onclick=close/);
 assert.match(share,/yes\.onclick=/);
 assert.match(share,/if\(acked\.has\(event\.eventId\)\)void publish/);
 assert.match(share,/async function publish\(id\)/);
 assert.match(share,/result\?\.ok===true/);
 assert.match(share,/Score envoyé au tableau/);
 assert.match(bootstrap,/projectionShare\.offer\(event\)/);
 assert.match(bootstrap,/projectionShare\.ack\(event\)/);
 assert.match(bootstrap,/projectionShare\.flush\(\)/);
});
