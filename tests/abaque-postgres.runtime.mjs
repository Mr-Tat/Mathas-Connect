import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID,createHash} from 'node:crypto';
import pg from 'pg';
import {judgeCompletion} from '../apps/abaque-longueurs/connect/completion-contract.mjs';
import {build,moves,classic,record,pilotClass} from './fixtures/abaque-events.mjs';
import {validateAudit,buildPilotActivation,version as migrationVersion,name as migrationName,sqlFile} from '../scripts/abaque-release.mjs';
const path=process.env.ABAQUE_LOCAL_MANIFEST;
if(!/^\/tmp\/mathas-abaque-local\.[a-zA-Z0-9]+\/local\.json$/.test(path||''))throw Error('disposable_local_database_required');
const config=JSON.parse(readFileSync(path,'utf8'));
if(!config.localOnly||config.host!=='127.0.0.1'||config.database!=='abaque_test')throw Error('disposable_local_database_required');
const pool=new pg.Pool({host:config.host,port:config.port,database:config.database,user:config.user,password:config.password,max:5,connectionTimeoutMillis:5000});
after(()=>pool.end());
async function pupil(){
 const student=randomUUID(),actor=randomUUID();
 await pool.query('insert into connect_students(id,display_name) values($1,$2)',[student,'Profil fictif Abaque']);
 await pool.query('insert into connect_abaque_pilot_students(student_id) values($1)',[student]);
 await pool.query("insert into connect_devices(auth_user_id,student_id,state) values($1,$2,'approved')",[actor,student]);
 await pool.query('insert into connect_enrollments(id,class_id,student_id) values($1,$2,$3)',[randomUUID(),pilotClass,student]);
 return {student,actor};
}
const load=identity=>pool.query('select connect_abaque_load_v1($1,$2,false) as value',[identity.actor,pilotClass]).then(r=>r.rows[0].value);
async function send(identity,event,{revision,epoch=0,student=identity.student}={}){
 if(revision===undefined)revision=(await load(identity)).revision;
 return (await pool.query('select connect_abaque_record_v1($1,$2,false,$3,$4,$5,$6,$7::jsonb) as value',
  [identity.actor,pilotClass,student,event.eventId,revision,epoch,JSON.stringify(judgeCompletion(event))])).rows[0].value;
}
async function unlocked(identity){for(const event of [build(10),build(10),moves(7),moves(7),classic('one'),classic('three',10),classic('five',16)])await send(identity,event);}

test('PostgreSQL réel : installation atomique fermée, historique exact unique et audit sans données élèves',async()=>{
 const audit=JSON.parse(readFileSync(config.lab+'/schema-audit.json','utf8'));
 assert.equal(validateAudit(audit).ok,true);
 const changed=structuredClone(audit);changed.structure.tables.connect_states.columns.find(c=>c.name==='revision').type='integer';
 assert.equal(validateAudit(changed).ok,false);
 const rows=(await pool.query('select version,name,statements from supabase_migrations.schema_migrations')).rows;
 assert.equal(rows.length,1);assert.equal(rows[0].version,migrationVersion);assert.equal(rows[0].name,migrationName);
 const source=readFileSync(new URL('../'+sqlFile,import.meta.url),'utf8').replace(/^([\s\S]*?)\bBEGIN;\s*/,'').replace(/\s*COMMIT;\s*$/,'');
 assert.equal(rows[0].statements.length,1);
 assert.equal(createHash('sha256').update(rows[0].statements[0]).digest('hex'),createHash('sha256').update(source).digest('hex'));
 const connection=await pool.connect();
 try{
  await assert.rejects(connection.query(readFileSync(config.lab+'/install.sql','utf8')),/abaque_schema_changed_reaudit_required/);
 }finally{await connection.query('rollback');connection.release();}
 assert.equal((await pool.query('select count(*)::int n from supabase_migrations.schema_migrations')).rows[0].n,1);
});

test('PostgreSQL réel : installation désactivée et autorisations publiques fermées',async()=>{
 const identity=await pupil();
 await assert.rejects(load(identity),/app_class_not_open/);
 await pool.query('update connect_abaque_classes set enabled=true where class_id=$1',[pilotClass]);
 await assert.rejects(load(identity),/app_disabled/);
 assert.equal((await pool.query("select count(*)::int as n from connect_hub_preset_entries where app_key='abaque-longueurs'")).rows[0].n,0);
 for(const role of ['anon','authenticated']){
  const connection=await pool.connect();
  try{
   await connection.query('begin');await connection.query('set local role '+role);
   await assert.rejects(connection.query('select connect_abaque_load_v1($1,$2,false)',[identity.actor,pilotClass]),/permission denied/);
  }finally{await connection.query('rollback');connection.release();}
 }
 await pool.query('update connect_abaque_classes set enabled=false where class_id=$1',[pilotClass]);
 assert.throws(()=>buildPilotActivation({classId:pilotClass,studentIds:[identity.student]}),/explicit_fictive_profiles/);
 await pool.query(buildPilotActivation({classId:pilotClass,fictiveConfirmed:true,studentIds:[identity.student]}));
 const snapshot=await load(identity);assert.equal(snapshot.xp.appXp,0);assert.equal(snapshot.xp.max,160);
 await assert.rejects(send(identity,moves()),/activity_locked/);
});

test('PostgreSQL réel : 160 XP, compléments, six trophées, abandons sans XP et autres applications intactes',async()=>{
 const identity=await pupil();
 await pool.query("insert into connect_xp_credits(student_id,app_key,xp_credited) values($1,'addition-ecrite-multiple',50)",[identity.student]);
 await pool.query("insert into connect_states(student_id,app_key,schema_version,revision,reset_epoch,state_data) values($1,'addition-ecrite-multiple',1,3,2,'{\"sentinel\":true}')",[identity.student]);
 const steps=[[build(10),8],[build(10),6],[build(),6],[moves(7),8],[moves(7),6],[moves(),6],[classic('one'),20],[classic('three',10),18],[classic('three'),10],[classic('five',16),28],[classic('five'),12]];
 let total=0;const first=steps[0][0];
 for(const [event,delta] of steps){const ack=await send(identity,event);total+=delta;assert.equal(ack.xp.delta,delta,event.kind);assert.equal(ack.xp.appXp,total,event.kind);}
 assert.equal(total,128);
 const abandoned=await send(identity,record('sudden',10,{abandoned:true}));assert.equal(abandoned.xp.delta,0);assert.equal(abandoned.xp.appXp,128);assert.equal(abandoned.state.suddenBest,10);
 for(const [event,delta] of [[record('lives',5),6],[record('lives',10),10],[record('sudden',5),6],[record('sudden',10),10]]){
  const ack=await send(identity,event);total+=delta;assert.equal(ack.xp.delta,delta);assert.equal(ack.xp.appXp,total);
 }
 const final=await load(identity);assert.equal(final.xp.appXp,160);assert.equal(final.xp.total,210);
 assert.deepEqual(final.trophies,['abaque:bronze','abaque:gold','abaque:silver','abaque:sudden-bronze','abaque:sudden-gold','abaque:sudden-silver']);
 assert.deepEqual(final.xp.remaining,{build:0,moves:0,one:0,three:0,five:0,lives:0,sudden:0});
 assert.equal((await send(identity,record('lives',10))).xp.delta,0);
 const duplicate=await send(identity,first,{revision:0});assert.equal(duplicate.duplicate,true);assert.equal(duplicate.xp.delta,0);
 assert.equal((await pool.query("select xp_credited from connect_xp_credits where student_id=$1 and app_key='addition-ecrite-multiple'",[identity.student])).rows[0].xp_credited,50);
 assert.deepEqual((await pool.query("select revision::int,reset_epoch::int,state_data from connect_states where student_id=$1 and app_key='addition-ecrite-multiple'",[identity.student])).rows[0],{revision:3,reset_epoch:2,state_data:{sentinel:true}});
});

test('PostgreSQL réel : concurrence, CAS, reçu durable et aucun double crédit',async()=>{
 const identity=await pupil(),first=build(10),second=build(10);
 const results=await Promise.allSettled([send(identity,first,{revision:0}),send(identity,second,{revision:0})]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 assert.match(results.find(r=>r.status==='rejected').reason.message,/revision_conflict/);
 const loser=results[0].status==='rejected'?first:second;
 assert.equal((await send(identity,loser)).xp.delta,6);
 assert.equal((await load(identity)).xp.appXp,14);
 const another=await pupil(),event=build(10);
 const duplicate=await Promise.all([send(another,event,{revision:0}),send(another,event,{revision:0})]);
 assert.deepEqual(duplicate.map(r=>r.xp.delta).sort((a,b)=>a-b),[0,8]);
 assert.equal((await load(another)).revision,1);
});

test('PostgreSQL réel : erreur tardive annule état, XP, trophées et reçu dans la même transaction',async()=>{
 const identity=await pupil();
 await pool.query("create function abaque_fixture_failure() returns trigger language plpgsql as $$ begin raise exception 'fixture_late_failure';end $$");
 await pool.query("create trigger abaque_fixture_failure before insert on connect_abaque_receipts for each row when ((new.judgement->>'firstTry')::int=12) execute function abaque_fixture_failure()");
 try{await assert.rejects(send(identity,build()),/fixture_late_failure/);}
 finally{await pool.query('drop trigger abaque_fixture_failure on connect_abaque_receipts');await pool.query('drop function abaque_fixture_failure()');}
 for(const table of ['connect_states','connect_xp_credits','connect_abaque_rights','connect_trophy_achievements','connect_abaque_receipts']){
  assert.equal((await pool.query('select count(*)::int as n from '+table+' where student_id=$1',[identity.student])).rows[0].n,0,table);
 }
});

test('PostgreSQL réel : identité réaffectée/révoquée, reset limité à Abaque et droits/trophées permanents',async()=>{
 const identity=await pupil();await unlocked(identity);
 const teacher=randomUUID();await pool.query('insert into connect_class_permissions(class_id,teacher_id,can_manage) values($1,$2,true)',[pilotClass,teacher]);
 const before=await load(identity);
 const reset=(await pool.query('select connect_abaque_restart_v1($1,$2,$3,$4) as value',[teacher,pilotClass,identity.student,0])).rows[0].value;
 assert.equal(reset.resetEpoch,1);assert.equal(reset.xp.appXp,before.xp.appXp);assert.deepEqual(reset.trophies,before.trophies);assert.deepEqual(reset.state,{});
 await assert.rejects(pool.query('select connect_abaque_restart_v1($1,$2,$3,$4)',[teacher,pilotClass,identity.student,0]),/stale_reset_epoch/);
 await assert.rejects(send(identity,build(),{revision:reset.revision,epoch:0}),/stale_reset_epoch/);
 const fresh={...build(),expectedResetEpoch:1};const resumed=await send(identity,fresh,{revision:reset.revision,epoch:1});
 assert.equal(resumed.xp.delta,6,'premier sans-faute complète seulement le jalon parfait non acquis');
 await assert.rejects(send(identity,{...build(),expectedResetEpoch:1},{epoch:1,student:teacher}),/identity_binding_conflict/);
 await pool.query("update connect_devices set state='revoked' where auth_user_id=$1",[identity.actor]);
 await assert.rejects(load(identity),/approved_identity_required/);
});


test('PostgreSQL réel : résumé HUB 160 XP et 6 trophées, contrat des anciennes applications préservé',async()=>{
 const identity=await pupil();await send(identity,build());
 const previous=(await pool.query('select connect_profile_progress_v1($1) as value',[identity.student])).rows[0].value;
 const next=(await pool.query('select connect_abaque_profile_progress_v1($1) as value',[identity.student])).rows[0].value;
 assert.deepEqual(next.apps.filter(app=>app.appKey!=='abaque-longueurs'),previous.apps);
 assert.equal(next.totalTrophies,previous.totalTrophies);
 assert.deepEqual(next.apps.find(app=>app.appKey==='abaque-longueurs'),{appKey:'abaque-longueurs',xpEarned:14,xpMax:160,trophiesEarned:1,trophiesMax:6});
});

test('PostgreSQL réel : activation ultérieure par données de classe, fermée tant que non autorisée',async()=>{
 const identity=await pupil(),classId=randomUUID();
 await pool.query('insert into connect_classes(id,name) values($1,$2)',[classId,'Autre classe locale fictive']);
 await pool.query('insert into connect_enrollments(id,class_id,student_id) values($1,$2,$3)',[randomUUID(),classId,identity.student]);
 await pool.query('insert into connect_abaque_classes(class_id,pilot_only) values($1,false)',[classId]);
 const request=()=>pool.query('select connect_abaque_load_v1($1,$2,false) as value',[identity.actor,classId]);
 await assert.rejects(request(),/app_class_not_open/);
 await pool.query('update connect_abaque_classes set enabled=true where class_id=$1',[classId]);
 await pool.query('delete from connect_abaque_pilot_students where student_id=$1',[identity.student]);
 assert.equal((await request()).rows[0].value.studentId,identity.student);
 await assert.rejects(load(identity),/fictive_profile_required/,'la classe TEST garde sa restriction fictive indépendante');
});


test('PostgreSQL réel : 80 % sur tous les formats et coupes distinctes à 3/5/8 pages Mort subite',async()=>{
 const identity=await pupil();await unlocked(identity);
 const original=(await load(identity)).state;
 for(const scores of [{one:3,three:10,five:16},{one:4,three:9,five:16},{one:4,three:10,five:15}]){
  const partial={...original,modeScores:scores};
  await pool.query("update connect_states set state_data=$2::jsonb where student_id=$1 and app_key='abaque-longueurs'",[identity.student,JSON.stringify(partial)]);
  for(const kind of ['lives','sudden'])await assert.rejects(send(identity,record(kind,3)),/activity_locked/);
 }
 await pool.query("update connect_states set state_data=$2::jsonb where student_id=$1 and app_key='abaque-longueurs'",[identity.student,JSON.stringify(original)]);
 assert.deepEqual((await send(identity,record('lives',8))).trophies,[]);
 for(let run=0;run<2;run++)assert.deepEqual((await send(identity,record('sudden',2))).trophies,[],'les parties ne se cumulent pas');
 for(const pages of [3,4,5,7,8]){
  const event=record('sudden',pages,{abandoned:pages===3});
  const result=await send(identity,event);
  const expected=['abaque:sudden-bronze',...(pages>=8?['abaque:sudden-gold']:[]),...(pages>=5?['abaque:sudden-silver']:[])];
  assert.deepEqual(result.trophies,expected,'seuil '+pages);
  assert.deepEqual(result.state.scoreRecords.medals,[]);
  if(pages===3){
   assert.equal(result.xp.delta,0,'quitter après trois pages ne donne pas de XP de fin');
   assert.equal((await send(identity,event,{revision:0})).duplicate,true);
  }
 }
 assert.equal((await load(identity)).trophies.includes('abaque:gold'),false,'l’or classique est indépendant');
 const before=await load(identity),teacher=randomUUID();
 await pool.query('insert into connect_class_permissions(class_id,teacher_id,can_manage) values($1,$2,true)',[pilotClass,teacher]);
 const reset=(await pool.query('select connect_abaque_restart_v1($1,$2,$3,$4) as value',[teacher,pilotClass,identity.student,0])).rows[0].value;
 assert.deepEqual(reset.trophies,before.trophies,'les coupes Mort subite restent permanentes après reset');
 assert.deepEqual(reset.state,{});
});
