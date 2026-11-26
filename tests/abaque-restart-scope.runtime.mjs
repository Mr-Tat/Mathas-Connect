import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {judgeCompletion} from '../apps/GRAN-abaque-m-1/connect/completion-contract.mjs';
import {build,moves,classic,record,pilotClass} from './fixtures/abaque-events.mjs';
if(process.env.ABAQUE_RESTART_LOCAL!=='1'||process.env.PGHOST!=='127.0.0.1'||process.env.PGDATABASE!=='abaque_test'||process.env.PGPORT!=='55432')throw Error('disposable_local_database_required');
const pool=new pg.Pool({host:'127.0.0.1',port:55432,database:'abaque_test',user:'postgres',password:'local-test-only'});
after(()=>pool.end());
const query=(s,a=[])=>pool.query(s,a);
const teacher=randomUUID();
async function pupil(){
 const student=randomUUID(),actor=randomUUID();
 await query('insert into connect_students(id,display_name) values($1,$2)',[student,'Fictif nouvelle progression']);
 await query('insert into connect_abaque_pilot_students(student_id) values($1)',[student]);
 await query("insert into connect_devices(auth_user_id,student_id,state) values($1,$2,'approved')",[actor,student]);
 await query('insert into connect_enrollments(id,class_id,student_id) values($1,$2,$3)',[randomUUID(),pilotClass,student]);
 return {student,actor};
}
const load=async p=>(await query('select connect_abaque_load_v1($1,$2,false) v',[p.actor,pilotClass])).rows[0].v;
async function send(p,event,epoch,revision){
 const now=await load(p);epoch??=now.resetEpoch;revision??=now.revision;
 return (await query('select connect_abaque_record_v1($1,$2,false,$3,$4,$5,$6,$7::jsonb) v',[p.actor,pilotClass,p.student,event.eventId,revision,epoch,JSON.stringify(judgeCompletion({...event,expectedResetEpoch:epoch}))])).rows[0].v;
}
const targets=(p,resetEpoch)=>[{studentId:p.student,resetEpoch}];
const restart=(scope,part,rows,actor=teacher)=>query('select connect_abaque_restart_scope_v1($1,$2,$3,$4,$5::jsonb) v',[actor,pilotClass,scope,part,JSON.stringify(rows)]).then(r=>r.rows[0].v);
test('Nouvelle progression réelle : préservation des preuves, epochs, verrous, droits et classe atomique',async()=>{
 await query("update connect_apps set enabled=true where app_key='abaque-longueurs'");
 await query("update connect_abaque_classes set enabled=true,unlock_mode='all_open',activity_2_allowed=true,activity_3_allowed=true where class_id=$1",[pilotClass]);
 await query('insert into connect_class_permissions(teacher_id,class_id,can_manage) values($1,$2,true)',[teacher,pilotClass]);
 const p=await pupil(),q=await pupil();
 await send(p,build());await send(p,moves());
 for(const kind of ['one','three','five'])await send(p,classic(kind));
 await send(p,record('sudden',15));
 const before=await load(p),other=await load(q);
 assert.equal(before.state.stage1.perfectRuns,1);assert.equal(before.state.stage2.perfectRuns,1);
 await assert.rejects(restart('student','activity3',targets(p,before.resetEpoch),randomUUID()),/professor_required/);
 await assert.rejects(restart('class','activity3',targets(p,before.resetEpoch)),/not_enrolled/);
 await assert.rejects(restart('class','activity3',[...targets(p,before.resetEpoch),...targets(q,other.resetEpoch+1)]),/stale_reset_epoch/);
 assert.deepEqual((await load(p)).state,before.state);
 const result=await restart('student','activity3',targets(p,before.resetEpoch));assert.equal(result.count,1);
 const next=await load(p);assert.equal(next.resetEpoch,before.resetEpoch+1);
 assert.deepEqual(next.state.stage1,before.state.stage1);assert.deepEqual(next.state.stage2,before.state.stage2);
 assert.equal(next.state.modeScores,undefined);assert.equal(next.xp.appXp,before.xp.appXp);assert.deepEqual(next.trophies,before.trophies);
 assert.deepEqual((await load(q)).state,other.state);
 await assert.rejects(send(p,build(),before.resetEpoch),/stale_reset_epoch/);
 await assert.rejects(send(p,record('sudden',5)),/activity_locked/);
 await assert.rejects(send(p,record('lives',5)),/activity_locked/);
 await send(p,build());await send(p,moves());const perfect=await load(p);
 assert.equal(perfect.state.stage1.perfectRuns,2);assert.equal(perfect.state.stage2.perfectRuns,2);
 assert.ok(perfect.trophies.includes('abaque:bronze'));assert.ok(perfect.trophies.includes('abaque:silver'));
 for(const kind of ['one','three','five'])await send(p,classic(kind));
 await send(p,record('sudden',5));const earned=await load(p);
 await restart('class','all',[...targets(p,earned.resetEpoch),...targets(q,other.resetEpoch)]);
 const fresh=await load(p);assert.equal(fresh.resetEpoch,earned.resetEpoch+1);assert.deepEqual(fresh.state,{});
 assert.equal(fresh.xp.appXp,earned.xp.appXp);assert.deepEqual(fresh.trophies,earned.trophies);
 await send(p,build());assert.equal((await load(p)).state.stage1.perfectRuns,1);
 const conn=await pool.connect();try{await conn.query('begin');await conn.query('set local role authenticated');await assert.rejects(conn.query('select connect_abaque_restart_scope_v1($1,$2,$3,$4,$5::jsonb)',[teacher,pilotClass,'student','all',JSON.stringify(targets(p,fresh.resetEpoch))]),/permission denied/);}finally{await conn.query('rollback');conn.release();}
});
