
import { createClient } from 'npm:@supabase/supabase-js@2.95.0';
const url=Deno.env.get('SUPABASE_URL')!, anon=Deno.env.get('SUPABASE_ANON_KEY')!, secret=Deno.env.get('SUPABASE_'+'SERVICE_ROLE_KEY')!;
const db=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
const h={'content-type':'application/json','cache-control':'no-store','access-control-allow-origin':'*','access-control-allow-headers':'authorization,apikey,content-type','access-control-allow-methods':'POST,OPTIONS'};
const fail=(error:string,status=400)=>new Response(JSON.stringify({ok:false,error}),{headers:h,status});
const ok=(payload:object)=>new Response(JSON.stringify({ok:true,...payload}),{headers:h});
const U=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const good=(v:unknown,n:number)=>typeof v==='string'&&v.trim().length>0&&v.length<=n;
const random=()=>Array.from(crypto.getRandomValues(new Uint8Array(16)),x=>x.toString(16).padStart(2,'0')).join('');
const hash=async(v:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v))),x=>x.toString(16).padStart(2,'0')).join('');
async function one(query:any){const {data,error}=await query.maybeSingle();if(error)throw Error('db_failed');return data;}
async function handle(req:Request){
 if(req.method==='OPTIONS')return new Response('',{headers:h});
 if(req.method!=='POST')return fail('method_not_allowed',405);
 const authz=req.headers.get('authorization')||'',token=authz.match(/^Bearer (\S+)$/i)?.[1];
 if(!token)return fail('auth_required',401);
 const client=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:{user},error}=await client.auth.getUser(token);
 if(error||!user)return fail('auth_required',401);
 const raw=await req.text();if(raw.length>8000)return fail('body_too_large',413);
 let b:any;try{b=JSON.parse(raw)}catch{return fail('invalid_json')}
 if(!b||typeof b!=='object'||Array.isArray(b))return fail('invalid_json');
 const teacher=async()=>!!(!user.is_anonymous&&await one(db.from('connect_teachers').select('auth_user_id').eq('auth_user_id',user.id)));
 const manage=async(id:string)=>!!await one(db.from('connect_class_permissions').select('class_id').eq('class_id',id).eq('teacher_id',user.id).eq('can_manage',true));
 try{
 switch(b.action){
 
 case 'teacher-player':{
   // Profil joueur dédié au professeur. La session professeur reste indépendante des élèves.
   if(user.is_anonymous||!await teacher()||!U.test(b.classId||''))return fail('forbidden',403);
   const player=await one(db.from('connect_teacher_players').select('student_id').eq('teacher_id',user.id));
   if(!player)return fail('player_not_configured',404);
   const member=await one(db.from('connect_enrollments').select('student_id').eq('student_id',player.student_id).eq('class_id',b.classId).is('left_at',null));
   if(!member)return ok({status:'wrong_class'});
   const student=await one(db.from('connect_students').select('display_name,avatar_kind,avatar_value,avatar_color,archived_at').eq('id',player.student_id));
   if(!student||student.archived_at)return ok({status:'revoked'});
   return ok({status:'approved',displayName:student.display_name,avatar:{kind:student.avatar_kind||'letter',value:student.avatar_value||'T',color:student.avatar_color||'ocean'},classId:b.classId});
 }
 case 'player-xp':{
   let id:string|null=null;
   if(user.is_anonymous){
     if(!U.test(b.classId||''))return fail('forbidden',403);
     const device=await one(db.from('connect_devices').select('student_id').eq('auth_user_id',user.id).eq('state','approved').limit(1));
     if(device&&await one(db.from('connect_enrollments').select('id').eq('class_id',b.classId).eq('student_id',device.student_id).is('left_at',null)))id=device.student_id;
   }else if(await teacher()&&U.test(b.classId||'')){
     const player=await one(db.from('connect_teacher_players').select('student_id').eq('teacher_id',user.id));
     if(player&&await one(db.from('connect_enrollments').select('id').eq('class_id',b.classId).eq('student_id',player.student_id).is('left_at',null)))id=player.student_id;
   }
   if(!id||!await one(db.from('connect_students').select('id').eq('id',id).is('archived_at',null)))return fail('forbidden',403);
   const {data:summary,error:xpError}=await db.rpc('connect_xp_read_v2',{p_student:id,p_app:'addition-ecrite-simple',p_include_milestones:false});
   if(xpError||!summary)return fail('xp_unavailable',503);
   return ok({xp:{total:summary.total,level:summary.level,next:summary.next,apps:summary.apps,active:true}});
 }
 case 'student-avatar':{
   const kind=b.kind,value=b.value,color=b.color;
   const animals=['fox','panda','frog','lion','penguin','owl','cat','dog','rabbit','bear','koala','wolf','tiger','monkey','elephant','giraffe','zebra','horse','cow','pig','sheep','deer','hedgehog','squirrel','otter','dolphin','whale','octopus','turtle','seal','duck','parrot','flamingo','bee','butterfly','dragon'];
   const objects=['soccer','basketball','tennis','volleyball','bicycle','airplane','rocket','car','train','skateboard','guitar','microphone','headphones','controller','paint','books','camera','star','trophy','music'];
   const smileys=['smile','cool','starstruck','grin','angel','party','cowboy','catface','heartcat','ghost','robot','alien','laughing','happy','wink','hug'];
   const colors=['ocean','sky','indigo','violet','plum','rose','coral','sun','amber','mint','forest','slate'];
   if(!colors.includes(color)||!(['animal','letter','object','smiley'].includes(kind))||(kind==='animal'?!animals.includes(value):kind==='object'?!objects.includes(value):kind==='smiley'?!smileys.includes(value):!(/^[A-Z]$/).test(value)))return fail('input_invalid');
   let studentId:string|null=null;
   if(user.is_anonymous){
     const device=await one(db.from('connect_devices').select('student_id').eq('auth_user_id',user.id).eq('state','approved').limit(1));
     studentId=device?.student_id||null;
   }else if(await teacher()){
     const player=await one(db.from('connect_teacher_players').select('student_id').eq('teacher_id',user.id));
     studentId=player?.student_id||null;
   }
   if(!studentId)return fail('forbidden',403);
   const updated=await db.from('connect_students').update({avatar_kind:kind,avatar_value:value,avatar_color:color}).eq('id',studentId).is('archived_at',null).select('id');
   if(!updated.error&&!updated.data?.length)return fail('profile_archived',403);
   return updated.error?fail('db_failed',500):ok({avatar:{kind,value,color}});
 }
 case 'student-device-label':{
   if(!user.is_anonymous||typeof b.label!=='string')return fail('forbidden',403);
   const label=b.label.trim();
   if(label.length<1||label.length>40||/[<>\u0000-\u001f]/.test(label))return fail('input_invalid');
   const device=await one(db.from('connect_devices').select('id').eq('auth_user_id',user.id).eq('state','approved').limit(1));
   if(!device)return fail('forbidden',403);
   const result=await db.from('connect_devices').update({device_label:label}).eq('id',device.id).eq('auth_user_id',user.id).eq('state','approved');
   return result.error?fail('db_failed',500):ok({label});
 }
 case 'student-release':{
   if(!user.is_anonymous)return fail('forbidden',403);
   const found=await db.from('connect_devices').select('id').eq('auth_user_id',user.id).eq('state','approved').limit(20);
   if(found.error)return fail('db_failed',500);
   const ids=found.data.map((d:any)=>d.id);
   if(!ids.length)return ok({released:true});
   const at=new Date().toISOString();
   const devices=await db.from('connect_devices').update({state:'revoked',revoked_at:at}).eq('auth_user_id',user.id).eq('state','approved').in('id',ids);
   if(devices.error)return fail('db_failed',500);
   const launches=await db.from('connect_launches').update({revoked_at:at}).in('device_id',ids).is('revoked_at',null);
   return launches.error?fail('db_failed',500):ok({released:true});
 }
 case 'student-me':{
   if(!user.is_anonymous||!U.test(b.classId||''))return fail('forbidden',403);
   const d=await one(db.from('connect_devices').select('student_id').eq('auth_user_id',user.id).eq('state','approved').limit(1));
   if(d){
     const e=await one(db.from('connect_enrollments').select('id').eq('student_id',d.student_id).eq('class_id',b.classId).is('left_at',null));
     if(!e)return ok({status:'wrong_class'});
     const student=await one(db.from('connect_students').select('display_name,avatar_kind,avatar_value,avatar_color,archived_at').eq('id',d.student_id));
     if(!student||student.archived_at)return ok({status:'revoked'});
     return ok({status:'approved',displayName:student?.display_name??'Élève',avatar:{kind:student?.avatar_kind||'letter',value:student?.avatar_value||String(student?.display_name||'E').slice(0,1).toUpperCase(),color:student?.avatar_color||'ocean'},level:{number:1,xp:0,next:90,active:false},classId:b.classId});
   }
   const revoked=await one(db.from('connect_devices').select('id').eq('auth_user_id',user.id).eq('state','revoked').limit(1));
   return ok({status:revoked?'revoked':'unregistered'});
 }
 case 'teacher-manage-student':{
   if(!await teacher()||!U.test(b.classId||'')||!U.test(b.studentId||'')||!['archive','restore','delete'].includes(b.operation))return fail('forbidden',403);
   if(!await manage(b.classId))return fail('forbidden',403);
   const student=await one(db.from('connect_students').select('id,display_name,archived_at').eq('id',b.studentId));
   if(!student)return fail('not_found',404);
   if(b.operation==='delete'&&(!student.archived_at||b.confirmName!==student.display_name||b.confirmPhrase!=='SUPPRIMER DÉFINITIVEMENT'))return fail('confirmation_required',400);
   const known=b.operation==='delete'?await db.from('connect_devices').select('auth_user_id').eq('student_id',b.studentId):null;
   if(known?.error)return fail('db_failed',500);
   const result=await db.rpc('connect_manage_student',{p_teacher:user.id,p_class:b.classId,p_student:b.studentId,p_action:b.operation});
   if(result.error)return fail('manage_failed',409);
   let accountCleanupPending=false;
   if(b.operation==='delete'){
     for(const authId of new Set((known?.data||[]).map((x:any)=>x.auth_user_id))){
       const [devices,requests]=await Promise.all([db.from('connect_devices').select('id').eq('auth_user_id',authId).limit(1),db.from('connect_join_requests').select('id').eq('auth_user_id',authId).limit(1)]);
       if(devices.error||requests.error){accountCleanupPending=true;continue}
       if(devices.data.length||requests.data.length)continue;
       const verified=await db.auth.admin.getUserById(authId);
       if(verified.error){accountCleanupPending=true;continue}
       if(verified.data.user?.is_anonymous){
         const removed=await db.auth.admin.deleteUser(authId);
         if(removed.error)accountCleanupPending=true;
       }
     }
   }
   return ok({operation:result.data,accountCleanupPending});
 }
 case 'teacher-dashboard':{
   if(!await teacher())return fail('forbidden',403);
   const perms=await db.from('connect_class_permissions').select('class_id').eq('teacher_id',user.id).eq('can_manage',true).limit(100);
   if(perms.error)return fail('db_failed',500);
   const ids=perms.data.map((x:any)=>x.class_id);
   const [years,classes]=await Promise.all([
     db.from('connect_school_years').select('id,label,starts_on,ends_on').order('starts_on',{ascending:false}).limit(100),
     ids.length?db.from('connect_classes').select('id,name,year_id').in('id',ids).order('created_at',{ascending:true}):Promise.resolve({data:[],error:null})
   ]);
   if(years.error||classes.error)return fail('db_failed',500);
   if(!U.test(b.classId||'')||!ids.includes(b.classId)){
     if(!ids.length)return ok({years:years.data,classes:classes.data,requests:[],students:[],devices:[]});
     const p=await db.from('connect_join_requests').select('id,class_id,first_name,last_initial,verify_code,expires_at,state')
       .in('class_id',ids).eq('state','pending').gt('expires_at',new Date().toISOString()).order('created_at').limit(100);
     if(p.error)return fail('db_failed',500);
     const rows=p.data||[];
     if(!rows.length)return ok({years:years.data,classes:classes.data,requests:[],students:[],devices:[]});
     const classesWithRequests=[...new Set(rows.map((r:any)=>r.class_id))];
     const en=await db.from('connect_enrollments').select('class_id,student_id')
       .in('class_id',classesWithRequests).is('left_at',null).limit(1000);
     if(en.error)return fail('db_failed',500);
     const idsWithStudent=[...new Set((en.data||[]).map((e:any)=>e.student_id))];
     const students=idsWithStudent.length?await db.from('connect_students')
       .select('id,display_name,archived_at').in('id',idsWithStudent):{data:[],error:null};
     if(students.error)return fail('db_failed',500);
     const names=new Map((students.data||[]).filter((e:any)=>!e.archived_at).map((e:any)=>[e.id,e.display_name]));
     const grouped=new Map<string,any[]>();
     for(const e of en.data||[]){const n=names.get(e.student_id);if(n){const arr=grouped.get(e.class_id)||[];arr.push({id:e.student_id,display_name:n});grouped.set(e.class_id,arr)}}
     const normalized=(v:string)=>String(v||'').normalize('NFC').toLocaleLowerCase('fr').replace(/[.\\s]+/g,'');
     return ok({years:years.data,classes:classes.data,students:[],devices:[],
       requests:rows.map((r:any)=>({...r,matches:(grouped.get(r.class_id)||[])
         .filter((st:any)=>normalized(st.display_name)===normalized(r.first_name+'.'+r.last_initial))}))});
   }
   const [requests,enrollments]=await Promise.all([
     db.from('connect_join_requests').select('id,first_name,last_initial,verify_code,state,created_at,expires_at,student_id')
       .eq('class_id',b.classId).eq('state','pending').gt('expires_at',new Date().toISOString()).order('created_at').limit(100),
     db.from('connect_enrollments').select('student_id').eq('class_id',b.classId).is('left_at',null).limit(200)
   ]);
   if(requests.error||enrollments.error)return fail('db_failed',500);
   const studentsIds=[...new Set(enrollments.data.map((x:any)=>x.student_id))];
   const [students,devices]=await Promise.all([
     studentsIds.length?db.from('connect_students').select('id,display_name,archived_at').in('id',studentsIds):Promise.resolve({data:[],error:null}),
     studentsIds.length?db.from('connect_devices').select('id,student_id,state,requested_at,device_label').in('student_id',studentsIds).limit(500):Promise.resolve({data:[],error:null})
   ]);
   if(students.error||devices.error)return fail('db_failed',500);
   return ok({years:years.data,classes:classes.data,requests:requests.data,students:students.data.filter((s:any)=>!s.archived_at),archivedStudents:students.data.filter((s:any)=>!!s.archived_at),devices:devices.data});
 }
 case 'teacher-results':{
   if(!U.test(b.classId||'')||!await manage(b.classId))return fail('forbidden',403);
   if(b.appKey!=='addition-ecrite-simple')return fail('input_invalid');
   const enrollment=await db.from('connect_enrollments').select('student_id').eq('class_id',b.classId).is('left_at',null).limit(120);
   if(enrollment.error)return fail('db_failed',500);
   const ids=enrollment.data.map((v:any)=>v.student_id);
   if(!ids.length)return ok({students:[]});
   const [names,states]=await Promise.all([
     db.from('connect_students').select('id,display_name').in('id',ids),
     db.from('connect_states').select('student_id,state_data,revision').eq('app_key',b.appKey).in('student_id',ids)
   ]);
   if(names.error||states.error)return fail('db_failed',500);
   const byId=new Map(states.data.map((v:any)=>[v.student_id,v]));
   const students=names.data.map((n:any)=>{
     const state:any=byId.get(n.id),data:any=state?.state_data||{};
     return {id:n.id,name:n.display_name,recent:Array.isArray(data.recent)?data.recent.slice(0,3):[],bestPoints:data.bestPoints??null,todayBest:data.todayBest??null,hasData:!!state};
   });
   return ok({students});
 }
 case 'teacher-years':{
   if(!await teacher())return fail('forbidden',403);
   const r=await db.from('connect_school_years')
     .select('id,label,starts_on,ends_on').order('starts_on',{ascending:false}).limit(100);
   return r.error?fail('db_failed',500):ok({years:r.data});
 }
 case 'teacher-classes':{
   if(!await teacher())return fail('forbidden',403);
   const perm=await db.from('connect_class_permissions').select('class_id').eq('teacher_id',user.id).eq('can_manage',true);
   if(perm.error)return fail('db_failed',500);
   const ids=perm.data.map((x:any)=>x.class_id);
   if(!ids.length)return ok({classes:[]});
   const c=await db.from('connect_classes').select('id,name,year_id').in('id',ids).order('created_at',{ascending:true});
   if(c.error)return fail('db_failed',500);
   return ok({classes:c.data});
 }
 case 'teacher-join-requests':{
   if(!U.test(b.classId||'')||!await manage(b.classId))return fail('forbidden',403);
   const r=await db.from('connect_join_requests')
    .select('id,first_name,last_initial,verify_code,state,created_at,expires_at,student_id')
    .eq('class_id',b.classId).eq('state','pending')
    .gt('expires_at',new Date().toISOString())
    .order('created_at',{ascending:true}).limit(100);
   if(r.error)return fail('db_failed',500);
   return ok({requests:r.data});
 }
 case 'teacher-students':{
   if(!U.test(b.classId||'')||!await manage(b.classId))return fail('forbidden',403);
   const e=await db.from('connect_enrollments').select('student_id').eq('class_id',b.classId).is('left_at',null);
   if(e.error)return fail('db_failed',500);
   if(!e.data.length)return ok({students:[]});
   const s=await db.from('connect_students').select('id,display_name').in('id',e.data.map((x:any)=>x.student_id)).is('archived_at',null);
   return s.error?fail('db_failed',500):ok({students:s.data});
 }
 case 'teacher-review-join':{
   if(!U.test(b.requestId||'')||typeof b.approve!=='boolean')return fail('input_invalid');
   if(!await teacher())return fail('forbidden',403);
   const args:any={p_teacher:user.id,p_request:b.requestId,p_approve:b.approve};
   if(b.existingStudentId){
     if(!U.test(b.existingStudentId))return fail('input_invalid');
     if(!await one(db.from('connect_students').select('id').eq('id',b.existingStudentId).is('archived_at',null)))return fail('student_archived',409);
     args.p_existing_student=b.existingStudentId;
   }
   const r=await db.rpc('connect_review_join',args);
   return r.error?fail('decision_failed',409):ok({result:r.data});
 }
 case 'student-join':{
   if(!user.is_anonymous)return fail('anonymous_device_required',403);
   if(!U.test(b.classId||'')||!good(b.firstName,40)||!good(b.lastInitial,2))
     return fail('input_invalid');
   const r=await db.rpc('connect_submit_join',{
     p_class:b.classId,p_auth_user:user.id,p_first:b.firstName,p_initial:b.lastInitial});
   return r.error?fail(r.error.message?.includes('device_already_approved')?'device_already_approved':'join_failed',409):ok({request:r.data});
 }
 case 'student-join-status':{
   if(!user.is_anonymous||!U.test(b.classId||''))return fail('forbidden',403);
   const r=await db.from('connect_join_requests').select('id,verify_code,state,expires_at')
     .eq('class_id',b.classId).eq('auth_user_id',user.id).maybeSingle();
   if(r.error)return fail('db_failed',500);
   // Un appareil approuvé doit proposer le profil courant, même lorsque
   // le lien ouvert appartient à une autre classe. Aucune identité n'est
   // révélée avant validation du JWT anonyme et de l'appareil approuvé.
   if(!r.data||r.data.state!=='pending'){
     const d=await one(db.from('connect_devices').select('student_id')
       .eq('auth_user_id',user.id).eq('state','approved').limit(1));
     if(d){
       const [student,enrolled]=await Promise.all([
         one(db.from('connect_students').select('display_name,avatar_kind,avatar_value,avatar_color')
           .eq('id',d.student_id).is('archived_at',null)),
         one(db.from('connect_enrollments').select('class_id')
           .eq('student_id',d.student_id).is('left_at',null).limit(1))
       ]);
       if(student&&enrolled&&b.awaitingApproval===true&&r.data?.state==='approved'&&enrolled.class_id===b.classId)return ok({request:{state:'approved'}});
       if(student&&enrolled)return ok({request:{state:'already_approved',
         classId:enrolled.class_id,displayName:student.display_name,
         avatar:{kind:student.avatar_kind||'animal',value:student.avatar_value||'fox',color:student.avatar_color||'ocean'}}});
       return ok({request:{state:'revoked'}});
     }
   }
   if(!r.data)return ok({request:null});
   if(r.data.state==='approved')return ok({request:{state:'revoked'}});
   if(r.data.state==='pending'&&new Date(r.data.expires_at)<new Date())
     return ok({request:{state:'expired'}});
   return ok({request:r.data});
 }
 case 'student-cancel-join':{
   if(!user.is_anonymous||!U.test(b.classId||''))return fail('forbidden',403);
   const r=await db.rpc('connect_cancel_join',{p_class:b.classId,p_auth_user:user.id});
   return r.error?fail('cancel_failed',409):ok({cancelled:r.data});
 }
 case 'teacher-create-year':{
  if(!await teacher())return fail('forbidden',403);
  if(!good(b.label,32)||!/^\d{4}-\d{2}-\d{2}$/.test(b.startsOn||'')||!/^\d{4}-\d{2}-\d{2}$/.test(b.endsOn||''))return fail('input_invalid');
  const r=await db.from('connect_school_years').insert({label:b.label,starts_on:b.startsOn,ends_on:b.endsOn}).select('id').single();
  return r.error?fail('year_failed'):ok({year:{id:r.data.id}});
 }
 case 'teacher-create-class':{
  if(!await teacher())return fail('forbidden',403);
  if(!U.test(b.yearId||'')||!good(b.name,100))return fail('input_invalid');
  const r=await db.rpc('connect_create_class',{p_teacher:user.id,p_year:b.yearId,p_name:b.name});
  return r.error?fail('class_failed'):ok({class:{id:r.data}});
 }
 case 'teacher-create-student':{
  if(!U.test(b.classId||'')||!good(b.name,120)||!await manage(b.classId))return fail('forbidden',403);
  const r=await db.rpc('connect_create_student',{p_teacher:user.id,p_class:b.classId,p_name:b.name});
  return r.error?fail('student_failed'):ok({student:{id:r.data}});
 }
 case 'teacher-pair-code':{
  if(!U.test(b.classId||'')||!U.test(b.studentId||'')||!await manage(b.classId))return fail('forbidden',403);
  if(!await one(db.from('connect_enrollments').select('id').eq('class_id',b.classId).eq('student_id',b.studentId).is('left_at',null))||!await one(db.from('connect_students').select('id').eq('id',b.studentId).is('archived_at',null)))return fail('not_enrolled',403);
  const code=random(),expiry=new Date(Date.now()+10*60000).toISOString();
  const r=await db.from('connect_pairings').insert({class_id:b.classId,student_id:b.studentId,created_by:user.id,code_hash:await hash(code),expires_at:expiry});
  return r.error?fail('pair_failed'):ok({code,expiresInSeconds:600});
 }
 case 'device-claim':{
  if(!user.is_anonymous||!good(b.code,64))return fail('anonymous_device_required',403);
  const r=await db.rpc('connect_claim_device',{p_auth_user:user.id,p_code_hash:await hash(b.code)});
  return r.error?fail('code_invalid',403):ok({device:{id:r.data,state:'requested'}});
 }
 case 'teacher-devices':{
  if(!U.test(b.classId||'')||!await manage(b.classId))return fail('forbidden',403);
  const e=await db.from('connect_enrollments').select('student_id').eq('class_id',b.classId).is('left_at',null);
  if(e.error)return fail('db_failed',500);
  const ids=(e.data||[]).map(x=>x.student_id);if(!ids.length)return ok({devices:[]});
  const r=await db.from('connect_devices').select('id,student_id,state,requested_at').in('student_id',ids);
  return r.error?fail('db_failed',500):ok({devices:r.data});
 }
 case 'teacher-device-decision':{
  if(!U.test(b.classId||'')||!U.test(b.deviceId||'')||!['approved','revoked'].includes(b.decision)||!await manage(b.classId))return fail('forbidden',403);
  const r=await db.rpc('connect_decide_device',{p_teacher:user.id,p_class:b.classId,p_device:b.deviceId,p_decision:b.decision});
  return r.error?fail('decision_failed',409):ok({state:r.data});
 }
 default:return fail('unknown_action',404);
 }
 }catch{return fail('request_failed',500)}
}
Deno.serve(handle);
