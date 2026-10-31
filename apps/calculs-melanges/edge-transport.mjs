// Adaptateur HTTP pour un pilote autorisé dans un environnement d'essai.
// Pas d'authentification recréée : le jeton provient du client Connect existant.
// Une erreur serveur ne vaut jamais confirmation d'enregistrement.
export function createEdgePost({endpoint,getToken,apikey,fetchImpl=fetch,timeoutMs=10000}){
 if(typeof endpoint!=='string'||!/^https:\/\//.test(endpoint)||typeof getToken!=='function'||typeof fetchImpl!=='function')throw Error('invalid_transport');
 if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>60000)throw Error('invalid_timeout');
 return async event=>{
  const token=await getToken();
  if(typeof token!=='string'||!token)throw Error('missing_session');
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
  const response=await fetchImpl(endpoint,{signal:controller.signal,method:'POST',headers:{apikey,authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify(event)});
  const body=await response.json().catch(()=>null);
  if(!response.ok)return {ok:false,status:response.status,error:body?.error||'server_error'};
  if(body?.ok!==true)return {ok:false,status:response.status,error:'invalid_server_response'};
  return body;
  }finally{clearTimeout(timer)}
 };
}
