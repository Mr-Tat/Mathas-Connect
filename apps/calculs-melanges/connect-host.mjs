// Utilise la session Supabase déjà créée par Math'as Connect.
// Aucun appel réseau au chargement du module. Instancié seulement derrière
// CONNECT_WRITE_READY après validation de l'Edge et des RPC XP.
export const CONNECT_URL='https://awmhpfofacaglewammxt.supabase.co';
export const CONNECT_PUBLISHABLE_KEY='sb_publishable_oI2Pyl3kXzmLkK-CBnw9Nw_66a4fZgM';
export const CONNECT_APP='melange-calculs-ecrits';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export async function createAuthenticatedHost({classId,teacherPlayer=false,createClient,fetchImpl=fetch,baseUrl=CONNECT_URL,apikey=CONNECT_PUBLISHABLE_KEY}){
 if(!UUID.test(classId)||typeof createClient!=='function'||typeof fetchImpl!=='function')throw Error('invalid_connect_host');
 if(!/^https:\/\/[a-z0-9.-]+\.supabase\.co$/.test(baseUrl)||typeof apikey!=='string'||!apikey.startsWith('sb_publishable_'))throw Error('untrusted_connect_endpoint');
 const client=createClient(baseUrl,apikey,{auth:{
  persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,
  ...(teacherPlayer?{storageKey:'mathas-connect-professor-auth-v1'}:{})
 }});
 const initial=(await client.auth.getSession()).data?.session;
 if(!initial?.access_token||!UUID.test(initial.user?.id)||
  (teacherPlayer?initial.user.is_anonymous===true:initial.user.is_anonymous!==true))
  throw Error('connect_session_missing');
 const subject=initial.user.id;let pupilId=null;
 async function getToken(){
  const current=(await client.auth.getSession()).data?.session;
  if(!current?.access_token||current.user?.id!==subject)throw Error('connect_identity_changed');
  return current.access_token;
 }
 async function call(action,endpoint){
  const token=await getToken();
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
  try{
  const response=await fetchImpl(baseUrl+'/functions/v1/'+endpoint,{
   signal:controller.signal,method:'POST',headers:{apikey,authorization:'Bearer '+token,'content-type':'application/json'},
   body:JSON.stringify({action,classId,...(pupilId?{expectedStudentId:pupilId}:{}),...(endpoint==='connect-results'?{appKey:CONNECT_APP}:{})})
  });
  const json=await response.json().catch(()=>null);
  if(!response.ok||json?.ok!==true)throw Error('connect_'+(json?.error||'unavailable'));
  return json;
  }finally{clearTimeout(timer)}
 }
 const profile=await call(teacherPlayer?'teacher-player':'student-me','connect-api');
 if(profile.status!=='approved'||profile.classId!==classId)throw Error('connect_profile_not_approved');
 return Object.freeze({
  classId,
  // Unique authenticated user ID used ONLY to namespace local data.
  // The Edge derives the actual student_id from the authenticated token.
  studentId:subject,
  get pupilId(){return pupilId},
  endpoint:baseUrl+'/functions/v1/connect-results',
  apikey,
  getToken,
  load:async()=>{const state=await call('student-load','connect-results');if(!UUID.test(state.storageSubject)||(pupilId&&pupilId!==state.storageSubject))throw Error('connect_pupil_changed');pupilId=state.storageSubject.toLowerCase();return state},
  readXp:()=>call('student-xp','connect-results')
 });
}
