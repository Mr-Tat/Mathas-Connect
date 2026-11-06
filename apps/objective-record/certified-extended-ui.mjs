import {
 EXTENDED_MODES,EXTENDED_LABELS,EXTENDED_LIMIT,parseExtendedChallenge,
 normalizeExtendedAttempt,extendedFirstTryCorrect,extendedEndState,
 createExtendedQueue
} from './certified-extended.mjs';
import {schoolModeAllowed,schoolModeLockReason} from './school-official-unlocks.mjs';

// Authenticated non-classic course embedded in the SAME pupil game host.
// Native visuals remain available for practice; this written-column interface
// is the verified school path for 3-vies, Mort subite, and HARD (both additions).
export function createCertifiedExtendedUI({
 button,modeSelect,levelSelect,frame,root,title,status,grid,
 verifyButton,nextButton,exitButton,getContext,call,refresh,notify,onRecorded=()=>{}
}){
 let run=null,queue=null,sending=false,native=null;
 let answerFields=[],carryFields=[];
 const clearNative=()=>{
  if(!native)return;
  const {win,doc}=native;
  doc.getElementById('mathas-certified-survival-screen')?.remove();
  delete win.__mathasServerCertifiedExtended;
  delete win.MathasCertifiedExtendedAttempt;
  native=null;
 };
 const nativeMessage=(text,phase)=>{
  if(!native)return;
  const {doc}=native;
  let overlay=doc.getElementById('mathas-certified-survival-screen');
  if(!overlay){
   overlay=doc.createElement('section');
   overlay.id='mathas-certified-survival-screen';
   overlay.setAttribute('role','dialog');
   overlay.setAttribute('aria-modal','true');
   overlay.style.cssText='position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(6,20,34,.94);color:#f5f9ff;font:16px/1.5 system-ui,sans-serif';
   doc.body.appendChild(overlay);
  }
  const panel=doc.createElement('div');
  panel.style.cssText='width:min(540px,100%);max-height:90vh;overflow:auto;text-align:center;padding:clamp(20px,5vw,36px);background:#16344f;border:2px solid #a7c5d4;border-radius:20px;box-shadow:0 12px 35px #0008';
  const heading=doc.createElement('h2');
  heading.textContent=phase==='verified'?'🏆 Résultat officiel Connect':
   phase==='pending'?'⚠️ Synchronisation en attente':'⏳ Vérification du résultat';
  heading.style.cssText='margin:0 0 12px;color:#ffe3aa;font-size:clamp(22px,4vw,30px)';
  const message=doc.createElement('p');message.textContent=text;
  panel.append(heading,message);
  if(phase==='pending'||phase==='verified'){
   const action=doc.createElement('button');
   action.type='button';
   action.textContent=phase==='verified'?'Retour au jeu':'↻ Réessayer l’enregistrement';
   action.style.cssText='margin-top:12px;padding:12px 20px;min-height:48px;border-radius:12px;border:1px solid #e4c17a;background:#a77829;color:#fff;font:800 16px system-ui;cursor:pointer';
   action.addEventListener('click',()=>{
    if(phase==='pending'){void finish();return;}
    const {doc:gameDoc,mode}=native;
    const back=gameDoc.getElementById(mode.startsWith('hard-')?'hardGameBack':'menuBtn');
    clearNative();
    back?.click();
   });
   panel.appendChild(action);
  }
  overlay.replaceChildren(panel);
 };
 const startNativeView=()=>{
  if(!run||run.answers.length!==0)return false;
  const iframe=frame.contentDocument?.getElementById('game');
  const win=iframe?.contentWindow,doc=iframe?.contentDocument;
  if(!win||!doc||typeof win.MathasLabV2Update!=='function')return false;
  const hard=run.mode.startsWith('hard-');
  const nativeMode=hard?run.mode.slice(5):run.mode;
  let launch=null;
  if(hard){
   launch=[...doc.querySelectorAll('#hardMenuScreen .hard-start')]
    .find(b=>Number(b.dataset.level)===run.level&&b.dataset.mode===nativeMode&&!b.disabled);
  }else{
   const sel=doc.getElementById('suddenMaxDigits');
   const width=run.appKey==='addition-ecrite-simple'?[3,5,7][run.level-1]:[5,6,7][run.level-1];
   if(!sel||!Array.from(sel.options).some(opt=>opt.value===String(width)))return false;
   sel.value=String(width);
   sel.dispatchEvent(new win.Event('change',{bubbles:true}));
   launch=doc.getElementById(nativeMode==='sudden'?'startSudden':'startThreeLives');
  }
  if(!launch||launch.disabled)return false;
  native={win,doc,mode:run.mode};
  win.__mathasServerCertifiedExtended={
   sessionId:run.sessionId,mode:run.mode,level:run.level,width:run.width,
   questions:run.questions,index:0,finished:false
  };
  win.MathasCertifiedExtendedAttempt=raw=>{
   const current=run;
   if(!current||!active(current.generation)||current.invalid||current.finished||sending)return;
   const q=current.questions[current.answers.length];
   const attempt=normalizeExtendedAttempt(q,raw);
   const updated=attempt?[...current.answers,attempt]:null;
   const state=updated?extendedEndState(current.mode,updated,current.questions):null;
   if(!state?.valid||!queue?.save(current,updated)){
    current.invalid=true;
    nativeMessage('Preuve non sauvegardée. Aucun XP ne sera demandé ; reviens au HUB pour recommencer.','pending');
    info('⚠️ Preuve invalide ou sauvegarde impossible : aucun XP demandé.');
    return;
   }
   current.answers=updated;
   if(state.complete){
    current.finished=true;
    win.__mathasServerCertifiedExtended.finished=true;
    void finish();
   }
  };
  doc.addEventListener('click',event=>{
   if(native?.doc!==doc||sending||!run||run.finished)return;
   if(!event.target?.closest?.('#menuBtn,#hardGameBack,#hardExit'))return;
   queue?.clear();run=null;queue=null;
   clearNative();controlsBusy(false);
  });
  frame.hidden=false;root.hidden=true;
  launch.click(); // Synthetic: bypass the trusted user-launch router on purpose.
  return true;
 };
 const active=seq=>seq===getContext().generation&&run?.appKey===getContext().activeApp;
 // Une mise à jour du site ou un rechargement ne doit pas interrompre
 // silencieusement une série certifiée. La preuve reste locale tant qu'elle
 // n'est pas finalisée côté serveur ; prévenir avant de quitter l'onglet.
 const warnWhilePlaying=event=>{
  if(!run||run.invalid||!active(run.generation))return;
  event.preventDefault();
  event.returnValue='';
 };
 if(typeof window!=='undefined'&&typeof window.addEventListener==='function')
  window.addEventListener('beforeunload',warnWhilePlaying);
 const info=text=>{status.textContent=text;notify(text)};
 function controlsBusy(busy){
  if(busy)button.dataset.extendedBusy='1';else delete button.dataset.extendedBusy;
  button.disabled=busy;modeSelect.disabled=busy;levelSelect.disabled=busy;
 }
 function reset(){
  // Quitter volontairement une épreuve annule la progression non terminée,
  // sans supprimer une fin complète en attente de synchronisation.
  if(run&&!run.finished)try{queue?.clear()}catch{}
  run=null;queue=null;sending=false;root.hidden=true;
  clearNative();
  delete root.dataset.mode;delete root.dataset.phase;
  frame.hidden=!frame.getAttribute('src');grid.replaceChildren();
  answerFields=[];carryFields=[];controlsBusy(false);
  verifyButton.disabled=true;nextButton.hidden=true;exitButton.disabled=false;
  exitButton.textContent='Retour au jeu';
 }
 function makeCell(text='',cls=''){
  const d=document.createElement('span');
  d.className='extended-digit '+cls;d.textContent=text;return d;
 }
 function makeInput(kind,col,idx){
  const input=document.createElement('input');
  input.type='text';input.inputMode='numeric';input.maxLength=1;
  input.autocomplete='off';input.pattern='[0-9]*';
  input.className='extended-digit-input '+kind;
  input.setAttribute('aria-label',kind==='carry'?'Retenue colonne '+(col+1):'Chiffre '+(idx+1)+' du résultat');
  input.dataset.kind=kind;input.dataset.col=String(col);
  input.addEventListener('input',()=>{
   input.value=input.value.replace(/[^0-9]/g,'').slice(-1);
   if(kind==='answer'&&input.value&&col>0)answerFields[col-1]?.focus();
  });
  input.addEventListener('keydown',event=>{
   if(event.key==='Enter'){event.preventDefault();verifyButton.click();}
  });
  return input;
 }
 function render(){
  if(!run)return;
  const index=run.answers.length,q=run.questions[index];
  if(!q)return;
  const current=extendedEndState(run.mode,run.answers,run.questions);
  if(!current.valid){info('Preuve interrompue : réponses incohérentes.');return}
  const sudden=run.mode.endsWith('sudden');
  root.dataset.phase='playing';
  title.textContent=sudden?EXTENDED_LABELS[run.mode]:
   EXTENDED_LABELS[run.mode]+' · Niveau '+run.level+
   (run.appKey==='addition-ecrite-simple'?' · Addition simple':' · Addition de plusieurs nombres');
  status.textContent=sudden?
   'Niveau '+run.level+' · Calcul '+(index+1)+' · '+current.correct+
   ' réussite'+(current.correct===1?'':'s')+' · 1 erreur = fin':
   'Calcul '+(index+1)+'/'+EXTENDED_LIMIT+
   ' · Score : '+current.correct+' · ❤️ '+current.hearts+' vie(s) restante(s)';
  const terms=q.addends,solution=terms.reduce((n,s)=>n+BigInt(s),0n).toString();
  const columns=solution.length;
  const table=document.createElement('div');
  table.className='extended-operations';
  // Dimensions communes à l'interface, adaptées à l'écran. Le défilement
  // horizontal évite l'écrasement des calculs HARD à 12–16 chiffres.
  table.style.gridTemplateColumns='var(--extended-operator-width) repeat('+columns+',var(--extended-column-width))';
  table.appendChild(makeCell('↗','extended-indicator'));
  carryFields=Array(q.width).fill(null);
  for(let col=columns-1;col>=0;col--){
   if(col===0||col>=q.width){table.appendChild(makeCell('','extended-empty'));continue;}
   const input=makeInput('carry',col,col);
   table.appendChild(input);carryFields[col]=input;
  }
  terms.forEach((s,i)=>{
   const last=i===terms.length-1;
   const lineClass=last?' extended-last-addend':'';
   table.appendChild(makeCell(last?'+':'','extended-operator'+lineClass));
   const padded=s.padStart(columns,' ');
   for(const digit of padded)table.appendChild(makeCell(digit.trim(),lineClass.trim()));
  });
  // Trait de séparation continu, comme sur les calculs posés du moteur natif.
  const rule=document.createElement('div');rule.className='extended-result-bar';
  rule.setAttribute('aria-hidden','true');table.appendChild(rule);
  table.appendChild(makeCell('=','extended-equals'));
  answerFields=Array(columns).fill(null);
  for(let col=columns-1;col>=0;col--){
   const input=makeInput('answer',col,col);
   table.appendChild(input);answerFields[col]=input;
  }
  const wrapped=document.createElement('div');
  wrapped.className='extended-grid-scroll';wrapped.appendChild(table);
  const exercise=document.createElement('div');exercise.className='extended-calc-box';
  const caption=document.createElement('p');caption.className='extended-calc-label';
  caption.textContent='Calcul posé · '+(index+1);
  exercise.append(caption,wrapped);
  const help=document.createElement('p');help.className='extended-instructions';
  help.textContent=sudden?
   'Écris le résultat et les retenues, puis valide. Les XP officiels arrivent seulement après confirmation de Connect.':
   '💡 Commence par les unités : écris les chiffres du résultat et les retenues au-dessus des colonnes. '+
   'Une première réponse incorrecte coûte une vie (ou termine la Mort subite).';
  const workspace=document.createElement('div');workspace.className='extended-workspace';
  const pad=document.createElement('div');pad.className='extended-keypad';
  const padTitle=document.createElement('p');padTitle.className='extended-keypad-title';
  padTitle.textContent='Clavier tactile';pad.appendChild(padTitle);
  for(const digit of ['1','2','3','4','5','6','7','8','9','⌫','0','✓']){
   const b=document.createElement('button');
   b.type='button';b.textContent=digit;b.className='extended-key';
   if(digit==='✓')b.classList.add('extended-key-confirm');
   b.addEventListener('click',()=>{
    if(digit==='✓'){verifyButton.click();return;}
    const focused=document.activeElement;
    const t=focused?.classList?.contains('extended-digit-input')?focused:answerFields[0];
    if(!t)return;
    if(digit==='⌫')t.value='';
    else t.value=digit;
    if(digit!=='⌫'&&t.dataset.kind==='answer'&&Number(t.dataset.col)>0){
     answerFields[Number(t.dataset.col)-1]?.focus();
    }else t.focus();
   });
   pad.appendChild(b);
  }
  workspace.append(exercise,pad);
  grid.replaceChildren(help,workspace);
  verifyButton.disabled=false;nextButton.hidden=true;
  answerFields[0]?.focus({preventScroll:true});
 }
 function currentAttempt(){
  const q=run?.questions[run.answers.length];if(!q)return null;
  if(answerFields.some(x=>x?.value===''))return null;
  return normalizeExtendedAttempt(q,{
   id:q.id,digits:answerFields.map(x=>x?.value??''),
   carries:carryFields.map(x=>x?.value??'')
  });
 }
 async function finish(){
  if(!run||!run.finished||run.invalid||sending||!active(run.generation))return;
  const current=run;sending=true;verifyButton.disabled=true;exitButton.disabled=true;
  root.dataset.phase='saving';
  if(native)nativeMessage('Tes réponses sont conservées. Le serveur vérifie le résultat et les XP officiels.','saving');
  info('⏳ Enregistrement officiel en cours… Attends la confirmation de Connect.');
  try{
   const ack=await call('finish-extended-proof-v1',current.appKey,
    {sessionId:current.sessionId,answers:current.answers});
   if(!active(current.generation))return;
   if(ack?.proofVerified!==true||!Number.isSafeInteger(ack.verifiedScore)
    ||!Number.isSafeInteger(ack.xp?.delta)
    ||ack.verifiedScore!==extendedEndState(current.mode,current.answers,current.questions).correct)
    throw Error('Le score certifié ne correspond pas aux calculs.');
   queue?.clear();
   const n=current.answers.length,score=ack.verifiedScore,delta=ack.xp.delta;
   run=null;queue=null;root.dataset.phase='verified';
   try{onRecorded({appKey:current.appKey,eventId:current.sessionId,duplicate:ack.duplicate===true});}catch{}
   let updated=true;try{await refresh()}catch{updated=false}
   const done='✅ Partie vérifiée par Connect · '+score+' bonnes réponses sur '+n+
    ' · +'+delta+' XP officiels.'+(updated?'':' Profil à actualiser.');
   info(done);
   if(native)nativeMessage(done,'verified');
   else{
    title.textContent='🏆 '+EXTENDED_LABELS[current.mode]+' · Résultat certifié';
    const result=document.createElement('div');
    result.className='extended-finished';result.textContent=done;
    grid.replaceChildren(result);
   }
   exitButton.disabled=false;exitButton.textContent='Retour au jeu';
   controlsBusy(false);verifyButton.disabled=true;nextButton.hidden=true;
  }catch(e){
   if(active(current.generation)){
    root.dataset.phase='pending';
    if(native)nativeMessage('Réponses conservées. Réessaie la synchronisation avec Connect.','pending');
    info('⚠️ Réponses conservées ; clique « Actualiser le profil » pour réessayer : '+e.message);
   }
  }finally{sending=false;exitButton.disabled=false}
 }
 function verify(){
  if(!run||run.finished||run.invalid||sending||!active(run.generation))return;
  const attempt=currentAttempt();
  if(!attempt){info('Complète tous les chiffres du résultat avant de valider.');return}
  const q=run.questions[run.answers.length],ok=extendedFirstTryCorrect(q,attempt);
  const updated=[...run.answers,attempt];
  const state=extendedEndState(run.mode,updated,run.questions);
  if(!state.valid||!queue?.save(run,updated)){
   run.invalid=true;verifyButton.disabled=true;
   info('⚠️ La preuve ne peut pas être sauvegardée : aucun XP demandé.');return;
  }
  run.answers=updated;verifyButton.disabled=true;root.dataset.phase='feedback';
  info((ok?'✅ Correct !':'❌ Résultat incorrect. La bonne somme était '+q.addends.reduce((s,x)=>s+BigInt(x),0n)+'.')+
   ' · Score : '+state.correct+(run.mode.includes('three-lives')?' · ❤️ '+state.hearts:''));
  if(state.complete){run.finished=true;void finish();return;}
  nextButton.hidden=false;
 }
 async function start(){
  if(!EXTENDED_MODES.includes(modeSelect.value)||run||sending)return;
  const ctx=getContext(),mode=modeSelect.value,level=Number(levelSelect.value),seq=ctx.generation;
  if(!ctx.pupilId||!ctx.classId||
   !['addition-ecrite-simple','addition-ecrite-multiple'].includes(ctx.activeApp))return;
  if(ctx.classId!=='4bf3400d-a315-4ea4-a2f3-afaca24dc9b9'
    &&!schoolModeAllowed(ctx.officialProgress,mode,level)){
   info('🔒 '+schoolModeLockReason(mode,level));return;
  }
  controlsBusy(true);
  try{
   // Lire la sauvegarde AVANT de demander une nouvelle session. Avant ce
   // correctif, le serveur émettait une nouvelle session à chaque lancement,
   // et les réponses locales ne correspondaient donc jamais à son UUID.
   queue=createExtendedQueue({storage:localStorage,studentId:ctx.pupilId,classId:ctx.classId,
    appKey:ctx.activeApp,mode,level});
   if(!queue)throw Error('Sauvegarde locale inaccessible');
   const previous=queue.read();
   let received=null;
   if(previous?.sessionId){
    try{
     received=await call('resume-extended-proof-v1',ctx.activeApp,{sessionId:previous.sessionId});
    }catch(e){
     // Reprendre un défi encore valide est prioritaire. Si le service est
     // temporairement indisponible, conserver les réponses plutôt que les
     // écraser avec une nouvelle partie.
     const known=new Set(['proof_not_found','proof_expired','revision_conflict',
      'stale_reset_epoch','proof_already_finished']);
     if(!known.has(e?.message))throw Error('Reprise impossible : les réponses restent sauvegardées. '+e.message);
    }
   }
   if(!received)received=await call('start-extended-proof-v1',ctx.activeApp,{level,mode});
   if(seq!==getContext().generation)return;
   const parsed=parseExtendedChallenge(received,ctx.activeApp,mode,level);
   if(!parsed||Date.parse(parsed.expiresAt)<=Date.now())throw Error('Défi serveur invalide ou expiré');
   run={...parsed,appKey:ctx.activeApp,generation:seq,
     answers:[],finished:false,invalid:false};
   if(previous?.sessionId===parsed.sessionId&&previous.answers.every((x,i)=>
     i<EXTENDED_LIMIT&&normalizeExtendedAttempt(parsed.questions[i],x))){
    const previousState=extendedEndState(mode,previous.answers,parsed.questions);
    if(previousState.valid)run.answers=previous.answers;
   }
   if(!queue.save(run,run.answers))throw Error('Sauvegarde de la session impossible');
   frame.hidden=true;root.dataset.mode=mode;root.hidden=false;
   const state=extendedEndState(mode,run.answers,run.questions);
   if(state.complete){run.finished=true;info('Reprise de la preuve terminée…');void finish();}
   else if(!run.answers.length&&startNativeView())return;
   else render();
  }catch(e){
   if(seq===getContext().generation){
    run=null;queue=null;root.hidden=true;frame.hidden=false;
    clearNative();
    delete root.dataset.mode;delete root.dataset.phase;
    controlsBusy(false);info('⚠️ '+e.message+' · aucun XP demandé.');
   }
  }
 }
 function exit(){
  if(sending)return;
  if(run&&!run.finished)try{queue?.clear()}catch{}
  run=null;queue=null;root.hidden=true;frame.hidden=false;
  clearNative();
  delete root.dataset.mode;delete root.dataset.phase;
  controlsBusy(false);verifyButton.disabled=true;nextButton.hidden=true;
  info('Retour au jeu. Exercice abandonné : les réponses non validées sont effacées.');
 }
 function startNative(mode,level){
  if(!EXTENDED_MODES.includes(mode)||![1,2,3].includes(level))return Promise.resolve();
  modeSelect.value=mode;levelSelect.value=String(level);
  modeSelect.dispatchEvent(new Event('change',{bubbles:true}));
  return start();
 }
 button.addEventListener('click',()=>{if(EXTENDED_MODES.includes(modeSelect.value))void start()});
 verifyButton.addEventListener('click',verify);
 nextButton.addEventListener('click',()=>{if(run&&!run.finished)render()});
 exitButton.addEventListener('click',exit);
 return Object.freeze({reset,startNative,hasPending:()=>!!run?.finished,
  onGameEvent:event=>!!native&&event?.mode===native.mode.replace(/^hard-/,'')&&!!event?.hard===native.mode.startsWith('hard-'),
  retry:()=>run?.finished?finish():Promise.resolve()});
}
