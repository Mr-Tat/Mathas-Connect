import {PROOF_APP,acceptAdditionProofChallenge,normalizeAdditionFirstAttempt,
 createCertifiedAdditionQueue} from './certified-addition.mjs';

// First vertical slice only: native Addition simple, class TEST, classic 4/L1.
// The database issues operands and verifies digits and carries. The browser
// cannot choose the grade, milestone or credited XP.
export function createAdditionProofUI({button,panel,frame,getContext,call,refresh,notify}){
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
  panel.hidden=false;button.disabled=false;
  if(!win)return;
  if(run && win.__mathasServerCertified?.sessionId!==run.sessionId){
   win.__mathasServerCertified={sessionId:run.sessionId,questions:run.questions,index:0};
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
  if(run.answers.length!==4){
   notify('Partie certifiée incomplète : quatre premières réponses nécessaires. Aucun XP demandé.');
   return;
  }
  sending=true;const current=run;
  try{
   const ack=await call('finish-proof',{sessionId:current.sessionId,answers:current.answers});
   if(!isCurrent(current.generation))return;
   if(ack?.proofVerified!==true||!Number.isSafeInteger(ack.verifiedScore)
     ||!Number.isSafeInteger(ack.xp?.delta)||ack.verifiedScore<0||ack.verifiedScore>4)
     throw Error('Réponse mathématique non confirmée par le serveur');
   queue?.clear();run=null;suppressedTerminal=true;
   await refresh();
   notify('✅ Vérifié côté serveur : '+ack.verifiedScore+'/4 · +'+ack.xp.delta+' XP Connect.');
  }catch(e){
   if(isCurrent(current.generation))notify('⚠️ Preuve conservée. Actualiser pour retenter : '+e.message);
  }finally{sending=false}
 }
 function onGameEvent(event){
  if(run){
   if(event?.phase==='ended'&&event.mode==='classic'){
    run.finished=true;void finish();
   }
   return true;
  }
  if(suppressedTerminal&&event?.phase==='ended')return true;
  if(event?.phase!=='ended')suppressedTerminal=false;
  return false;
 }
 async function start(){
  const ctx=getContext(),seq=ctx.generation;
  if(ctx.classId!=='4bf3400d-a315-4ea4-a2f3-afaca24dc9b9'
    ||ctx.activeApp!==PROOF_APP||!ctx.pupilId)return;
  const {win,doc}=inner();
  if(!win||!doc?.getElementById('menuScreen')||
   doc.getElementById('menuScreen').classList.contains('hidden')){
   notify('Reviens au menu Addition simple pour une épreuve certifiée.');return;
  }
  button.disabled=true;
  try{
   const data=await call('start-proof',{});
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
   if(previous?.sessionId===challenge.sessionId&&previous.answers.length===4){
    run.answers=previous.answers;run.finished=true;
    notify('Synchronisation des quatre réponses conservées…');
    void finish();return;
   }
   if(!queue.save(run,[]))throw Error('Stockage sécurisé de reprise impossible');
   win.__mathasServerCertified={sessionId:run.sessionId,
    questions:run.questions,index:0};
   const level=doc.getElementById('classicMaxDigits');
   const four=doc.querySelector('.classic-count-btn[data-count="4"]');
   const classic=doc.getElementById('startClassic');
   if(!level||!four||!classic)throw Error('Contrôles pédagogiques natifs introuvables');
   level.value='3';level.dispatchEvent(new Event('change',{bubbles:true}));
   four.click();classic.click();
   notify('🔐 4 additions émises par Connect. Les chiffres et reports seront vérifiés côté serveur.');
  }catch(e){
   if(isCurrent(seq)){run=null;queue=null;notify('⚠️ '+e.message+' : aucun XP demandé.');}
  }finally{if(isCurrent(seq))button.disabled=false}
 }
 button.addEventListener('click',()=>{void start()});
 return Object.freeze({reset,bind,onGameEvent,hasPending:()=>!!run?.finished,retry:()=>run?.finished?finish():Promise.resolve()});
}
