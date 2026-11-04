// Authenticated pupil multiplication proof. Isolated from both Addition functions.
// Never accepts a game score, point count, rewards or student identifier from the browser.
import {createClient} from 'npm:@supabase/supabase-js@2.95.0';

const BASE=Deno.env.get('SUPABASE_URL')!;
const PUBLIC=Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE=Deno.env.get('SUPABASE_'+'SERVICE_ROLE_KEY')!;
const db=createClient(BASE,SERVICE,{auth:{persistSession:false,autoRefreshToken:false}});
const APP='multiplication-ecrite-simple';
const CLASS_TEST='4bf3400d-a315-4ea4-a2f3-afaca24dc9b9';
const CLASSES=new Set([CLASS_TEST,
 '8fe170fa-9e8f-4e80-885a-b0ba68026f64',
 '71f5f4a5-3f25-4ec7-ac29-c33d2e6b395e',
 '1b021ed9-4846-4203-9c7b-4b5fa8d7adab',
 '0d8ba828-59cc-468b-a4b8-7b2a1af10b88',
 'a9195199-0a28-4e86-99ce-47b36dd6e646'
]);
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const valid=(x:unknown):x is string=>typeof x==='string'&&UUID.test(x);
const cors={'access-control-allow-origin':'*',
 'access-control-allow-headers':'authorization,apikey,content-type',
 'access-control-allow-methods':'POST,OPTIONS','cache-control':'no-store',
 'content-type':'application/json'};
const reply=(data:object,status=200)=>new Response(JSON.stringify(data),{status,headers:cors});
const deny=(reason:string,status=400)=>reply({ok:false,error:reason},status);
async function row(q:any){
 const {data,error}=await q.maybeSingle();
 if(error)throw Error('database_unavailable');
 return data;
}
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response('',{headers:cors});
 if(req.method!=='POST')return deny('method_not_allowed',405);
 const token=req.headers.get('authorization')?.match(/^Bearer (\S+)$/i)?.[1];
 if(!token)return deny('auth_required',401);
 const publicClient=createClient(BASE,PUBLIC,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:{user},error}=await publicClient.auth.getUser(token);
 if(error||!user)return deny('auth_required',401);
 const raw=await req.text();
 if(raw.length>52000)return deny('payload_too_large',413);
 let input:any;try{input=JSON.parse(raw)}catch{return deny('invalid_json')}
 const b=input;
 if(!b||typeof b!=='object'||Array.isArray(b))return deny('invalid_request');
 const cls=typeof b.classId==='string'?b.classId.toLowerCase():'';
 if(!CLASSES.has(cls))return deny('school_class_not_allowed',403);
 const start=b.action==='start-classic-v1';
 const finish=b.action==='finish-classic-v1';
 if(!start&&!finish)return deny('proof_only',403);
 const keys=Object.keys(b).sort().join(',');
 if(start){
  if(keys!=='action,classId,level,multipliers,total'
   ||![1,2,3].includes(b.level)||![4,10,20].includes(b.total)
   ||!Array.isArray(b.multipliers)||b.multipliers.length<1||b.multipliers.length>8
   ||new Set(b.multipliers).size!==b.multipliers.length
   ||b.multipliers.some((n:unknown)=>!Number.isInteger(n)||(n as number)<2||(n as number)>9))
    return deny('invalid_configuration');
 }else if(keys!=='action,answers,classId,sessionId'||!valid(b.sessionId)
   ||!Array.isArray(b.answers)||![4,10,20].includes(b.answers.length))
   return deny('invalid_answers');
 try{
  let student:string|null=null;
  if(user.is_anonymous===true){
   const device=await row(db.from('connect_devices').select('student_id')
    .eq('auth_user_id',user.id).eq('state','approved').limit(1));
   if(!device)return deny('device_not_approved',403);
   const enrolled=await row(db.from('connect_enrollments').select('student_id')
    .eq('student_id',device.student_id).eq('class_id',cls).is('left_at',null));
   if(!enrolled)return deny('not_enrolled',403);
   student=device.student_id;
  }else{
   const permitted=await row(db.from('connect_class_permissions').select('class_id')
    .eq('teacher_id',user.id).eq('class_id',cls).eq('can_manage',true));
   if(!permitted)return deny('teacher_not_authorized',403);
   const player=await row(db.from('connect_teacher_players').select('student_id')
    .eq('teacher_id',user.id));
   if(!player)return deny('teacher_player_missing',403);
   student=player.student_id;
  }
  if(!valid(student))return deny('identity_binding_conflict',409);
  const live=await row(db.from('connect_students').select('id')
   .eq('id',student).is('archived_at',null));
  if(!live)return deny('inactive_student',403);
  const app=await row(db.from('connect_apps').select('enabled').eq('app_key',APP));
  if(app?.enabled!==true)return deny('app_disabled',403);
  const name=start?'connect_objective_record_school_mul_issue_classic_v1':
   'connect_objective_record_school_mul_finish_classic_v1';
  const args=start
   ?{p_student:student,p_class:cls,p_level:b.level,p_total:b.total,p_multipliers:b.multipliers}
   :{p_student:student,p_class:cls,p_session:b.sessionId,p_answers:b.answers};
  const {data,error:rpcError}=await db.rpc(name,args);
  if(rpcError){
   const known=new Set(['school_class_not_allowed','invalid_proof_configuration','not_school_subject',
    'multipliers_not_allowed','proof_expired','proof_not_found','proof_replay_collision',
    'stale_reset_epoch','revision_conflict','invalid_proof_answers','inactive_student']);
   const problem=known.has(rpcError.message)?rpcError.message:'proof_unavailable';
   if(!known.has(rpcError.message))console.error('multiplication_proof_rpc_failed',rpcError.code);
   const status=['proof_replay_collision','stale_reset_epoch','revision_conflict'].includes(problem)?409
    :problem==='proof_expired'?410:problem==='proof_not_found'?404
    :['school_class_not_allowed','not_school_subject','inactive_student','multipliers_not_allowed'].includes(problem)?403
    :['invalid_proof_answers','invalid_proof_configuration'].includes(problem)?400:503;
   return deny(problem,status);
  }
  if(start){
   if(data?.ok!==true||!valid(data.sessionId)||data.level!==b.level
    ||data.total!==b.total||!Array.isArray(data.questions)||data.questions.length!==b.total)
    return deny('invalid_proof_response',503);
  }else if(data?.ok!==true||data.proofVerified!==true
   ||!Number.isSafeInteger(data.verifiedScore)||data.verifiedScore<0
   ||data.verifiedScore>b.answers.length||!Number.isSafeInteger(data.xp?.delta))
   return deny('invalid_proof_response',503);
  return reply(data);
 }catch(err){
  console.error('multiplication_school_error',err instanceof Error?err.message:'unknown');
  return deny('school_service_unavailable',503);
 }
});
