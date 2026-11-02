// TEST ONLY. This endpoint must NEVER be used for the five real-school HUBs.
// It accepts a native-browser score (not a server arithmetic proof), solely to
// test end-to-end persistence with fictional profiles of the TEST classroom.
// PostgreSQL owns receipt + state + XP in the same atomic transaction.
import {createClient} from 'npm:@supabase/supabase-js@2.95.0';

const URL=Deno.env.get('SUPABASE_URL')!;
const PUBLISHABLE=Deno.env.get('SUPABASE_ANON_KEY')!;
const ADMIN=Deno.env.get('SUPABASE_'+'SERVICE_ROLE_KEY')!;
const TEST='4bf3400d-a315-4ea4-a2f3-afaca24dc9b9';
const APPS=new Set(['addition-ecrite-simple','soustraction-ecrite-simple','multiplication-ecrite-simple']);
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const validId=(x:unknown):x is string=>typeof x==='string'&&UUID.test(x);
const int=(x:unknown,min:number,max:number)=>Number.isSafeInteger(x)&&Number(x)>=min&&Number(x)<=max;
const cors={'access-control-allow-origin':'*','access-control-allow-headers':'authorization,apikey,content-type',
 'access-control-allow-methods':'POST,OPTIONS','content-type':'application/json','cache-control':'no-store'};
const result=(body:object,status=200)=>new Response(JSON.stringify(body),{status,headers:cors});
const fail=(error:string,status=400)=>result({ok:false,error},status);
const db=createClient(URL,ADMIN,{auth:{persistSession:false,autoRefreshToken:false}});
const one=async(query:any)=>{const {data,error}=await query.maybeSingle();if(error)throw Error('database_unavailable');return data};

Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response('',{headers:cors});
 if(req.method!=='POST')return fail('method_not_allowed',405);
 const token=req.headers.get('authorization')?.match(/^Bearer (\S+)$/i)?.[1];
 if(!token)return fail('auth_required',401);
 const client=createClient(URL,PUBLISHABLE,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:{user},error:authError}=await client.auth.getUser(token);
 if(authError||!user)return fail('auth_required',401);
 const raw=await req.text();
 if(raw.length>4000)return fail('invalid_request',413);
 let b:any;try{b=JSON.parse(raw)}catch{return fail('invalid_json')};
 // Only the TEST classroom may invoke any of the three routes.
 // Proof start/finish do not trust a client-supplied pupil ID, score or questions.
 const proofStart=b?.action==='start-proof';
 const proofFinish=b?.action==='finish-proof';
 const proofStartV2=b?.action==='start-proof-v2';
 const proofFinishV2=b?.action==='finish-proof-v2';
 const validProofStartV2=proofStartV2&&b.appKey==='addition-ecrite-simple'
   &&[1,2,3].includes(b.level)&&[4,10,20].includes(b.total)
   &&Object.keys(b).sort().join(',')==='action,appKey,classId,level,total';
 const validProofFinishV2=proofFinishV2&&b.appKey==='addition-ecrite-simple'
   &&validId(b.sessionId)&&Array.isArray(b.answers)
   &&[4,10,20].includes(b.answers.length)
   &&Object.keys(b).sort().join(',')==='action,answers,appKey,classId';
 const validProofStart=proofStart&&b.appKey==='addition-ecrite-simple'
   &&Object.keys(b).sort().join(',')==='action,appKey,classId';
 const validProofFinish=proofFinish&&b.appKey==='addition-ecrite-simple'
   &&validId(b.sessionId)&&Array.isArray(b.answers)&&b.answers.length===4
   &&Object.keys(b).sort().join(',')==='action,answers,appKey,classId';
 const record=b?.action==='game-record'&&APPS.has(b?.appKey)
   &&b.schemaVersion===1&&b.points===0&&b.rewards===null
   &&validId(b.eventId)&&validId(b.expectedStudentId)
   &&int(b.expectedRevision,0,1000000000)&&int(b.expectedResetEpoch,0,1000000000)
   &&['classic','sudden'].includes(b.mode)&&int(b.level,1,3)&&int(b.score,0,1000)
   &&(b.mode==='classic'?([4,10,20].includes(b.total)&&b.score<=b.total):b.total===null);
 if(!b||b.classId!==TEST||(!record&&!validProofStart&&!validProofFinish&&!validProofStartV2&&!validProofFinishV2))
  return fail('invalid_test_record',400);
 try{
  let studentId:string|null=null;
  if(user.is_anonymous===true){
   const device=await one(db.from('connect_devices').select('student_id').eq('auth_user_id',user.id).eq('state','approved').limit(1));
   if(!device)return fail('device_not_approved',403);
   const enrolled=await one(db.from('connect_enrollments').select('student_id')
    .eq('student_id',device.student_id).eq('class_id',TEST).is('left_at',null));
   if(!enrolled)return fail('not_enrolled_in_test',403);
   studentId=device.student_id;
  }else{
   const managed=await one(db.from('connect_class_permissions').select('class_id')
    .eq('teacher_id',user.id).eq('class_id',TEST).eq('can_manage',true));
   if(!managed)return fail('teacher_not_authorized_for_test',403);
   const player=await one(db.from('connect_teacher_players').select('student_id').eq('teacher_id',user.id));
   if(!player)return fail('teacher_player_missing',403);
   studentId=player.student_id;
  }
  // Proof routes bind the pupil entirely from the verified JWT/device/teacher player.
  // Only the legacy native record action carries an expectedStudentId.
  if(!validId(studentId)||(record&&b.expectedStudentId.toLowerCase()!==studentId.toLowerCase()))
   return fail('identity_binding_conflict',409);
  const active=await one(db.from('connect_students').select('id')
   .eq('id',studentId).is('archived_at',null));
  if(!active)return fail('inactive_student',403);
  const enabled=await one(db.from('connect_apps').select('enabled').eq('app_key',b.appKey));
  if(enabled?.enabled!==true)return fail('app_disabled',403);

  if(proofStart||proofFinish||proofStartV2||proofFinishV2){
   const start=proofStart||proofStartV2;
   const functionName=proofStart?'connect_objective_record_test_issue_add_v1':
     proofStartV2?'connect_objective_record_test_issue_add_v2':
     proofFinish?'connect_objective_record_test_finish_add_v1':
     'connect_objective_record_test_finish_add_v2';
   const args=proofStart?{p_student:studentId,p_class:TEST}:
     proofStartV2?{p_student:studentId,p_class:TEST,p_level:b.level,p_total:b.total}:
     {p_student:studentId,p_class:TEST,p_session:b.sessionId,p_answers:b.answers};
   const {data,error}=await db.rpc(functionName,args);
   if(error){
    const codes=new Set(['proof_expired','proof_not_found','proof_replay_collision',
      'stale_reset_epoch','revision_conflict','not_test_subject','invalid_proof_answers']);
    const msg=codes.has(error.message)?error.message:'proof_unavailable';
    if(!codes.has(error.message))console.error('addition_proof_rpc_failed',error.code);
    return fail(msg,['proof_replay_collision','stale_reset_epoch','revision_conflict'].includes(msg)?409:
      msg==='proof_expired'?410:msg==='proof_not_found'?404:
      msg==='invalid_proof_answers'?400:503);
   }
   if(data?.ok!==true||(start?
     (!validId(data.sessionId)||!Array.isArray(data.questions)
      ||data.questions.length!==(proofStart?4:b.total)
      ||(proofStartV2&&(data.level!==b.level||data.total!==b.total))):
     (data.proofVerified!==true||!Number.isSafeInteger(data.verifiedScore)
      ||!Number.isSafeInteger(data.xp?.delta))))
     return fail('invalid_proof_response',503);
   return result(data);
  }

  const {data,error}=await db.rpc('connect_objective_record_test_fixed_v1',{
   p_student:studentId,p_class:TEST,p_app:b.appKey,p_event:b.eventId,
   p_expected_revision:b.expectedRevision,p_reset_epoch:b.expectedResetEpoch,
   p_mode:b.mode,p_level:b.level,p_score:b.score,p_total:b.total
  });
  if(error){
   const known=new Set(['revision_conflict','stale_reset_epoch','event_collision','invalid_result','inactive_student']);
   const msg=known.has(error.message)?error.message:'test_atomic_save_unavailable';
   if(!known.has(error.message))console.error('objective_record_test_atomic_failed',error.code);
   return fail(msg,['revision_conflict','stale_reset_epoch','event_collision'].includes(msg)?409:
    msg==='invalid_result'?400:503);
  }
  if(data?.ok!==true||!Number.isSafeInteger(data.revision)||!data.xp
   ||!Number.isSafeInteger(data.xp.appXp)||!Number.isSafeInteger(data.xp.total)
   ||!Number.isSafeInteger(data.xp.level)||!Number.isSafeInteger(data.xp.delta))
    return fail('invalid_atomic_ack',503);
  return result(data);
 }catch(e){
  console.error('objective_record_test_error',e instanceof Error?e.message:'unknown');
  return fail('test_service_unavailable',503);
 }
});
