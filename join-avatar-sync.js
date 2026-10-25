import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.95.0';
const sb=createClient('https://awmhpfofacaglewammxt.supabase.co','sb_publishable_oI2Pyl3kXzmLkK-CBnw9Nw_66a4fZgM');
const cls=new URLSearchParams(location.search).get('class');
const key='mathas.connect.avatar-pending:'+cls;
const approved=document.querySelector('[data-view="approved"]');
let busy=false;
async function syncAvatar(){
 if(busy||!approved||approved.hidden)return;
 let avatar;try{avatar=JSON.parse(localStorage.getItem(key)||'null')}catch{return}
 if(!avatar)return;
 busy=true;
 try{
 const {data:{session}}=await sb.auth.getSession();
 if(!session?.user?.is_anonymous)return;
 const headers={'content-type':'application/json',apikey:'sb_publishable_oI2Pyl3kXzmLkK-CBnw9Nw_66a4fZgM',authorization:'Bearer '+session.access_token};
 const endpoint='https://awmhpfofacaglewammxt.supabase.co/functions/v1/connect-api';
 const who=await fetch(endpoint,{method:'POST',headers,body:JSON.stringify({action:'student-me',classId:cls})}).then(r=>r.json());
 if(!who.ok||who.status!=='approved')return;
 const result=await fetch(endpoint,{method:'POST',headers,body:JSON.stringify({action:'student-avatar',...avatar})});
 if(result.ok&&(await result.json()).ok)localStorage.removeItem(key);
 }catch(e){console.warn('Avatar à resynchroniser lors de la prochaine visite.')}
 finally{busy=false}
}
if(approved){new MutationObserver(syncAvatar).observe(approved,{attributes:true,attributeFilter:['hidden']});syncAvatar();}
