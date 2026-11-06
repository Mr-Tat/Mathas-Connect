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
 let run=null,queue=null,sending=false;
 let answerFields=[],carryFields=[];
 const active=seq=>seq===getContext().generation&&run?.appKey===getContext().activeApp;
 const info=text=>{status.textContent=text;notify(text)};
 function controlsBusy(busy){
  if(busy)button.dataset.extendedBusy='1';else delete button.dataset.extendedBusy;
  button.disabled=busy;modeSelect.disabled=busy;levelSelect.disabled=busy;
 }
 function reset(){
  run=null;queue=null;sending=false;root.hidden=true;
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
  title.textContent=EXTENDED_LABELS[run.mode]+' · Niveau '+run.level+
   (run.appKey==='addition-ecrite-simple'?' · Addition simple':' · Addition de plusieurs nombres');
  status.textContent='Calcul '+(index+1)+'/'+EXTENDED_LIMIT+
   ' · Score : '+current.correct+' · '+(run.mode.includes('three-lives')?
    '❤️ '+current.hearts+' vie(s) restante(s)':'💀 Une erreur termine la partie');
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
  table.appendChild(makeCell('=','extended-equals'));
  answerFields=Array(columns).fill(null);
  for(let col=columns-1;col>=0;col--){
   const input=makeInput('answer',col,col);
   table.appendChild(input);answerFields[col]=input;
  }
  const wrapped=document.createElement('div');
  wrapped.className='extended-grid-scroll';wrapped.appendChild(table);
  const exercise=doc.createElement('div');exercise.className='extended-calc-box';
  const caption=doc.createElement('p');caption.className='extended-calc-label';
  caption.textContent='Calcul posé · '+(index+1);
  exercise.append(caption,wrapped);
  const help=doc.createElement('p');help.className='extended-instructions';
  help.textContent='💡 Commence par les unités : écris les chiffres du résultat et les retenues au-dessus des colonnes. '+
   'Une première réponse incorrecte coûte une vie (ou termine la Mort subite).';
  const workspace=doc.createElement('div');workspace.className='extended-workspace';
  const pad=doc.createElement('div');pad.className='extended-keypad';
  const padTitle=doc.createElement('p');padTitle.className='extended-keypad-title';
  padTitle.textContent='Clavier tactile';pad.appendChild(padTitle);
  for(const digit of ['1','2','3','4','5','6','7','8','9','⌫','0','✓']){
   const b=doc.createElement('button');
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
   run=null;queue=null;
   try{onRecorded({appKey:current.appKey,eventId:current.sessionId,duplicate:ack.duplicate===true});}catch{}
   let updated=true;try{await refresh()}catch{updated=false}
   const done='✅ Partie vérifiée par Connect · '+score+' bonnes réponses sur '+n+
    ' · +'+delta+' XP officiels.'+(updated?'':' Profil à actualiser.');
   info(done);
   title.textContent='🏆 '+EXTENDED_LABELS[current.mode]+' · Résultat certifié';
   const result=document.createElement('div');
   result.className='extended-finished';result.textContent=done;
   grid.replaceChildren(result);
   exitButton.disabled=false;exitButton.textContent='Retour au jeu';
   controlsBusy(false);verifyButton.disabled=true;nextButton.hidden=true;
  }catch(e){
   if(active(current.generation))info('⚠️ Réponses conservées ; clique « Actualiser le profil » pour réessayer : '+e.message);
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
  run.answers=updated;verifyButton.disabled=true;
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
   const received=await call('start-extended-proof-v1',ctx.activeApp,{level,mode});
   if(seq!==getContext().generation)return;
   const parsed=parseExtendedChallenge(received,ctx.activeApp,mode,level);
   if(!parsed||Date.parse(parsed.expiresAt)<=Date.now())throw Error('Défi serveur invalide ou expiré');
   queue=createExtendedQueue({storage:localStorage,studentId:ctx.pupilId,classId:ctx.classId,
    appKey:ctx.activeApp,mode,level});
   if(!queue)throw Error('Sauvegarde locale inaccessible');
   const previous=queue.read();
   run={...parsed,appKey:ctx.activeApp,generation:seq,
     answers:[],finished:false,invalid:false};
   if(previous?.sessionId===parsed.sessionId&&previous.answers.every((x,i)=>
     i<EXTENDED_LIMIT&&normalizeExtendedAttempt(parsed.questions[i],x))){
    const previousState=extendedEndState(mode,previous.answers,parsed.questions);
    if(previousState.valid)run.answers=previous.answers;
   }
   if(!queue.save(run,run.answers))throw Error('Sauvegarde de la session impossible');
   frame.hidden=true;root.hidden=false;
   const state=extendedEndState(mode,run.answers,run.questions);
   if(state.complete){run.finished=true;info('Reprise de la preuve terminée…');void finish();}
   else render();
  }catch(e){
   if(seq===getContext().generation){
    run=null;queue=null;root.hidden=true;frame.hidden=false;
    controlsBusy(false);info('⚠️ '+e.message+' · aucun XP demandé.');
   }
  }
 }
 function exit(){
  if(sending)return;
  run=null;queue=null;root.hidden=true;frame.hidden=false;
  controlsBusy(false);verifyButton.disabled=true;nextButton.hidden=true;
  info('Retour au jeu. Une série interrompue conserve ses réponses jusqu’à expiration.');
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
  retry:()=>run?.finished?finish():Promise.resolve()});
}
