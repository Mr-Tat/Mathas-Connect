import {normalizeMultiplicationAttempt,validMultipliers} from './certified-multiplication.mjs';
import {
 MUL_EXTENDED_MODES,MUL_EXTENDED_LIMIT,MUL_EXTENDED_LABELS,
 parseMulExtendedChallenge,mulFirstTryCorrect,mulExtendedEndState,
 createMulExtendedQueue
} from './certified-multiplication-extended.mjs';
import {schoolModeAllowed,schoolModeLockReason} from './school-official-unlocks.mjs';

const APP='multiplication-ecrite-simple';
const TEST_CLASS='4bf3400d-a315-4ea4-a2f3-afaca24dc9b9';
// Le dessin et les couleurs du jeu original restent dans son iframe.
// Pour la survie, seule la feuille de calcul issue du serveur est interactive.
export function createMultiplicationExtendedUI({
 button,modeSelect,levelSelect,frame,root,title,status,grid,
 verifyButton,nextButton,exitButton,getContext,call,refresh,notify,onRecorded=()=>{}
}){
 let run=null,queue=null,sending=false,answers=[],carries=[];
 const validContext=g=>g===getContext().generation&&getContext().activeApp===APP;
 const info=text=>{status.textContent=text;notify(text)};
 const controlsBusy=busy=>{
  if(busy)button.dataset.extendedBusy='1';else delete button.dataset.extendedBusy;
  button.disabled=busy;modeSelect.disabled=busy;levelSelect.disabled=busy;
 };
 function reset(){
  run=null;queue=null;sending=false;answers=[];carries=[];
  root.hidden=true;frame.hidden=!frame.getAttribute('src');grid.replaceChildren();
  controlsBusy(false);verifyButton.disabled=true;nextButton.hidden=true;exitButton.disabled=false;
 }
 const makeSpan=(text='',cls='')=>{
  const el=document.createElement('span');el.className='extended-digit '+cls;el.textContent=text;return el;
 };
 function makeInput(kind,col){
  const input=document.createElement('input');
  input.type='text';input.inputMode='numeric';input.maxLength=1;input.pattern='[0-9]*';
  input.autocomplete='off';input.className='extended-digit-input '+kind;
  input.setAttribute('aria-label',kind==='carry'?'Retenue colonne '+(col+1):'Chiffre colonne '+(col+1));
  input.dataset.kind=kind;input.dataset.col=String(col);
  input.addEventListener('input',()=>{
   input.value=input.value.replace(/[^0-9]/g,'').slice(-1);
   if(kind==='answer'&&input.value&&col>0)answers[col-1]?.focus();
  });
  input.addEventListener('keydown',event=>{
   if(event.key==='Enter'){event.preventDefault();verifyButton.click();}
  });
  return input;
 }
 const selectedMultipliers=hard=>{
  if(hard)return [2,3,4,5,6,7,8,9];
  const doc=frame.contentDocument?.getElementById('game')?.contentDocument;
  const arr=[...(doc?.querySelectorAll('#multiplierPicker [data-mult].active')||[])]
   .map(node=>Number(node.dataset.mult))
   .filter(n=>Number.isInteger(n)&&n>=2&&n<=9).sort((a,b)=>a-b);
  return validMultipliers(arr)?arr:null;
 };
 function render(){
  if(!run)return;
  const q=run.questions[run.answers.length];if(!q)return;
  const state=mulExtendedEndState(run.mode,run.answers,run.questions);
  if(!state.valid){run.invalid=true;info('⚠️ Preuve interrompue : réponses incohérentes.');return}
  title.textContent=MUL_EXTENDED_LABELS[run.mode]+' · Multiplication niveau '+run.level;
  status.textContent='Calcul '+(run.answers.length+1)+'/'+MUL_EXTENDED_LIMIT+
   ' · '+state.correct+' réussite(s) · '+(run.mode.endsWith('three-lives')
    ?'❤️ '+state.hearts+' vie(s) restante(s)':'💀 Une erreur termine la partie');
  const product=(BigInt(q.a)*BigInt(q.m)).toString(),columns=product.length;
  const table=document.createElement('div');table.className='extended-operations mathas-mul-proof';
  table.style.gridTemplateColumns='26px repeat('+columns+',34px)';
  table.appendChild(makeSpan('↗','extended-indicator'));
  carries=Array(q.a.length).fill(null);
  for(let col=columns-1;col>=0;col--){
   if(col===0||col>=q.a.length){table.appendChild(makeSpan('','extended-empty'));continue;}
   const input=makeInput('carry',col);carries[col]=input;table.append(input);
  }
  table.append(makeSpan('','extended-operator'));
  for(const digit of q.a.padStart(columns,' '))table.append(makeSpan(digit.trim()));
  table.append(makeSpan('×','extended-operator'));
  for(const digit of String(q.m).padStart(columns,' '))table.append(makeSpan(digit.trim()));
  table.append(makeSpan('=','extended-equals'));
  answers=Array(columns).fill(null);
  for(let col=columns-1;col>=0;col--){
   const input=makeInput('answer',col);answers[col]=input;table.append(input);
  }
  const wrapped=document.createElement('div');wrapped.className='extended-grid-scroll';wrapped.append(table);
  grid.replaceChildren(wrapped);
  const hint=document.createElement('p');hint.className='extended-instructions';
  hint.textContent='Écris chaque chiffre du produit et, si besoin, les retenues. '+
   'Seule ta première réponse compte pour le score certifié.';
  grid.append(hint);
  const pad=document.createElement('div');pad.className='extended-keypad';
  for(const key of ['1','2','3','4','5','6','7','8','9','⌫','0']){
   const b=document.createElement('button');b.type='button';b.textContent=key;b.className='extended-key';
   b.addEventListener('click',()=>{
    const el=document.activeElement?.classList?.contains('extended-digit-input')
     ?document.activeElement:answers[0];
    if(!el)return;
    el.value=key==='⌫'?'':key;
    if(key!=='⌫'&&el.dataset.kind==='answer'&&Number(el.dataset.col)>0)
     answers[Number(el.dataset.col)-1]?.focus();
    else el.focus();
   });pad.append(b);
  }
  grid.append(pad);verifyButton.disabled=false;nextButton.hidden=true;
  answers[0]?.focus({preventScroll:true});
 }
 function currentAttempt(){
  const q=run?.questions[run.answers.length];
  if(!q||answers.some(x=>!x||x.value===''))return null;
  return normalizeMultiplicationAttempt({
   id:q.id,digits:answers.map(x=>x.value),carries:carries.map(x=>x?.value||'')
  },q);
 }
 async function finish(){
  if(!run||!run.finished||run.invalid||sending||!validContext(run.generation))return;
  const completed=run;sending=true;verifyButton.disabled=true;exitButton.disabled=true;
  try{
   const state=mulExtendedEndState(completed.mode,completed.answers,completed.questions);
   if(!state.valid||!state.complete)throw Error('Preuve incomplète');
   const ack=await call('finish-extended-v1',{sessionId:completed.sessionId,answers:completed.answers});
   if(!validContext(completed.generation))return;
   if(ack?.proofVerified!==true||ack.verifiedScore!==state.correct
    ||ack.attempted!==state.attempted||!Number.isSafeInteger(ack.xp?.delta))
    throw Error('Le serveur a rejeté la vérification du score.');
   queue?.clear();run=null;queue=null;
   try{onRecorded({appKey:APP,eventId:completed.sessionId,duplicate:ack.duplicate===true})}catch{}
   let synced=true;try{await refresh()}catch{synced=false}
   const result='✅ Partie certifiée · '+state.correct+'/'+state.attempted+
    ' calcul(s) · +'+ack.xp.delta+' XP officiels'+(synced?'':' · Profil à actualiser');
   info(result);title.textContent='🏆 '+MUL_EXTENDED_LABELS[completed.mode]+' · Résultat certifié';
   const display=document.createElement('p');display.className='extended-finished';display.textContent=result;
   grid.replaceChildren(display);verifyButton.disabled=true;nextButton.hidden=true;
   exitButton.textContent='Retour au jeu';controlsBusy(false);
  }catch(e){
   if(validContext(completed.generation))
    info('⚠️ Preuve conservée ; actualise le profil pour réessayer : '+e.message);
  }finally{sending=false;exitButton.disabled=false}
 }
 function verify(){
  if(!run||run.finished||run.invalid||sending||!validContext(run.generation))return;
  const raw=currentAttempt();
  if(!raw){info('Termine tous les chiffres du produit avant de valider.');return}
  const q=run.questions[run.answers.length],correct=mulFirstTryCorrect(q,raw);
  const updated=[...run.answers,raw];
  const state=mulExtendedEndState(run.mode,updated,run.questions);
  if(!state.valid||!queue?.save(run,updated)){
   run.invalid=true;verifyButton.disabled=true;
   info('⚠️ Impossible de conserver la preuve : aucun XP demandé.');return;
  }
  run.answers=updated;verifyButton.disabled=true;
  info((correct?'✅ Correct !':'❌ Première réponse incorrecte · produit attendu : '+
   (BigInt(q.a)*BigInt(q.m)).toString()+'.')+
   ' · Réussites : '+state.correct+(run.mode.endsWith('three-lives')?' · ❤️ '+state.hearts:''));
  if(state.complete){run.finished=true;void finish()}else nextButton.hidden=false;
 }
 async function start(){
  if(!MUL_EXTENDED_MODES.includes(modeSelect.value)||run||sending)return;
  const ctx=getContext(),mode=modeSelect.value,level=Number(levelSelect.value),seq=ctx.generation;
  if(!ctx.pupilId||!ctx.classId||ctx.activeApp!==APP||![1,2,3].includes(level))return;
  if(ctx.classId!==TEST_CLASS&&!schoolModeAllowed(ctx.officialProgress,mode,level)){
   info('🔒 '+schoolModeLockReason(mode,level));return;
  }
  const mults=selectedMultipliers(mode.startsWith('hard-'));
  if(!mults){info('Sélectionne les tables imposées avant de lancer un défi.');return;}
  controlsBusy(true);
  try{
   const received=await call('start-extended-v1',{level,mode,multipliers:mults});
   if(!validContext(seq))return;
   const parsed=parseMulExtendedChallenge(received,mode,level,mults);
   if(!parsed||Date.parse(parsed.expiresAt)<=Date.now())throw Error('Questions certifiées expirées ou invalides');
   queue=createMulExtendedQueue({storage:localStorage,studentId:ctx.pupilId,classId:ctx.classId,mode,level});
   if(!queue)throw Error('Sauvegarde de preuve indisponible');
   const old=queue.read();
   run={...parsed,appKey:APP,generation:seq,answers:[],invalid:false,finished:false};
   if(old?.sessionId===parsed.sessionId&&old.answers.every((a,i)=>
    i<MUL_EXTENDED_LIMIT&&normalizeMultiplicationAttempt(a,parsed.questions[i]))){
    const valid=mulExtendedEndState(mode,old.answers,parsed.questions);
    if(valid.valid)run.answers=old.answers;
   }
   if(!queue.save(run,run.answers))throw Error('Impossible de sauvegarder cette épreuve');
   frame.hidden=true;root.hidden=false;
   const resumed=mulExtendedEndState(mode,run.answers,run.questions);
   if(resumed.complete){run.finished=true;info('Reprise de la preuve certifiée…');void finish()}
   else render();
  }catch(e){
   if(validContext(seq)){
    run=null;queue=null;root.hidden=true;frame.hidden=false;controlsBusy(false);
    info('⚠️ '+e.message+' · aucun XP crédité.');
   }
  }
 }
 function exit(){
  if(sending)return;
  run=null;queue=null;root.hidden=true;frame.hidden=false;
  controlsBusy(false);verifyButton.disabled=true;nextButton.hidden=true;
  exitButton.textContent='Retour au jeu';
  info('Retour au jeu. Les réponses déjà écrites restent récupérables jusqu’à expiration.');
 }
 function startNative(mode,level){
  if(!MUL_EXTENDED_MODES.includes(mode)||![1,2,3].includes(level))return Promise.resolve();
  modeSelect.value=mode;levelSelect.value=String(level);
  modeSelect.dispatchEvent(new Event('change',{bubbles:true}));
  return start();
 }
 button.addEventListener('click',()=>{if(getContext().activeApp===APP
  &&MUL_EXTENDED_MODES.includes(modeSelect.value))void start()});
 verifyButton.addEventListener('click',()=>{if(getContext().activeApp===APP)verify()});
 nextButton.addEventListener('click',()=>{if(getContext().activeApp===APP&&run&&!run.finished)render()});
 exitButton.addEventListener('click',()=>{if(getContext().activeApp===APP)exit()});
 return Object.freeze({reset,startNative,hasPending:()=>!!run?.finished,
  retry:()=>run?.finished?finish():Promise.resolve()});
}
