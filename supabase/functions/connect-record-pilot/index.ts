import {createClient} from 'npm:@supabase/supabase-js@2.95.0';

// Laboratoire authentifie uniquement. Aucune ecriture dans les tables XP officielles.
const TEST='4bf3400d-a315-4ea4-a2f3-afaca24dc9b9';
const APPS=new Set(['addition-ecrite-simple','addition-ecrite-multiple','soustraction-ecrite-simple','multiplication-ecrite-simple','melange-calculs-ecrits']);
const URL=Deno.env.get('SUPABASE_URL')!;
const ADMIN=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const PUB=Deno.env.get('SUPABASE_ANON_KEY')!;
const db=createClient(URL,ADMIN,{auth:{persistSession:false,autoRefreshToken:false}});
const auth=createClient(URL,PUB,{auth:{persistSession:false,autoRefreshToken:false}});
const headers={'access-control-allow-origin':'*','access-control-allow-methods':'POST, OPTIONS','access-control-allow-headers':'authorization,apikey,content-type,x-client-info','content-type':'application/json; charset=utf-8','cache-control':'no-store'};
const response=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
const err=(code:string,status=400)=>response({ok:false,error:code},status);
const uuid=(s:unknown):s is string=>typeof s==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
const integer=(v:unknown,lo:number,hi:number):v is number=>Number.isSafeInteger(v)&&Number(v)>=lo&&Number(v)<=hi;
const keys=['classic:4:perfect','classic:10:pass','classic:10:bonus','classic:20:pass','classic:20:bonus','sudden:5','sudden:10','hard:3','hard:7'];
type Stored={events:Array<{id:string,mode:string,score:number,points:number,xp:number,at:string}>,earned:Record<string,number>,best:number,trophies:string[]};
const blank=():Stored=>({events:[],earned:{},best:0,trophies:[]});
const validState=(s:any):s is Stored=>s&&typeof s==='object'&&Array.isArray(s.events)&&s.earned&&typeof s.earned==='object'&&integer(s.best,0,500000)&&Array.isArray(s.trophies);
const opsKey=(ops:string[])=>ops.length?'mixed-rate-'+ops.length:'standard';
const normalizedOps=(raw:unknown,app:string):string[]|null=>{
 if(app!=='melange-calculs-ecrits')return raw==null?[]:null;
 if(!Array.isArray(raw)||raw.length<1||raw.length>3||raw.some(v=>!['add','sub','mul'].includes(v)))return null;
 const ordered=['add','sub','mul'].filter(x=>raw.includes(x));
 return ordered.length===raw.length?ordered:null;
};
function proof(b:any,app:string){
 if(!['classic','sudden','three-lives','hard-classic','hard-sudden','hard-three-lives'].includes(b?.mode)
   ||!integer(b.level,1,3)||!integer(b.score,0,600)||!uuid(b.eventId))return null;
 const hard=b.mode.startsWith('hard-');
 const total=b.mode==='classic'?b.total:null;
 if(b.mode==='classic'&&(![4,10,20].includes(total)||b.score>total))return null;
 if(b.mode==='three-lives'&&b.score>400)return null;
 if(hard&&b.score>200)return null;
 // Les trois vies ne sont pas une Mort subite : la preuve doit attester
 // l'épuisement des trois coeurs, pas un abandon ou un écran simplement quitté.
 if(b.mode.endsWith('three-lives')){
   if(b.phase!=='ended'||b.hearts!==0)return null;
   if(!hard&&(!integer(b.completed,3,10000)||b.completed<b.score+3))return null;
 }
 if(hard&&app==='melange-calculs-ecrits'&&Array.isArray(b.ops)&&b.ops.length!==3)return null;
 const ops=normalizedOps(b.ops,app);if(!ops)return null;
 return {mode:String(b.mode),level:Number(b.level),score:Number(b.score),total,hard,ops,eventId:b.eventId as string};
}
function points(g:NonNullable<ReturnType<typeof proof>>){
 const factor=g.hard?3.375*1.2**(g.level-1):1.5**(g.level-1);
 const unit=g.mode.endsWith('sudden')?2:g.mode.endsWith('three-lives')?1:
   g.total===4?4:g.total===10?3:2;
 return Math.round(g.score*factor*unit);
}
function grant(s:Stored,g:NonNullable<ReturnType<typeof proof>>,awards:Record<string,number>){
 let added=0;const earned={...s.earned};const variant=g.hard?'hard':'normal';
 const scope=g.level+':'+opsKey(g.ops)+':'+variant+':';
 const possible:Array<[string,number]>=[];
 const offer=(key:string,cap=1)=>{
  if(awards[key]==null)return;
  const base=Number(awards[key]);
  // Mêmes paliers 1/4, 1/2, plein droit que le contrat Mélange V3.
  let eligible=base;
  if(g.ops.length===2)eligible=key==='classic:20:pass'?32:key==='classic:20:bonus'?6:Math.floor(base/2);
  if(g.ops.length===1)eligible=key==='classic:10:bonus'?2:key==='classic:20:bonus'?3:Math.round(base/4);
  possible.push([key,Math.floor(eligible*cap)]);
 };
 if(g.mode==='classic'){
  if(g.total===4&&g.score===4)offer('classic:4:perfect');
  if(g.total===10&&g.score>=8)offer('classic:10:pass');
  if(g.total===10&&g.score===10)offer('classic:10:bonus');
  if(g.total===20&&g.score>=16)offer('classic:20:pass');
  if(g.total===20&&g.score===20)offer('classic:20:bonus');
 }else if(g.hard){
  if(g.score>=3)offer('hard:3',g.mode==='hard-three-lives'?.5:1);
  if(g.score>=7)offer('hard:7',g.mode==='hard-three-lives'?.5:1);
 }else{
  const cap=g.mode==='three-lives'?.5:1;
  if(g.score>=5)offer('sudden:5',cap);
  if(g.score>=10)offer('sudden:10',cap);
 }
 for(const [key,ceiling] of possible){
  const id=scope+key;
  const old=Number(earned[id]||0);
  // Trois vies ne paie que la moitie du meme jalon de Mort subite.
  const next=Math.max(old,ceiling);
  added+=next-old;
  earned[id]=next;
 }
 s.earned=earned;
 return added;
}
function trophies(s:Stored,g:NonNullable<ReturnType<typeof proof>>,pts:number){
 const values=new Set(s.trophies);
 if(g.mode==='classic'&&g.total===g.score)values.add('mastery:'+g.level+':'+g.total);
 if(g.mode==='sudden'&&g.score>=25)values.add('sudden:'+g.level);
 if(g.mode==='hard-sudden')for(const n of [3,5,10])if(g.score>=n)values.add('hard:'+g.level+':'+n);
 for(const n of [200,400,600])if(pts>=n)values.add('score:'+n);
 s.trophies=[...values].sort().slice(0,90);
}
async function identity(user:any):Promise<string|null>{
 if(user.is_anonymous){
  const {data:devices,error:e1}=await db.from('connect_devices').select('student_id').eq('auth_user_id',user.id).eq('state','approved').limit(1);
  if(e1||devices?.length!==1)return null;
  const id=devices[0].student_id;
  const {data:e,error:e2}=await db.from('connect_enrollments').select('student_id').eq('student_id',id).eq('class_id',TEST).is('left_at',null).limit(1);
  if(e2||e?.length!==1)return null;
  const {data:student}=await db.from('connect_students').select('id').eq('id',id).is('archived_at',null).maybeSingle();
  return student?.id||null;
 }
 // Monsieur T peut essayer dans le LAB uniquement s'il gere bien la classe TEST.
 const {data:p}=await db.from('connect_class_permissions').select('class_id').eq('teacher_id',user.id).eq('class_id',TEST).eq('can_manage',true).maybeSingle();
 if(!p)return null;
 const {data:tp}=await db.from('connect_teacher_players').select('student_id').eq('teacher_id',user.id).maybeSingle();
 return tp?.student_id||null;
}
async function load(studentId:string,app:string){
 const {data,error}=await db.from('connect_record_pilot_states').select('revision,state_data')
   .eq('student_id',studentId).eq('class_id',TEST).eq('app_key',app).maybeSingle();
 if(error)throw Error('db_error');
 const state=validState(data?.state_data)?data.state_data:blank();
 return {state,revision:data?.revision??0,exists:!!data};
}
// Lecture du plafond encore disponible, calcule uniquement sur le serveur.
function projection(earned:Record<string,number>,app:string,level:number,ops:string[],awards:Record<string,number>){
 const scope=level+':'+opsKey(ops)+':normal:';
 const eligible=(key:string)=>{
   const base=Number(awards[key]||0);
   if(ops.length===2)return key==='classic:20:pass'?32:key==='classic:20:bonus'?6:Math.floor(base/2);
   if(ops.length===1)return key==='classic:10:bonus'?2:key==='classic:20:bonus'?3:Math.round(base/4);
   return base;
 };
 const remaining=(key:string,cap:number)=>Math.max(0,Math.floor(eligible(key)*cap)-Number(earned[scope+key]||0));
 return {level,ops,classic:{
   '4':remaining('classic:4:perfect',1),
   '10':remaining('classic:10:pass',1)+remaining('classic:10:bonus',1),
   '20':remaining('classic:20:pass',1)+remaining('classic:20:bonus',1)},
   sudden:remaining('sudden:5',1)+remaining('sudden:10',1),
   threeLives:remaining('sudden:5',.5)+remaining('sudden:10',.5)};
}
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('',{headers});
 if(req.method!=='POST')return err('method_not_allowed',405);
 const token=req.headers.get('authorization')?.match(/^Bearer (\S+)$/i)?.[1];
 if(!token)return err('auth_required',401);
 const {data:{user},error}=await auth.auth.getUser(token);
 if(error||!user)return err('auth_required',401);
 const raw=await req.text();
 if(raw.length>5000)return err('payload_too_large',413);
 let b:any;try{b=JSON.parse(raw)}catch{return err('invalid_json')};
 if(b?.classId!==TEST||!APPS.has(b?.appKey))return err('test_class_only',403);
 if(!['load','record','teacher-summary'].includes(b?.action))return err('invalid_action');
 try{
  if(b.action==='teacher-summary'){
   // Aucun appareil anonyme ne peut lire les résultats, même dans la classe TEST.
   if(user.is_anonymous)return err('teacher_required',403);
   const {data:permission,error:permError}=await db.from('connect_class_permissions')
     .select('can_view_results,can_manage')
     .eq('teacher_id',user.id).eq('class_id',TEST).maybeSingle();
   if(permError||!permission||(permission.can_view_results!==true&&permission.can_manage!==true))
     return err('teacher_permission_required',403);
   const {data:enrollments,error:enrollError}=await db.from('connect_enrollments')
     .select('student_id').eq('class_id',TEST).is('left_at',null).limit(200);
   if(enrollError)return err('pilot_unavailable',503);
   const ids=[...new Set((enrollments||[]).map(x=>x.student_id))];
   if(!ids.length)return response({ok:true,appKey:b.appKey,rows:[]});
   const [people,states]=await Promise.all([
     db.from('connect_students').select('id,display_name').in('id',ids).is('archived_at',null).limit(200),
     db.from('connect_record_pilot_states').select('student_id,revision,state_data,updated_at')
       .eq('class_id',TEST).eq('app_key',b.appKey).in('student_id',ids).limit(200)
   ]);
   if(people.error||states.error)return err('pilot_unavailable',503);
   const names=new Map((people.data||[]).map(x=>[x.id,x.display_name]));
   const rows=(states.data||[]).filter(x=>names.has(x.student_id)).map(x=>{
     const state=validState(x.state_data)?x.state_data:blank();
     return {name:names.get(x.student_id),revision:x.revision,
       xp:Object.values(state.earned).reduce((sum,n)=>sum+Number(n||0),0),
       best:state.best,trophies:state.trophies.length,
       attempts:state.events.length,updatedAt:x.updated_at};
   }).sort((a,b)=>a.name.localeCompare(b.name,'fr'));
   return response({ok:true,appKey:b.appKey,rows});
  }
  const studentId=await identity(user);
  if(!studentId)return err('unapproved_test_profile',403);
  if(b?.expectedStudentId!=null&&b.expectedStudentId!==studentId)return err('identity_conflict',409);
  if(b.action==='load'){
   const {state,revision}=await load(studentId,b.appKey);
   let rights=null;
   if(integer(b.level,1,3)){
    const ops=normalizedOps(b.ops,b.appKey);
    if(ops){
     const {data:rules,error:e}=await db.from('connect_xp_award_rules')
       .select('award_key,points').eq('app_key',b.appKey).in('award_key',keys);
     if(e||!rules?.length)throw Error('rules_unavailable');
     rights=projection(state.earned,b.appKey,b.level,ops,
       Object.fromEntries(rules.map(row=>[row.award_key,row.points])));
    }
   }
   return response({ok:true,studentId,revision,pilot:true,rights,
     xp:Object.values(state.earned).reduce((a,b)=>a+Number(b||0),0),
     earned:state.earned,best:state.best,trophies:state.trophies,
     recent:state.events.slice(-15)});
  }
  const g=proof(b,b.appKey);if(!g)return err('invalid_game_proof');
  const {data:rules,error:rulesError}=await db.from('connect_xp_award_rules')
   .select('award_key,points').eq('app_key',b.appKey).in('award_key',keys);
  if(rulesError||!rules?.length)return err('rules_unavailable',503);
  const awards=Object.fromEntries(rules.map(row=>[row.award_key,row.points]));
  for(let tries=0;tries<5;tries++){
   const {state,revision,exists}=await load(studentId,b.appKey);
   if(state.events.some(e=>e.id===g.eventId))
    return response({ok:true,duplicate:true,revision,xp:Object.values(state.earned).reduce((a,b)=>a+Number(b||0),0),best:state.best,trophies:state.trophies});
   const next:Stored={events:[...state.events],earned:{...state.earned},best:state.best,trophies:[...state.trophies]};
   const score=points(g),awarded=grant(next,g,awards);
   next.best=Math.max(next.best,score);
   trophies(next,g,score);
   next.events.push({id:g.eventId,mode:g.mode,score:g.score,points:score,xp:awarded,at:new Date().toISOString()});
   if(next.events.length>100)next.events=next.events.slice(-100);
   if(!exists){
    const {error:insert}=await db.from('connect_record_pilot_states').insert({
      student_id:studentId,class_id:TEST,app_key:b.appKey,revision:1,state_data:next});
    if(insert?.code==='23505')continue;
    if(insert)throw Error('db_write_failed');
   }else{
    const {data:saved,error:write}=await db.from('connect_record_pilot_states')
      .update({revision:revision+1,state_data:next,updated_at:new Date().toISOString()})
      .eq('student_id',studentId).eq('class_id',TEST).eq('app_key',b.appKey).eq('revision',revision)
      .select('revision').maybeSingle();
    if(write)throw Error('db_write_failed');
    if(!saved)continue;
   }
   return response({ok:true,duplicate:false,awarded,points:score,revision:revision+1,
     xp:Object.values(next.earned).reduce((a,b)=>a+Number(b||0),0),
     best:next.best,trophies:next.trophies,earned:next.earned});
  }
  return err('concurrent_update_retry',409);
 }catch(e){
  console.error('record_pilot_error',e instanceof Error?e.message:'unknown');
  return err('pilot_unavailable',503);
 }
});
