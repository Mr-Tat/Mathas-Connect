import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createAbaqueHandler} from '../supabase/functions/connect-abaque/handler.mjs';
const file=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const sql=file('supabase/migrations/20261116100000_abaque_prof_class_gates_top_two.sql');
const html=file('apps/GRAN-abaque-m-1/index.html');
const ui=file('index.html');
const teacher=file('app.js');
const bootstrap=file('apps/GRAN-abaque-m-1/connect/bootstrap.mjs');
const classroom='4bf3400d-a315-4ea4-a2f3-afaca24dc9b9';
const actor='00000000-0000-4000-8000-000000000011';

test('Deux seules cases de classe et droits sauvegardés via RPC professeur',()=>{
 assert.match(ui,/id="abaque-class-gates-2"/);
 assert.match(ui,/id="abaque-class-gates-3"/);
 assert.doesNotMatch(ui,/id="abaque-class-gates-[1456]"/);
 assert.match(teacher,/teacher-activity-get/);
 assert.match(teacher,/teacher-activity-set/);
 assert.match(teacher,/void abaqueGatesLoad\(\)/);
 assert.match(sql,/activity_2_allowed boolean NOT NULL DEFAULT false/);
 assert.match(sql,/activity_3_allowed boolean NOT NULL DEFAULT false/);
 assert.match(sql,/connect_class_permissions[\s\S]*?teacher_id=p_actor AND can_manage/);
 assert.match(sql,/REVOKE ALL ON FUNCTION public.connect_abaque_class_gates_set_v1[^\n]+ FROM PUBLIC,anon,authenticated/);
});

test('Le serveur interdit 2 et tout 3, master professeur débloqué sans offrir XP',()=>{
 assert.match(sql,/kind='moves' AND NOT \(SELECT a.activity_2_allowed/);
 assert.match(sql,/kind IN \('one','three','five','lives','sudden'\) AND NOT \(SELECT a.activity_3_allowed/);
 assert.match(sql,/RAISE EXCEPTION 'teacher_authorization_required'/);
 assert.match(sql,/IF NOT p_teacher AND \(\(kind='moves'/);
 assert.match(sql,/IF kind='one' AND first_good=4 THEN PERFORM public.connect_abaque_award_v1/);
 assert.match(html,/classActivityAccess.teacherFree\|\|pedagogicalUnlock/);
 assert.match(bootstrap,/snapshot.activityAccess.teacherFree/);
 assert.match(bootstrap,/Actualiser les autorisations/);
});

test('Top 2 durable, sans toucher aux deux seuils de progression, preuves distinctes pour les coupes',()=>{
 assert.match(sql,/jsonb_build_object\('topScores',grades\)/);
 assert.match(sql,/UNION ALL SELECT first_good::integer/);
 assert.match(sql,/ORDER BY value DESC LIMIT 2/);
 assert.match(sql,/count_passes<2/);
 assert.match(sql,/receipt.event_id|receipt.reset_epoch=p_epoch/);
 assert.match(sql,/connect_abaque_receipts r[\s\S]*?r.reset_epoch=s.reset_epoch/);
 assert.match(html,/captionText.textContent='Meilleurs scores'/);
 assert.match(html,/topScores=\[\.\.\.top\.filter\(Number.isSafeInteger\),correct\]/);
});

test('Autorisations : élève refusé et réponses liées au compte professeur',async()=>{
 const requests=[],auth={auth:{getUser:async()=>({data:{user:{id:actor,is_anonymous:false}}})}};
 const db={rpc:async(name,args)=>{requests.push({name,args});return {data:{ok:true,activity2:false,activity3:false},error:null};}};
 const request=(action,data={},token='fake')=>new Request('https://example.test',{method:'POST',
 headers:{authorization:'Bearer '+token},body:JSON.stringify({action,appKey:'abaque-longueurs',classId:classroom,...data})});
 const handle=createAbaqueHandler({auth,db,access:'open'});
 assert.equal((await handle(request('teacher-activity-get'))).status,200);
 assert.equal(requests[0].name,'connect_abaque_class_gates_get_v1');
 assert.equal((await handle(request('teacher-activity-set',{activity:3,allowed:true}))).status,200);
 assert.equal(requests[1].name,'connect_abaque_class_gates_set_v1');
 assert.equal(requests[1].args.p_activity,3);
 assert.equal((await handle(request('teacher-activity-set',{activity:1,allowed:true}))).status,400);
 assert.equal(requests.length,2);
 const pupil=createAbaqueHandler({auth:{auth:{getUser:async()=>({data:{user:{id:actor,is_anonymous:true}}})}},db,access:'open'});
 assert.equal((await pupil(request('teacher-activity-set',{activity:3,allowed:true}))).status,403);
 assert.equal(requests.length,2);
 const denied=createAbaqueHandler({auth,db:{rpc:async()=>({data:null,error:{message:'teacher_authorization_required'}})},access:'open'});
 assert.equal((await denied(request('teacher-activity-get'))).status,403);
});

test('Mode Master local impossible à utiliser pour contourner les blocages Connect élèves',()=>{
 assert.match(html,/const unlocked=what=>\(master&&!connectBinding\)\|\|classActivityAccess\.teacherFree/);
 assert.match(html,/\$\('masterToggle'\)\.classList\.toggle\('hidden',!!connectBinding&&!classActivityAccess\.teacherFree\)/);
 assert.match(html,/if\(master\|\|connectBinding&&!classActivityAccess\.teacherFree\)return/);
 assert.match(html,/if\(!snapshot\.activityAccess\?\.teacherFree\)\{master=false/);
 assert.match(html,/try\{sessionStorage\.removeItem\(SESSION\)\}/);
});
