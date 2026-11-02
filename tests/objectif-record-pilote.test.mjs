import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const sql=read('supabase/migrations/20261102134600_objectif_record_pilot_lab_only.sql');
const edge=read('supabase/functions/connect-record-pilot/index.ts');
const pilot=read('essais/objectif-record-pilote.js');
const html=read('essais/objectif-record-pilote.html');
test('le pilote ne peut toucher aucun credit ni resultat de production',()=>{
  assert.match(sql,/class_id\s*=\s*'4bf3400d-a315-4ea4-a2f3-afaca24dc9b9'/);
  assert.match(sql,/enable row level security/i);
  assert.match(sql,/revoke all.+from public, anon, authenticated/i);
  assert.match(sql,/grant select,insert,update.+to service_role/i);
  assert.doesNotMatch(sql,/^\s*(?:truncate|drop|delete)\s/mi);
  assert.doesNotMatch(edge,/\.from\(['"]connect_xp_credits['"]\)|\.from\(['"]connect_states['"]\)|\.from\(['"]connect_trophy_achievements['"]\)/);
  assert.match(edge,/connect_record_pilot_states/g);
  assert.match(edge,/b\?\.classId!==TEST/);
  assert.match(edge,/auth\.auth\.getUser\(token\)/);
  assert.match(edge,/\.eq\('state','approved'\)/);
  assert.match(edge,/\.eq\('class_id',TEST\)/);
});
test('idempotence atomique, jalons demi-plein et limites de preuve',()=>{
  assert.match(edge,/\.eq\('revision',revision\)/);
  assert.match(edge,/\.some\(e=>e\.id===g\.eventId\)/);
  assert.match(edge,/Math\.max\(old,ceiling\)/);
  assert.match(edge,/g\.mode==='three-lives'\?\.5:1/);
  assert.match(edge,/awards\[key\]/);
  assert.match(edge,/if\(g\.total===4&&g\.score===4\)/);
  assert.match(edge,/g\.score>=8/);
  assert.match(edge,/g\.score>=16/);
  assert.match(edge,/!uuid\(b\.eventId\)/);
});
test('cinq moteurs, memes pilotes et interface de bilan',()=>{
  for(const key of ['addition-simple','addition-multiple','soustraction','multiplication','melange'])
    assert.ok(pilot.includes("'"+key+"'"),key);
  assert.match(pilot,/connect-record-pilot/);
  assert.match(pilot,/crypto\.randomUUID\(\)/);
  assert.match(pilot,/\.addEventListener\('change'/);
  assert.match(pilot,/MathasLabV2Update/);
  assert.match(pilot,/classId:TEST/);
  assert.match(html,/id="xp"/);
  assert.match(html,/id="best"/);
  assert.match(html,/id="trophies"/);
});

test('les cinq boutons affichent uniquement les XP restants confirmes par le serveur',()=>{
 assert.match(pilot,/function renderRights\(doc\)/);
 assert.match(pilot,/pilotRights=d\.rights\?\?null/);
 assert.match(pilot,/rights\?\.classic\?\.\[amount\]\?\?null/);
 assert.match(pilot,/rights\?\.threeLives\?\?null/);
 assert.match(pilot,/rights\?\.sudden\?\?null/);
 assert.match(pilot,/indicator\?\.remove\(\)/);
 assert.match(pilot,/pilotRights=null;/);
 assert.match(pilot,/renderRights\(doc\)/);
 assert.match(pilot,/querySelectorAll\('#menuScreen \.mathas-pilot-remaining'\)/);
 assert.match(pilot,/const matches=\[\.\.\.button\.querySelectorAll\(':scope > \.classic-xp-remaining'\)\]/);
 assert.match(pilot,/const matches=\[\.\.\.meta\.querySelectorAll\('\.score-mode-detail'\)\]/);
 assert.doesNotMatch(pilot,/line\.className='mathas-pilot-remaining'/);
 assert.doesNotMatch(pilot,/window\.MathasPilotState\.rights\|\|/);
});
test('les fins 3 vies livrent un motif de fin et le serveur refuse les parties interrompues',()=>{
 assert.match(pilot,/phase:d\.phase,hearts:d\.hearts,completed:d\.completed/);
 assert.match(edge,/b\.mode\.endsWith\('three-lives'\)/);
 assert.match(edge,/b\.phase!=='ended'\|\|b\.hearts!==0/);
 assert.match(edge,/b\.completed<b\.score\+3/);
});

test('la lecture professeur des resultats pilotes est strictement autorisee et cantonnée a TEST',()=>{
 const edge=read('supabase/functions/connect-record-pilot/index.ts');
 const lab=read('laboratoire.js'),html=read('laboratoire.html');
 assert.match(edge,/b\.action==='teacher-summary'/);
 assert.match(edge,/user\.is_anonymous\)return err\('teacher_required',403\)/);
 assert.match(edge,/\.eq\('teacher_id',user\.id\)\.eq\('class_id',TEST\)/);
 assert.match(edge,/permission\.can_view_results!==true&&permission\.can_manage!==true/);
 assert.match(edge,/\.eq\('class_id',TEST\)\.eq\('app_key',b\.appKey\)/);
 assert.match(edge,/\.is\('left_at',null\)/);
 assert.doesNotMatch(edge,/\.from\(['"]connect_xp_credits['"]\)/);
 assert.match(lab,/guard\(\);\s*const appKey=\$\('pilot-results-app'\)/);
 assert.match(lab,/rpc\('connect-record-pilot','teacher-summary'/);
 assert.match(html,/id="pilot-results-refresh"/);
 assert.match(html,/id="pilot-results-app"/);
 assert.match(html,/id="pilot-results"/);
});
