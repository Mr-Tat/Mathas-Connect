import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {avatarAnimals,avatarObjects,avatarSmileys,avatarColors,avatarCategories} from '../avatar-catalog.js';
import {PROFILE_REWARDS} from '../profile-rewards.mjs';
import {eligibleCelebrations,CELEBRATION_DETAILS} from '../profile-celebration.mjs';

const root=new URL('../',import.meta.url);
const get=p=>readFileSync(new URL(p,root),'utf8');
test('Palettes complètes : 24 animaux, 24 objets, 24 smileys et 20 fonds, sans injures animales',()=>{
 for(const [name,set] of [['animal',avatarAnimals],['object',avatarObjects],['smiley',avatarSmileys]])
  assert.equal(Object.keys(set).length,24,name);
 assert.equal(Object.keys(avatarColors).length,20);
 assert.equal(avatarColors.transparent,'transparent');
 for(const bad of ['monkey','pig'])assert.equal(Object.hasOwn(avatarAnimals,bad),false);
 assert.equal(avatarCategories.find(c=>c.kind==='animal').icons,avatarAnimals);
 assert.equal(avatarCategories.find(c=>c.kind==='object').icons,avatarObjects);
 assert.equal(avatarCategories.find(c=>c.kind==='smiley').icons,avatarSmileys);
 const api=get('supabase/functions/connect-api/index.ts');
 for(const [varname,keys] of [['animals',avatarAnimals],['objects',avatarObjects],['smileys',avatarSmileys],['colors',avatarColors]]){
  const match=api.match(new RegExp('const '+varname+'=\\[([^\\n]+)\\];'));
  assert.ok(match,'server allowlist: '+varname);
  const actual=match[1].split(',').map(s=>s.trim().replaceAll("'",''));
  assert.deepEqual(actual,Object.keys(keys),'server/UI list must match exactly: '+varname);
 }
});
test('La géométrie fait réellement deux lignes sur écran large, avec repli mobile',()=>{
 const css=get('hub-profile.css');
 assert.match(css,/\.avatar-modal \.avatar-choices\{[^}]*grid-template-columns:repeat\(12,minmax\(0,1fr\)\)/s);
 assert.match(css,/\.avatar-modal \.avatar-colors\{[^}]*grid-template-columns:repeat\(10,minmax\(0,1fr\)\)/s);
 assert.match(css,/@media\(max-width:680px\)/);
 assert.match(css,/@media\(max-width:435px\)/);
});
test('La file des célébrations est triée, dédoublonnée et limitée aux vrais paliers atteints',()=>{
 assert.deepEqual(eligibleCelebrations([20,3,10,6,15,3,999,-1,2,'3',null],20),[3,6,10,15,20]);
 assert.deepEqual(eligibleCelebrations([20,3,15,6,10],6),[3,6]);
 assert.deepEqual(eligibleCelebrations([3,6,10],2),[]);
 assert.deepEqual(eligibleCelebrations(null,20),[]);
 assert.deepEqual(Object.keys(CELEBRATION_DETAILS),PROFILE_REWARDS.map(r=>r.key));
});
test('Sécurité des notifications : serveur vérifie appareil, classe, niveau et ACK idempotent',()=>{
 const api=get('supabase/functions/connect-api/index.ts');
 const sql=get('supabase/release-candidates/20261103_profile_reward_celebrations_v1.sql');
 const block=api.slice(api.indexOf("case 'student-reward-celebrate':{"),api.indexOf("case 'student-device-label':{"));
 assert.ok(block.length>500);
 for(const token of ["user.is_anonymous","eq('auth_user_id',user.id)","eq('state','approved')","is('revoked_at',null)","eq('class_id',b.classId)","is('left_at',null)","is('archived_at',null)","readProfileUnlockLevel(device.student_id)","level<b.level","ignoreDuplicates:true"])
  assert.ok(block.includes(token),'missing gate '+token);
 assert.doesNotMatch(block,/b\.studentId|b\.student_id|b\.unlockLevel|b\.xp|b\.teacherId/);
 assert.match(sql,/PRIMARY KEY \(student_id,reward_level\)/);
 assert.match(sql,/ENABLE ROW LEVEL SECURITY/);
 assert.match(sql,/REVOKE ALL .* FROM PUBLIC,anon,authenticated/);
 assert.doesNotMatch(sql,/UPDATE public\.connect_xp|DELETE FROM public\.connect_states/);
});
test('Le HUB revient avec les paliers serveur et jamais avec une animation dans les jeux',()=>{
 const hub=get('hub.js'),html=get('hub.html'),api=get('supabase/functions/connect-api/index.ts');
 assert.match(hub,/profileCelebrations\.receive\(profile\)/);
 assert.match(hub,/profileCelebrations\.reset\(\)/);
 assert.match(hub,/enabled:!playingAsTeacher/);
 assert.match(hub,/acknowledge:level=>saveProfileChange\('student-reward-celebrate'/);
 assert.match(api,/pendingProfileRewards/);
 assert.match(html,/id="reward-celebration"/);
 assert.match(html,/aria-modal="true"/);
 assert.match(html,/id="reward-customize"/);
 assert.match(html,/id="reward-later"/);
 const ctrl=get('profile-celebration.mjs');
 assert.match(ctrl,/praised\.add\(current\)/);
 assert.match(ctrl,/deferred\.add\(level\)/);
 assert.match(get('hub-profile.css'),/prefers-reduced-motion:reduce/);
});
test('Modules Javascript syntaxically correct',()=>{
 for(const path of ['avatar-catalog.js','profile-rewards.mjs','profile-celebration.mjs','hub.js']){
  const r=spawnSync(process.execPath,['--check','--input-type=module'],{input:get(path),encoding:'utf8'});
  assert.equal(r.status,0,path+': '+r.stderr);
 }
});
