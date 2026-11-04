// Authenticated pupil multiplication proof. Isolated from both Addition functions.
// Never accepts a game score, point count, rewards or student identifier from the browser.
import {createClient} from 'npm:@supabase/supabase-js@2.95.0';
import {MULTIPLICATION_TEST_CLASS,MULTIPLICATION_SCHOOL_PRESETS,multiplicationSchoolPreset,mayStartMultiplicationSchoolProof} from './school-visibility.ts';

const BASE=Deno.env.get('SUPABASE_URL')!;
const PUBLIC=Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE=Deno.env.get('SUPABASE_'+'SERVICE_ROLE_KEY')!;
const db=createClient(BASE,SERVICE,{auth:{persistSession:false,autoRefreshToken:false}});
const APP='multiplication-ecrite-simple';
const CLASSES=new Set([MULTIPLICATION_TEST_CLASS,...Object.keys(MULTIPLICATION_SCHOOL_PRESETS)]);
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
 const classicStart=b.action==='start-classic-v1';
 const classicFinish=b.action==='finish-classic-v1';
 const extendedStart=b.action==='start-extended-v1';
 const extendedFinish=b.action==='finish-extended-v1';
 const start=classicStart||extendedStart,finish=classicFinish||extendedFinish;
 if(!start&&!finish)return deny('proof_only',403);
 const keys=Object.keys(b).sort().join(',');
 if(start){
  if(keys!==(classicStart?'action,classId,level,multipliers,total':'action,classId,level,mode,multipliers')
   ||![1,2,3].includes(b.level)
   ||(classicStart?![4,10,20].includes(b.total):!['sudden','three-lives','hard-sudden','hard-three-lives'].includes(b.mode))
   ||!Array.isArray(b.multipliers)||b.multipliers.length<1||b.multipliers.length>8
   ||new Set(b.multipliers).size!==b.multipliers.length
   ||b.multipliers.some((n:unknown)=>!Number.isInteger(n)||(n as number)<2||(n as number)>9))
    return deny('invalid_configuration');
 }else if(keys!=='action,answers,classId,sessionId'||!valid(b.sessionId)
   ||!Array.isArray(b.answers)||
     (classicFinish?![4,10,20].includes(b.answers.length):b.answers.length<1||b.answers.length>120))
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
  // A hidden school card must NEVER be bypassed using the direct Pages URL.
  // Check at the creation of a new challenge. Previously issued sessions may
  // still finish if the professor hides the card while a pupil is working.
  // This check follows JWT, device approval, enrollment and teacher-player
  // verification; no public browser access to the service-role database.
  if(start&&cls!==MULTIPLICATION_TEST_CLASS){
   const preset=multiplicationSchoolPreset(cls);
   if(!preset)return deny('school_class_not_allowed',403);
   const entry=await row(db.from('connect_hub_preset_entries').select('visible')
    .eq('preset_slug',preset).eq('app_key',APP));
   if(!mayStartMultiplicationSchoolProof(cls,entry?.visible===true))
    return deny('school_app_not_open_for_class',403);
  }
  const name=classicStart?'connect_objective_record_school_mul_issue_classic_v1'
   :extendedStart?'connect_objective_record_school_mul_issue_extended_v1'
   :classicFinish?'connect_objective_record_school_mul_finish_classic_v1'
   :'connect_objective_record_school_mul_finish_extended_v1';
  const args=classicStart
   ?{p_student:student,p_class:cls,p_level:b.level,p_total:b.total,p_multipliers:b.multipliers}
   :extendedStart
   ?{p_student:student,p_class:cls,p_mode:b.mode,p_level:b.level,p_multipliers:b.multipliers}
   :{p_student:student,p_class:cls,p_session:b.sessionId,p_answers:b.answers};
  const {data,error:rpcError}=await db.rpc(name,args);
  if(rpcError){
   const known=new Set(['school_class_not_allowed','invalid_proof_configuration','not_school_subject',
    'multipliers_not_allowed','proof_expired','proof_not_found','proof_replay_collision',
    'stale_reset_epoch','revision_conflict','invalid_proof_answers','inactive_student',
    'school_mode_locked','proof_continued_after_end','proof_incomplete_game']);
   const problem=known.has(rpcError.message)?rpcError.message:'proof_unavailable';
   if(!known.has(rpcError.message))console.error('multiplication_proof_rpc_failed',rpcError.code);
   const status=['proof_replay_collision','stale_reset_epoch','revision_conflict'].includes(problem)?409
    :problem==='proof_expired'?410:problem==='proof_not_found'?404
    :['school_class_not_allowed','not_school_subject','inactive_student','multipliers_not_allowed','school_mode_locked'].includes(problem)?403
    :['invalid_proof_answers','invalid_proof_configuration','proof_incomplete_game','proof_continued_after_end'].includes(problem)?400:503;
   return deny(problem,status);
  }
  if(start){
   if(data?.ok!==true||!valid(data.sessionId)||data.level!==b.level
    ||!Array.isArray(data.questions)
    ||(classicStart?data.total!==b.total||data.questions.length!==b.total
      :data.mode!==b.mode||data.limit!==120||data.questions.length!==120))
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
