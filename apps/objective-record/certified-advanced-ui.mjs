import {
 ADVANCED_MODES,MAX_ADVANCED_QUESTIONS,acceptAdvancedChallenge,advancedWidth,
 normalizeAdvancedAttempt,advancedStopReason,createAdvancedProofQueue
} from './certified-advanced.mjs';
import {SCHOOL_CLASS_IDS} from './release-routing.mjs';

// Advanced game modes MUST start with authenticated, server-issued operands.
// Only these five actual school classes participate; TEST continues classic.
const CLASS_SET=new Set(SCHOOL_CLASS_IDS);
const APP_SET=new Set(['addition-ecrite-simple','addition-ecrite-multiple']);
export function createAdvancedProofUI({frame,getContext,call,refresh,notify,onRecorded=()=>{}}){
 let run=null,queue=null,sending=false,launching=false,approvedClick=null;
 let trackedDocument=null,captureListener=null;
 const current=seq=>seq===getContext().generation&&getContext().activeApp===run?.appKey;
 function reset(){
  if(trackedDocument&&captureListener)trackedDocument.removeEventListener('click',captureListener,true);
  trackedDocument=null;captureListener=null;
  run=null;queue=null;sending=false;launching=false;approvedClick=null;
 }
 const nested=()=>{
  const outer=frame.contentDocument,inside=outer?.getElementById('game');
  return {doc:inside?.contentDocument,win:inside?.contentWindow};
 };
 function configFor(button){
  const ctx=getContext();
  if(!CLASS_SET.has(ctx.classId)||!APP_SET.has(ctx.activeApp)||!ctx.pupilId)return null;
  const raw=button.dataset?.mode,hard=!!button.closest('#hardMenuScreen,#hardMenu')||
    button.classList.contains('hard-start');
  const mode=hard?'hard-'+raw:button.id==='startSudden'?'sudden':button.id==='startThreeLives'?'three-lives':null;
  if(!ADVANCED_MODES.includes(mode))return null;
  const {doc}=nested();
  const selector=doc?.getElementById('suddenMaxDigits');
  const value=Number(selector?.value);
  const level=hard?Number(button.dataset.level):
   ctx.activeApp==='addition-ecrite-simple'?({3:1,5:2,7:3})[value]:
   ({5:1,6:2,7:3})[value];
  return [1,2,3].includes(level)?{mode,level,ctx}:null;
 }
 async function finish(){
  if(!run||!run.finished||run.invalid||sending||!current(run.generation))return;
  sending=true;
  const now=run;
  try{
   const ack=await call('finish-advanced-v1',{sessionId:now.sessionId,answers:now.answers});
   if(!current(now.generation))return;
   if(ack?.proofVerified!==true||!Number.isSafeInteger(ack.verifiedScore)
    ||!Number.isSafeInteger(ack.verifiedErrors)||!Number.isSafeInteger(ack.xp?.delta)
    ||ack.verifiedScore+ack.verifiedErrors!==now.answers.length
    ||ack.questionsChecked!==now.answers.length||ack.mode!==now.mode)
    throw Error('Preuve arithmétique non validée par Connect');
   queue?.clear();run=null;
   try{onRecorded({eventId:now.sessionId,appKey:now.appKey,duplicate:ack.duplicate===true})}
   catch{/* Sharing is a separate consent event. */}
   let updated=true;try{await refresh()}catch{updated=false}
   notify('✅ '+now.mode.replaceAll('-',' ')+' · '+ack.verifiedScore+' calculs corrects'+
    ' · +'+ack.xp.delta+' XP Connect vérifiés.'+
    (updated?'':' Réactualise les données lorsque la connexion revient.'));
  }catch(e){
   if(current(now.generation))notify('⚠️ Preuve conservée pour un nouvel envoi : '+e.message);
  }finally{sending=false}
 }
 async function start(button,config){
  if(launching||sending||run){notify('Termine d’abord ta partie certifiée en cours.');return;}
  launching=true;
  const {ctx,mode,level}=config,seq=ctx.generation;
  try{
   const data=await call('start-advanced-v1',{level,mode});
   if(seq!==getContext().generation||ctx.activeApp!==getContext().activeApp)return;
   const challenge=acceptAdvancedChallenge(data,ctx.activeApp,mode,level);
   if(!challenge||Date.parse(challenge.expiresAt)<=Date.now())throw Error('Défi scolaire expiré ou invalide');
   queue=createAdvancedProofQueue({storage:localStorage,studentId:ctx.pupilId,classId:ctx.classId,appKey:ctx.activeApp});
   if(!queue)throw Error('Sauvegarde du profil indisponible');
   run={...challenge,generation:seq,answers:[],finished:false,invalid:false};
   if(!queue.save(run))throw Error('Impossible de préserver cette épreuve');
   const {win}=nested();
   if(!win)throw Error('Moteur natif indisponible');
   win.__mathasServerAdvanced={sessionId:run.sessionId,mode,level,
    width:advancedWidth(run.appKey,mode,level),questions:run.questions,index:0,finished:false};
   approvedClick=button;
   button.click();
   approvedClick=null;
   notify('🔐 '+mode.replaceAll('-',' ')+' niveau '+level+
    ' : opérations émises par Connect, retenues et règles d’arrêt vérifiées côté serveur.');
  }catch(e){
   if(seq===getContext().generation){
    run=null;queue=null;notify('⚠️ '+e.message+'. Aucun XP attribué.');
   }
  }finally{approvedClick=null;launching=false}
 }
 function bind(win,doc){
  if(!doc?.getElementById('menuScreen')||!win)return;
  if(trackedDocument===doc)return;
  if(trackedDocument&&captureListener)trackedDocument.removeEventListener('click',captureListener,true);
  trackedDocument=doc;
  win.MathasAdvancedAttempt=(raw)=>{
   if(!run||!current(run.generation)||run.finished||sending||run.invalid)return;
   const q=run.questions[run.answers.length];
   const attempt=normalizeAdvancedAttempt(raw,q,run.appKey,run.mode,run.level);
   if(!attempt){run.invalid=true;notify('Première réponse invalide : aucun XP demandé.');return;}
   run.answers.push(attempt);
   const why=advancedStopReason({
    mode:run.mode,answers:run.answers,questions:run.questions,appKey:run.appKey,level:run.level
   });
   if(why){
    run.finished=true;
    if(win.__mathasServerAdvanced)win.__mathasServerAdvanced.finished=true;
   }
   if(!queue?.save(run)){run.invalid=true;notify('Preuve locale impossible à sauvegarder. Aucun XP demandé.');return;}
   if(run.finished)void finish();
  };
  captureListener=event=>{
   if(approvedClick&&event.target===approvedClick)return;
   const button=event.target?.closest?.('#startThreeLives,#startSudden,.hard-start[data-mode="sudden"],.hard-start[data-mode="three-lives"]');
   if(!button)return;
   const config=configFor(button);
   if(!config)return;
   event.preventDefault();event.stopImmediatePropagation();
   void start(button,config);
  };
  doc.addEventListener('click',captureListener,true);
 }
 function onGameEvent(event){
  if(!run)return false;
  if(!current(run.generation))return true;
  if(event?.phase==='ended'){
   if(run.finished&&!run.invalid)void finish();
   else{
    run.invalid=true;
    notify('Partie terminée sans preuve complète : aucun XP attribué.');
   }
  }
  return true;
 }
 return Object.freeze({
  reset,bind,onGameEvent,
  hasPending:()=>!!run?.finished&&!!run?.answers.length,
  retry:()=>run?.finished?finish():Promise.resolve()
 });
}
