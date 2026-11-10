// Séance guidée multiplication : lecture des questions partagées et pilotage professeur.
// Séparée des preuves SQL de calcul, XP, trophées et projection.
import {createClient} from 'npm:@supabase/supabase-js@2.95.0';
import {MULTIPLICATION_TEST_CLASS,multiplicationSchoolPreset,mayStartMultiplicationSchoolProof} from './school-visibility.mjs';
import {guidedSessionLive,mayRenewGuidedHost} from './lease.mjs';
const BASE=Deno.env.get('SUPABASE_URL')!;
const ANON=Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE=Deno.env.get('SUPABASE_'+'SERVICE_ROLE_KEY')!;
const db=createClient(BASE,SERVICE,{auth:{persistSession:false,autoRefreshToken:false}});
const APP='multiplication-ecrite-simple',TABLE='connect_guided_multiplication_sessions';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const headers={'content-type':'application/json','cache-control':'no-store','access-control-allow-origin':'*','access-control-allow-methods':'POST,OPTIONS','access-control-allow-headers':'authorization,apikey,content-type','access-control-max-age':'600'};
const reply=(x:any,status=200)=>new Response(JSON.stringify(x),{status,headers});
const fail=(code:string,status=400)=>reply({ok:false,error:code},status);
async function one(q:any){const {data,error}=await q.maybeSingle();if(error)throw Error('database_read_failed');return data}
function rand(max:number){const limit=0x100000000-(0x100000000%max);let n:number;do{n=crypto.getRandomValues(new Uint32Array(1))[0]}while(n>=limit);return n%max}
function operation(level:number,mults:number[]){
 const width=[3,5,7][level-1];let result:any;
 for(let tries=0;tries<40;tries++){
  const digits=width===3?3:width-1+rand(2);
  const a=String(1+rand(9))+Array.from({length:digits-1},()=>String(rand(10))).join('');
  const m=mults[rand(mults.length)];result={a,m};
  let carry=0,found=false;
  for(let col=a.length-1;col>0;col--){carry=Math.floor((Number(a[col])*m+carry)/10);if(carry)found=true}
  if(found)break;
 }
 return result;
}
const makePage=(l:number,m:number[])=>[operation(l,m),operation(l,m)];
// Les séances créées avant la migration avaient zéro indicateur par page.
const flags=(x:any)=>Array.from({length:Array.isArray(x.pages)?x.pages.length:0},
 (_,i)=>Array.isArray(x.required_pages)&&x.required_pages[i]===true);
const view=(x:any)=>!x?.active?{ok:true,active:false}:
 {ok:true,active:true,sessionId:x.session_id,revision:Number(x.revision),level:x.level,
 carryMethod:x.carry_method,multipliers:x.multipliers,pages:x.pages,
 pageIndex:x.page_index,requiredPages:flags(x),allowSkip:x.allow_skip===true,updatedAt:x.updated_at};
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response('',{headers});
 if(req.method!=='POST')return fail('method_not_allowed',405);
 const token=req.headers.get('authorization')?.match(/^Bearer (\S+)$/i)?.[1];
 if(!token)return fail('auth_required',401);
 const auth=createClient(BASE,ANON,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:{user},error}=await auth.auth.getUser(token);
 if(error||!user)return fail('auth_required',401);
 const raw=await req.text();if(raw.length>5000)return fail('payload_too_large',413);
 let b:any;try{b=JSON.parse(raw)}catch{return fail('invalid_json')}
 if(!b||typeof b!=='object'||Array.isArray(b)||!UUID.test(b.classId||''))return fail('invalid_request');
 if(!['status','resume','start','next','previous','set-required','set-skip','stop','heartbeat','closing'].includes(b.action))return fail('invalid_action');
 if(b.action!=='status'&&user.is_anonymous===true)return fail('teacher_only',403);
 const cls=String(b.classId).toLowerCase();
 try{
  let teacher=false;
  if(user.is_anonymous===true){
   const device=await one(db.from('connect_devices').select('student_id').eq('auth_user_id',user.id).eq('state','approved').limit(1));
   if(!device)return fail('device_not_approved',403);
   const enrol=await one(db.from('connect_enrollments').select('student_id').eq('student_id',device.student_id).eq('class_id',cls).is('left_at',null).limit(1));
   if(!enrol)return fail('not_enrolled',403);
   const live=await one(db.from('connect_students').select('id').eq('id',device.student_id).is('archived_at',null).limit(1));
   if(!live)return fail('inactive_student',403);
  }else{
   const permitted=await one(db.from('connect_class_permissions').select('class_id').eq('teacher_id',user.id).eq('class_id',cls).eq('can_manage',true).limit(1));
   if(!permitted)return fail('teacher_not_authorized',403);
   teacher=true;
  }
  const app=await one(db.from('connect_apps').select('enabled').eq('app_key',APP).limit(1));
  if(app?.enabled!==true)return fail('app_disabled',403);
  if(cls!==MULTIPLICATION_TEST_CLASS){
   const preset=multiplicationSchoolPreset(cls);if(!preset)return fail('school_class_not_allowed',403);
   const visible=await one(db.from('connect_hub_preset_entries').select('visible').eq('preset_slug',preset).eq('app_key',APP).limit(1));
   if(!mayStartMultiplicationSchoolProof(cls,visible?.visible===true))return fail('school_app_not_open_for_class',403);
  }
  let current=await one(db.from(TABLE).select('*').eq('class_id',cls).limit(1));
  const now=new Date().toISOString();
  // Seul le chargement initial de l'onglet d'origine envoie « resume ».
  // Un status déjà en vol lors de la fermeture ne doit JAMAIS annuler sa fermeture.
  if(b.action==='resume'&&teacher&&current?.active&&current.teacher_id===user.id
   &&UUID.test(b.hostId||'')&&UUID.test(b.pageId||'')&&guidedSessionLive(current)){
   if(!current.host_client_id){
    // Adoption des séances antérieures à cette livraison, sans supprimer leurs pages.
    const {data:adopted,error:adoptError}=await db.from(TABLE).update({
     host_client_id:b.hostId,host_page_id:b.pageId,host_seen_at:now,close_requested_at:null
    }).eq('class_id',cls).eq('session_id',current.session_id)
      .is('host_client_id',null).eq('active',true).select().maybeSingle();
    if(adoptError)throw Error('adoption_failed');
    if(adopted)current=adopted;
   }else if(current.host_client_id===b.hostId&&current.host_page_id!==b.pageId){
    // Un nouveau chargement reçoit un ID de page différent. Une requête
    // « closing » envoyée en retard depuis l'ancienne page sera alors refusée.
    let query=db.from(TABLE).update({
     host_page_id:b.pageId,host_seen_at:now,close_requested_at:null
    }).eq('class_id',cls).eq('session_id',current.session_id)
      .eq('host_client_id',b.hostId).eq('active',true);
    query=current.host_page_id?query.eq('host_page_id',current.host_page_id):query.is('host_page_id',null);
    const {data:resumed,error:resumeError}=await query.select().maybeSingle();
    if(resumeError)throw Error('resume_failed');
    if(resumed)current=resumed;
   }
  }
  // L'expiration est évaluée côté serveur, et jamais d'après l'horloge élève.
  if(!guidedSessionLive(current)){
   if(current?.active){
    // Nettoyage prudent : ne pas désactiver une séance qui aurait entre-temps
    // reçu un heartbeat ou un nouveau démarrage.
    let query=db.from(TABLE).update({active:false,updated_at:now})
      .eq('class_id',cls).eq('session_id',current.session_id)
      .eq('revision',current.revision).eq('active',true);
    query=current.host_seen_at?query.eq('host_seen_at',current.host_seen_at):query.is('host_seen_at',null);
    query=current.close_requested_at?query.eq('close_requested_at',current.close_requested_at):query.is('close_requested_at',null);
    const {error:cleanupError}=await query;
    if(cleanupError)throw Error('cleanup_failed');
   }
   if(b.action==='status'||b.action==='resume')return reply(view(null));
   // start() peut remplacer une séance périmée en réutilisant sa ligne.
   if(b.action!=='start')return fail('session_not_active',409);
  }
  if(b.action==='status'||b.action==='resume')return reply(view(current));
  if(!teacher)return fail('teacher_only',403);
  if(b.action==='start'){
   if(![1,2,3].includes(b.level)||!['top','side'].includes(b.carryMethod)
    ||!Array.isArray(b.multipliers)||b.multipliers.length<1||b.multipliers.length>8
    ||new Set(b.multipliers).size!==b.multipliers.length
    ||b.multipliers.some((v:any)=>!Number.isInteger(v)||v<2||v>9))return fail('invalid_configuration');
   if(current?.active&&guidedSessionLive(current))return fail('session_already_active',409);
   if(!UUID.test(b.hostId||'')||!UUID.test(b.pageId||''))return fail('teacher_tab_required',409);
   const row={class_id:cls,teacher_id:user.id,session_id:crypto.randomUUID(),active:true,
    host_client_id:b.hostId,host_page_id:b.pageId,host_seen_at:now,close_requested_at:null,
    level:b.level,carry_method:b.carryMethod,multipliers:b.multipliers,
    pages:[makePage(b.level,b.multipliers)],required_pages:[false],page_index:0,allow_skip:false,
    revision:Number(current?.revision||0)+1,updated_at:new Date().toISOString()};
   const {data,error:writeError}=current
    ?await db.from(TABLE).update(row).eq('class_id',cls).eq('revision',current.revision).select().maybeSingle()
    :await db.from(TABLE).insert(row).select().maybeSingle();
   if(writeError){if(writeError.code==='23505')return fail('session_conflict',409);throw Error('start_failed')}
   if(!data)return fail('session_conflict',409);
   return reply(view(data));
  }
  if(!current?.active||!guidedSessionLive(current))return fail('session_not_active',409);
  if(current.teacher_id!==user.id)return fail('session_owned_by_other_teacher',403);
  if(!UUID.test(b.sessionId||'')||b.sessionId!==current.session_id)return fail('session_changed',409);
  if(current.host_client_id&&(!UUID.test(b.hostId||'')||b.hostId!==current.host_client_id))
   return fail('session_owned_by_other_tab',403);
  if(current.host_page_id&&(!UUID.test(b.pageId||'')||b.pageId!==current.host_page_id))
   return fail('session_owned_by_other_page',403);
  if(b.action==='heartbeat'||b.action==='closing'){
   if(!mayRenewGuidedHost(current,{teacherId:user.id,sessionId:b.sessionId,hostId:b.hostId,pageId:b.pageId}))
    return fail('session_owned_by_other_tab',403);
   // Présence et fermeture ne changent PAS la révision pédagogique des pages.
   // Le heartbeat ne lève pas une fermeture : seul un chargement (status)
   // de l'onglet d'origine peut reprendre la séance.
   const patch=b.action==='heartbeat'?{host_seen_at:now}:{close_requested_at:now};
   const {data,error:writeError}=await db.from(TABLE).update(patch)
    .eq('class_id',cls).eq('session_id',current.session_id)
    .eq('host_client_id',b.hostId).eq('host_page_id',b.pageId)
    .eq('active',true).select().maybeSingle();
   if(writeError)throw Error('presence_write_failed');
   if(!data)return fail('session_changed',409);
   return reply({ok:true,active:true});
  }
  if(b.revision!==Number(current.revision))return fail('session_changed',409);
  const patch:any={revision:Number(current.revision)+1,updated_at:now};
  // Les pages déjà ouvertes restent en mémoire : revenir puis « Suivant »
  // ne régénère jamais de calculs déjà affichés.
  if(b.action==='next'){
   if(current.page_index<current.pages.length-1){
    patch.page_index=current.page_index+1;
   }else{
    if(!Array.isArray(current.pages)||current.pages.length>=120)return fail('page_limit',409);
    patch.pages=[...current.pages,makePage(current.level,current.multipliers)];
    patch.required_pages=[...flags(current),false];
    patch.page_index=patch.pages.length-1;
   }
  }else if(b.action==='previous'){
   if(current.page_index<=0)return fail('first_page',409);
   patch.page_index=current.page_index-1;
  }else if(b.action==='set-skip'){
   // Compatibilité des onglets encore ouverts sur l'ancienne interface.
   if(typeof b.allowSkip!=='boolean')return fail('invalid_configuration');
   patch.allow_skip=b.allowSkip;
  }else if(b.action==='set-required'){
   if(!Number.isInteger(b.pageIndex)||b.pageIndex!==current.page_index
     ||b.pageIndex<0||b.pageIndex>=current.pages.length||typeof b.required!=='boolean')
    return fail('invalid_page_requirement');
   const required=flags(current);
   required[b.pageIndex]=b.required;
   patch.required_pages=required;
  }else if(b.action==='stop')patch.active=false;
  const {data,error:writeError}=await db.from(TABLE).update(patch)
   .eq('class_id',cls).eq('session_id',current.session_id).eq('revision',current.revision).select().maybeSingle();
  if(writeError)throw Error('update_failed');
  if(!data)return fail('session_conflict',409);
  return reply(view(data));
 }catch(e){
  console.error('guided_multiplication_unavailable',e instanceof Error?e.message:'unknown');
  return fail('service_unavailable',503);
 }
});
