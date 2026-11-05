import {PROOF_APP,acceptAdditionProofChallenge,normalizeAdditionFirstAttempt,
 createCertifiedAdditionQueue} from './certified-addition.mjs';
import {SCHOOL_CLASS_IDS} from './release-routing.mjs';
import {schoolModeAllowed,schoolModeLockReason} from './school-official-unlocks.mjs';
const VALID_PROOF_CLASSES=new Set(['4bf3400d-a315-4ea4-a2f3-afaca24dc9b9',...SCHOOL_CLASS_IDS]);


// Server-issued Addition simple, CLASSIC 4/10/20 across 3 levels; TEST-only until school release.
// The database issues operands and verifies digits and carries. The browser
// cannot choose the grade, milestone or credited XP.
export function createAdditionProofUI({button,panel,levelSelect,totalSelect,modeSelect,frame,getContext,call,refresh,notify,onRecorded=()=>{}}){
 let run=null,queue=null,sending=false,suppressedTerminal=false;
 const isCurrent=seq=>seq===getContext().generation&&getContext().activeApp===PROOF_APP;
 const inner=()=>{
  const outer=frame.contentDocument;
  const node=outer?.getElementById('game');
  return {win:node?.contentWindow,doc:node?.contentDocument};
 };
 function reset(){
  run=null;queue=null;sending=false;suppressedTerminal=false;
  panel.hidden=true;button.disabled=true;
 }
 function bind(win,doc){
  const ctx=getContext();
  if(ctx.activeApp!==PROOF_APP||!ctx.pupilId||!doc?.getElementById('menuScreen'))return;
  panel.hidden=false;
  if(!button.dataset.extendedBusy)button.disabled=!!run||sending;
  if(!win)return;
  // Un retour au menu avant la fin de la partie abandonne uniquement cette
  // tentative locale. Les réponses incomplètes ne doivent jamais être créditées.
  // Le prochain clic relance une nouvelle épreuve certifiée par le serveur.
  if(!doc.__mathasCertifiedExitListener){
   doc.__mathasCertifiedExitListener=true;
   doc.addEventListener('click',event=>{
    if(!event.target?.closest?.('#menuBtn'))return;
    if(!run||run.finished||sending)return;
    queue?.clear();
    run=null;queue=null;suppressedTerminal=false;
    delete win.__mathasServerCertified;
    if(!button.dataset.extendedBusy)button.disabled=false;
    notify('Partie interrompue. Tu peux lancer une nouvelle série.');
   });
  }
  if(run && win.__mathasServerCertified?.sessionId!==run.sessionId){
   win.__mathasServerCertified={sessionId:run.sessionId,level:run.level,total:run.total,questions:run.questions,index:0};
  }else if(!run&&win.__mathasServerCertified){
   delete win.__mathasServerCertified;
  }
  win.MathasCertifiedAttempt=raw=>{
   const ctx=getContext();
   if(!run||!isCurrent(run.generation)||sending||run.finished||run.invalid)return;
   const q=run.questions[run.answers.length];
   const attempt=normalizeAdditionFirstAttempt(raw,q);
   if(!attempt){run.invalid=true;notify('Première réponse invalide : aucun XP demandé.');return;}
   run.answers.push(attempt);
   if(!queue?.save(run,run.answers)){
    run.invalid=true;notify('Sauvegarde des réponses impossible : aucun XP demandé.');
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
   const ack=await call('finish-proof-v2',{sessionId:current.sessionId,answers:current.answers});
   if(!isCurrent(current.generation))return;
   if(ack?.proofVerified!==true||!Number.isSafeInteger(ack.verifiedScore)
     ||!Number.isSafeInteger(ack.xp?.delta)||ack.verifiedScore<0||ack.verifiedScore>current.total)
     throw Error('Réponse mathématique non confirmée par le serveur');
   queue?.clear();run=null;suppressedTerminal=true;
   // This session ID is the same eventId as the official score receipt.
   // A consent offer follows server verification and never affects the award.
   try{onRecorded({eventId:current.sessionId,appKey:PROOF_APP,duplicate:ack.duplicate===true})}
   catch{/* Projection is optional, and cannot roll back an awarded result. */}
   let profileUpdated=true;
   try{await refresh()}catch{profileUpdated=false}
   notify('✅ Vérifié côté serveur : '+ack.verifiedScore+'/'+current.total+
    ' · +'+ack.xp.delta+' XP Connect.'+
    (profileUpdated?'':' Profil à actualiser lorsque la connexion revient.'));
  }catch(e){
   if(isCurrent(current.generation))notify('⚠️ Preuve conservée. Actualiser pour retenter : '+e.message);
  }finally{sending=false}
 }
 function onGameEvent(event){
  if(run){
   if(event?.phase==='ended'&&event.mode==='classic'&&event.level===run.level&&event.total===run.total){
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
    ||ctx.activeApp!==PROOF_APP||!ctx.pupilId)return;
  const {win,doc}=inner();
  if(!win||!doc?.getElementById('menuScreen')||
   doc.getElementById('menuScreen').classList.contains('hidden')){
   notify('Reviens au menu Addition simple pour une épreuve certifiée.');return;
  }
  const level=Number(levelSelect?.value),total=Number(totalSelect?.value);
  if(ctx.classId!=='4bf3400d-a315-4ea4-a2f3-afaca24dc9b9'
    &&!schoolModeAllowed(ctx.officialProgress,'classic',level)){
   notify('🔒 '+schoolModeLockReason('classic',level));return;
  }
  if(![1,2,3].includes(level)||![4,10,20].includes(total)){
   notify('Choisis un niveau et une série de calculs valides.');return;
  }
  if(run||sending)return;
  button.disabled=true;
  try{
   const data=await call('start-proof-v2',{level,total});
   if(!isCurrent(seq))return;
   const challenge=acceptAdditionProofChallenge(data);
   if(!challenge||Date.parse(challenge.expiresAt)<=Date.now())
    throw Error('Épreuve serveur non valide ou expirée');
   queue=createCertifiedAdditionQueue({storage:localStorage,
    studentId:ctx.pupilId,classId:ctx.classId});
   if(!queue)throw Error('Profil de sauvegarde indisponible');
   const previous=queue.read();
   run={...challenge,generation:seq,answers:[],finished:false,invalid:false};
   suppressedTerminal=false;
   if(previous?.sessionId===challenge.sessionId&&previous.level===level&&previous.total===total&&previous.answers.length===total){
    run.answers=previous.answers;run.finished=true;
    notify('Synchronisation des '+total+' réponses conservées…');
    void finish();return;
   }
   if(!queue.save(run,[]))throw Error('Stockage sécurisé de reprise impossible');
   win.__mathasServerCertified={sessionId:run.sessionId,
    level:run.level,total:run.total,questions:run.questions,index:0};
   const nativeLevel=doc.getElementById('classicMaxDigits');
   const sharedLevel=doc.getElementById('trainingMaxDigits');
   const launch=doc.querySelector('.classic-count-btn[data-count="'+total+'"]');
   if(!nativeLevel||!sharedLevel||!launch)throw Error('Contrôles pédagogiques natifs introuvables');
   // The 4/10/20 native buttons ONLY select a count. The native
   // #startClassic button actually starts the game. Never stop at selection.
   const width=({1:3,2:5,3:7})[level];
   sharedLevel.value=String(width);nativeLevel.value=String(width);
   sharedLevel.dispatchEvent(new Event('change',{bubbles:true}));
   // This engine's native count-button event is the direct-start control.
   launch.click();
   notify('🔐 '+total+' additions niveau '+level+' émises par Connect. Chiffres et reports vérifiés côté serveur.');
  }catch(e){
   if(isCurrent(seq)){run=null;queue=null;notify('⚠️ '+e.message+' : aucun XP demandé.');}
  }finally{if(isCurrent(seq))button.disabled=!!run||sending}
 }
 function startNative(level,total){
  if(![1,2,3].includes(level)||![4,10,20].includes(total))return Promise.resolve();
  modeSelect.value='classic';levelSelect.value=String(level);totalSelect.value=String(total);
  return start();
 }
 button.addEventListener('click',()=>{void start()});
 return Object.freeze({reset,bind,onGameEvent,startNative,
  hasPending:()=>!!run?.finished,retry:()=>run?.finished?finish():Promise.resolve()});
}
