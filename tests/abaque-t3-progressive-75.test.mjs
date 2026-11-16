import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const html=read('apps/GRAN-abaque-m-1/index.html');
const migration=read('supabase/migrations/20261116190500_abaque_t3_internal_75_percent_gates.sql')
 .replaceAll("''","'");

test('Le professeur ouvre l’activité 3, les scores internes à 75 % restent nécessaires',()=>{
 assert.match(html,/case 'all_open':teacherAllows=true/);
 assert.match(html,/return teacherAllows&&\(!\['one','three','five','sudden','lives'\]\.includes\(what\)\|\|progressiveUnlocked\(what\)\)/);
 for(const [kind,mode,total] of [['three','one',4],['five','three',12]]){
  assert.match(html,new RegExp("has75\\('"+mode+"',"+total+"\\)"),kind);
 }
 assert.match(html,/\[\['one',4\],\['three',12\],\['five',20\]\]\.every\(/);
 assert.match(html,/best\*4>=total\*3/);
 assert.match(html,/\['sudden','lives'\]\.includes\(what\)/);
 assert.match(html,/what==='stage2'&&passes\('stage1'\)>=2/);
 assert.match(html,/what==='stage3'&&passes\('stage2'\)>=2/);
 assert.match(html,/classActivityAccess\.teacherFree\)return true/);
 assert.match(html,/const grade=correct===total\?'green':correct\*4>=total\*3\?'orange':'red'/);
});

test('La migration valide les scores en production, y compris quand all_open est choisi',()=>{
 assert.ok(migration.includes("IN ('all_open','mastery_80')"));
 assert.ok(migration.includes("kind='three' AND NOT"));
 assert.ok(migration.includes("kind='five' AND NOT"));
 assert.ok(migration.includes("kind IN ('lives','sudden')"));
 for(const [mode,threshold] of [['one',3],['three',9],['five',15]]){
  assert.ok(migration.includes("{modeScores,"+mode+"}"),mode);
  assert.ok(migration.includes(">= "+threshold)||migration.includes(">="+threshold),mode+' '+threshold);
 }
 assert.match(migration,/\(scores->>kind\)::int\*4>=total\*3/);
 assert.match(migration,/kind='moves' AND jsonb_array_length/);
 assert.match(migration,/kind='one' AND jsonb_array_length/);
 assert.match(migration,/teacher_authorization_required|Autorisation professeur intacte/);
 assert.doesNotMatch(migration,/\b(?:DELETE FROM|DROP TABLE|TRUNCATE TABLE|UPDATE public\.connect_states)\b/);
});

test('Les champs longs et l’affichage compact sont cohérents avec 4, 12, 20 conversions',()=>{
 assert.match(html,/width:156px;flex:0 0 156px/);
 assert.match(html,/t3LongAnswer/);
 assert.match(html,/max-width:480px/);
 assert.match(html,/const scoreText=Number\.isInteger\(best\)\?\x60\$\{best\}\/\$\{total\}\x60:\x60\?\/\$\{total\}\x60/);
 assert.match(html,/const homeVisibleMode=m=>m==='sudden'\|\|unlocked\('stage3'\)/);
 assert.match(html,/Au moins 75 % en 1, 3 et 5 pages/);
});
