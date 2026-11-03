import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {PROFILE_REWARDS,AVATAR_LEVELS,avatarKindUnlocked,colorUnlocked,aliasUnlocked,
 officialInitial,unlockedProfileLevel} from '../profile-rewards.mjs';
import {avatarColor,avatarGlyph} from '../avatar-catalog.js';

const root=new URL('../',import.meta.url);
const get=path=>readFileSync(new URL(path,root),'utf8');

test('Les cinq récompenses se débloquent strictement aux niveaux 3, 6, 10, 15 et 20',()=>{
 assert.deepEqual(PROFILE_REWARDS.map(x=>[x.level,x.key]),[
  [3,'animal'],[6,'color'],[10,'alias'],[15,'object'],[20,'smiley']]);
 assert.equal(AVATAR_LEVELS.letter,1);
 for(const level of [1,2]){
  assert.equal(avatarKindUnlocked('animal',level),false);
  assert.equal(colorUnlocked(level),false);
  assert.equal(aliasUnlocked(level),false);
 }
 assert.equal(avatarKindUnlocked('animal',3),true);
 assert.equal(colorUnlocked(5),false);
 assert.equal(colorUnlocked(6),true);
 assert.equal(aliasUnlocked(9),false);
 assert.equal(aliasUnlocked(10),true);
 assert.equal(avatarKindUnlocked('object',14),false);
 assert.equal(avatarKindUnlocked('object',15),true);
 assert.equal(avatarKindUnlocked('smiley',19),false);
 assert.equal(avatarKindUnlocked('smiley',20),true);
});

test('L’initiale accentuée est conservée, le fond est transparent',()=>{
 assert.equal(officialInitial('  Élodie S  '),'É');
 assert.equal(officialInitial('   Martin P'),'M');
 assert.equal(avatarGlyph({kind:'letter',value:'É'}),'É');
 assert.equal(avatarColor('transparent'),'transparent');
 assert.equal(avatarColor('couleur-inconnue'),'transparent');
 assert.equal(unlockedProfileLevel({xp:{level:2},unlockLevel:3}),3);
});

test('Le serveur ignore les niveaux annoncés par les élèves et protège les profils',()=>{
 const api=get('supabase/functions/connect-api/index.ts');
 const edit=api.slice(api.indexOf("case 'student-avatar':{"),api.indexOf("case 'student-device-label':{"));
 assert.match(api,/const avatarMinLevel:Record<string,number>=\{letter:1,animal:3,object:15,smiley:20\}/);
 assert.match(api,/db\.rpc\('connect_xp_read_v2'/);
 assert.match(api,/connect_level_profiles/);
 assert.match(edit,/level<avatarMinLevel\[kind\]/);
 assert.match(edit,/level<6&&color!=='transparent'/);
 assert.match(edit,/initialFromName\(student\.display_name\)/);
 assert.match(edit,/if\(await readProfileUnlockLevel\(device\.student_id\)<10\)/);
 assert.match(edit,/public_alias:alias/);
 assert.match(edit,/eq\('auth_user_id',user\.id\)\.eq\('state','approved'\)/);
 assert.doesNotMatch(edit,/b\.level|b\.xp|b\.unlockLevel/);
});

test('L’inscription ne renvoie plus un ancien choix de l’élève',()=>{
 const entry=get('join-avatar.js'),app=get('app.js'),html=get('index.html');
 assert.match(entry,/editedJoinAvatar\(\)\{return null\}/);
 assert.match(entry,/clearJoinAvatarDraft\(\)/);
 assert.doesNotMatch(app,/await call\('student-avatar',choice\)/);
 assert.match(html,/première lettre de ton prénom/);
 assert.match(html,/Continuer vers le HUB/);
});

test('Sauvegarde protégée et réinitialisation strictement limitée aux élèves',()=>{
 const sql=get('supabase/release-candidates/20261103_profile_rewards_initials_v1.sql');
 assert.match(sql,/connect_private\.avatar_backup_20261103/);
 assert.match(sql,/NOT EXISTS\(SELECT 1 FROM public\.connect_teacher_players/);
 assert.match(sql,/avatar_value=upper\(left\(btrim\(s\.display_name\),1\)\)/);
 assert.match(sql,/avatar_color='transparent'/);
 assert.match(sql,/ALTER COLUMN avatar_color SET DEFAULT 'transparent'/);
 assert.match(sql,/CREATE TRIGGER connect_default_initial_avatar_v1/);
 assert.doesNotMatch(sql,/UPDATE public\.connect_xp_credits|DELETE FROM public\.connect_states|TRUNCATE/i);
});

test('Syntaxe des interfaces JS ES modules',()=>{
 for(const path of ['profile-rewards.mjs','avatar-catalog.js','hub.js','join-avatar.js','app.js']){
  const res=spawnSync(process.execPath,['--check','--input-type=module'],{input:get(path),encoding:'utf8'});
  assert.equal(res.status,0,path+': '+res.stderr);
 }
});
