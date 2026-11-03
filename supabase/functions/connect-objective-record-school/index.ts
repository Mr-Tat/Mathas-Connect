// Real-school, JWT-bound, arithmetic-issued proof only. No browser score endpoint.
// Does not modify the TEST pilot or legacy applications.
// PostgreSQL service-role-only school_* RPCs perform the actual grading + XP.
import {createClient} from 'npm:@supabase/supabase-js@2.95.0';
const URL=Deno.env.get('SUPABASE_URL')!;
const PUBLIC=Deno.env.get('SUPABASE_ANON_KEY')!;
const ADMIN=Deno.env.get('SUPABASE_'+'SERVICE_ROLE_KEY')!;
const SCHOOL=new Set([
 '8fe170fa-9e8f-4e80-885a-b0ba68026f64',
 '71f5f4a5-3f25-4ec7-ac29-c33d2e6b395e',
 '1b021ed9-4846-4203-9c7b-4b5fa8d7adab',
 '0d8ba828-59cc-468b-a4b8-7b2a1af10b88',
 'a9195199-0a28-4e86-99ce-47b36dd6e646'
]);
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const valid=(v:unknown):v is string=>typeof v==='string'&&UUID.test(v);
const cors={'access-control-allow-origin':'*','access-control-allow-headers':'authorization,apikey,content-type',
 'access-control-allow-methods':'POST,OPTIONS','cache-control':'no-store','content-type':'application/json'};
const reply=(data:object,status=200)=>new Response(JSON.stringify(data),{status,headers:cors});
const deny=(error:string,status=400)=>reply({ok:false,error},status);
const db=createClient(URL,ADMIN,{auth:{persistSession:false,autoRefreshToken:false}});
const one=async(q:any)=>{const {data,error}=await q.maybeSingle();if(error)throw Error('database_unavailable');return data;};
const map=Object.freeze({
 'addition-ecrite-simple':{start:'start-proof-v2',finish:'finish-proof-v2',
  issue:'connect_objective_record_school_issue_add_v1',grade:'connect_objective_record_school_finish_add_v1'},
 'addition-ecrite-multiple':{start:'start-proof-multi-v1',finish:'finish-proof-multi-v1',
  issue:'connect_objective_record_school_issue_multi_v1',grade:'connect_objective_record_school_finish_multi_v1'}
});
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response('',{headers:cors});
 if(req.method!=='POST')return deny('method_not_allowed',405);
 const token=req.headers.get('authorization')?.match(/^Bearer (\S+)$/i)?.[1];
 if(!token)return deny('auth_required',401);
 const client=createClient(URL,PUBLIC,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:{user},error}=await client.auth.getUser(token);
 if(error||!user)return deny('auth_required',401);
 const raw=await req.text();
 if(raw.length>10000)return deny('invalid_request',413);
 let b:any;try{b=JSON.parse(raw)}catch{return deny('invalid_json');}
 const cls=typeof b?.classId==='string'?b.classId.toLowerCase():'';
 const contract=(map as Record<string,typeof map['addition-ecrite-simple']>)[b?.appKey];
 if(!SCHOOL.has(cls)||!contract)return deny('school_class_not_allowed',403);
 const start=b.action===contract.start,finish=b.action===contract.finish;
 if(!start&&!finish)return deny('proof_only',403);
 if(start){
  if(![1,2,3].includes(b.level)||![4,10,20].includes(b.total)
   ||Object.keys(b).sort().join(',')!=='action,appKey,classId,level,total')
    return deny('invalid_configuration');
 }else{
  if(!valid(b.sessionId)||!Array.isArray(b.answers)
   ||![4,10,20].includes(b.answers.length)
   ||Object.keys(b).sort().join(',')!=='action,answers,appKey,classId,sessionId')
    return deny('invalid_answers');
 }
 try{
  let student:string|null=null;
  if(user.is_anonymous===true){
   const device=await one(db.from('connect_devices').select('student_id')
    .eq('auth_user_id',user.id).eq('state','approved').limit(1));
   if(!device)return deny('device_not_approved',403);
   const enrolled=await one(db.from('connect_enrollments').select('student_id')
    .eq('student_id',device.student_id).eq('class_id',cls).is('left_at',null));
   if(!enrolled)return deny('not_enrolled',403);
   student=device.student_id;
  }else{
   const permitted=await one(db.from('connect_class_permissions').select('class_id')
    .eq('teacher_id',user.id).eq('class_id',cls).eq('can_manage',true));
   if(!permitted)return deny('teacher_not_authorized',403);
   const player=await one(db.from('connect_teacher_players').select('student_id')
    .eq('teacher_id',user.id));
   if(!player)return deny('teacher_player_missing',403);
   student=player.student_id;
  }
  if(!valid(student))return deny('identity_binding_conflict',409);
  const alive=await one(db.from('connect_students').select('id').eq('id',student).is('archived_at',null));
  if(!alive)return deny('inactive_student',403);
  const app=await one(db.from('connect_apps').select('enabled').eq('app_key',b.appKey));
  if(app?.enabled!==true)return deny('app_disabled',403);
  const args=start?{p_student:student,p_class:cls,p_level:b.level,p_total:b.total}
   :{p_student:student,p_class:cls,p_session:b.sessionId,p_answers:b.answers};
  const {data,error:rpcError}=await db.rpc(start?contract.issue:contract.grade,args);
  if(rpcError){
   const known=new Set(['proof_expired','proof_not_found','proof_replay_collision','stale_reset_epoch',
     'revision_conflict','not_school_subject','invalid_proof_answers','school_class_not_allowed']);
   const msg=known.has(rpcError.message)?rpcError.message:'proof_unavailable';
   if(!known.has(rpcError.message))console.error('school_addition_rpc_failed',rpcError.code);
   const code=['proof_replay_collision','stale_reset_epoch','revision_conflict'].includes(msg)?409:
    msg==='proof_expired'?410:msg==='proof_not_found'?404:
    ['not_school_subject','school_class_not_allowed'].includes(msg)?403:
    msg==='invalid_proof_answers'?400:503;
   return deny(msg,code);
  }
  if(data?.ok!==true||(start?
   (!valid(data.sessionId)||!Array.isArray(data.questions)||data.questions.length!==b.total
     ||data.level!==b.level||data.total!==b.total):
   (data.proofVerified!==true||!Number.isSafeInteger(data.verifiedScore)
      ||!Number.isSafeInteger(data.xp?.delta))))
   return deny('invalid_proof_response',503);
  return reply(data);
 }catch(e){
  console.error('school_addition_error',e instanceof Error?e.message:'unknown');
  return deny('school_service_unavailable',503);
 }
});
