import {MULTIPLICATION_PROOF_APP,acceptMultiplicationChallenge,
 normalizeMultiplicationAttempt,validMultipliers,createMultiplicationQueue}
 from './certified-multiplication.mjs';

const TEST_CLASS='4bf3400d-a315-4ea4-a2f3-afaca24dc9b9';
// Certification native du mode Classique. Pas de bascule automatique sur un
// score local en cas d'erreur réseau ou de profil scolaire non autorisé.
export function createMultiplicationProofUI({
 button,panel,levelSelect,totalSelect,modeSelect,frame,
 getContext,call,refresh,notify,onRecorded=()=>{}
}){
 let run=null,queue=null,sending=false,suppressedTerminal=false;
 const current=seq=>seq===getContext().generation
  &&getContext().activeApp===MULTIPLICATION_PROOF_APP;
 const inner=()=>{
  const outer=frame.contentDocument;
  const game=outer?.getElementById('game');
  return {win:game?.contentWindow,doc:game?.contentDocument};
 };
 function reset(){
  const {win}=inner();
  if(win){delete win.__mathasServerCertifiedMul;delete win.MathasCertifiedMulAttempt;
   delete win.MathasCertifiedMulFinished;}
  run=null;queue=null;sending=false;suppressedTerminal=false;
  panel.hidden=true;button.disabled=true;
 }
 function selectedMultipliers(doc){
  const nodes=[...doc.querySelectorAll('#multiplierPicker [data-mult].active')];
  const values=nodes.map(node=>Number(node.dataset.mult))
   .filter(n=>Number.isInteger(n)&&n>=2&&n<=9).sort((a,b)=>a-b);
  return validMultipliers(values)?values:null;
 }
 function bind(win,doc){
  const ctx=getContext();
  if(ctx.activeApp!==MULTIPLICATION_PROOF_APP
   ||ctx.classId!==TEST_CLASS||!ctx.pupilId||!doc?.getElementById('menuScreen'))return;
  panel.hidden=false;
  if(!button.dataset.extendedBusy)button.disabled=!!run||sending;
  if(!win)return;
  if(run&&win.__mathasServerCertifiedMul?.sessionId!==run.sessionId){
   win.__mathasServerCertifiedMul={sessionId:run.sessionId,
    level:run.level,total:run.total,questions:run.questions,index:0};
  }else if(!run&&win.__mathasServerCertifiedMul)delete win.__mathasServerCertifiedMul;
  win.MathasCertifiedMulAttempt=raw=>{
   if(!run||!current(run.generation)||sending||run.finished||run.invalid)return;
   const expected=run.questions[run.answers.length];
   const attempt=normalizeMultiplicationAttempt(raw,expected);
   if(!attempt){run.invalid=true;notify('Preuve interrompue : première réponse invalide, aucun XP demandé.');return;}
   run.answers.push(attempt);
   if(!queue?.save(run,run.answers)){
    run.invalid=true;notify('Sauvegarde des réponses impossible : aucun XP demandé.');
   }
  };
  win.MathasCertifiedMulFinished=()=>{
   if(run&&!run.finished){run.finished=true;void finish();}
  };
 }
 async function finish(){
  if(!run||run.invalid||sending||!current(run.generation))return;
  if(run.answers.length!==run.total){
   run.invalid=true;
   notify('Preuve incomplète : '+run.answers.length+'/'+run.total+' premières réponses. Aucun XP demandé.');
   return;
  }
  const completed=run;
  sending=true;
  try{
   const ack=await call('finish-classic-v1',{
    sessionId:completed.sessionId,answers:completed.answers
   });
   if(!current(completed.generation))return;
   if(ack?.proofVerified!==true||!Number.isSafeInteger(ack.verifiedScore)
    ||ack.verifiedScore<0||ack.verifiedScore>completed.total
    ||!Number.isSafeInteger(ack.xp?.delta))throw Error('Réponse non certifiée par Connect');
   queue?.clear();run=null;queue=null;suppressedTerminal=true;
   const {win}=inner();if(win)delete win.__mathasServerCertifiedMul;
   try{onRecorded({appKey:MULTIPLICATION_PROOF_APP,
    eventId:completed.sessionId,duplicate:ack.duplicate===true});}catch{}
   let updated=true;try{await refresh()}catch{updated=false}
   notify('✅ Multiplication vérifiée : '+ack.verifiedScore+'/'+completed.total+
    ' · +'+ack.xp.delta+' XP officiels.'+
    (updated?'':' Actualise le profil pour mettre à jour les compteurs.'));
  }catch(e){
   if(current(completed.generation))notify('⚠️ Preuve conservée, actualiser pour réessayer : '+e.message);
  }finally{sending=false}
 }
 function onGameEvent(event){
  if(run){
   if(event?.mode==='classic'&&event.level===run.level
    &&event.total===run.total&&['finished','ended'].includes(event.phase)
    &&!run.finished){run.finished=true;void finish();}
   return true;
  }
  if(suppressedTerminal&&['finished','ended'].includes(event?.phase))return true;
  if(!['finished','ended'].includes(event?.phase))suppressedTerminal=false;
  return false;
 }
 async function start(){
  const ctx=getContext(),seq=ctx.generation;
  if(ctx.activeApp!==MULTIPLICATION_PROOF_APP
   ||ctx.classId!==TEST_CLASS||!ctx.pupilId||run||sending
   ||modeSelect.value!=='classic')return;
  const {win,doc}=inner();
  if(!win||!doc?.getElementById('menuScreen')
   ||doc.getElementById('menuScreen').classList.contains('hidden')){
   notify('Reviens au menu Multiplication avant de lancer une série certifiée.');return;
  }
  const level=Number(levelSelect.value),total=Number(totalSelect.value);
  if(![1,2,3].includes(level)||![4,10,20].includes(total)){
   notify('Niveau ou série non autorisés.');return;
  }
  const multipliers=selectedMultipliers(doc);
  if(!multipliers){
   notify('Sélectionne au moins une table de 2 à 9.');return;
  }
  button.disabled=true;
  try{
   const data=await call('start-classic-v1',{level,total,multipliers});
   if(!current(seq))return;
   const parsed=acceptMultiplicationChallenge(data);
   if(!parsed||Date.parse(parsed.expiresAt)<=Date.now()
    ||parsed.questions.some(q=>!multipliers.includes(q.m)))
    throw Error('Questions certifiées invalides ou tables non autorisées');
   queue=createMultiplicationQueue({storage:localStorage,
    studentId:ctx.pupilId,classId:ctx.classId});
   if(!queue)throw Error('Sauvegarde des réponses indisponible');
   const previous=queue.read();
   run={...parsed,generation:seq,answers:[],finished:false,invalid:false};
   suppressedTerminal=false;
   if(previous?.sessionId===parsed.sessionId&&previous.level===level
    &&previous.total===total&&previous.answers.length===total
    &&previous.answers.every((a,i)=>normalizeMultiplicationAttempt(a,parsed.questions[i]))){
    run.answers=previous.answers;run.finished=true;void finish();return;
   }
   if(!queue.save(run,[]))throw Error('Sauvegarde du brouillon indisponible');
   const nativeLevel=doc.getElementById('trainingLevel');
   const launch=doc.querySelector('.classic-count-btn[data-count="'+total+'"]');
   if(!nativeLevel||!launch)throw Error('Boutons du jeu natif indisponibles');
   nativeLevel.value=String(level);
   nativeLevel.dispatchEvent(new Event('change',{bubbles:true}));
   if(Number(doc.getElementById('classicLevel')?.value)!==level)
    throw Error('Niveau natif non synchronisé');
   win.__mathasServerCertifiedMul={sessionId:run.sessionId,
    level,total,questions:run.questions,index:0};
   launch.click();
   notify('🔐 '+total+' multiplications niveau '+level+
    ' émises par Connect, chiffres et reports vérifiés côté serveur.');
  }catch(e){
   if(current(seq)){
    run=null;queue=null;
    const {win}=inner();if(win)delete win.__mathasServerCertifiedMul;
    notify('⚠️ '+e.message+' · aucun XP demandé.');
   }
  }finally{if(current(seq))button.disabled=!!run||sending}
 }
 function startNative(level,total){
  if(![1,2,3].includes(level)||![4,10,20].includes(total))return Promise.resolve();
  modeSelect.value='classic';levelSelect.value=String(level);
  totalSelect.value=String(total);return start();
 }
 button.addEventListener('click',()=>{if(getContext().activeApp===MULTIPLICATION_PROOF_APP)void start();});
 return Object.freeze({reset,bind,startNative,onGameEvent,
  hasPending:()=>!!run?.finished,retry:()=>run?.finished?finish():Promise.resolve()});
}
