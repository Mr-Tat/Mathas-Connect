// Activation exclusivement bornée au projet Connect et au pilote TEST.
// SQL garde la classe TEST fermée tant qu'elle n'est pas explicitement active.
// Une valeur "closed" dans les secrets Supabase a toujours priorité.
const CONNECT_HOST='awmhpfofacaglewammxt.supabase.co';
export function resolveAbaqueAccess(setting, projectUrl){
  if(setting==='pilot')return 'pilot';
  if(setting!==undefined&&setting!==null)return 'closed';
  try{return new URL(projectUrl).hostname===CONNECT_HOST?'pilot':'closed';}
  catch{return 'closed';}
}
