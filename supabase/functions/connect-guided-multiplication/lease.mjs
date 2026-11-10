// Contrat de présence d'un onglet professeur pour le guidé collectif Multiplication.
// 15 s de reprise après rechargement/navigation ; repli si un navigateur ne signale pas sa fermeture.
// Le délai plus long de présence évite de fermer la classe quand le professeur consulte un autre onglet.
export const CLOSE_GRACE_MS=15_000;
export const HEARTBEAT_TIMEOUT_MS=10*60_000;
export function guidedSessionLive(row,now=Date.now()){
 if(row?.active!==true)return false;
 const seen=Date.parse(row.host_seen_at||row.updated_at||'');
 if(!Number.isFinite(seen)||seen+HEARTBEAT_TIMEOUT_MS<=now)return false;
 if(row.close_requested_at){
  const closing=Date.parse(row.close_requested_at);
  if(!Number.isFinite(closing)||closing+CLOSE_GRACE_MS<=now)return false;
 }
 return true;
}
export function mayRenewGuidedHost(row,{teacherId,sessionId,hostId}){
 return !!(row&&row.active===true&&typeof teacherId==='string'
  &&row.teacher_id===teacherId&&row.session_id===sessionId
  &&typeof hostId==='string'&&row.host_client_id===hostId);
}
