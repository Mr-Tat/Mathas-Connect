import {isFixedTestApp,normalizeAtomicTestCompletion,acceptNativeRecordAck} from './native-official-record.mjs';
// TEST-class bridge to atomic official Connect RPCs (the original Addition-multiple RPC and the fixed-operation candidate).
// Only classic/sudden. Native-browser score is not an independently verified
// arithmetic transcript, so this gate must never be opened in real classrooms.
export function createAtomicTestRecorder({classId,appKey,subject,storage,send,reload,notify,isCurrent,onRecorded=()=>{}}){
 const TEST='4bf3400d-a315-4ea4-a2f3-afaca24dc9b9';
 if(classId!==TEST||!isFixedTestApp(appKey)||!subject
   ||typeof send!=='function'||typeof reload!=='function'
   ||typeof notify!=='function'||typeof isCurrent!=='function')return null;
 const key='mathas.record-test-native.v1.'+classId+'.'+subject+'.'+appKey;
 let version=null,runId=null,ended=false,sending=false,pending=null;
 const uuid=()=>crypto.randomUUID();
 function read(){
  try{const v=JSON.parse(storage.getItem(key)||'null');
   if(!v||v.appKey!==appKey||v.classId!==TEST
      ||typeof v.eventId!=='string'||v.eventId.length!==36)return null;
   return v;
  }catch{return null}
 }
 function write(p){
  if(p)storage.setItem(key,JSON.stringify(p));else storage.removeItem(key);
  pending=p;
 }
 function initialize(doc){
  if(!doc||!Number.isSafeInteger(doc.revision)||doc.revision<0
    ||!Number.isSafeInteger(doc.resetEpoch)||doc.resetEpoch<0)return false;
  version={revision:doc.revision,resetEpoch:doc.resetEpoch};
  pending=read();return true;
 }
 // Never replay a queued receipt into a different parcours after a teacher
 // reset. Archive the ORIGINAL payload before clearing the live queue; if
 // local storage is full, fail closed and keep the pending event untouched.
 function quarantine(event,reason){
  const archiveKey=key+'.archive.'+event.eventId;
  storage.setItem(archiveKey,JSON.stringify({...event,quarantineReason:reason}));
  write(null);
 }
 async function retry(){
  if(!isCurrent()||sending||!pending||!version)return !pending;
  sending=true;
  const event=pending;
  try{
   notify('Enregistrement officiel de la partie…');
   const {appKey:ignoreApp,classId:ignoreClass,...request}=event;
   const response=await send(request);
   if(!isCurrent())return false;
   const ack=acceptNativeRecordAck(response,event.eventId);
   if(!ack)throw Error('accusé de réception officiel incomplet');
   version={revision:ack.revision,resetEpoch:ack.resetEpoch};
   write(null);
   await reload();
   if(isCurrent()){
    // Offer projection publication ONLY AFTER the server ACK. Sending XP and
    // accepting a projection offer are two distinct user decisions.
    try{onRecorded({eventId:event.eventId,appKey,duplicate:ack.duplicate})}
    catch{/* An optional projection prompt must never invalidate official XP. */}
    notify(ack.duplicate?'Partie déjà enregistrée · aucun XP en double':
     'Partie enregistrée : XP du profil scolaire recalculés côté serveur');
   }
   return true;
  }catch(e){
   if(!isCurrent())return false;
   const error=String(e?.message||'Erreur réseau');
   if(error==='stale_reset_epoch'){
    try{
     quarantine(event,'stale_reset_epoch');
     await reload();
     if(isCurrent())notify('Ancienne partie isolée après la remise à zéro : aucun XP transféré au nouveau parcours.');
     return true;
    }catch{
     notify('⚠️ Impossible de terminer la reprise après remise à zéro. Actualiser pour vérifier le profil.');
     return false;
    }
   }
   if(error==='revision_conflict'){
    try{
     const fresh=await reload();
     if(!isCurrent())return false;
     const latest=fresh?.loaded;
     if(latest&&Number.isSafeInteger(latest.revision)&&Number.isSafeInteger(latest.resetEpoch)){
      if(latest.resetEpoch!==event.expectedResetEpoch){
       quarantine(event,'reset_epoch_changed_on_conflict');
       notify('Ancienne partie isolée : parcours modifié entre deux onglets.');
       return true;
      }
      if(latest.revision>event.expectedRevision){
       write({...event,expectedRevision:latest.revision});
       notify('Un autre onglet a enregistré une partie. Révision mise à jour ; réessayer la synchronisation.');
       return false;
      }
     }
    }catch{
     // Keep the exact original event until a verified server reload succeeds.
    }
   }
   if(isCurrent())notify('⚠️ Partie conservée : '+error+'. Actualiser pour retenter.');
   return false;
  }finally{sending=false}
 }
 function onSnapshot(event){
  if(!isCurrent()||!version||!event||pending)return;
  if(event.phase!=='ended'){
   if(ended||!runId)runId=uuid();
   ended=false;return;
  }
  if(ended)return;
  ended=true;
  const id=runId||uuid();
  runId=null;
  const proof=normalizeAtomicTestCompletion({appKey,event});
  if(!proof){notify('Partie terminée : ce mode attend encore son raccordement XP officiel.');return;}
  const record={eventId:id,expectedRevision:version.revision,
   expectedResetEpoch:version.resetEpoch,appKey,classId,...proof};
  try{write(record)}catch{
   notify('Impossible de sauvegarder la preuve locale : aucun XP demandé.');return;
  }
  void retry();
 }
 return Object.freeze({initialize,retry,onSnapshot,hasPending:()=>!!pending});
}
