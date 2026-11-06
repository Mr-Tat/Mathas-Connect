// Math'as Connect — short-lived, in-memory verification of an unchanged JWT.
// Supabase's getUser() performs a separate network round-trip. A token already
// verified by Auth does not need another getUser request for every school API
// call; the Edge Function still authenticates and authorizes EACH request.
//
// Never persist this cache. A new JWT, changed identity or expired TTL forces
// another remote verification. Parallel requests share one verification.
export function createVerifiedSessionToken({auth,teacher=false,ttlMs=45_000,now=()=>Date.now()}){
 if(!auth?.getSession||!auth?.getUser||!Number.isSafeInteger(ttlMs)||ttlMs<0)
  throw Error('Authentification Connect indisponible');
 let verified=null,pending=null,owner=null;
 return async function verifiedToken(){
  const {data:{session:local}={}}=await auth.getSession();
  const token=local?.access_token,id=local?.user?.id;
  if(!token||!id)throw Error('Session Connect absente');
  if(owner&&owner!==id)throw Error('Le profil connecté a changé');
  if(verified?.token===token&&verified.id===id&&now()<verified.until)return token;
  if(!pending||pending.token!==token||pending.id!==id){
   const promise=(async()=>{
    // This call validates the current JWT with Supabase Auth, not just
    // the untrusted user object returned by getSession().
    const {data:{user}={},error}=await auth.getUser(token);
    if(error||!user||user.id!==id
      ||(teacher?user.is_anonymous===true:user.is_anonymous!==true))
     throw Error('Session Connect non reconnue');
   })();
   pending={token,id,promise};
  }
  const request=pending;
  try{
   await request.promise;
   if(owner&&owner!==id)throw Error('Le profil connecté a changé');
   // An older in-flight check must not replace a newer JWT's cache.
   if(pending===request){
    owner=id;
    verified={token,id,until:now()+ttlMs};
   }
   return token;
  }finally{
   if(pending===request)pending=null;
  }
 };
}
