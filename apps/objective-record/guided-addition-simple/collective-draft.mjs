// Sauvegarde de secours LOCALE du guidé collectif : onglet + classe + compte élève.
// Aucune donnée de résultat envoyée à Supabase, aucun score/XP écrit.
export const DRAFT_VERSION=1;
export const DRAFT_TTL_MS=12*60*60*1000;
export const MAX_DRAFT_BYTES=120*1024;
const UUID=/^[0-9a-f]{8}-[0-9a-f-]{27}$/i;

export function createGuidedDraftStore({storage,classId,studentId,now=()=>Date.now()}={}){
 const enabled=!!storage&&UUID.test(classId||'')&&UUID.test(studentId||'');
 const key=enabled?'mathas.add.simple.guided.draft.v1.'+classId+'.'+studentId:null;
 function clear(){
  if(!enabled)return;
  try{storage.removeItem(key)}catch{}
 }
 function read(session){
  if(!enabled||!UUID.test(session?.sessionId||''))return null;
  try{
   const raw=storage.getItem(key);
   if(!raw)return null;
   if(raw.length>MAX_DRAFT_BYTES){clear();return null}
   const data=JSON.parse(raw);
   const valid=data?.version===DRAFT_VERSION&&data.sessionId===session.sessionId
    &&Number.isSafeInteger(data.savedAt)&&data.savedAt<=now()+30000
    &&now()-data.savedAt<=DRAFT_TTL_MS
    &&Number.isInteger(data.pageIndex)&&data.pageIndex>=0
    &&data.pageIndex<session.pages.length
    &&Array.isArray(data.pages)&&data.pages.length<=120;
   if(!valid){clear();return null}
   return data;
  }catch{clear();return null}
 }
 function save(session,pageIndex,pages){
  if(!enabled||!UUID.test(session?.sessionId||'')
    ||!Number.isInteger(pageIndex)||pageIndex<0||pageIndex>=session.pages.length
    ||!Array.isArray(pages)||pages.length>120)return false;
  try{
   const raw=JSON.stringify({version:DRAFT_VERSION,sessionId:session.sessionId,
    savedAt:now(),pageIndex,pages});
   if(raw.length>MAX_DRAFT_BYTES)return false;
   storage.setItem(key,raw);
   return true;
  }catch{return false}
 }
 return {enabled,read,save,clear};
}
