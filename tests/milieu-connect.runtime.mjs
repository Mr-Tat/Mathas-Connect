import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {createMilieuHandler} from '../supabase/functions/connect-milieu/handler.mjs';
import {questionSequence} from '../apps/DIV-Milieu-de-segment-1/connect/seeded-questions.mjs';
import {LEVELS} from '../apps/DIV-Milieu-de-segment-1/connect/reward-contract.mjs';
if(process.env.MILIEU_LOCAL!=='1'||process.env.PGHOST!=='127.0.0.1'||process.env.PGDATABASE!=='milieu_test')throw Error('disposable_local_database_required');
const pool=new pg.Pool({host:'127.0.0.1',port:55432,database:'milieu_test',user:'postgres',password:'local-test-only'});after(()=>pool.end());
const query=(s,a=[])=>pool.query(s,a);
const cls=randomUUID(),teacher=randomUUID(),actor=randomUUID(),student=randomUUID(),other=randomUUID(),otherActor=randomUUID();
const users=new Map([[teacher,false],[actor,true],[otherActor,true]]);
const auth={auth:{getUser:async token=>users.has(token)?{data:{user:{id:token,is_anonymous:users.get(token)}}}:{error:{message:'invalid'}}}};
const db={rpc:async(name,args)=>{try{const entries=Object.entries(args);const sql='select public.'+name+'('+entries.map(([k,v],i)=>k+' => $'+(i+1)).join(',')+') v';const values=entries.map(([k,v])=>['p_proof','p_judgement','p_state','p_targets'].includes(k)?JSON.stringify(v):v);return {data:(await query(sql,values)).rows[0].v}}catch(e){return {error:{message:e.message}}}}};
const handler=createMilieuHandler({auth,db,access:'pilot'});
async function post(action,body={},who=actor,h=handler){const response=await h(new Request('https://local.test',{method:'POST',headers:{authorization:'Bearer '+who,'content-type':'application/json'},body:JSON.stringify({action,appKey:'milieu-segment',classId:cls,...body})}));return {status:response.status,...await response.json()}}
async function ok(action,body={},who=actor){const r=await post(action,body,who);assert.equal(r.ok,true,JSON.stringify(r));return r}
const proof=(activity,mode,seed,good=20)=>{const n=questionSequence(activity,seed),steps=['gi2','g3'].includes(activity)?['measure','calc','place']:activity.startsWith('g')?['calc','place']:['calc'];const items=[];for(let i=0;i<(mode?good:LEVELS[activity].n);i++){const v=n();items.push({n:v,helps:[],attempts:steps.map(stage=>stage==='measure'?{stage,tick:v,value:v}:stage==='calc'?{stage,value:v/2}:{stage,tick:v/2})})}if(mode)for(let i=0;i<(mode==='sudden'?1:3);i++){const v=n();items.push({n:v,helps:[],attempts:[{stage:'measure',tick:v,value:0}]})}return {version:1,activity,mode,items}};
async function run(activity,mode=null,who=actor,pupil=student){const current=await ok('load',{},who),eventId=randomUUID(),b={expectedStudentId:pupil,eventId,resetEpoch:current.resetEpoch};const started=await ok('begin',{...b,activity,mode},who);const result=proof(activity,mode,started.seed);return {b,result,ack:await ok('record',{...b,proof:result},who)}}
test('PostgreSQL réel + handler Edge injecté : identité, 280 XP, projection, idempotence, reset',async()=>{
 await query("insert into connect_apps(app_key,title,enabled,featured) values('milieu-segment','La moitié',true,false)");
 await query("insert into connect_classes(id,name) values($1,'Fictive')",[cls]);
 await query('insert into connect_milieu_classes(class_id,enabled) values($1,true)',[cls]);
 await query('insert into connect_class_permissions(teacher_id,class_id,can_manage) values($1,$2,true)',[teacher,cls]);
 for(const [p,a] of [[student,actor],[other,otherActor]]){await query("insert into connect_students(id,display_name) values($1,'Fictif')",[p]);await query('insert into connect_milieu_approved(student_id) values($1)',[p]);await query("insert into connect_devices(auth_user_id,student_id,state) values($1,$2,'approved')",[a,p]);await query('insert into connect_enrollments(id,class_id,student_id) values($1,$2,$3)',[randomUUID(),cls,p])}
 assert.equal((await post('load',{},actor,createMilieuHandler({auth,db}))).error,'integration_closed');
 assert.equal((await post('load',{expectedStudentId:other})).error,'identity_binding_conflict');
 assert.equal((await post('teacher-summary')).error,'professor_required');
 assert.equal((await post('begin',{expectedStudentId:student,eventId:randomUUID(),resetEpoch:0,activity:'decimal'})).error,'activity_locked');
 for(const k of Object.keys(LEVELS))for(let i=0;i<LEVELS[k].p;i++)await run(k);
 let a=await run('gi2','sudden');assert.equal(a.ack.judgement.points,80);assert.equal(a.ack.xp.delta,48);
 let b=await run('g3','sudden');assert.equal(b.ack.judgement.points,120);assert.equal(b.ack.xp.appXp,280);assert.equal(b.ack.trophies.length,12);
 assert.equal((await ok('record',{...b.b,proof:b.result})).xp.delta,0);
 const changed=structuredClone(b.result);changed.items[0].n=10;assert.equal((await post('record',{...b.b,proof:changed})).ok,false);
 assert.equal((await ok('board',{expectedStudentId:student})).boardBest,0);
 assert.equal((await post('share',b.b)).ok,false);
 assert.equal((await ok('share',{...b.b,confirmed:true})).boardBest,120);
 assert.equal((await ok('share',{...b.b,confirmed:true})).duplicate,true);
 assert.equal((await ok('share',{...a.b,confirmed:true})).alreadyCovered,true);
 const roster=(await ok('teacher-summary',{},teacher)).students;const p=roster.find(x=>x.studentId===student),q=roster.find(x=>x.studentId===other);
 const target=x=>({studentId:x.studentId,epoch:x.resetEpoch,revision:x.revision});
 const reset={scope:'student',part:'integerGeometry',repeatXp:true,confirmed:true,targets:[target(p)]};
 assert.equal((await post('teacher-restart',reset)).error,'professor_required');
 assert.equal((await post('teacher-restart',{...reset,scope:'class',targets:[target(p)]},teacher)).error,'not_enrolled');
 assert.equal((await post('teacher-restart',{...reset,scope:'class',targets:[target(p),{...target(q),epoch:1}]},teacher)).error,'stale_reset_epoch');
 assert.equal((await ok('load')).resetEpoch,0);
 assert.equal((await ok('teacher-restart',reset,teacher)).count,1);
 let snapshot=await ok('load');assert.equal(snapshot.resetEpoch,1);assert.equal(snapshot.xp.appXp,280);assert.equal(snapshot.state.decimalUnlocked,true);assert.ok(snapshot.state.levels.g3);assert.equal(snapshot.state.levels.gi1,undefined);assert.equal(snapshot.scoreRecords.allBest,120);
 assert.equal((await post('record',{...a.b,proof:a.result})).error,'stale_reset_epoch');
 assert.equal((await post('begin',{...a.b,eventId:randomUUID(),resetEpoch:1,activity:'gi2',mode:'lives'})).error,'activity_locked');
 await run('gi1');await run('gi2');await run('gi2','lives');snapshot=await ok('load');assert.equal(snapshot.xp.appXp,356);
 assert.equal((await run('gi2','sudden')).ack.xp.delta,0);
 assert.equal((await ok('load',{},otherActor)).xp.appXp,0);
 const conn=await pool.connect();try{await conn.query('begin');await conn.query('set local role authenticated');await assert.rejects(conn.query('select public.connect_milieu_snapshot_v2($1)',[student]),/permission denied/)}finally{await conn.query('rollback');conn.release()}
});
