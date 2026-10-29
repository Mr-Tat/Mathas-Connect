import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';

// A genuine LOCAL GoTrue session, Edge handler, PostgREST and PostgreSQL.
// Never connect to a hosted Supabase project or any real pupil.
const url=process.env.API_URL,anon=process.env.ANON_KEY,service=process.env.SERVICE_ROLE_KEY;
assert.ok(url?.startsWith('http://127.0.0.1:')&&anon&&service,'LOCAL loopback required');
const client=key=>createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const admin=client(service),studentAuth=client(anon),outsiderAuth=client(anon),teacherAuth=client(anon);
const classId=randomUUID(),studentId=randomUUID(),eventId=randomUUID();
const appKey='addition-ecrite-multiple',oldApp='addition-ecrite-simple';
function checked(res,where){if(res.error)throw Error(where+': '+res.error.message);return res.data;}
async function post(session,endpoint,payload){
 const res=await fetch(url+'/functions/v1/'+endpoint,{method:'POST',
 headers:{apikey:anon,authorization:'Bearer '+session.access_token,'content-type':'application/json'},
 body:JSON.stringify({classId,...payload})});
 const data=await res.json();
 return {status:res.status,data};
}
function success(res,where){
 assert.equal(res.status,200,where+': '+JSON.stringify(res.data));
 assert.equal(res.data.ok,true,where+': '+JSON.stringify(res.data));
 return res.data;
}
const student=checked(await studentAuth.auth.signInAnonymously(),'student signup').session;
const outsider=checked(await outsiderAuth.auth.signInAnonymously(),'outsider signup').session;
const teacher=checked(await teacherAuth.auth.signUp({
 email:'local-'+randomUUID()+'@example.test',password:'LocalTest!SecurePass123'
}),'teacher signup').session;
assert.ok(student?.user?.is_anonymous&&outsider?.access_token&&teacher?.access_token&&!teacher.user.is_anonymous);
checked(await admin.from('connect_students').insert({id:studentId,display_name:'Élève fictif'}),'student');
checked(await admin.from('connect_enrollments').insert({id:randomUUID(),class_id:classId,student_id:studentId}),'class');
checked(await admin.from('connect_devices').insert({id:randomUUID(),auth_user_id:student.user.id,student_id:studentId,state:'approved'}),'device');
checked(await admin.from('connect_teachers').insert({auth_user_id:teacher.user.id}),'teacher');
checked(await admin.from('connect_class_permissions').insert({class_id:classId,teacher_id:teacher.user.id,can_manage:true}),'teacher permission');
checked(await admin.from('connect_xp_credits').insert({student_id:studentId,app_key:oldApp,xp_credited:22}),'previous XP');
assert.equal(success(await post(student,'connect-api',{action:'student-me'}),'student identity').status,'approved');
const load=success(await post(student,'connect-results',{action:'student-load',appKey}),'first load');
assert.equal(load.revision,0);assert.equal(load.resetEpoch,0);
assert.equal((await post(outsider,'connect-results',{action:'student-load',appKey})).status,403);
const rewards={version:3,mastery:{4:[true,false,false],10:[false,false,false],20:[false,false,false]},
 sudden:[false,false,false],hardAwards:{bronze:[false,false,false],silver:[false,false,false],gold:[false,false,false]},
 scoreOne:{bronze:false,silver:false,gold:false},unlockedGold:false};
const event={action:'game-record',appKey,eventId,mode:'classic',level:1,score:4,total:4,
 points:0,expectedRevision:0,expectedResetEpoch:0,rewards};
const result=success(await post(student,'connect-results',event),'saved game');
assert.equal(result.revision,1);assert.equal(result.xp.delta,22);assert.equal(result.xp.total,44);
const duplicate=success(await post(student,'connect-results',event),'duplicate');
assert.equal(duplicate.duplicate,true);assert.equal(duplicate.xp.delta,0);
const state=success(await post(student,'connect-results',{action:'student-load',appKey}),'reload');
assert.equal(state.state.classic[0]['4'],4);
assert.equal(state.state.rewards.mastery['4'][0],true);
const overview=success(await post(teacher,'connect-results',{action:'teacher-overview'}),'professor overview');
const profApp=overview.students.find(x=>x.id===studentId)?.apps.find(x=>x.appKey===appKey);
assert.equal(profApp?.state?.classic[0]['4'],4);
const detail=success(await post(teacher,'connect-results',{action:'teacher-detail',appKey,studentId}),'professor detail');
assert.equal(detail.state.rewards.mastery['4'][0],true);
const restart=success(await post(teacher,'connect-results',{
 action:'teacher-parcours-restart',appKey,studentId,scope:'student',repeatXp:false
}),'professor restart');
assert.equal(restart.parcours,2);
const reset=success(await post(student,'connect-results',{action:'student-load',appKey}),'after reset');
assert.equal(reset.resetEpoch,1);assert.deepEqual(reset.state,{});
const xp=success(await post(student,'connect-results',{action:'student-xp',appKey}),'XP after reset');
assert.equal(xp.appXp,22);assert.equal(xp.total,44);
const previous=checked(await admin.from('connect_xp_credits').select('xp_credited')
 .eq('student_id',studentId).eq('app_key',oldApp).single(),'historical XP');
assert.equal(previous.xp_credited,22);
console.log('PASS genuine LOCAL Supabase Auth+Edge+PostgreSQL: 4/4, 22 XP, trophy, professor, reset, 44 global XP, outsider denied');
