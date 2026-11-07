import test from 'node:test';
import assert from 'node:assert/strict';
import {judgeCompletion,recordPoints} from '../apps/GRAN-abaque-m-1/connect/completion-contract.mjs';
import {createAbaqueQueue} from '../apps/GRAN-abaque-m-1/connect/offline-queue.mjs';
import {createAbaqueHandler} from '../supabase/functions/connect-abaque/handler.mjs';
import {resolveAbaqueAccess} from '../supabase/functions/connect-abaque/access-policy.mjs';
import {build,moves,classic,record,pilotClass} from './fixtures/abaque-events.mjs';
const authId='00000000-0000-4000-8000-000000000011',studentId='00000000-0000-4000-8000-000000000012';
const storage=()=>{const data=new Map();return {getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)}};

test('Abaque serveur : vrais seuils, scores et preuves de fin ; aucune récompense déclarée par le client',()=>{
 assert.equal(judgeCompletion(build(10)).firstTry,10);
 assert.equal(judgeCompletion(moves(7)).firstTry,7);
 for(const [kind,points] of [['one',100],['three',324],['five',580]])assert.equal(judgeCompletion(classic(kind)).points,points);
 assert.equal(judgeCompletion(record('lives',5)).points,129);
 assert.equal(judgeCompletion(record('sudden',5)).points,155);
 assert.equal(judgeCompletion(record('sudden',10,{abandoned:true})).eligible,false);
 for(const altered of [{...build(),master:true},{...build(),xp:160},{...build(),trophies:['gold']},{...record(),completed:false},{...classic(),tasks:[]}])assert.throws(()=>judgeCompletion(altered));
 const proof=record('sudden',4);proof.tasks[3].manip=true;
 assert.throws(()=>judgeCompletion(proof),/invalid_completion/);
 const corrected=classic('one',3);corrected.tasks[3].correctedAnswer=2000;
 assert.equal(judgeCompletion(corrected).firstTry,3);assert.equal(judgeCompletion(corrected).points,81);
});

test('Abaque file : résultat conservé après ACK incorrect, redémarrage, puis ACK exact lié à l’identité',async()=>{
 const saved=storage(),event=build();let valid=false;
 const post=async()=>({ok:true,eventId:valid?event.eventId:'wrong',studentId,authSubject:authId,appKey:'abaque-longueurs',resetEpoch:0,revision:1,duplicate:false});
 const first=createAbaqueQueue({storage:saved,classId:pilotClass,authSubject:authId,studentId,post});
 first.initialize(0,0);assert.equal(first.enqueue(event),true);assert.equal(await first.flush(),false);assert.equal(first.pending(),1);
 const restored=createAbaqueQueue({storage:saved,classId:pilotClass,authSubject:authId,studentId,post});
 restored.initialize(0,0);valid=true;assert.equal(await restored.flush(),true);assert.equal(restored.pending(),0);
 const other=createAbaqueQueue({storage:saved,classId:pilotClass,authSubject:authId,studentId:'00000000-0000-4000-8000-000000000013',post});
 assert.notEqual(first.key,other.key);assert.equal(other.pending(),0);
});

test('Abaque file : réponse perdue, doublon idempotent, époque périmée et stockage indisponible',async()=>{
 const saved=storage(),event=build();let calls=0;
 const post=async()=>{calls++;if(calls===1)throw Error('lost_response');return {ok:true,eventId:event.eventId,studentId,authSubject:authId,appKey:'abaque-longueurs',resetEpoch:0,revision:1,duplicate:true};};
 const queue=createAbaqueQueue({storage:saved,classId:pilotClass,authSubject:authId,studentId,post});
 queue.initialize(0,0);queue.enqueue(event);assert.equal(await queue.flush(),false);assert.equal(queue.pending(),1);assert.equal(await queue.flush(),true);
 queue.enqueue(build());queue.initialize(2,1);assert.equal(queue.pending(),0);assert.equal(queue.quarantined(),1);
 const broken={getItem:()=>null,setItem:()=>{throw Error('disk_full')}};
 const full=createAbaqueQueue({storage:broken,classId:pilotClass,authSubject:authId,studentId,post});
 full.initialize(0,0);assert.throws(()=>full.enqueue(build()),/storage/);assert.equal(full.pending(),1,'le résultat reste en mémoire si le stockage échoue');
});

test('Abaque contrat Edge avec Auth simulée : fermeture, identité fournie par le SDK et preuves jugées côté serveur',async()=>{
 let calls=0,captured;
 const auth={auth:{getUser:async token=>({data:{user:token==='fake-approved'?{id:authId,is_anonymous:true}:null},error:null})}};
 const db={rpc:async(name,args)=>{calls++;captured={name,args};return {data:{ok:true},error:null}}};
 const body={action:'record',appKey:'abaque-longueurs',classId:pilotClass,expectedStudentId:studentId,revision:0,resetEpoch:0,event:build()};
 const request=(data=body,token='fake-approved')=>new Request('http://local.invalid',{method:'POST',headers:{authorization:'Bearer '+token},body:JSON.stringify(data)});
 assert.equal((await createAbaqueHandler({auth,db})(request())).status,403);assert.equal(calls,0);
 const handle=createAbaqueHandler({auth,db,access:'pilot'});
 assert.equal((await handle(request(body,'invalid'))).status,401);assert.equal(calls,0);
 assert.equal((await handle(request({...body,classId:studentId}))).status,403);assert.equal(calls,0);
 assert.equal((await handle(request({...body,event:{...body.event,xp:160}}))).status,400);assert.equal(calls,0);
 assert.equal((await handle(request())).status,200);assert.equal(captured.name,'connect_abaque_record_v1');
 assert.equal(captured.args.p_actor,authId);assert.equal(captured.args.p_result.firstTry,12);assert.equal(captured.args.p_result.points,0);
 const forbidden=await handle(request({...body,action:'teacher-reset',studentId}));assert.equal(forbidden.status,403);
});


test('Abaque record long : mémoire de preuve bornée, formule native exacte et aucun plafond de 10 000 conversions',()=>{
 for(const kind of ['lives','sudden']){
  let native=0;
  for(let count=0;count<1000;count++){
   assert.equal(recordPoints(kind,count),native,kind+' '+count);
   const base=30+5*Math.floor(count/4);native+=kind==='lives'?Math.round(base/1.2):base;
  }
  const event=record(kind,10,{abandoned:true});event.completed=true;delete event.abandoned;
  event.tailSegments=kind==='lives'?[100000,0,0,0]:[100000,0];
  const judged=judgeCompletion(event);
  assert.equal(judged.firstTry,100010);assert.equal(judged.points,recordPoints(kind,100010));
  assert.equal(event.tasks.length,10);assert.equal(event.tailSegments.length,kind==='lives'?4:2);
 }
});

test('Abaque pilote, Auth simulée : gestion réservée au professeur TEST et confirmation explicite des profils',async()=>{
 let calls=0,last;
 const db={rpc:async(name,args)=>{calls++;last={name,args};return {data:{ok:true,ready:true,approvedCount:1},error:null}}};
 const auth={auth:{getUser:async token=>({data:{user:{id:authId,is_anonymous:token==='pupil'}},error:null})}};
 const handler=createAbaqueHandler({auth,db,access:'pilot'});
 const request=(data,token='teacher')=>new Request('http://local.invalid',{method:'POST',headers:{authorization:'Bearer '+token},body:JSON.stringify({appKey:'abaque-longueurs',classId:pilotClass,...data})});
 assert.equal((await handler(request({action:'teacher-pilot-status'},'pupil'))).status,403);assert.equal(calls,0);
 assert.equal((await handler(request({action:'teacher-pilot-approve',studentIds:[studentId],includeTeacher:false},'teacher'))).status,400);assert.equal(calls,0);
 assert.equal((await handler(request({action:'teacher-pilot-approve',fictiveConfirmed:true,studentIds:[studentId],includeTeacher:false}))).status,200);
 assert.equal(last.name,'connect_abaque_pilot_approve_v1');assert.equal(last.args.p_actor,authId);
 assert.deepEqual(last.args.p_students,[studentId]);assert.equal(last.args.p_confirmed,true);
 assert.equal((await handler(request({action:'teacher-pilot-status'}))).status,200);assert.equal(last.name,'connect_abaque_pilot_status_v1');
 const open=createAbaqueHandler({auth,db,access:'open'});
 assert.equal((await open(request({action:'teacher-pilot-status',classId:studentId}))).status,403);
});

test('Abaque activation 07/11: seulement TEST sur Connect, toute fermeture explicite prioritaire',()=>{
 const project='https://awmhpfofacaglewammxt.supabase.co';
 assert.equal(resolveAbaqueAccess(undefined,project),'pilot','l activation TEST autorisee ne depend pas d un secret absent');
 assert.equal(resolveAbaqueAccess(null,project),'pilot');
 assert.equal(resolveAbaqueAccess('pilot',project),'pilot');
 for(const flag of ['closed','open','', 'unsafe'])assert.equal(resolveAbaqueAccess(flag,project),'closed');
 assert.equal(resolveAbaqueAccess(undefined,'https://bzdflehyuowbawdzuawh.supabase.co'),'closed');
 assert.equal(resolveAbaqueAccess(undefined,'http://localhost:54321'),'closed');
 assert.equal(resolveAbaqueAccess(undefined,'not a url'),'closed');
});
