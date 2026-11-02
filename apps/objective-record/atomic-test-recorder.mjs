import {ATOMIC_TEST_APP,normalizeAtomicTestCompletion,acceptNativeRecordAck} from './native-official-record.mjs';
// TEST-class bridge to the existing atomic Connect Addition-multiple RPC.
// Only classic/sudden. Native-browser score is not an independently verified
// arithmetic transcript, so this gate must never be opened in real classrooms.
export function createAtomicTestRecorder({classId,appKey,subject,storage,send,reload,notify,isCurrent}){
 const TEST='4bf3400d-a315-4ea4-a2f3-afaca24dc9b9';
 if(classId!==TEST||appKey!==ATOMIC_TEST_APP||!subject
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
   if(isCurrent())notify(ack.duplicate?'Partie déjà enregistrée · aucun XP en double':
    'Partie enregistrée : XP du profil scolaire recalculés côté serveur');
   return true;
  }catch(e){
   if(isCurrent())notify('⚠️ Partie conservée : '+(e?.message||'Erreur réseau')+'. Actualiser pour retenter.');
   return false;
  }finally{sending=false}
 }
 function onSnapshot(event){
  if(!isCurrent()||!version||!event||pending)return;
  const terminal=(event.mode==='classic'&&event.phase==='finished')||(event.mode==='sudden'&&event.phase==='ended');
  if(!terminal){
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
