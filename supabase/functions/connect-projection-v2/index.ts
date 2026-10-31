import {createClient} from 'npm:@supabase/supabase-js@2.95.0';

// Teacher-only Projection V2 API. Every read and write checks verified JWT,
// teacher status, and class-specific management permissions.
// Password is checked by Supabase Auth, never persisted or logged.
const url=Deno.env.get('SUPABASE_URL')!;
const anon=Deno.env.get('SUPABASE_ANON_KEY')!;
const secret=Deno.env.get('SUPABASE_'+'SERVICE_ROLE_KEY')!;
const db=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
const headers={'content-type':'application/json','cache-control':'no-store','access-control-allow-origin':'*',
 'access-control-allow-headers':'authorization,apikey,content-type','access-control-allow-methods':'POST,OPTIONS'};
const respond=(body:object,status=200)=>new Response(JSON.stringify(body),{status,headers});
const deny=(code:string,status=400)=>respond({ok:false,error:code},status);
const uuid=(s:unknown)=>typeof s==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
const keys=['addition-ecrite-simple','multiplication-ecrite-simple','soustraction-ecrite-simple',
 'addition-ecrite-multiple','melange-calculs-ecrits'];
const allowKey=(k:unknown)=>typeof k==='string'&&keys.includes(k);
const distinct=(x:string[])=>[...new Set(x)];
const classOptions=(o:any)=>o&&typeof o==='object'&&!Array.isArray(o)&&
 Array.isArray(o.scoreApps)&&o.scoreApps.length<=keys.length&&o.scoreApps.every(allowKey)&&
 Array.isArray(o.percentageApps)&&o.percentageApps.length<=keys.length&&o.percentageApps.every(allowKey)&&
 Array.isArray(o.comparisons)&&o.comparisons.length<=4&&o.comparisons.every(uuid)&&
 (o.comparisonDisplay===undefined||(Array.isArray(o.comparisonDisplay)&&o.comparisonDisplay.length<=4&&
   o.comparisonDisplay.every((v:any)=>v&&uuid(v.classId)&&typeof v.score==='boolean'&&
     typeof v.percentage==='boolean'&&(v.score||v.percentage))))&&
 Number.isInteger(o.rotationSeconds)&&o.rotationSeconds>=45&&o.rotationSeconds<=180;

async function records(query:any){
 const {data,error}=await query;
 if(error)throw Error('database_read');
 return data??[];
}
async function ownClasses(teacherId:string,ids:string[]){
 if(!ids.length||ids.length>5||ids.some(id=>!uuid(id)))return false;
 const allowed=await records(db.from('connect_class_permissions').select('class_id')
  .eq('teacher_id',teacherId).eq('can_manage',true).in('class_id',ids).limit(10));
 return ids.every(id=>allowed.some((p:any)=>p.class_id===id));
}
async function checkPassword(email:string,password:string,teacherId:string){
 // No side effects on the professor's browser session: ephemeral Auth client.
 const ephemeral=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data,error}=await ephemeral.auth.signInWithPassword({email,password});
 return !error&&data.user?.id===teacherId&&data.user?.is_anonymous!==true;
}

Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response('',{headers});
 if(req.method!=='POST')return deny('method',405);
 const token=req.headers.get('authorization')?.match(/^Bearer (\S+)$/i)?.[1];
 if(!token)return deny('auth',401);
 const client=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:{user},error}=await client.auth.getUser(token);
 if(error||!user||user.is_anonymous)return deny('auth',401);
 const raw=await req.text();
 if(raw.length>15000)return deny('too_large',413);
 let b:any;try{b=JSON.parse(raw)}catch{return deny('json',400)}
 if(!b||typeof b!=='object'||Array.isArray(b)||!uuid(b.classId))return deny('class',400);
 try{
  const [teacher,principal]=await Promise.all([
   records(db.from('connect_teachers').select('auth_user_id').eq('auth_user_id',user.id).limit(1)),
   ownClasses(user.id,[b.classId])
  ]);
  if(!teacher.length||!principal)return deny('forbidden',403);
  if(b.action==='teacher-load'){
   const comparisons=Array.isArray(b.comparisons)?b.comparisons:[];
   if(comparisons.length>4||comparisons.some((id:any)=>!uuid(id)))return deny('comparisons',400);
   const classIds=distinct([b.classId,...comparisons]);
   if(!await ownClasses(user.id,classIds))return deny('forbidden',403);
   const [classRows,memberRows,periodRows,settingsRows,teacherPlayerRows]=await Promise.all([
    records(db.from('connect_classes').select('id,name').in('id',classIds).limit(8)),
    records(db.from('connect_enrollments').select('student_id,class_id').in('class_id',classIds).is('left_at',null).limit(250)),
    records(db.from('connect_projection_score_periods').select('class_id,app_key,score_since').in('class_id',classIds).limit(100)),
    records(db.from('connect_projection_settings').select('class_id,options').in('class_id',classIds).limit(8)),
    records(db.from('connect_teacher_players').select('student_id').eq('teacher_id',user.id).limit(1))
   ]);
   const memberIds=distinct(memberRows.map((m:any)=>m.student_id));
   const [profiles,badges]=await Promise.all([
    memberIds.length?records(db.from('connect_students')
     .select('id,display_name,public_alias,projection_opt_in,archived_at')
     .in('id',memberIds).is('archived_at',null).limit(250)):Promise.resolve([]),
    memberIds.length?db.rpc('connect_projection_player_badges_v1',{p_students:memberIds}).then((x:any)=>{
     if(x.error)throw Error('badges_unavailable');return x.data??[];
    }):Promise.resolve([])
   ]);
   const profileMap=new Map(profiles.map((p:any)=>[p.id,p]));
   const badgeMap=new Map(badges.map((p:any)=>[p.student_id,p]));
   const teacherId=teacherPlayerRows[0]?.student_id??null;
   const bestByClass=new Map();
   await Promise.all(classIds.map(async id=>{
    const {data,error}=await db.rpc('connect_projection_best_scores_v1',{p_class:id});
    if(error)throw Error('best_scores_unavailable');
    bestByClass.set(id,data??[]);
   }));
   const showTeacher=b.showTeacher===true;
   const classes=classRows.filter((row:any)=>classIds.includes(row.id)).map((row:any)=>{
    const members=memberRows.filter((m:any)=>m.class_id===row.id).map((m:any)=>m.student_id);
    const best=bestByClass.get(row.id)??[];
    const membersSet=new Set(members);
    const totals=keys.map(appKey=>({appKey,
     bestSum:best.filter((x:any)=>x.app_key===appKey&&membersSet.has(x.student_id))
      .reduce((sum:number,x:any)=>sum+Math.max(0,Number(x.best_score)||0),0)}));
    const students=members.map((id:string)=>{
     const p:any=profileMap.get(id);
     if(!p||!(p.projection_opt_in===true||(showTeacher&&id===teacherId)))return null;
     const bd:any=badgeMap.get(id);
     // Only approved public display aliases, never private last names of non-opted students.
     const name=String(p.public_alias||p.display_name||'Élève').slice(0,80);
     return {id,name,level:bd?.level??null,trophies:bd?.trophies??0,
      isTeacher:id===teacherId,scores:best.filter((x:any)=>x.student_id===id&&membersSet.has(id))
       .map((x:any)=>({appKey:x.app_key,bestScore:x.best_score,at:x.best_event_at}))};
    }).filter(Boolean);
    return {classId:row.id,name:row.name,students,enrolled:members.length,totals,
     scorePeriods:periodRows.filter((p:any)=>p.class_id===row.id).map((p:any)=>({appKey:p.app_key,since:p.score_since})),
     options:settingsRows.find((p:any)=>p.class_id===row.id)?.options??null,
     percentages:null,percentageStatus:'exercise_telemetry_not_yet_available'};
   });
   return respond({ok:true,classes,appKeys:keys});
  }
  if(b.action==='teacher-save-options'){
   if(!classOptions(b.options))return deny('invalid_options',400);
   const opts=b.options;
   if(new Set(opts.scoreApps).size!==opts.scoreApps.length
      ||new Set(opts.percentageApps).size!==opts.percentageApps.length
      ||new Set(opts.comparisons).size!==opts.comparisons.length
      ||opts.comparisons.includes(b.classId))return deny('duplicate_options',400);
   const comparisonDisplay=(Array.isArray(opts.comparisonDisplay)?opts.comparisonDisplay:
     opts.comparisons.map((id:string)=>({classId:id,score:true,percentage:true})))
     .map((v:any)=>({classId:v.classId,score:v.score,percentage:v.percentage}));
   const selectedClasses=comparisonDisplay.map((v:any)=>v.classId);
   if(new Set(selectedClasses).size!==selectedClasses.length
      ||selectedClasses.some((id:string)=>id===b.classId)
      ||JSON.stringify([...selectedClasses].sort())!==JSON.stringify([...opts.comparisons].sort()))
       return deny('invalid_comparison_options',400);
   if(selectedClasses.length&&!await ownClasses(user.id,selectedClasses))return deny('forbidden',403);
   const options={scoreApps:opts.scoreApps,percentageApps:opts.percentageApps,
    comparisons:selectedClasses,comparisonDisplay,rotationSeconds:opts.rotationSeconds};
   const {error}=await db.from('connect_projection_settings').upsert({
    class_id:b.classId,options,updated_at:new Date().toISOString(),updated_by:user.id
   },{onConflict:'class_id'});
   if(error)throw Error('settings_write');
   return respond({ok:true,options});
  }
  if(b.action==='teacher-reset-score'){
   if(!allowKey(b.appKey)||typeof b.password!=='string'||b.password.length<1||b.password.length>160
      ||typeof user.email!=='string'||!user.email)return deny('invalid_reset',400);
   if(!await checkPassword(user.email,b.password,user.id))return deny('password_refused',403);
   const {data,error}=await db.rpc('connect_projection_reset_score_v1',{
    p_class:b.classId,p_app:b.appKey,p_teacher:user.id
   });
   if(error)throw Error('reset_failed');
   return respond({ok:true,classId:b.classId,appKey:b.appKey,scoreSince:data});
  }
  return deny('action',400);
 }catch{
  // Never log request payload: it may contain a professor password.
  return deny('temporarily_unavailable',503);
 }
});
