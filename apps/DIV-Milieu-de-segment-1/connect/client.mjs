import {questionSequence} from './seeded-questions.mjs';
import {avatarGlyph,avatarColor} from '../../../avatar-catalog.js';
const BASE='https://awmhpfofacaglewammxt.supabase.co';
const KEY='sb_publishable_oI2Pyl3kXzmLkK-CBnw9Nw_66a4fZgM';
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
export async function openMilieu({classId,teacher,onInvalid}){
 if(!uuid(classId))throw Error('Classe manquante. Ouvre le jeu depuis le HUB.');
 const {createClient}=await import('https://esm.sh/@supabase/supabase-js@2.95.0');
 const client=createClient(BASE,KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,storageKey:teacher?'mathas-connect-professor-auth-v1':'sb-awmhpfofacaglewammxt-auth-token'}});
 const initial=(await client.auth.getSession()).data?.session;
 if(!initial?.access_token||!uuid(initial.user?.id))throw Error('Session Connect manquante.');
 const subject=initial.user.id;
 let pupil=null,active=true;
 client.auth.onAuthStateChange((_event,session)=>{if(!session?.access_token||session.user?.id!==subject){active=false;onInvalid?.()}});
 async function post(action,body={}){
  const session=(await client.auth.getSession()).data?.session;
  if(!active||!session?.access_token||session.user?.id!==subject)throw Object.assign(Error('Session modifiée.'),{status:401});
  const c=new AbortController(),timer=setTimeout(()=>c.abort(),12000);
  try{
   const response=await fetch(BASE+'/functions/v1/connect-milieu',{method:'POST',signal:c.signal,cache:'no-store',headers:{apikey:KEY,authorization:'Bearer '+session.access_token,'content-type':'application/json'},body:JSON.stringify({...body,action,appKey:'milieu-segment',classId,...(pupil?{expectedStudentId:pupil}:{})})});
   const value=await response.json().catch(()=>null);
   if(!active)throw Object.assign(Error('Session modifiée.'),{status:401});
   if(!response.ok||value?.ok!==true)throw Object.assign(Error(value?.error||'Connexion indisponible.'),{status:response.status,code:value?.error});
   if(value.authSubject!==subject||value.classId!==classId||(value.studentId&&pupil&&value.studentId!==pupil))throw Object.assign(Error('Identité invalide.'),{status:401});
   return value;
  }finally{clearTimeout(timer)}
 }
 const snapshot=await post('load');
 if(!uuid(snapshot.studentId)||snapshot.ruleset!==2||snapshot.status!=='approved'||!Number.isSafeInteger(snapshot.resetEpoch)||!Number.isSafeInteger(snapshot.revision)||snapshot.xp?.max!==280||!snapshot.state?.levels||!Array.isArray(snapshot.trophies))throw Error('Réponse Connect invalide.');
 pupil=snapshot.studentId;
 const storageKey='mathas.milieu-segment.official.v2.'+[classId,subject,pupil].join('.');
 try{localStorage.setItem(storageKey+'.probe','1');localStorage.removeItem(storageKey+'.probe')}catch{throw Error('Sauvegarde indisponible. Impossible de jouer officiellement.')}
 return {post,snapshot,storageKey,questionSequence,classId,subject,pupil,avatarGlyph,avatarColor};
}
