// Verified profile badge: TEST or enabled/visible school class (checked by the RPC).
const CLASS='4bf3400d-a315-4ea4-a2f3-afaca24dc9b9';
const SCHOOL=new Set(["8fe170fa-9e8f-4e80-885a-b0ba68026f64","71f5f4a5-3f25-4ec7-ac29-c33d2e6b395e","1b021ed9-4846-4203-9c7b-4b5fa8d7adab","0d8ba828-59cc-468b-a4b8-7b2a1af10b88","a9195199-0a28-4e86-99ce-47b36dd6e646"]);
const APP='milieu-segment';
export async function appendMilieuProgress(previous,{db,url,setting,classId,actor,teacher,studentId}){
 if(!previous||!Array.isArray(previous.apps)||(classId!==CLASS&&!SCHOOL.has(classId))||!studentId||!actor)return previous;
 try{
  if(new URL(url).hostname!=='awmhpfofacaglewammxt.supabase.co'||(setting!=null&&!['pilot','open'].includes(setting))||(setting==='pilot'&&classId!==CLASS))return previous;
  const {data,error}=await db.rpc('connect_milieu_load_v2',{p_actor:actor,p_class:classId,p_teacher:teacher,p_expected:studentId});
  if(error||data?.ok!==true||data.appKey!==APP||data.studentId!==studentId)return previous;
  const s=data.state;
  if(!s||typeof s!=='object'||Array.isArray(s))return previous;
  const rights=Object.values(s.rights||{}),cups=Object.values(s.cups||{});
  if(rights.some(x=>!Number.isSafeInteger(x)||x<0)||cups.some(x=>x!==true))return previous;
  // The 280 denominator is the permanent first-path rights, not replay bonus XP.
  const xpEarned=rights.reduce((sum,x)=>sum+x,0),trophiesEarned=cups.length;
  if(xpEarned>280||trophiesEarned>12)return previous;
  return {...previous,apps:[...previous.apps.filter(a=>a.appKey!==APP),{appKey:APP,xpEarned,xpMax:280,trophiesEarned,trophiesMax:12}]};
 }catch{return previous}
}
