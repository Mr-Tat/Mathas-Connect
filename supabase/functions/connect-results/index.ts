import {createClient} from 'npm:@supabase/supabase-js@2.95.0';
const url=Deno.env.get('SUPABASE_URL')!,pub=Deno.env.get('SUPABASE_ANON_KEY')!,priv=Deno.env.get('SUPABASE_'+'SERVICE_ROLE_KEY')!;
const db=createClient(url,priv,{auth:{persistSession:false,autoRefreshToken:false}});
const headers={'content-type':'application/json','cache-control':'no-store','access-control-allow-origin':'*','access-control-allow-headers':'authorization,apikey,content-type','access-control-allow-methods':'POST,OPTIONS'};
const answer=(v:object,status=200)=>new Response(JSON.stringify(v),{status,headers});
const deny=(e:string,status=400)=>answer({ok:false,error:e},status);
const valid=(v:any)=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const app='addition-ecrite-simple',lab='connect-lab';
const appAllowed=(k:any)=>k===app||k===lab;
const belgianDay=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Brussels',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const read=async(q:any)=>{const {data,error}=await q.maybeSingle();if(error)throw Error('db_error');return data};
const int=(n:any,min:number,max:number)=>Number.isSafeInteger(n)&&n>=min&&n<=max;
function validate(s:any){
 if(!s||typeof s!=='object'||Array.isArray(s))throw Error('bad_state');
 const classic=Array.from({length:3},(_,i)=>{const x=s.classic?.[i]??{};if(typeof x!=='object'||Array.isArray(x))throw Error('classic');const y:any={};for(const count of [4,10,20])if(x[count]!=null){if(!int(x[count],0,count))throw Error('classic');y[count]=x[count]}return y});
 const sequence=(k:string)=>Array.from({length:3},(_,i)=>{const v=s[k]?.[i];if(v==null)return null;if(!int(v,0,100000))throw Error(k);return v});
 const recent=(s.recent??[]);if(!Array.isArray(recent)||recent.length>3)throw Error('recent');
 const runs=recent.map((v:any)=>{if(!v||!['classic','sudden','hard'].includes(v.mode)||!int(v.level,1,3)||!int(v.score,0,100000)||!/^\d{4}-\d{2}-\d{2}T/.test(v.at||''))throw Error('recent');if(v.total!=null&&(![4,5,10,20].includes(v.total)||v.score>v.total))throw Error('recent');return {mode:v.mode,level:v.level,score:v.score,total:v.total??null,points:int(v.points,0,10000000)?v.points:0,eventId:valid(v.eventId)?v.eventId:null,at:String(v.at).slice(0,32)}});
 const best=s.bestPoints??null;if(best!==null&&!int(best,0,10000000))throw Error('best');
 const today=s.todayBest??null;if(today!==null&&(!/^\d{4}-\d{2}-\d{2}$/.test(today.day||'')||!int(today.points,0,10000000)))throw Error('today');
 const prog:any={};for(const k of ['level2','level3','sudden1','sudden2','sudden3','perfect1','perfect2','perfect3','hard']){if(s.progress?.[k]!=null){if(typeof s.progress[k]!=='boolean')throw Error('progress');prog[k]=s.progress[k]}}
 const ids=Array.isArray(s.ids)?s.ids.slice(0,50).filter(valid):[];
 return {classic,sudden:sequence('sudden'),hard:sequence('hard'),recent:runs,bestPoints:best,todayBest:today,progress:prog,ids};
}
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('',{headers});
 if(req.method!=='POST')return deny('method',405);
 const token=req.headers.get('authorization')?.match(/^Bearer (\S+)$/i)?.[1];if(!token)return deny('auth',401);
 const client=createClient(url,pub,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:{user},error}=await client.auth.getUser(token);if(error||!user)return deny('auth',401);
 const raw=await req.text();if(raw.length>6500)return deny('too_large',413);
 let b:any;try{b=JSON.parse(raw)}catch{return deny('json')};
 if(!valid(b?.classId))return deny('class');
 const selected=appAllowed(b.appKey)?b.appKey:null;
 try{
  const managed=async()=>!user.is_anonymous&&!!await read(db.from('connect_class_permissions').select('class_id').eq('teacher_id',user.id).eq('class_id',b.classId).eq('can_manage',true));
  const identity=async()=>{if(!user.is_anonymous)return null;const device=await read(db.from('connect_devices').select('student_id').eq('auth_user_id',user.id).eq('state','approved').limit(1));if(!device)return null;return await read(db.from('connect_enrollments').select('student_id').eq('student_id',device.student_id).eq('class_id',b.classId).is('left_at',null))?device.student_id:null};
  if(b.action==='teacher-summary'){
   if(!selected||!await managed())return deny('forbidden',403);
   const en=await db.from('connect_enrollments').select('student_id').eq('class_id',b.classId).is('left_at',null).limit(100);
   if(en.error)throw Error('db');const ids=[...new Set(en.data.map(x=>x.student_id))];
   if(!ids.length)return answer({ok:true,students:[]});
   const [names,states]=await Promise.all([db.from('connect_students').select('id,display_name').in('id',ids),db.from('connect_states').select('student_id,state_data').eq('app_key',selected).in('student_id',ids)]);
   if(names.error||states.error)throw Error('db');
   const map=new Map(states.data.map(x=>[x.student_id,x.state_data]));
   return answer({ok:true,students:names.data.map(x=>{const s:any=map.get(x.id)||{};return {id:x.id,name:x.display_name,recent:(s.recent||[]).slice(0,3),bestPoints:s.bestPoints??null,todayBest:s.todayBest?.day===belgianDay()?s.todayBest.points:null}}).sort((a,b)=>a.name.localeCompare(b.name,'fr'))});
  }
  if(b.action==='teacher-detail'){
   if(!selected||!await managed()||!valid(b.studentId))return deny('forbidden',403);
   const enrolled=await read(db.from('connect_enrollments').select('id').eq('student_id',b.studentId).eq('class_id',b.classId).is('left_at',null));if(!enrolled)return deny('forbidden',403);
   const [name,state]=await Promise.all([read(db.from('connect_students').select('display_name').eq('id',b.studentId)),read(db.from('connect_states').select('revision,state_data').eq('student_id',b.studentId).eq('app_key',selected))]);
   return answer({ok:true,name:name?.display_name||'Élève',state:state?.state_data||null,revision:state?.revision??0});
  }
  if(b.action==='student-load'||b.action==='student-save'||b.action==='lab-record'){
   if(!selected||b.action==='lab-record'&&selected!==lab)return deny('forbidden',403);
   const studentId=await identity();if(!studentId)return deny('forbidden',403);
   const current=await read(db.from('connect_states').select('revision,state_data,reset_epoch').eq('student_id',studentId).eq('app_key',selected));
   if(b.action==='student-load')return answer({ok:true,revision:current?.revision??0,resetEpoch:current?.reset_epoch??0,state:current?.state_data||null});
   // Les jeux réels restent en lecture seule. Écriture exclusivement pour le laboratoire.
   if(b.action==='student-save')return deny('write_not_enabled',403);
   if(!valid(b.eventId)||!int(b.expectedRevision,0,1000000000)||!['classic','sudden','hard'].includes(b.mode)
     ||!int(b.level,1,3)||!int(b.score,0,100000)||!int(b.points,0,10000000)
     ||(b.mode==='classic'?(![4,10,20].includes(b.total)||b.score>b.total):b.total!=null))
      return deny('invalid_result');
   const rev=current?.revision??0;
   const prior=validate(current?.state_data||{});
   if(prior.ids.includes(b.eventId))return answer({ok:true,revision:rev,state:prior,duplicate:true});
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
   }else next[b.mode][i]=Math.max(next[b.mode][i]??0,b.score);
   next.bestPoints=Math.max(next.bestPoints??0,b.points);
   const today=belgianDay();
   next.todayBest={day:today,points:Math.max(next.todayBest?.day===today?next.todayBest.points:0,b.points)};
   const payload={state_data:next,schema_version:1,updated_at:when};
   if(current){
      const update=await db.from('connect_states').update({...payload,revision:rev+1})
        .eq('student_id',studentId).eq('app_key',lab).eq('revision',rev).select('revision').maybeSingle();
      if(update.error)throw Error('db_error');
      if(!update.data)return deny('revision_conflict',409);
      return answer({ok:true,revision:update.data.revision,state:next});
   }
   const created=await db.from('connect_states').insert({...payload,student_id:studentId,app_key:lab,revision:1}).select('revision').single();
   if(created.error)return deny(created.error.code==='23505'?'revision_conflict':'db_error',created.error.code==='23505'?409:500);
   return answer({ok:true,revision:created.data.revision,state:next});
  }
  return deny('unknown_action',404);
 }catch{return deny('server_error',500)}
});
