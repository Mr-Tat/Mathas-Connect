import {APP_KEY,judgeCompletion} from '../../../apps/GRAN-abaque-m-1/connect/completion-contract.mjs';
export const PILOT_CLASS='4bf3400d-a315-4ea4-a2f3-afaca24dc9b9';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const integer=value=>Number.isSafeInteger(value)&&value>=0;
const headers={'content-type':'application/json; charset=utf-8','cache-control':'no-store','access-control-allow-origin':'*','access-control-allow-headers':'authorization,apikey,content-type,x-client-info','access-control-allow-methods':'POST,OPTIONS'};
const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers});
const deny=(code,status=400)=>reply({ok:false,error:code},status);
const knownErrors=new Set(['pilot_class_required','approved_identity_required','identity_binding_conflict','app_disabled','invalid_result','stale_reset_epoch','revision_conflict','xp_cap','professor_required','not_enrolled','activity_locked','event_id_reused','fictive_profile_required','app_class_not_open']);
async function readBody(request){
 const reader=request.body?.getReader();if(!reader)throw Error('invalid_json');
 const chunks=[];let size=0;
 try{
  for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>2000000){await reader.cancel();throw Error('payload_too_large');}chunks.push(value);}
 }finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw Error('invalid_json');}
}
export function createAbaqueHandler({auth,db,access='closed'}){
 return async function handle(request){
  if(request.method==='OPTIONS')return new Response('',{headers});
  if(request.method!=='POST')return deny('method_not_allowed',405);
  // A browser flag/URL/storage cannot enable a production write.
  if(!['pilot','open'].includes(access))return deny('integration_closed',403);
  const token=request.headers.get('authorization')?.match(/^Bearer (\S+)$/i)?.[1];
  if(!token)return deny('authentication_required',401);
  let body;
  try{body=await readBody(request);}catch(error){return deny(error.message,error.message==='payload_too_large'?413:400);}
  if(!body||body.appKey!==APP_KEY||!uuid.test(body.classId)||
   !['load','record','teacher-summary','teacher-reset'].includes(body.action))return deny('invalid_request');
  if(access==='pilot'&&body.classId!==PILOT_CLASS)return deny('app_class_not_open',403);
  try{
   const verified=await auth.auth.getUser(token),user=verified.data?.user;
   if(verified.error||!user||!uuid.test(user.id)||typeof user.is_anonymous!=='boolean')return deny('authentication_required',401);
   const teacher=!user.is_anonymous;
   const args={p_actor:user.id,p_class:body.classId};
   let routine;
   if(body.action==='load'){
    if(body.expectedStudentId!=null&&!uuid.test(body.expectedStudentId))return deny('invalid_request');
    routine='connect_abaque_load_v1';args.p_teacher=teacher;args.p_expected=body.expectedStudentId??null;
   }else if(body.action==='record'){
    if(!uuid.test(body.expectedStudentId)||!integer(body.revision)||!integer(body.resetEpoch))return deny('invalid_request');
    if(body.event?.expectedResetEpoch!==body.resetEpoch)return deny('stale_reset_epoch',409);
    let result;try{result=judgeCompletion(body.event);}catch{return deny('invalid_completion');}
    routine='connect_abaque_record_v1';Object.assign(args,{p_teacher:teacher,p_student:body.expectedStudentId,
     p_event:result.eventId,p_revision:body.revision,p_epoch:body.resetEpoch,p_result:result});
   }else{
    if(!teacher)return deny('professor_required',403);
    if(body.action==='teacher-summary')routine='connect_abaque_teacher_v1';
    else{
     if(!uuid.test(body.studentId)||!integer(body.resetEpoch)||body.repeatXp===true)return deny('invalid_request');
     routine='connect_abaque_restart_v1';args.p_student=body.studentId;args.p_epoch=body.resetEpoch;
    }
   }
   const {data,error}=await db.rpc(routine,args);
   if(error){
    const code=knownErrors.has(error.message)?error.message:'db_error';
    const status=['revision_conflict','stale_reset_epoch','identity_binding_conflict','event_id_reused'].includes(code)?409:
     ['pilot_class_required','approved_identity_required','app_disabled','professor_required','not_enrolled','activity_locked','fictive_profile_required','app_class_not_open'].includes(code)?403:code==='db_error'?503:400;
    return deny(code,status);
   }
   if(!data||data.ok!==true)return deny('db_error',503);
   return reply({...data,authSubject:user.id,classId:body.classId,status:'approved'});
  }catch{return deny('service_unavailable',503);}
 };
}
