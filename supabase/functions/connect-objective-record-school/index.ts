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
 if(raw.length>60000)return deny('invalid_request',413);
 let b:any;try{b=JSON.parse(raw)}catch{return deny('invalid_json');}
 const cls=typeof b?.classId==='string'?b.classId.toLowerCase():'';
 const contract=(map as Record<string,typeof map['addition-ecrite-simple']>)[b?.appKey];
 if(!SCHOOL.has(cls)||!contract)return deny('school_class_not_allowed',403);
 const extendedStart=b.action==='start-extended-proof-v1';
 const extendedFinish=b.action==='finish-extended-proof-v1';
 const extendedResume=b.action==='resume-extended-proof-v1';
 const start=b.action===contract.start,finish=b.action===contract.finish;
 if(!start&&!finish&&!extendedStart&&!extendedFinish&&!extendedResume)return deny('proof_only',403);
 if(extendedResume){
  if(!valid(b.sessionId)||Object.keys(b).sort().join(',')!=='action,appKey,classId,sessionId')
   return deny('invalid_configuration');
 }else if(start||extendedStart){
  if(![1,2,3].includes(b.level))return deny('invalid_configuration');
  if(extendedStart){
   if(!['three-lives','sudden','hard-three-lives','hard-sudden'].includes(b.mode)
    ||Object.keys(b).sort().join(',')!=='action,appKey,classId,level,mode')
     return deny('invalid_configuration');
  }else if(![4,10,20].includes(b.total)
   ||Object.keys(b).sort().join(',')!=='action,appKey,classId,level,total')
    return deny('invalid_configuration');
 }else{
  if(!valid(b.sessionId)||!Array.isArray(b.answers)
   ||(extendedFinish?b.answers.length<1||b.answers.length>120:![4,10,20].includes(b.answers.length))
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
  if(extendedResume){
   // Auth et appartenance à la classe validées ci-dessus ; le service-role
   // ne doit jamais retrouver une session par son UUID seul.
   const pending=await one(db.from('connect_objective_record_school_extended_sessions')
    .select('session_id,mode,level,width,total,expected_revision,reset_epoch,questions,expires_at,consumed_at')
    .eq('session_id',b.sessionId).eq('student_id',student)
    .eq('class_id',cls).eq('app_key',b.appKey));
   if(!pending)return deny('proof_not_found',404);
   if(pending.consumed_at)return deny('proof_already_finished',409);
   if(!Number.isFinite(Date.parse(pending.expires_at))||Date.parse(pending.expires_at)<=Date.now())
    return deny('proof_expired',410);
   const state=await one(db.from('connect_states').select('revision,reset_epoch')
    .eq('student_id',student).eq('app_key',b.appKey));
   const revision=Number(pending.expected_revision),epoch=Number(pending.reset_epoch);
   if(!Number.isSafeInteger(revision)||!Number.isSafeInteger(epoch)||
      revision!==Number(state?.revision??0)||epoch!==Number(state?.reset_epoch??0))
    return deny('revision_conflict',409);
   if(!Array.isArray(pending.questions)||pending.questions.length!==120||
      !['three-lives','sudden','hard-three-lives','hard-sudden'].includes(pending.mode)||
      ![1,2,3].includes(pending.level)||pending.total!==120)
    return deny('invalid_proof_response',503);
   return reply({ok:true,resumed:true,sessionId:pending.session_id,appKey:b.appKey,
    mode:pending.mode,level:pending.level,width:pending.width,limit:pending.total,
    revision,resetEpoch:epoch,questions:pending.questions,expiresAt:pending.expires_at});
  }
  const args=extendedStart?
    {p_student:student,p_class:cls,p_app:b.appKey,p_mode:b.mode,p_level:b.level}:
   extendedFinish?
    {p_student:student,p_class:cls,p_app:b.appKey,p_session:b.sessionId,p_answers:b.answers}:
   start?{p_student:student,p_class:cls,p_level:b.level,p_total:b.total}
    :{p_student:student,p_class:cls,p_session:b.sessionId,p_answers:b.answers};
  const rpc=extendedStart?'connect_objective_record_school_issue_extended_v1':
   extendedFinish?'connect_objective_record_school_finish_extended_v1':
   start?contract.issue:contract.grade;
  const {data,error:rpcError}=await db.rpc(rpc,args);
  if(rpcError){
   const known=new Set(['proof_expired','proof_not_found','proof_replay_collision','stale_reset_epoch',
     'revision_conflict','not_school_subject','invalid_proof_answers','school_class_not_allowed',
     'proof_continued_after_end','proof_incomplete_game']);
   const msg=known.has(rpcError.message)?rpcError.message:'proof_unavailable';
   if(!known.has(rpcError.message))console.error('school_addition_rpc_failed',rpcError.code);
   const code=['proof_replay_collision','stale_reset_epoch','revision_conflict'].includes(msg)?409:
    msg==='proof_expired'?410:msg==='proof_not_found'?404:
    ['not_school_subject','school_class_not_allowed'].includes(msg)?403:
    ['invalid_proof_answers','proof_continued_after_end','proof_incomplete_game'].includes(msg)?400:503;
   return deny(msg,code);
  }
  if(data?.ok!==true||((start||extendedStart)?
   (!valid(data.sessionId)||!Array.isArray(data.questions)||
     data.questions.length!==(extendedStart?120:b.total)
     ||data.level!==b.level||(extendedStart?data.mode!==b.mode||data.limit!==120:data.total!==b.total)):
   (data.proofVerified!==true||!Number.isSafeInteger(data.verifiedScore)
      ||!Number.isSafeInteger(data.xp?.delta))))
   return deny('invalid_proof_response',503);
  return reply(data);
 }catch(e){
  console.error('school_addition_error',e instanceof Error?e.message:'unknown');
  return deny('school_service_unavailable',503);
 }
});
