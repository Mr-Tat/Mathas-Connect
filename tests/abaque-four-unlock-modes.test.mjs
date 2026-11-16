import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createAbaqueHandler} from '../supabase/functions/connect-abaque/handler.mjs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const sql=read('supabase/migrations/20261116120000_abaque_four_classroom_unlock_modes.sql');
const html=read('apps/GRAN-abaque-m-1/index.html');
const hub=read('index.html');
const frontend=read('app.js');
const bootstrap=read('apps/GRAN-abaque-m-1/connect/bootstrap.mjs');
const actor='00000000-0000-4000-8000-000000000011';
const classroom='4bf3400d-a315-4ea4-a2f3-afaca24dc9b9';
const modes=['stage1_only','through_2','all_open','mastery_80'];
const request=(action,extra={})=>new Request('https://example.test',{method:'POST',
 headers:{authorization:'Bearer token'},body:JSON.stringify({action,appKey:'abaque-longueurs',classId:classroom,...extra})});
const auth=anonymous=>({auth:{getUser:async()=>({data:{user:{id:actor,is_anonymous:anonymous}}})}});

test('Quatre modes uniques par classe avec choix 80 % restaurable et aucun effacement',()=>{
 assert.match(sql,/ADD COLUMN IF NOT EXISTS unlock_mode text NOT NULL DEFAULT 'stage1_only'/);
 for(const mode of modes){
  assert.match(sql,new RegExp("'"+mode+"'"));
  assert.match(hub,new RegExp('name="abaque-unlock-mode" value="'+mode+'"'));
 }
 assert.equal((hub.match(/name="abaque-unlock-mode" value=/g)||[]).length,4);
 assert.doesNotMatch(hub,/id="abaque-class-gates-[23]"/);
 assert.match(sql,/WHERE class_id=p_class AND teacher_id=p_actor AND can_manage/);
 assert.match(sql,/REVOKE ALL ON FUNCTION public.connect_abaque_class_mode_set_v1\(uuid,uuid,text\) FROM PUBLIC,anon,authenticated/);
 assert.doesNotMatch(sql,/DELETE FROM|TRUNCATE|UPDATE public\.connect_states/);
 assert.match(hub,/puis remettre le défi des 80 % sans supprimer les résultats/);
});

test('Mode professeur autorise les activités, sous-niveaux progressifs, Master Connect interdit aux élèves',()=>{
 assert.match(html,/case 'stage1_only':teacherAllows=what==='stage1'/);
 assert.match(html,/case 'through_2':teacherAllows=what==='stage1'\|\|what==='stage2'/);
 assert.match(html,/case 'all_open':teacherAllows=true/);
 assert.match(html,/case 'mastery_80':return pedagogicalUnlock\(what\)/);
  assert.match(html,/progressiveUnlocked\(what\)/);
 assert.match(sql,/definition:=replace\(definition,original_fragment,new_fragment\)/);
 assert.match(sql,/unlock_mode FROM public\.connect_abaque_classes a WHERE a\.class_id=p_class AND a\.enabled\)=''mastery_80''/);
 assert.match(sql,/activity_2_allowed=p_mode IN \('through_2','all_open','mastery_80'\)/);
 assert.match(sql,/activity_3_allowed=p_mode IN \('all_open','mastery_80'\)/);
 assert.match(html,/if\(!snapshot\.activityAccess\?\.teacherFree\)\{master=false/);
 assert.match(html,/try\{sessionStorage\.removeItem\(SESSION\)\}/);
});

test('Droits connectés : validation stricte des modes et sélection par classe',()=>{
 for(const str of ['stage1_only','through_2','all_open','mastery_80']){
  assert.ok(bootstrap.includes(str),'client: '+str);
  assert.ok(html.includes(str),'jeu: '+str);
  assert.ok(frontend.includes(str),'prof: '+str);
 }
 assert.match(bootstrap,/value\.activityAccess\.unlockMode/);
 assert.match(html,/snapshot\.activityAccess\.unlockMode/);
 assert.match(frontend,/abaqueModeRequest\('teacher-mode-get',classId\)/);
 assert.match(frontend,/abaqueModeRequest\('teacher-mode-set',classId,\{mode\}\)/);
 assert.match(html,/connect\/bootstrap\.mjs\?v=20261116-guest-mode-v1/);
});

test('Le professeur peut lire et enregistrer les 4 modes ; un élève ou mode inconnu est refusé',async()=>{
 const calls=[];
 const db={rpc:async(name,args)=>{
  calls.push({name,args});
  return {data:{ok:true,mode:args.p_mode??'stage1_only'},error:null};
 }};
 const teacher=createAbaqueHandler({auth:auth(false),db,access:'open'});
 assert.equal((await teacher(request('teacher-mode-get'))).status,200);
 assert.equal(calls[0].name,'connect_abaque_class_mode_get_v1');
 for(const mode of modes){
  const response=await teacher(request('teacher-mode-set',{mode}));
  assert.equal(response.status,200,mode);
  assert.equal((await response.json()).mode,mode);
  assert.equal(calls.at(-1).name,'connect_abaque_class_mode_set_v1');
  assert.equal(calls.at(-1).args.p_mode,mode);
  assert.equal(calls.at(-1).args.p_class,classroom);
 }
 const before=calls.length;
 assert.equal((await teacher(request('teacher-mode-set',{mode:'open_everything_unsafe'}))).status,400);
 assert.equal(calls.length,before);
 const pupil=createAbaqueHandler({auth:auth(true),db,access:'open'});
 assert.equal((await pupil(request('teacher-mode-get'))).status,403);
 assert.equal((await pupil(request('teacher-mode-set',{mode:'all_open'}))).status,403);
 assert.equal(calls.length,before);
});

test('Mode de défi et mode libre gardent la même logique XP, coupes et reçus',()=>{
 assert.match(sql,/Keep the existing result judge and anti-double-credit logic in place/);
 assert.match(sql,/the 80% pedagogical lock applies only/i);
 assert.match(sql,/SELECT pg_get_functiondef\('public\.connect_abaque_record_v1/);
 assert.match(html,/recordStage\('stage2'/);
 assert.match(html,/recordMode\(selectedMode/);
 assert.match(sql,/connect_abaque_access_v1/);
});
