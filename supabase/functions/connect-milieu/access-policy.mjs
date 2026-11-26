// School access requires an enabled class, approved identity and visible preset;
// TEST keeps its fictive allowlist. Explicit pilot/closed settings remain authoritative.
 // An explicit closed or unknown environment setting always closes the route.
export const PILOT_CLASS='4bf3400d-a315-4ea4-a2f3-afaca24dc9b9';
export function milieuAccess(url,setting){
 try{
  if(new URL(url).hostname!=='awmhpfofacaglewammxt.supabase.co')return 'closed';
  return setting==null||setting==='open'?'open':setting==='pilot'?'pilot':'closed';
 }catch{return 'closed'}
}
