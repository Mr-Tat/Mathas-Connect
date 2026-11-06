// Épreuve scolaire dans les VRAIES grilles et pavés du moteur Multiplication.
// Le navigateur ne choisit aucun calcul et ne crédite aucun XP : seul le
// serveur émet les exercices et valide les premières tentatives.
import {
 acceptMultiplicationChallenge,acceptMultiplicationExtendedChallenge,
 normalizeMultiplicationAttempt,multiplicationEndState,restoreMultiplicationTranscript,
 multiplicationQueue,expectedMultiplicationWidth
} from './certified-classic.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const COUNTS=[4,10,20];
export function createNativeCertifiedMultiplication({
 documentRef=document,storage=localStorage,getFrame,getContext,call,refresh,onVerified,notify=()=>{}
}={}){
 let run=null,queue=null,starting=false,sending=false,revision=0,contextKey=null;
 const notice=documentRef.createElement('div');
 notice.id='mathasMultiNativeProofStatus';
 notice.style.cssText='position:fixed;z-index:99999;bottom:9px;left:50%;transform:translateX(-50%);max-width:min(570px,calc(100vw - 24px));background:#103451;color:#fff1c2;border:1px solid #d7b967;border-radius:12px;padding:9px 14px;font:650 13px/1.45 system-ui;box-shadow:0 4px 25px #0018;text-align:center;pointer-events:none';
 notice.hidden=true;documentRef.body.append(notice);
 const show=(s,visible=true)=>{notice.textContent=String(s);notice.hidden=!visible;notify(s)};
 const identity=()=>getContext?.();
 const bridge=()=>getFrame?.()?.contentWindow?.MathasNativeCertifiedBridge||null;
 const same=()=>{const ctx=identity();return run&&ctx?.connected===true
  &&contextKey===ctx.classId+'|'+ctx.studentId};
 const stats=()=>run?multiplicationEndState(run.mode,run.answers,run.questions):null;
 // Purely visual status: official scores still require the server receipt.
 const syncSurvivalHud=()=>{
  const win=getFrame?.()?.contentWindow;
  if(!win)return;
  const state=stats();
  win.__mathasCertifiedSurvivalHud=run?.mode==='three-lives'&&state?.valid
   ?{mode:'three-lives',remaining:state.lives}:null;
 };
 const receiver={
  progress:()=>stats(),
  record(answer){
   if(!same()||sending)return false;
   const q=run.questions[run.answers.length];
   if(!q||answer?.id!==q.id)return false;
   const normalized=normalizeMultiplicationAttempt(q,answer);
   if(!normalized)return false;
   const answers=[...run.answers,normalized],state=multiplicationEndState(run.mode,answers,run.questions);
   if(!state.valid||!queue?.save(run,answers)){
    show('⚠️ Impossible de sauvegarder la tentative. Aucun résultat envoyé.');
    return false;
   }
   run.answers=answers;
   syncSurvivalHud();
   notice.hidden=true;
   if(state.complete){
    bridge()?.completed();
    queueMicrotask(()=>{void finish()});
   }
   return true;
  },
  suspended(){
   if(sending)return;
   if(run&&!stats()?.complete)queue?.clear();
   run=null;queue=null;contextKey=null;
   syncSurvivalHud();
   show('Exercice quitté : réponses incomplètes abandonnées. Les acquis restent sauvegardés.',true);
  },
  problem:message=>show(message,true)
 };
 async function finish(){
  if(!same()||sending||!stats()?.complete)return false;
  sending=true;
  const ticket=run,saved=queue;
  show('Vérification officielle des calculs et reports…');
  try{
   const ack=await call(ticket.mode==='classic'?'finish-classic-v1':'finish-extended-v1',
    {sessionId:ticket.sessionId,answers:ticket.answers});
   if(!same()||ticket!==run)return false;
   const calculated=multiplicationEndState(ticket.mode,ticket.answers,ticket.questions).correct;
   if(ack?.proofVerified!==true||ack.verifiedScore!==calculated
     ||!Number.isSafeInteger(ack.xp?.delta))
    throw Error('Le reçu de preuve ne correspond pas aux premiers essais.');
   saved?.clear();
   run=null;queue=null;contextKey=null;
   syncSurvivalHud();
   bridge()?.abandonView();
   show('✅ Série certifiée · '+calculated+' réussite(s) · +'+(ack.duplicate?0:ack.xp.delta)+' XP officiels.');
   try{await refresh?.()}catch{show('✅ Série certifiée, mais actualisation des scores indisponible.')}
   try{onVerified?.({eventId:ticket.sessionId,ack})}catch{/* Consentement indépendant */}
   return true;
  }catch(e){
   show('⚠️ Preuve sauvegardée, en attente de synchronisation. Reprends le même défi pour réessayer. '+(e?.message||''));
   return false;
  }finally{sending=false}
 }
 async function start({mode='classic',level,total,multipliers,method='top',tensFirst=false}={}){
  const ctx=identity();
  if(starting||sending||!ctx?.connected||!UUID.test(ctx.classId)||!UUID.test(ctx.studentId)
   ||!['classic','sudden','three-lives','hard-sudden','hard-three-lives'].includes(mode)
   ||![1,2,3].includes(level)||mode==='classic'&&!COUNTS.includes(total)
   ||mode!=='classic'&&!expectedMultiplicationWidth(mode,level)
   ||!['top','side'].includes(method)||!Array.isArray(multipliers)
   ||multipliers.length<1||multipliers.length>8
   ||multipliers.some(n=>!Number.isSafeInteger(n)||n<2||n>9))return false;
  if(run)return false;
  const native=bridge();
  if(!native){show('Moteur natif indisponible. Actualise la page.');return false}
  const uid=ctx.classId+'|'+ctx.studentId;
  const selected=[...new Set(multipliers)].sort((a,b)=>a-b);
  queue=multiplicationQueue(storage,ctx.studentId,ctx.classId,mode,level);
  if(!queue){show('Identité scolaire indisponible.');return false}
  const previous=queue.read(),restored=restoreMultiplicationTranscript(previous,mode);
  if(previous&&!restored){
   // Une ancienne épreuve expirée/corrompue ne doit jamais bloquer un nouveau départ.
   queue.clear();
  }
  contextKey=uid;starting=true;
  try{
   if(restored){
    run={...restored};
   }else{
    show('Préparation des calculs certifiés par Connect…');
    const data=await call(mode==='classic'?'start-classic-v1':'start-extended-v1',
     mode==='classic'?{level,total,multipliers:selected}:{level,mode,multipliers:selected});
    if(identity()?.classId+'|'+identity()?.studentId!==uid)throw Error('Profil élève remplacé');
    const accepted=mode==='classic'
     ?acceptMultiplicationChallenge(data,level,total,selected)
     :acceptMultiplicationExtendedChallenge(data,level,mode,selected);
    if(!accepted)throw Error('Défi mathématique émis par le serveur invalide.');
    run={...accepted,mode,multipliers:selected,method,tensFirst,answers:[]};
    if(!queue.save(run,[]))throw Error('La preuve ne peut pas être sauvegardée.');
   }
   if(stats()?.complete){
    // Reprise d'un résultat complet ayant échoué à la synchronisation.
    starting=false;return await finish();
   }
   if(!native.launch(run,receiver))throw Error('Le moteur natif n’a pas pu afficher le défi.');
   syncSurvivalHud();
   notice.hidden=true;
   if(run.answers.length)show('Défi conservé : '+run.answers.length+
      ' premier(s) essai(s) retrouvés · même série serveur.',true);
   return true;
  }catch(e){
   show('⚠️ Partie scolaire indisponible : '+(e?.message||'Erreur inconnue'));
   run=null;queue=null;contextKey=null;
   syncSurvivalHud();
   return false;
  }finally{starting=false}
 }
 function reset(){
  revision++;
  if(run&&!stats()?.complete)queue?.clear();
  bridge()?.abandonView();
  run=null;queue=null;contextKey=null;sending=false;starting=false;notice.hidden=true;
  syncSurvivalHud();
 }
 return Object.freeze({start,reset,isOpen:()=>!!run,destroy(){reset();notice.remove()}});
}
