// Soustraction scolaire : épreuves émises et corrigées par le serveur.
// Le moteur libre V6.0.2 et ses deux techniques restent inchangés.
export const SUBTRACTION_APP='soustraction-ecrite-simple';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const COUNTS=[4,10,20];
const WIDTHS=Object.freeze({normal:[3,5,7],hard:[10,12,16]});
export const SUBTRACTION_EXTENDED_MODES=Object.freeze(['three-lives','sudden','hard-three-lives','hard-sudden']);
const digits=value=>typeof value==='string'&&/^[0-9]{1,16}$/.test(value);
const positive=value=>typeof value==='string'&&/^[1-9][0-9]{0,15}$/.test(value);
export const expectedSubtractionWidth=(mode,level)=>
 [1,2,3].includes(level)?WIDTHS[mode.startsWith('hard-')?'hard':'normal'][level-1]:null;
function goodQuestion(q,i,expectedWidth,method){
 if(!q||q.id!=='q'+(i+1)||q.op!=='sub'||q.method!==method
  ||!positive(q.a)||!positive(q.b)||!Number.isInteger(q.width)
  ||q.width!==q.a.length||q.width<expectedWidth-1||q.width>expectedWidth
  ||BigInt(q.b)>BigInt(q.a))return false;
 return true;
}
export function acceptSubtractionChallenge(data,level,total,method='addBottom'){
 if(![1,2,3].includes(level)||!COUNTS.includes(total)||!['addBottom','takeTop'].includes(method)
  ||data?.ok!==true||!UUID.test(data.sessionId)
  ||data.level!==level||data.total!==total||data.method!==method
  ||!Number.isSafeInteger(data.revision)||data.revision<0
  ||!Number.isSafeInteger(data.resetEpoch)||data.resetEpoch<0
  ||!Array.isArray(data.questions)||data.questions.length!==total
  ||!Number.isFinite(Date.parse(data.expiresAt))||Date.parse(data.expiresAt)<=Date.now())return null;
 return data.questions.every((q,i)=>goodQuestion(q,i,WIDTHS.normal[level-1],method))?data:null;
}
export function acceptSubtractionExtended(data,level,mode,method='addBottom'){
 if(!SUBTRACTION_EXTENDED_MODES.includes(mode)||![1,2,3].includes(level)
  ||!['addBottom','takeTop'].includes(method)||data?.ok!==true
  ||!UUID.test(data.sessionId)||data.level!==level||data.mode!==mode
  ||data.method!==method||data.limit!==120
  ||!Number.isSafeInteger(data.revision)||data.revision<0
  ||!Number.isSafeInteger(data.resetEpoch)||data.resetEpoch<0
  ||!Array.isArray(data.questions)||data.questions.length!==120
  ||!Number.isFinite(Date.parse(data.expiresAt))||Date.parse(data.expiresAt)<=Date.now())return null;
 return data.questions.every((q,i)=>goodQuestion(q,i,expectedSubtractionWidth(mode,level),method))?data:null;
}
export function subtractionAttemptCorrect(question,raw){
 if(!question||!digits(raw))return false;
 try{return BigInt(raw)===BigInt(question.a)-BigInt(question.b)}catch{return false}
}
export function subtractionEndState(mode,answers,questions){
 if(!Array.isArray(answers)||!Array.isArray(questions)||answers.length>questions.length)return null;
 let correct=0,errors=0;
 const lives=mode.includes('three-lives')?3:mode==='classic'?Infinity:1;
 for(let i=0;i<answers.length;i++){
  if(subtractionAttemptCorrect(questions[i],answers[i].answer))correct++;else errors++;
  if(i<answers.length-1&&errors>=lives)return null;
 }
 return {correct,errors,complete:answers.length===questions.length||errors>=lives,
  livesLeft:Number.isFinite(lives)?Math.max(0,lives-errors):null};
}
export function subtractionTranscriptStore(storage,studentId,classId,mode,level,method,total=null){
 const base='mathas.sub-certified.'+[studentId,classId,mode,level,method].join('.');
 const legacyKey=base+'v1';
 const countScoped=mode==='classic'&&COUNTS.includes(total);
 const key=countScoped?base+'n'+total+'.v1':legacyKey;
 function legacy(){
  if(!countScoped)return null;
  try{
   const snapshot=JSON.parse(storage.getItem(legacyKey)||'null');
   return snapshot?.total===total?snapshot:null;
  }catch{return null}
 }
 return Object.freeze({
  read(){
   try{
    const raw=storage.getItem(key);
    const value=raw?JSON.parse(raw):legacy();
    if(!value||!UUID.test(value.sessionId)||!Array.isArray(value.answers)
      ||Date.parse(value.expiresAt)<=Date.now()||value.method!==method
      ||value.mode!==mode||value.level!==level
      ||countScoped&&value.total!==total)return null;
    return value;
   }catch{return null}
  },
  save(run){
   try{storage.setItem(key,JSON.stringify(run));return true}catch{return false}
  },
  clear(){
   try{
    storage.removeItem(key);
    if(countScoped&&legacy())storage.removeItem(legacyKey);
    return true;
   }catch{return false}
  }
 });
}
function restore(snapshot,mode,level,method){
 if(!snapshot||snapshot.mode!==mode||snapshot.level!==level||snapshot.method!==method
  ||!Array.isArray(snapshot.answers))return null;
 const accepted=mode==='classic'
  ?acceptSubtractionChallenge(snapshot,level,snapshot.total,method)
  :acceptSubtractionExtended(snapshot,level,mode,method);
 if(!accepted||snapshot.answers.length>accepted.questions.length)return null;
 if(snapshot.answers.some((x,i)=>!x||x.id!==accepted.questions[i].id||!digits(x.answer)))return null;
 if(!subtractionEndState(mode,snapshot.answers,snapshot.questions))return null;
 return snapshot;
}
const CSS=String.raw`
.mathas-sub-proof{position:fixed;inset:0;z-index:100000;background:rgba(5,22,34,.98);color:#e9f6fb;overflow:auto;padding:clamp(8px,3vw,24px);box-sizing:border-box;font:600 14px/1.4 system-ui}
.mathas-sub-proof[hidden]{display:none!important}
.mathas-sub-proof-inner{max-width:750px;margin:auto;border-radius:18px;border:2px solid #547c91;background:#123348;box-shadow:0 16px 50px #0008;padding:clamp(14px,3vw,24px)}
.mathas-sub-proof h2{margin:0 0 10px;color:#f8dc86;font-size:22px}
.mathas-sub-proof .mathas-sub-proof-meta{display:flex;gap:12px;align-items:center;flex-wrap:wrap;color:#c5e5eb;font-weight:700}
.mathas-sub-proof .mathas-sub-operation{font:850 clamp(27px,5.5vw,47px)/1.25 ui-monospace,SFMono-Regular,Consolas,monospace;letter-spacing:.075em;width:max-content;max-width:100%;margin:16px auto;padding:12px 20px;background:#071f32;border:1px solid #4a778b;border-radius:12px;text-align:right;font-variant-numeric:tabular-nums}
.mathas-sub-proof .mathas-sub-operation .subtract{border-bottom:3px solid #f3d57e;margin-bottom:8px}
.mathas-sub-proof .mathas-sub-method{font-size:12px;color:#f2d88b;text-align:center;margin-bottom:8px}
.mathas-sub-proof .mathas-sub-answer{display:block;width:min(100%,440px);margin:10px auto;padding:13px 18px;border-radius:10px;border:2px solid #f3d57e;background:#fff;color:#092c40;font:800 clamp(22px,4vw,30px) ui-monospace,monospace;text-align:right;box-sizing:border-box}
.mathas-sub-proof .mathas-sub-note{display:block;color:#c8e5ee;font-size:12px;text-align:center}
.mathas-sub-proof .mathas-sub-actions{display:flex;justify-content:center;align-items:center;gap:9px;flex-wrap:wrap;margin:15px auto}
.mathas-sub-proof button{padding:10px 18px;border-radius:10px;border:1px solid #c1d5de;background:#284b65;color:white;font:700 13px system-ui;cursor:pointer}
.mathas-sub-proof button.primary{background:#eaca6b;color:#182e3b;border-color:#f7df8d}
.mathas-sub-proof button:disabled{opacity:.5;cursor:not-allowed}
.mathas-sub-proof .mathas-sub-status{color:#fff0be;text-align:center;min-height:25px}
.mathas-sub-proof .mathas-sub-pad{max-width:300px;margin:10px auto;display:grid;grid-template-columns:repeat(3,1fr);gap:7px}
.mathas-sub-proof .mathas-sub-pad button{font:800 19px system-ui;padding:9px}
`;
export function createCertifiedSubtraction({
 documentRef=document,storage=localStorage,getContext,getFrame=()=>null,call,refresh,onVerified,notify=()=>{}
}={}){
 const d=documentRef,style=d.createElement('style');style.textContent=CSS;d.head.append(style);
 const root=d.createElement('section');root.className='mathas-sub-proof';root.hidden=true;
 root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');
 root.setAttribute('aria-label','Soustraction scolaire certifiée');
 const inner=d.createElement('div');inner.className='mathas-sub-proof-inner';root.append(inner);d.body.append(root);
 let run=null,store=null,sending=false,finishing=false,nativeRunning=false;
 const native=(which=run?.mode)=>which?.startsWith('hard-')
  ?getFrame()?.contentWindow?.MathasSubtractionHardProof||null
  :getFrame()?.contentWindow?.MathasSubtractionNativeProof||null;
 const live=()=>getContext?.().connected===true;
 function show(message){const el=inner.querySelector('.mathas-sub-status');if(el)el.textContent=message;notify(message)}
 function close(){if(sending||finishing)return;
  if(run&&!subtractionEndState(run.mode,run.answers,run.questions)?.complete)store?.clear();
  root.hidden=true;inner.replaceChildren();run=null;store=null;nativeRunning=false}
 function node(tag,className,textContent){
  const el=d.createElement(tag);if(className)el.className=className;
  if(textContent!==undefined)el.textContent=textContent;return el;
 }
 function button(label,action,primary=false){
  const el=node('button',primary?'primary':'',label);el.type='button';el.onclick=action;return el;
 }
 function build({title,meta,operation=false}){
  inner.replaceChildren();
  inner.append(node('h2','',title),node('div','mathas-sub-proof-meta',meta));
  if(operation){
   const q=run.questions[run.answers.length],op=node('div','mathas-sub-operation');
   op.append(node('div','',q.a),node('div','subtract','− '+q.b));
   inner.append(op,node('div','mathas-sub-method',
    'Méthode : '+(run.method==='takeTop'?'Emprunt direct':'Compensation')));
   const answer=node('input','mathas-sub-answer');
   answer.type='text';answer.inputMode='numeric';answer.autocomplete='off';answer.maxLength=16;
   answer.setAttribute('aria-label','Résultat de la soustraction, du chiffre de gauche au chiffre de droite');
   answer.placeholder='Résultat';
   answer.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();validate(answer)}});
   inner.append(answer,node('small','mathas-sub-note',
    'Effectue la soustraction posée avec la méthode choisie. Un seul essai par calcul.'));
   const bar=node('div','mathas-sub-actions');
   bar.append(button('Valider ce calcul',()=>validate(answer),true),
    button('Quitter l’exercice (abandonner)',close));
   inner.append(bar);
   const pad=node('div','mathas-sub-pad');
   for(const n of ['7','8','9','4','5','6','1','2','3','⌫','0','C']){
    pad.append(button(n,()=>{
     if(n==='C')answer.value='';
     else if(n==='⌫')answer.value=answer.value.slice(0,-1);
     else if(answer.value.length<16)answer.value+=n;
     answer.focus();
    }));
   }
   inner.append(pad);
   queueMicrotask(()=>answer.focus());
  }else inner.append(node('div','mathas-sub-status',''));
  if(!inner.querySelector('.mathas-sub-status'))inner.append(node('div','mathas-sub-status',''));
 }

 const receiver=Object.freeze({
  progress:()=>run?subtractionEndState(run.mode,run.answers,run.questions):null,
  record(entry){
   if(!live()||!run||!store||sending||finishing)return false;
   const q=run.questions[run.answers.length];
   if(!q||entry?.id!==q.id||!digits(entry.answer))return false;
   const next={...run,answers:[...run.answers,{id:q.id,answer:entry.answer}]};
   const state=subtractionEndState(run.mode,next.answers,next.questions);
   if(!state||!store.save(next))return false;
   run=next;
   if(state.complete){
    native()?.completed();
    queueMicrotask(()=>{void finish()});
   }
   return true;
  },
  suspended(){
   if(sending||finishing)return;
   if(run&&!subtractionEndState(run.mode,run.answers,run.questions)?.complete)store?.clear();
   run=null;store=null;nativeRunning=false;
   notify('Exercice abandonné : réponses incomplètes effacées, anciens acquis conservés.');
  },
  problem(message){notify(message)}
 });
 function showNative(){
  const adapter=native();
  if(!adapter?.launch(run,receiver))throw Error('Moteur des emprunts certifiés indisponible');
  nativeRunning=true;
  root.hidden=true;
 }
 function render(){
  if(!run)return;
  const state=subtractionEndState(run.mode,run.answers,run.questions);
  if(!state){show('Journal invalide : préviens ton professeur.');return}
  if(state.complete){void finish();return}
  const kind=run.mode==='classic'?'Série classique':
   run.mode.includes('hard')?'HARD '+(run.mode.includes('three-lives')?'3 vies':'Mort subite'):
   run.mode==='three-lives'?'3 vies':'Mort subite';
  build({title:'Soustraction · '+kind,
   meta:'Niveau '+run.level+' · Calcul '+(run.answers.length+1)+' / '+run.questions.length+
    ' · '+state.correct+' réussite(s)'+(state.livesLeft!==null?' · '+state.livesLeft+' vie(s) restante(s)':''),
   operation:true});
 }
 function validate(input){
  if(!run||sending||finishing)return;
  const raw=input.value.trim();
  if(!digits(raw)){show('Écris un nombre entier positif ou zéro, sans espace.');input.focus();return}
  const q=run.questions[run.answers.length];
  const next={...run,answers:[...run.answers,{id:q.id,answer:raw}]};
  if(!store?.save(next)){show('Sauvegarde locale impossible : ne ferme pas la page.');return}
  run=next;
  const good=subtractionAttemptCorrect(q,raw),state=subtractionEndState(run.mode,run.answers,run.questions);
  if(!state){show('Partie incohérente : aucun résultat envoyé.');return}
  render();
  if(!state.complete)show(good?'Calcul juste. Poursuis !':'Calcul incorrect. La série continue si le mode le permet.');
 }
 async function finish(){
  if(!run||sending||!live()||!subtractionEndState(run.mode,run.answers,run.questions)?.complete)return;
  sending=true;finishing=true;
  const snapshot=run,stats=subtractionEndState(run.mode,run.answers,run.questions);
  root.hidden=false;
  build({title:'Vérification officielle',meta:'Résultat local : '+stats.correct+' / '+snapshot.answers.length});
  const retry=button('Réessayer la synchronisation',()=>{finishing=false;void finish()},true);
  try{
   const action=run.mode==='classic'?'finish-classic-v1':'finish-extended-v1';
   const receipt=await call(action,{sessionId:snapshot.sessionId,answers:snapshot.answers});
   if(receipt?.proofVerified!==true||receipt.verifiedScore!==stats.correct
    ||!Number.isSafeInteger(receipt?.xp?.delta))throw Error('score_proof_mismatch');
   // Le serveur a déjà validé atomiquement l'épreuve : ne jamais refaire
   // une écriture XP à cause d'une panne de rafraîchissement ou de projection.
   store?.clear();
   if(nativeRunning){native()?.home();nativeRunning=false}
   try{await refresh()}catch(error){notify('✅ XP certifiés, actualisation du profil à retenter.')}
   try{await onVerified?.({eventId:snapshot.sessionId,ack:receipt})}
   catch{notify('✅ XP certifiés, projection à consulter plus tard.')}
   inner.replaceChildren(
    node('h2','','Série vérifiée ✓'),
    node('div','mathas-sub-proof-meta',
     stats.correct+' réussite(s) sur '+snapshot.answers.length+' calcul(s). XP, trophées et records synchronisés.'),
    node('div','mathas-sub-status','Le score du tableau sera proposé uniquement avec ton accord.'));
   inner.append(button('Retour à Soustraction',()=>{sending=false;finishing=false;close()},true));
  }catch(error){
   const message=error instanceof Error?error.message:'proof_unavailable';
   inner.append(node('p','mathas-sub-status','En attente de synchronisation : '+message));
   inner.append(retry,button('Fermer sans perdre le résultat',()=>{sending=false;finishing=false;close()}));
  }finally{sending=false;finishing=false}
 }
 async function start({mode='classic',level,total=null,method='addBottom'}={}){
  if(!live()||!['classic',...SUBTRACTION_EXTENDED_MODES].includes(mode)
   ||![1,2,3].includes(level)||!['addBottom','takeTop'].includes(method)
   ||mode==='classic'&&!COUNTS.includes(total))return false;
  const ctx=getContext();
  store=subtractionTranscriptStore(storage,ctx.studentId,ctx.classId,mode,level,method,total);
  root.hidden=false;
  build({title:'Chargement du défi certifié',meta:'Soustraction · Niveau '+level});
  const prior=store.read(),restored=restore(prior,mode,level,method);
  if(prior&&!restored)store.clear();
  if(restored){
   run=restored;
   if(subtractionEndState(run.mode,run.answers,run.questions)?.complete){void finish();return true}
   try{showNative();return true}catch(error){show(error.message);return false}
  }
  try{
   const action=mode==='classic'?'start-classic-v1':'start-extended-v1';
   const data=await call(action,mode==='classic'?{mode:undefined,level,total,method}:{mode,level,method});
   const accepted=mode==='classic'
    ?acceptSubtractionChallenge(data,level,total,method)
    :acceptSubtractionExtended(data,level,mode,method);
   if(!accepted)throw Error('Défi scolaire non valide');
   run={...accepted,mode,level,method,answers:[]};
   if(!store.save(run))throw Error('Sauvegarde de la preuve impossible');
   showNative();return true;
  }catch(error){
   build({title:'Défi indisponible',meta:'Aucun point ni XP fictif n’a été attribué.'});
   show(error instanceof Error?error.message:'Connexion scolaire indisponible');
   inner.append(button('Retour au menu',close,true));return false;
  }
 }
 return Object.freeze({start,close,isOpen:()=>!root.hidden,destroy(){if(run&&!subtractionEndState(run.mode,run.answers,run.questions)?.complete)store?.clear();native()?.abandonView();root.remove();style.remove()}});
}
