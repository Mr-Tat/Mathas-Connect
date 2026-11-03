import {MULTI_PROOF_APP,MULTI_PROOF_WIDTH,acceptMultiChallenge,
 normalizeMultiFirstAttempt,createMultiProofQueue} from './certified-multiple.mjs';
import {SCHOOL_CLASS_IDS} from './release-routing.mjs';
const VALID_PROOF_CLASSES=new Set(['4bf3400d-a315-4ea4-a2f3-afaca24dc9b9',...SCHOOL_CLASS_IDS]);


// Uses the SAME existing school host and native game. No additional LAB page.
// PostgreSQL chooses numbers, grades every result digit and multi-addend carry,
// and alone decides the official XP. The client preserves only retry evidence.
export function createMultipleProofUI({
 button,panel,levelSelect,totalSelect,modeSelect,frame,getContext,call,refresh,notify,onRecorded=()=>{}
}){
 let run=null,queue=null,sending=false,suppressedTerminal=false;
 const isCurrent=seq=>seq===getContext().generation&&getContext().activeApp===MULTI_PROOF_APP;
 const inner=()=>{
  const outer=frame.contentDocument;
  const node=outer?.getElementById('game');
  return {win:node?.contentWindow,doc:node?.contentDocument};
 };
 function reset(){run=null;queue=null;sending=false;suppressedTerminal=false;}
 function bind(win,doc){
  const ctx=getContext();
  if(ctx.activeApp!==MULTI_PROOF_APP||!ctx.pupilId||!doc?.getElementById('menuScreen'))return;
  panel.hidden=false;button.disabled=!!run||sending;
  if(!win)return;
  if(run&&win.__mathasServerCertifiedMulti?.sessionId!==run.sessionId)
   win.__mathasServerCertifiedMulti={sessionId:run.sessionId,
    level:run.level,total:run.total,questions:run.questions};
  else if(!run&&win.__mathasServerCertifiedMulti)delete win.__mathasServerCertifiedMulti;
  win.MathasCertifiedMultipleAttempt=raw=>{
   if(!run||!isCurrent(run.generation)||sending||run.finished||run.invalid)return;
   const expected=run.questions[run.answers.length];
   const answer=normalizeMultiFirstAttempt(raw,expected,run.level);
   if(!answer){run.invalid=true;notify('Première réponse invalide : aucun XP demandé.');return}
   run.answers.push(answer);
   if(!queue?.save(run,run.answers)){
    run.invalid=true;notify('Sauvegarde de la preuve impossible : aucun XP demandé.');
   }
  };
 }
 async function finish(){
  if(!run||run.invalid||sending||!isCurrent(run.generation))return;
  if(run.answers.length!==run.total){
   notify('Partie certifiée incomplète : '+run.total+' premières réponses nécessaires. Aucun XP demandé.');
   return;
  }
  sending=true;const current=run;
  try{
   const ack=await call('finish-proof-multi-v1',{sessionId:current.sessionId,answers:current.answers});
   if(!isCurrent(current.generation))return;
   if(ack?.proofVerified!==true||!Number.isSafeInteger(ack.verifiedScore)
    ||ack.verifiedScore<0||ack.verifiedScore>current.total
    ||!Number.isSafeInteger(ack.xp?.delta))throw Error('Réponse mathématique non confirmée par Connect');
   queue?.clear();run=null;suppressedTerminal=true;
   try{onRecorded({eventId:current.sessionId,appKey:MULTI_PROOF_APP,duplicate:ack.duplicate===true})}
   catch{/* A projection opt-in never changes the XP award. */}
   let updated=true;try{await refresh()}catch{updated=false}
   notify('✅ Addition multiple vérifiée : '+ack.verifiedScore+'/'+current.total+
    ' · +'+ack.xp.delta+' XP Connect.'+
    (updated?'':' Actualiser pour relire le profil.'));
  }catch(e){
   if(isCurrent(current.generation))notify('⚠️ Preuve conservée. Actualiser pour réessayer : '+e.message);
  }finally{sending=false}
 }
 function onGameEvent(event){
  if(run){
   if(event?.phase==='ended'&&event.mode==='classic'
    &&event.level===run.level&&event.total===run.total){
    run.finished=true;void finish();
   }
   return true;
  }
  if(suppressedTerminal&&event?.phase==='ended')return true;
  if(event?.phase!=='ended')suppressedTerminal=false;
  return false;
 }
 async function start(){
  if(modeSelect&&modeSelect.value!=='classic')return;
  const ctx=getContext(),seq=ctx.generation;
  if(!VALID_PROOF_CLASSES.has(ctx.classId)
   ||ctx.activeApp!==MULTI_PROOF_APP||!ctx.pupilId)return;
  const {win,doc}=inner();
  if(!win||!doc?.getElementById('menuScreen')
   ||doc.getElementById('menuScreen').classList.contains('hidden')){
   notify('Reviens au menu Addition multiple pour une épreuve certifiée.');return;
  }
  const level=Number(levelSelect.value),total=Number(totalSelect.value);
  if(!Object.hasOwn(MULTI_PROOF_WIDTH,level)||![4,10,20].includes(total)){
   notify('Choisis un niveau et une série valides.');return;
  }
  if(run||sending)return;
  button.disabled=true;
  try{
   const data=await call('start-proof-multi-v1',{level,total});
   if(!isCurrent(seq))return;
   const challenge=acceptMultiChallenge(data);
   if(!challenge||Date.parse(challenge.expiresAt)<=Date.now())throw Error('Épreuve serveur invalide ou expirée');
   queue=createMultiProofQueue({storage:localStorage,studentId:ctx.pupilId,classId:ctx.classId});
   if(!queue)throw Error('Stockage du profil indisponible');
   const previous=queue.read();
   run={...challenge,generation:seq,answers:[],finished:false,invalid:false};
   suppressedTerminal=false;
   if(previous?.sessionId===challenge.sessionId&&previous.level===level
    &&previous.total===total&&previous.answers.length===total){
    run.answers=previous.answers;run.finished=true;
    notify('Synchronisation des '+total+' réponses sauvegardées…');
    void finish();return;
   }
   if(!queue.save(run,[]))throw Error('Sauvegarde locale impossible');
   win.__mathasServerCertifiedMulti={sessionId:run.sessionId,
    level:run.level,total:run.total,questions:run.questions};
   const nativeLevel=doc.getElementById('classicMaxDigits');
   const sharedLevel=doc.getElementById('trainingMaxDigits');
   const selectCount=doc.querySelector('.classic-count-btn[data-count="'+total+'"]');
   const launch=doc.getElementById('startClassic');
   if(!nativeLevel||!sharedLevel||!selectCount||!launch)throw Error('Contrôles natifs introuvables');
   const width=MULTI_PROOF_WIDTH[level];
   sharedLevel.value=String(width);nativeLevel.value=String(width);
   sharedLevel.dispatchEvent(new Event('change',{bubbles:true}));
   selectCount.click();launch.click();
   notify('🔐 '+total+' additions de plusieurs nombres niveau '+level+
    ' émises par Connect. Reports et résultats vérifiés côté serveur.');
  }catch(e){
   if(isCurrent(seq)){run=null;queue=null;notify('⚠️ '+e.message+' : aucun XP demandé.')}
  }finally{if(isCurrent(seq))button.disabled=!!run||sending}
 }
 button.addEventListener('click',()=>{void start()});
 return Object.freeze({reset,bind,onGameEvent,hasPending:()=>!!run?.finished,
  retry:()=>run?.finished?finish():Promise.resolve()});
}
