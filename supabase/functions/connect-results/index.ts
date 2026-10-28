import {createClient} from 'npm:@supabase/supabase-js@2.95.0';
const url=Deno.env.get('SUPABASE_URL')!,pub=Deno.env.get('SUPABASE_ANON_KEY')!,priv=Deno.env.get('SUPABASE_'+'SERVICE_ROLE_KEY')!;
const db=createClient(url,priv,{auth:{persistSession:false,autoRefreshToken:false}});
const headers={'content-type':'application/json','cache-control':'no-store','access-control-allow-origin':'*','access-control-allow-headers':'authorization,apikey,content-type','access-control-allow-methods':'POST,OPTIONS'};
const answer=(v:object,status=200)=>new Response(JSON.stringify(v),{status,headers});
const deny=(e:string,status=400)=>answer({ok:false,error:e},status);
const valid=(v:any)=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const app='addition-ecrite-simple',mul='multiplication-ecrite-simple',lab='connect-lab';
const appAllowed=(k:any)=>k===app||k===mul||k===lab;
const belgianDay=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Brussels',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const read=async(q:any)=>{const {data,error}=await q.maybeSingle();if(error)throw Error('db_error');return data};
const int=(n:any,min:number,max:number)=>Number.isSafeInteger(n)&&n>=min&&n<=max;
// Récompenses privées de l'élève : collectées côté jeu, non transmises au tableau professeur.
function normalizeRewards(raw:any){
 if(raw==null)return null;
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('rewards');
 const triple=(a:any)=>{if(!Array.isArray(a)||a.length!==3||a.some(v=>typeof v!=='boolean'))throw Error('rewards');return a;};
 const mastery:any={};for(const k of ['4','10','20'])mastery[k]=triple(raw.mastery?.[k]);
 const hardAwards:any={};for(const c of ['bronze','silver','gold'])hardAwards[c]=triple(raw.hardAwards?.[c]);
 const scoreOne:any={};for(const c of ['bronze','silver','gold']){if(typeof raw.scoreOne?.[c]!=='boolean')throw Error('rewards');scoreOne[c]=raw.scoreOne[c]}
 if(typeof raw.unlockedGold!=='boolean')throw Error('rewards');
 return {version:3,mastery,sudden:triple(raw.sudden),hardAwards,scoreOne,unlockedGold:raw.unlockedGold};
}
function mergeRewards(before:any,after:any){
 if(!after)return before;
 if(!before)return after;
 const out=structuredClone(before);
 for(const k of ['4','10','20'])for(let i=0;i<3;i++)out.mastery[k][i]=before.mastery[k][i]||after.mastery[k][i];
 for(let i=0;i<3;i++)out.sudden[i]=before.sudden[i]||after.sudden[i];
 for(const c of ['bronze','silver','gold']){
   out.scoreOne[c]=before.scoreOne[c]||after.scoreOne[c];
   for(let i=0;i<3;i++)out.hardAwards[c][i]=before.hardAwards[c][i]||after.hardAwards[c][i];
 }
 out.unlockedGold=before.unlockedGold||after.unlockedGold;
 return out;
}
function validate(s:any){
 if(!s||typeof s!=='object'||Array.isArray(s))throw Error('bad_state');
 const classic=Array.from({length:3},(_,i)=>{const x=s.classic?.[i]??{};if(typeof x!=='object'||Array.isArray(x))throw Error('classic');const y:any={};for(const count of [4,10,20])if(x[count]!=null){if(!int(x[count],0,count))throw Error('classic');y[count]=x[count]}return y});
 const sequence=(k:string)=>Array.from({length:3},(_,i)=>{const v=s[k]?.[i];if(v==null)return null;if(!int(v,0,100000))throw Error(k);return v});
 const recent=(s.recent??[]);if(!Array.isArray(recent)||recent.length>3)throw Error('recent');
 const runs=recent.map((v:any)=>{if(!v||!['classic','sudden','hard','hard-challenge'].includes(v.mode)||!int(v.level,1,3)||!int(v.score,0,100000)||!/^\d{4}-\d{2}-\d{2}T/.test(v.at||''))throw Error('recent');if(v.total!=null&&(![4,5,10,20].includes(v.total)||v.score>v.total))throw Error('recent');return {mode:v.mode,level:v.level,score:v.score,total:v.total??null,points:int(v.points,0,10000000)?v.points:0,eventId:valid(v.eventId)?v.eventId:null,at:String(v.at).slice(0,32)}});
 const best=s.bestPoints??null;if(best!==null&&!int(best,0,10000000))throw Error('best');
 const today=s.todayBest??null;if(today!==null&&(!/^\d{4}-\d{2}-\d{2}$/.test(today.day||'')||!int(today.points,0,10000000)))throw Error('today');
 const prog:any={};for(const k of ['level2','level3','sudden1','sudden2','sudden3','perfect1','perfect2','perfect3','hard']){if(s.progress?.[k]!=null){if(typeof s.progress[k]!=='boolean')throw Error('progress');prog[k]=s.progress[k]}}
 const ids=Array.isArray(s.ids)?s.ids.slice(0,50).filter(valid):[];
 const topThree=Array.isArray(s.topThree)?s.topThree.filter((v:any)=>int(v,0,10000000)).slice(0,3):[];
 const hardThree=Array.from({length:3},(_,i)=>{const value=s.hardThree?.[i];if(value==null)return null;if(!int(value,0,5))throw Error('hardThree');return value});
 return {classic,sudden:sequence('sudden'),hard:sequence('hard'),recent:runs,bestPoints:best,todayBest:today,progress:prog,ids,topThree,hardThree,rewards:normalizeRewards(s.rewards)};
}
function mergeHistorical(current:any,old:any){
 if(!old||typeof old!=='object'||Array.isArray(old))throw Error('invalid_import');
 const next=structuredClone(current);
 for(let i=0;i<3;i++){
  for(const n of [4,10,20]){const value=old.classic?.[i]?.[n];if(value!=null){if(!int(value,0,n))throw Error('invalid_import');next.classic[i][n]=Math.max(next.classic[i][n]??0,value)}}
  for(const group of ['sudden','hard']){const value=old[group]?.[i];if(value!=null){if(!int(value,0,100000))throw Error('invalid_import');next[group][i]=Math.max(next[group][i]??0,value)}}
  const hardThree=old.hardThree?.[i];if(hardThree!=null){if(!int(hardThree,0,5))throw Error('invalid_import');next.hardThree[i]=Math.max(next.hardThree[i]??0,hardThree)}
 }
 for(const key of ['level2','level3','sudden1','sudden2','sudden3','perfect1','perfect2','perfect3','hard']){
  const value=old.progress?.[key];if(value!=null&&typeof value!=='boolean')throw Error('invalid_import');
  if(value===true)next.progress[key]=true;
 }
 if(old.bestPoints!=null){if(!int(old.bestPoints,0,10000000))throw Error('invalid_import');next.bestPoints=Math.max(next.bestPoints??0,old.bestPoints)}
 if(!Array.isArray(old.topThree)||old.topThree.length>3||old.topThree.some((n:any)=>!int(n,0,10000000)))throw Error('invalid_import');
 next.topThree=[...new Set([...next.topThree,...old.topThree,...(old.bestPoints==null?[]:[old.bestPoints])])].sort((a,b)=>b-a).slice(0,3);
 if(old.rewards)next.rewards=mergeRewards(next.rewards,normalizeRewards(old.rewards));
 return next;
}
// Une restauration n'invente aucune partie : les dates/id historiques sont conservés.
// Le score/perfection/trophée est fusionné dans le compte ACTUEL, sans remplacer un meilleur record.
function restorePreviewState(current:any,snapshot:any){
 const old=validate(snapshot),now=validate(current||{});
 const next=mergeHistorical(now,old);
 const id=(a:any)=>a.eventId||JSON.stringify([a.at,a.mode,a.level,a.score,a.total]);
 const rows=new Map<string,any>();
 for(const item of [...now.recent,...old.recent]){
  const key=id(item);if(!rows.has(key))rows.set(key,item);
 }
 next.recent=[...rows.values()].sort((a:any,b:any)=>b.at.localeCompare(a.at)).slice(0,3);
 next.ids=[...new Set([...now.ids,...old.ids,...next.recent.map((v:any)=>v.eventId).filter(valid)])].slice(-50);
 if(old.todayBest?.day===belgianDay())next.todayBest={day:belgianDay(),points:Math.max(next.todayBest?.day===belgianDay()?next.todayBest.points:0,old.todayBest.points)};
 return {before:now,after:validate(next)};
}
function restoreSummary(state:any){
 return {bestPoints:state.bestPoints??null,classic:state.classic,sudden:state.sudden,
   hard:state.hard,hardThree:state.hardThree,progress:state.progress,
   trophies:state.rewards?Object.values(state.rewards.mastery).flat().filter(Boolean).length+Object.values(state.rewards.hardAwards).flat().filter(Boolean).length+state.rewards.sudden.filter(Boolean).length+Object.values(state.rewards.scoreOne).filter(Boolean).length+Number(state.rewards.unlockedGold):0,
   lastThree:state.recent.map((v:any)=>({mode:v.mode,level:v.level,score:v.score,total:v.total,at:v.at})),
   topThree:state.topThree};
}
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('',{headers});
 if(req.method!=='POST')return deny('method',405);
 const token=req.headers.get('authorization')?.match(/^Bearer (\S+)$/i)?.[1];if(!token)return deny('auth',401);
 const client=createClient(url,pub,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:{user},error}=await client.auth.getUser(token);if(error||!user)return deny('auth',401);
 const raw=await req.text();if(raw.length>18000)return deny('too_large',413);
 let b:any;try{b=JSON.parse(raw)}catch{return deny('json')};
 if(!valid(b?.classId))return deny('class');
 const selected=appAllowed(b.appKey)?b.appKey:null;
 try{
  const managed=async()=>!user.is_anonymous&&!!await read(db.from('connect_class_permissions').select('class_id').eq('teacher_id',user.id).eq('class_id',b.classId).eq('can_manage',true));
  const identity=async()=>{if(!user.is_anonymous){
     if(!await managed())return null;
     const player=await read(db.from('connect_teacher_players').select('student_id').eq('teacher_id',user.id));
     if(!player)return null;
     // Le compte joueur du professeur peut jouer dans chacune de ses classes.
     // managed() ci-dessus vérifie l'autorisation pour la classe demandée.
     const active=await read(db.from('connect_students').select('id').eq('id',player.student_id).is('archived_at',null));
     return active?player.student_id:null;
    }const device=await read(db.from('connect_devices').select('student_id').eq('auth_user_id',user.id).eq('state','approved').limit(1));if(!device)return null;const enrolled=await read(db.from('connect_enrollments').select('student_id').eq('student_id',device.student_id).eq('class_id',b.classId).is('left_at',null));if(!enrolled)return null;const active=await read(db.from('connect_students').select('id').eq('id',device.student_id).is('archived_at',null));return active?device.student_id:null};
  const refreshXp=async(studentId:string,appKey:string)=>{
   if(appKey!==app&&appKey!==mul)return null;
   const result=await db.rpc('connect_xp_sync_v2',{p_student:studentId,p_app:appKey,p_force:false});
   if(result.error){console.error('xp_credit_error',result.error.code);throw Error('xp_sync_failed')}
   return result.data;
  };
  // Parcours de révision : opération réservée au professeur, jamais au JWT élève.
  if(b.action==='teacher-parcours-restart'){
   if(!await managed()||![app,mul].includes(b.appKey)||typeof b.repeatXp!=='boolean'
      ||!['student','class'].includes(b.scope))return deny('forbidden',403);
   if(b.scope==='student'&&!valid(b.studentId))return deny('invalid_student');
   const name=b.scope==='class'?'connect_parcours_restart_class':'connect_parcours_restart_one';
   const args:any={p_teacher:user.id,p_class:b.classId,p_app:b.appKey,p_repeat_xp:b.repeatXp};
   if(b.scope==='student')args.p_student=b.studentId;
   const result=await db.rpc(name,args);
   if(result.error){console.error('parcours_restart',result.error.code);return deny('restart_failed',409)}
   return answer({ok:true,...result.data});
  }
  if(b.action==='teacher-parcours-history'){
   if(!await managed()||![app,mul].includes(b.appKey)||!valid(b.studentId))return deny('forbidden',403);
   const member=await read(db.from('connect_enrollments').select('student_id').eq('student_id',b.studentId).eq('class_id',b.classId).is('left_at',null));
   if(!member)return deny('forbidden',403);
   const [current,history]=await Promise.all([
     db.from('connect_parcours_current').select('parcours_number,repeat_xp,started_at').eq('student_id',b.studentId).eq('app_key',b.appKey).maybeSingle(),
     db.from('connect_parcours_history').select('parcours_number,ended_at,repeat_xp,state_data,archived_xp').eq('student_id',b.studentId).eq('app_key',b.appKey).order('parcours_number',{ascending:false}).limit(12)
   ]);
   if(current.error||history.error)return deny('db_error',500);
   return answer({ok:true,current:current.data||{parcours_number:1,repeat_xp:false},history:history.data||[]});
  }
  // Restauration de secours : fusion des acquis, sans nouvelles tables ni RPC.
  if(b.action==='teacher-restore-preview'||b.action==='teacher-restore-apply'){
    if(!await managed()||!valid(b.studentId)||b.appKey!==app)return deny('forbidden',403);
    if(!['mathas-connect-class-backup-v1','mathas-connect-class-backup-v2','mathas-connect-class-backup-v3','mathas-connect-class-backup-v4'].includes(b.backupFormat))return deny('invalid_backup_format');
    if(b.backupProjectRef!=null&&b.backupProjectRef!=='awmhpfofacaglewammxt')return deny('wrong_project',403);
    if(!int(b.backupRevision,0,1000000000)||!int(b.backupResetEpoch,0,1000000000))return deny('invalid_backup');
    const member=await read(db.from('connect_enrollments').select('id').eq('student_id',b.studentId).eq('class_id',b.classId).is('left_at',null));
    if(!member||!await read(db.from('connect_students').select('id').eq('id',b.studentId).is('archived_at',null)))return deny('student_not_active',403);
    const record=await read(db.from('connect_states').select('revision,reset_epoch,state_data').eq('student_id',b.studentId).eq('app_key',app));
    const rev=record?.revision??0,epoch=record?.reset_epoch??0;
    if(record&&b.backupResetEpoch>epoch)return deny('backup_newer_epoch',409);
    const different=!!record&&b.backupResetEpoch!==epoch;
    if(different&&b.recoverPastReset!==true)return deny('previous_reset_requires_confirmation',409);
    const {before,after}=restorePreviewState(record?.state_data||{},b.backupState);
    // Une sauvegarde V4 restaure aussi les étapes XP indépendantes des records effacés.
    const backupKeys:any[]=b.backupFormat==='mathas-connect-class-backup-v4'?b.backupMilestones:[];
    if(!Array.isArray(backupKeys)||backupKeys.length>100||backupKeys.some((x:any)=>!x||x.appKey!==app||typeof x.key!=='string'||! /^(classic:[123]:(4:perfect|10:(pass|bonus)|20:(pass|bonus))|sudden:[123]:(5|10)|hard:[123]:(3|7))$/.test(x.key)))return deny('invalid_backup_milestones');
    const uniqueKeys=[...new Set(backupKeys.map((x:any)=>x.key))].sort();
    const existing=await db.from('connect_xp_milestones').select('milestone_key').eq('student_id',b.studentId).eq('app_key',app);
    if(existing.error)throw Error('db_error');
    const currentKeys=new Set(existing.data.map((x:any)=>x.milestone_key));
    const missingKeys=uniqueKeys.filter((k:string)=>!currentKeys.has(k));
    const stateChanged=JSON.stringify(before)!==JSON.stringify(after);
    const changed=stateChanged||missingKeys.length>0;
    // Liaison de la confirmation à la prévisualisation exacte, sans table supplémentaire.
    const digestInput=JSON.stringify([b.classId,b.studentId,app,rev,epoch,b.backupRevision,b.backupResetEpoch,different,after,uniqueKeys,[...currentKeys].sort()]);
    const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(digestInput)))).map(v=>v.toString(16).padStart(2,'0')).join('');
    const info={ok:true,changed,studentId:b.studentId,appKey:app,currentRevision:rev,currentResetEpoch:epoch,
      recoveringPastReset:different,previewDigest:digest,stateChanged,restoringXpMilestones:missingKeys.length,before:restoreSummary(before),after:restoreSummary(after)};
    if(b.action==='teacher-restore-preview')return answer(info);
    // Une sauvegarde privée préalable est impérative. Le clic navigateur ne prouve
    // pas le stockage du fichier : le professeur doit vérifier lui-même sa copie.
    if(!b.confirmed||b.confirmationPhrase!=='RESTAURER'||b.safetyBackupExported!==true)return deny('confirmation_required',403);
    if(!int(b.expectedRevision,0,1000000000)||!int(b.expectedResetEpoch,0,1000000000))return deny('invalid_revision');
    if(rev!==b.expectedRevision||epoch!==b.expectedResetEpoch)return deny('revision_conflict',409);
    if(typeof b.previewDigest!=='string'||b.previewDigest!==digest)return deny('preview_changed',409);
    if(!changed){const xp=await refreshXp(b.studentId,app);return answer({...info,unchanged:true,...(xp?{xp}:{} )});}
    const payload={state_data:after,schema_version:1,updated_at:new Date().toISOString(),revision:rev+1};
    if(stateChanged&&record){
      const update=await db.from('connect_states').update(payload)
        .eq('student_id',b.studentId).eq('app_key',app).eq('revision',rev).eq('reset_epoch',epoch)
        .select('revision').maybeSingle();
      if(update.error)throw Error('db_error');
      if(!update.data)return deny('revision_conflict',409);
    }else if(stateChanged){
      const created=await db.from('connect_states')
        .insert({...payload,student_id:b.studentId,app_key:app,reset_epoch:epoch})
        .select('revision').single();
      if(created.error)return deny(created.error.code==='23505'?'revision_conflict':'db_error',created.error.code==='23505'?409:500);
    }
    if(missingKeys.length){
      const rows=missingKeys.map((key:string)=>({student_id:b.studentId,app_key:app,milestone_key:key,evidence:{source:'teacher-backup-v4',restored:true}}));
      const added=await db.from('connect_xp_milestones').upsert(rows,{onConflict:'student_id,app_key,milestone_key',ignoreDuplicates:true});
      if(added.error)return deny('milestone_restore_failed_after_state_write',500);
    }
    const xp=await refreshXp(b.studentId,app);
    return answer({...info,restored:true,revision:stateChanged?rev+1:rev,...(xp?{xp}:{} )});
  }
  if(b.action==='teacher-export'){
   // Sauvegarde privée, seulement pour l'enseignant gestionnaire de cette classe.
   if(!await managed())return deny('forbidden',403);
   const people=await db.from('connect_enrollments').select('student_id,joined_at,left_at').eq('class_id',b.classId).limit(250);
   if(people.error)throw Error('db_error');
   const ids=[...new Set(people.data.map((p:any)=>p.student_id))];
   const [profiles,states]=await Promise.all([
    ids.length?db.from('connect_students').select('id,display_name,public_alias,archived_at,avatar_kind,avatar_value,avatar_color,projection_opt_in').in('id',ids):Promise.resolve({data:[],error:null}),
    ids.length?db.from('connect_states').select('student_id,app_key,revision,reset_epoch,state_data').in('student_id',ids):Promise.resolve({data:[],error:null})
   ]);
   if(profiles.error||states.error)throw Error('db_error');
   const [credits,levels]=await Promise.all([
    ids.length?db.from('connect_xp_credits').select('student_id,app_key,xp_credited,evidence,ruleset_version,updated_at').in('student_id',ids):Promise.resolve({data:[],error:null}),
    ids.length?db.from('connect_level_profiles').select('student_id,highest_level_reached,level_ruleset_version,updated_at').in('student_id',ids):Promise.resolve({data:[],error:null})
   ]);
   if(credits.error||levels.error)throw Error('db_error');
   const milestones=ids.length?await db.from('connect_xp_milestones').select('student_id,app_key,milestone_key,achieved_at,evidence').in('student_id',ids).limit(10000):{data:[],error:null};
   if(milestones.error)throw Error('db_error');
   // Sauvegarde privée : archives et XP des parcours antérieurs également exportés.
   const [parcours,history,bonus]=await Promise.all([
    ids.length?db.from('connect_parcours_current').select('student_id,app_key,parcours_number,repeat_xp,started_at').in('student_id',ids).limit(250):Promise.resolve({data:[],error:null}),
    ids.length?db.from('connect_parcours_history').select('student_id,app_key,parcours_number,class_id,ended_at,repeat_xp,state_data,archived_xp').eq('class_id',b.classId).in('student_id',ids).limit(3000):Promise.resolve({data:[],error:null}),
    ids.length?db.from('connect_parcours_xp_bonus').select('student_id,app_key,parcours_number,milestone_key,points,achieved_at').in('student_id',ids).limit(8000):Promise.resolve({data:[],error:null})
   ]);
   if(parcours.error||history.error||bonus.error)throw Error('db_error');
   return answer({ok:true,format:'mathas-connect-class-backup-v4',projectRef:'awmhpfofacaglewammxt',exportedAt:new Date().toISOString(),classId:b.classId,
    students:profiles.data.map((p:any)=>({id:p.id,displayName:p.display_name,publicAlias:p.public_alias,archivedAt:p.archived_at,avatar:{kind:p.avatar_kind,value:p.avatar_value,color:p.avatar_color},projectionOptIn:p.projection_opt_in,
     xpMilestones:milestones.data.filter((x:any)=>x.student_id===p.id).map((x:any)=>({appKey:x.app_key,key:x.milestone_key,achievedAt:x.achieved_at,evidence:x.evidence})),
     xpCredits:credits.data.filter((x:any)=>x.student_id===p.id).map((x:any)=>({appKey:x.app_key,xpCredited:x.xp_credited,evidence:x.evidence,rulesetVersion:x.ruleset_version,updatedAt:x.updated_at})),
     levelProfile:levels.data.find((x:any)=>x.student_id===p.id)||null,
     parcoursCurrent:parcours.data.filter((x:any)=>x.student_id===p.id),
     parcoursHistory:history.data.filter((x:any)=>x.student_id===p.id),
     parcoursXpBonus:bonus.data.filter((x:any)=>x.student_id===p.id),
     enrollments:people.data.filter((e:any)=>e.student_id===p.id),
     apps:states.data.filter((state:any)=>state.student_id===p.id).map((state:any)=>({appKey:state.app_key,revision:state.revision,resetEpoch:state.reset_epoch,state:state.state_data}))}))
   });
  }
  if(b.action==='teacher-overview'){
   if(!await managed())return deny('forbidden',403);
   const en=await db.from('connect_enrollments').select('student_id').eq('class_id',b.classId).is('left_at',null).limit(250);
   if(en.error)throw Error('db_error');
   const ids=[...new Set(en.data.map((x:any)=>x.student_id))];
   if(!ids.length)return answer({ok:true,students:[]});
   const [names,states]=await Promise.all([
    db.from('connect_students').select('id,display_name').in('id',ids).is('archived_at',null),
    db.from('connect_states').select('student_id,app_key,state_data').in('student_id',ids)
   ]);
   if(names.error||states.error)throw Error('db_error');
   const byStudent=new Map<string,any[]>();
   for(const row of states.data){
    let apps=byStudent.get(row.student_id);if(!apps){apps=[];byStudent.set(row.student_id,apps)}
    const state=row.state_data||{};
    apps.push({appKey:row.app_key,state:{recent:Array.isArray(state.recent)?state.recent.slice(0,3).map((r:any)=>({at:r.at,score:r.score,total:r.total})):[],
     bestPoints:state.bestPoints??null,todayBest:state.todayBest??null,classic:state.classic??null,sudden:state.sudden??null,hard:state.hard??null}});
   }
   return answer({ok:true,students:names.data.map((p:any)=>({id:p.id,displayName:p.display_name,apps:byStudent.get(p.id)||[]}))});
  }
  if(b.action==='teacher-summary'){
   if(!selected||!await managed())return deny('forbidden',403);
   const en=await db.from('connect_enrollments').select('student_id').eq('class_id',b.classId).is('left_at',null).limit(100);
   if(en.error)throw Error('db');const ids=[...new Set(en.data.map(x=>x.student_id))];
   if(!ids.length)return answer({ok:true,students:[]});
   const [names,states]=await Promise.all([db.from('connect_students').select('id,display_name').in('id',ids).is('archived_at',null),db.from('connect_states').select('student_id,state_data').eq('app_key',selected).in('student_id',ids)]);
   if(names.error||states.error)throw Error('db');
   const map=new Map(states.data.map(x=>[x.student_id,x.state_data]));
   return answer({ok:true,students:names.data.map(x=>{const s:any=map.get(x.id)||{};return {id:x.id,name:x.display_name,recent:(s.recent||[]).slice(0,3),bestPoints:s.bestPoints??null,todayBest:s.todayBest?.day===belgianDay()?s.todayBest.points:null}}).sort((a,b)=>a.name.localeCompare(b.name,'fr'))});
  }
  if(b.action==='teacher-detail'){
   if(!selected||!await managed()||!valid(b.studentId))return deny('forbidden',403);
   const enrolled=await read(db.from('connect_enrollments').select('id').eq('student_id',b.studentId).eq('class_id',b.classId).is('left_at',null));if(!enrolled||!await read(db.from('connect_students').select('id').eq('id',b.studentId).is('archived_at',null)))return deny('forbidden',403);
   const [name,state]=await Promise.all([read(db.from('connect_students').select('display_name').eq('id',b.studentId)),read(db.from('connect_states').select('revision,state_data').eq('student_id',b.studentId).eq('app_key',selected))]);
   return answer({ok:true,studentId:b.studentId,name:name?.display_name||'Élève',state:state?.state_data||null,revision:state?.revision??0});
  }
  if(b.action==='student-xp'){
   if(b.appKey!==app&&b.appKey!==mul)return deny('forbidden',403);
   const studentId=await identity();if(!studentId)return deny('forbidden',403);
   const {data:summary,error:xpError}=await db.rpc('connect_xp_read_v2',{p_student:studentId,p_app:b.appKey,p_include_milestones:true});
   if(xpError||!summary)return deny('xp_unavailable',503);
   return answer({ok:true,appXp:summary.appXp,total:summary.total,level:summary.level,next:summary.next,milestones:summary.milestones,currentMilestones:summary.currentMilestones,parcours:summary.parcours,repeatXp:summary.repeatXp,max:summary.max});
  }
  if(b.action==='student-load'||b.action==='student-save'||b.action==='lab-record'||b.action==='game-record'||b.action==='game-reset'){
   if(!selected||(b.action==='lab-record'&&selected!==lab)||(b.action==='game-record'&&selected!==app&&selected!==mul))return deny('forbidden',403);
   const studentId=await identity();if(!studentId)return deny('forbidden',403);
   const current=await read(db.from('connect_states').select('revision,state_data,reset_epoch').eq('student_id',studentId).eq('app_key',selected));
   if(b.action==='student-load')return answer({ok:true,revision:current?.revision??0,resetEpoch:current?.reset_epoch??0,state:current?.state_data||null});
   // Les jeux réels restent en lecture seule. Écriture exclusivement pour le laboratoire.
   if(b.action==='game-reset')return deny('teacher_only',403);
   if(b.action==='student-save')return deny('write_not_enabled',403);
   if(!valid(b.eventId)||!int(b.expectedRevision,0,1000000000)||!int(b.expectedResetEpoch,0,1000000000)||!['classic','sudden','hard','hard-challenge'].includes(b.mode)
     ||!int(b.level,1,3)||!int(b.score,0,100000)||!int(b.points,0,10000000)
     ||(b.mode==='classic'?(![4,10,20].includes(b.total)||b.score>b.total):b.mode==='hard-challenge'?(b.total!==5||b.score>5||b.points!==0):b.total!=null))
      return deny('invalid_result');
   const rev=current?.revision??0;
   if((current?.reset_epoch??0)!==b.expectedResetEpoch)return deny('stale_reset_epoch',409);
   const prior=validate(current?.state_data||{});
   if(prior.ids.includes(b.eventId)){const xp=await refreshXp(studentId,selected);return answer({ok:true,revision:rev,resetEpoch:current?.reset_epoch??0,state:prior,duplicate:true,...(xp?{xp}:{})});}
   if(rev!==b.expectedRevision)return deny('revision_conflict',409);
   const next=structuredClone(prior),i=b.level-1,when=new Date().toISOString();
   next.ids=[b.eventId,...next.ids].slice(0,50);
   next.recent=[{eventId:b.eventId,mode:b.mode,level:b.level,score:b.score,total:b.total??null,points:b.points,at:when},...next.recent].slice(0,3);
   if(b.mode==='classic'){
      next.classic[i][b.total]=Math.max(next.classic[i][b.total]??0,b.score);
      if(b.total>=10&&b.score*5>=b.total*4){
         next.progress['sudden'+b.level]=true;
         if(b.level===1)next.progress.level2=true;
         if(b.level===2)next.progress.level3=true;
      }
      if(b.total>=10&&b.score===b.total)next.progress['perfect'+b.level]=true;
      if(next.progress.perfect1&&next.progress.perfect2&&next.progress.perfect3)next.progress.hard=true;
   }else if(b.mode==='hard-challenge')next.hardThree[i]=Math.max(next.hardThree[i]??0,b.score);
   else next[b.mode][i]=Math.max(next[b.mode][i]??0,b.score);
   if(b.action==='game-record'&&b.rewards!=null){
     const received=normalizeRewards(b.rewards);
     next.rewards=mergeRewards(next.rewards,received);
   }
   if(b.mode!=='hard-challenge'){
     next.bestPoints=Math.max(next.bestPoints??0,b.points);
     next.topThree=[...next.topThree,b.points].sort((a:number,b:number)=>b-a).slice(0,3);
     const today=belgianDay();
     next.todayBest={day:today,points:Math.max(next.todayBest?.day===today?next.todayBest.points:0,b.points)};
   }
   const payload={state_data:next,schema_version:1,updated_at:when};
   if(current){
      const update=await db.from('connect_states').update({...payload,revision:rev+1})
        .eq('student_id',studentId).eq('app_key',selected).eq('revision',rev).eq('reset_epoch',b.expectedResetEpoch).select('revision').maybeSingle();
      if(update.error)throw Error('db_error');
      if(!update.data)return deny('revision_conflict',409);
      const xp=await refreshXp(studentId,selected);
      return answer({ok:true,revision:update.data.revision,resetEpoch:b.expectedResetEpoch,state:next,...(xp?{xp}:{} )});
   }
   const created=await db.from('connect_states').insert({...payload,student_id:studentId,app_key:selected,revision:1}).select('revision').single();
   if(created.error)return deny(created.error.code==='23505'?'revision_conflict':'db_error',created.error.code==='23505'?409:500);
   const xp=await refreshXp(studentId,selected);
   return answer({ok:true,revision:created.data.revision,resetEpoch:b.expectedResetEpoch,state:next,...(xp?{xp}:{} )});
  }
  return deny('unknown_action',404);
 }catch{return deny('server_error',500)}
});
