import {APP_KEY,RULESET,initialState,canPlay,judgeCompletion,applyJudgement,xpTotal,remaining,scoreRecords,XP_MAX} from '../../../apps/DIV-Milieu-de-segment-1/connect/reward-contract.mjs';
import {verifySequence} from '../../../apps/DIV-Milieu-de-segment-1/connect/seeded-questions.mjs';
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const int=v=>Number.isSafeInteger(v)&&v>=0;
const headers={'content-type':'application/json','cache-control':'no-store','access-control-allow-origin':'*','access-control-allow-headers':'authorization,apikey,content-type,x-client-info','access-control-allow-methods':'POST,OPTIONS'};
const reply=(v,status=200)=>new Response(JSON.stringify(v),{status,headers});
const errors=new Set(['app_class_not_open','app_disabled','fictive_profile_required','approved_identity_required','identity_binding_conflict','stale_reset_epoch','revision_conflict','event_id_reused','activity_locked','run_missing','invalid_result','invalid_completion','invalid_sequence']);
const state=s=>Object.keys(s.state||{}).length?s.state:initialState();
export function createMilieuHandler({auth,db,access='closed'}){
 return async request=>{
  if(request.method==='OPTIONS')return new Response('',{headers});
  if(request.method!=='POST')return reply({ok:false,error:'method_not_allowed'},405);
  if(access!=='pilot')return reply({ok:false,error:'integration_closed'},403);
  const token=request.headers.get('authorization')?.match(/^Bearer (\S+)$/i)?.[1];
  if(!token)return reply({ok:false,error:'authentication_required'},401);
  try{
   const raw=await request.text();if(raw.length>2000000)return reply({ok:false,error:'payload_too_large'},413);
   const b=JSON.parse(raw);
   if(b.appKey!==APP_KEY||!uuid(b.classId)||!['load','begin','record','share'].includes(b.action))throw Error('invalid_result');
   const verified=await auth.auth.getUser(token),u=verified.data?.user;
   if(verified.error||!uuid(u?.id)||typeof u.is_anonymous!=='boolean')return reply({ok:false,error:'authentication_required'},401);
   const teacher=!u.is_anonymous,base={p_actor:u.id,p_class:b.classId,p_teacher:teacher};
   const call=async(name,args)=>{const {data,error}=await db.rpc('connect_milieu_'+name+'_v2',{...base,...args});if(error)throw Error(error.message);if(!data?.ok)throw Error('db_error');return data};
   const draw=s=>({...s,state:state(s),ruleset:RULESET,authSubject:u.id,classId:b.classId,status:'approved',teacherFree:teacher,xp:{appXp:s.appXp,total:s.totalXp,max:XP_MAX,remaining:remaining(state(s)),delta:s.xpDelta||0},trophies:Object.keys(state(s).cups),scoreRecords:scoreRecords(state(s),s.day)});
   if(b.action==='load'){if(b.expectedStudentId!=null&&!uuid(b.expectedStudentId))throw Error('invalid_result');return reply(draw(await call('load',{p_expected:b.expectedStudentId??null})))}
   if(!uuid(b.expectedStudentId)||!uuid(b.eventId)||!int(b.resetEpoch))throw Error('invalid_result');
   const args={p_student:b.expectedStudentId,p_event:b.eventId,p_epoch:b.resetEpoch};
   if(b.action==='share'){if(b.confirmed!==true)throw Error('invalid_result');return reply({...await call('share',args),authSubject:u.id,classId:b.classId})}
   if(b.action==='begin'){
    const loaded=await call('load',{p_expected:b.expectedStudentId});
    if(!canPlay(state(loaded),b.activity,b.mode??null,teacher))throw Error('activity_locked');
    if(loaded.resetEpoch!==b.resetEpoch)throw Error('stale_reset_epoch');
    return reply(draw(await call('begin',{...args,p_revision:loaded.revision,p_activity:b.activity,p_mode:b.mode??null})));
   }
   const event=await call('event',args);
   if(event.activity!==b.proof?.activity||event.mode!==b.proof?.mode)throw Error('invalid_completion');
   verifySequence(b.proof,event.seed);
   const j=judgeCompletion(b.proof);
   if(event.receipt){
    // Commit routine compares JSONB exactly; duplicate returns previous judgement, no credit.
    return reply(draw(await call('commit',{...args,p_revision:event.revision,p_proof:b.proof,p_judgement:j,p_state:state(event),p_xp:event.appXp,p_cups:Object.keys(state(event).cups)})));
   }
   const applied=applyJudgement(state(event),j,{eventId:b.eventId,day:event.day,teacherFree:teacher});
   return reply(draw(await call('commit',{...args,p_revision:event.revision,p_proof:b.proof,p_judgement:j,p_state:applied.state,p_xp:xpTotal(applied.state),p_cups:Object.keys(applied.state.cups)})));
  }catch(e){const error=errors.has(e.message)?e.message:'service_unavailable';return reply({ok:false,error},['revision_conflict','stale_reset_epoch','event_id_reused'].includes(error)?409:['app_class_not_open','app_disabled','fictive_profile_required','approved_identity_required','identity_binding_conflict','activity_locked'].includes(error)?403:error==='service_unavailable'?503:400)}
 };
}
