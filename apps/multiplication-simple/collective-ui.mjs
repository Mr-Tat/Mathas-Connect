import {validSession,canAdvance} from './collective-contract.mjs?v=20261110-v1';

// Contrôleur visuel du guidé collectif : mêmes nombres, copies individuelles.
// Il ne transmet jamais les chiffres saisis par les élèves.
export function createMultiplicationCollective({iframe,teacher,call,classId,classLabel=''}){
 let doc=null,bridge=null,session=null,joined=false,practicing=false,index=-1,busy=false;
 let menuSlot=null,menuButton=null,bar=null,notice=null,teacherRow=null,pupilRow=null,barClassBadge=null;
 let btnNext=null,teacherNextButton=null,btnStartHere=null,btnJoinHere=null,btnSkip=null,btnStop=null,btnBoard=null,btnPractice=null,btnReturn=null,btnCatchup=null;
 let answerPanel=null,teacherAnswers=[],confirmPanel=null,boardLock=null,started=false,lastError='';
 const lockKey='mathas.mul.guided.board-lock.'+classId;
 try{const v=JSON.parse(sessionStorage.getItem(lockKey)||'null');if(v?.salt&&v?.hash)boardLock=v}catch{}
 const say=msg=>{lastError=msg;if(notice)notice.textContent=msg;};
 const el=(tag,cls,text)=>{const x=doc.createElement(tag);if(cls)x.className=cls;if(text!==undefined)x.textContent=text;return x};
 const button=(label,fn)=>{const x=el('button','mathas-collective-button',label);x.type='button';x.addEventListener('click',fn);return x};
 const classBadge=()=>{
  const node=el('span','mc-guided-class-badge',classLabel);
  node.hidden=!classLabel;
  node.title=classLabel+' · classe utilisée pour le guidé collectif';
  return node;
 };
 const isLocked=()=>teacher&&!!boardLock;
 const sameSession=s=>session?.sessionId===s?.sessionId;
 const displayCurrent=()=>{
  if(!validSession(session)||index<0||index>=session.pages.length)return false;
  const inGame=doc?.getElementById('gameScreen')?.classList.contains('hidden')===false;
  if(inGame&&bridge?.status()?.collective)return bridge.show(session.pages[index],index);
  return bridge?.enter(session.pages[index],index,session)===true;
 };
 const updateSession=s=>{
  if(!validSession(s)){
   if(session&&joined){bridge?.leave();say('Le professeur a terminé la séance. Tu peux continuer en guidé individuel.')}
   session=null;joined=false;practicing=false;index=-1;render();return;
  }
  if(!sameSession(s)){bridge?.leave();session=s;joined=false;practicing=false;index=-1;}
  else session=s;
  render();
 };
 async function poll(){
  // Aucun appel de découverte côté élève avant son clic explicite.
  // Une fois dans la séance, le suivi léger permet d'activer « Suivant ».
  if(!teacher&&!joined)return;
  if(busy||doc?.hidden||document.hidden)return;
  try{
   const s=await call('status');
   if(s?.ok!==true)throw Error(s?.error||'synchronisation_indisponible');
   lastError='';
   if(!sameSession(s)||session?.revision!==s.revision||!s.active)updateSession(s);
  }catch(e){say('Synchronisation momentanément indisponible. Réessaie.');render()}
 }
 async function write(action,payload={}){
  if(!teacher||isLocked()||busy||!session||!validSession(session))return false;
  busy=true;render();
  try{
   const result=await call(action,{sessionId:session.sessionId,revision:session.revision,...payload});
   if(result?.ok!==true)throw Error(result?.error||'opération refusée');
   const previouslyJoined=joined;
   updateSession(result);
   if(action==='next'&&previouslyJoined&&validSession(session)){
    index=session.pageIndex;joined=true;practicing=false;displayCurrent();
   }
   lastError='';return true;
  }catch(e){say('Action non enregistrée : '+String(e.message||e));await poll();return false}
  finally{busy=false;render()}
 }
 async function join(){
  if(busy)return;
  const inGame=doc?.getElementById('gameScreen')?.classList.contains('hidden')===false;
  if(!joined&&inGame&&bridge?.status()?.training===false){
   if(!confirm('Quitter l’exercice en cours pour rejoindre le guidé collectif ?'))return;
  }
  busy=true;render();
  try{
   // Contrôle de la séance uniquement au clic, jamais à l'ouverture élève.
   const current=await call('status');
   if(current?.ok!==true)throw Error(current?.error||'vérification indisponible');
   updateSession(current);
   if(!validSession(session)){
    say('Aucune séance collective lancée pour ta classe. Continue le guidé individuel.');
    return;
   }
   if(!joined)index=session.pageIndex;
   else if(index>session.pageIndex)index=session.pageIndex;
   joined=true;practicing=false;
   if(!displayCurrent()){
    say('Moteur guidé indisponible. Recharge la page.');
    joined=false;
   }else lastError='';
  }catch(e){
   say('Impossible de vérifier la séance pour le moment. Réessaie.');
  }finally{busy=false;render()}
 }
 async function start(){
  if(!teacher||isLocked()||busy||!bridge||session?.active)return;
  const cfg=bridge.getConfig();
  if(![1,2,3].includes(cfg.level)||!['top','side'].includes(cfg.carryMethod)||!Array.isArray(cfg.multipliers)||!cfg.multipliers.length){say('Choisis le niveau, la méthode et les tables.');return}
  busy=true;render();
  try{
   const result=await call('start',cfg);
   if(!validSession(result))throw Error(result?.error||'démarrage impossible');
   updateSession(result);index=0;joined=true;practicing=false;
   displayCurrent();lastError='';
  }catch(e){say('La séance n’a pas démarré : '+String(e.message||e))}
  finally{busy=false;render()}
 }
 function studentNext(toLatest=false){
  if(!joined||practicing||busy||!validSession(session))return;
  if(toLatest&&!session.allowSkip)return;
  const next=toLatest?session.pageIndex:index+1;
  if(next<=index||next>session.pageIndex)return;
  if(!session.allowSkip&&!bridge?.status()?.finished){say('Termine tes deux calculs avant de continuer.');return}
  index=next;displayCurrent();say('');render();
 }
 function practice(){
  if(!joined||busy)return;
  if(!practicing){bridge?.practice();practicing=true}
  else {practicing=false;displayCurrent()}
  render();
 }
 const hash=async(str)=>{
  const result=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(str));
  return Array.from(new Uint8Array(result),b=>b.toString(16).padStart(2,'0')).join('');
 };
 async function toggleBoard(){
  if(!teacher||busy)return;
  if(!boardLock){
   const pin=prompt('Mode Élève au tableau : choisis un code professeur de 4 à 8 chiffres.');
   if(!pin)return;
   if(!/^\d{4,8}$/.test(pin)){say('Code refusé : saisis 4 à 8 chiffres.');return}
   const salt=crypto.randomUUID(),value={salt,hash:await hash(salt+':'+pin)};
   try{sessionStorage.setItem(lockKey,JSON.stringify(value))}catch{say('Impossible de verrouiller cet appareil.');return}
   boardLock=value;clearAnswers();say('Mode Élève au tableau actif : commandes professeur verrouillées.');
  }else{
   const pin=prompt('Code professeur pour retrouver les commandes :');
   if(pin===null)return;
   if(await hash(boardLock.salt+':'+pin)!==boardLock.hash){say('Code incorrect. Le mode Élève au tableau reste actif.');return}
   boardLock=null;sessionStorage.removeItem(lockKey);say('Commandes professeur rétablies.');
  }
  render();
 }
 function clearAnswers(){
  if(!answerPanel)return;
  answerPanel.querySelectorAll('.mc-result').forEach(e=>e.textContent='');
  if(confirmPanel)confirmPanel.replaceChildren();
  if(answerPanel.tagName==='DETAILS')answerPanel.open=false;
 }
 function showAnswer(i){
  if(!teacher||isLocked()||!validSession(session)||!joined||practicing)return;
  if(!confirmPanel||!answerPanel)return;
  confirmPanel.replaceChildren();
  const promptText=el('span','', 'Révéler la réponse du calcul '+(index*2+i+1)+' ?');
  const yes=button('Oui',()=>{
   if(isLocked())return;
   const operation=session.pages[index]?.[i];
   if(operation)teacherAnswers[i].textContent=String(BigInt(operation.a)*BigInt(operation.m));
   confirmPanel.replaceChildren();
  });
  const no=button('Non',()=>confirmPanel.replaceChildren());
  yes.classList.add('mc-neutral');no.classList.add('mc-neutral');
  // Pas de bouton vert, pas de position privilégiée pour « Oui ».
  const pair=crypto.getRandomValues(new Uint8Array(1))[0]%2?[yes,no]:[no,yes];
  confirmPanel.append(promptText,...pair);
 }
 function render(){
  if(!doc)return;
  const active=validSession(session),locked=isLocked();
  if(menuSlot){
   const inMenu=!doc.getElementById('menuScreen')?.classList.contains('hidden');
   menuSlot.hidden=!teacher||!inMenu;
   menuButton.disabled=busy||locked;
   menuButton.textContent=active?'Reprendre la classe':'👥 Lancer avec la classe';
  }
  const gameVisible=doc.getElementById('gameScreen')?.classList.contains('hidden')===false;
  const inGuided=gameVisible&&bridge?.status()?.training===true;
  const startHere=teacher&&!active&&inGuided;
  const studentJoinHere=!teacher&&inGuided&&!practicing&&(!joined||bridge?.status()?.collective!==true);
  if(bar)bar.hidden=!((active&&(joined||gameVisible))||startHere||studentJoinHere);
  if(btnStartHere){btnStartHere.hidden=!startHere;btnStartHere.disabled=busy||locked}
  if(btnJoinHere){btnJoinHere.hidden=!studentJoinHere;btnJoinHere.disabled=busy}
  if(!active){
   if(notice)notice.textContent=lastError||(startHere
    ?'Guidé individuel · prêt à lancer avec la classe'
    :studentJoinHere?'Guidé individuel · rejoins la classe quand tu le souhaites':'');
   if(teacherRow)teacherRow.hidden=true;
   if(pupilRow)pupilRow.hidden=true;
   if(answerPanel)answerPanel.hidden=true;
   return;
  }
  const phase=bridge?.status();
  if(notice){
   const info=joined?(practicing?'Entraînement libre en attendant':
    'Guidé collectif · page '+(index+1)+' / '+(session.pageIndex+1)):'Séance collective disponible';
   notice.textContent=lastError||info+(teacher?' · Professeur':' · Élève');
  }
  if(teacherRow)teacherRow.hidden=!teacher||!joined;
  if(pupilRow)pupilRow.hidden=teacher||!joined;
  if(teacher){
   if(btnBoard)btnBoard.textContent=locked?'🔒 Déverrouiller professeur':'🔐 Élève au tableau';
   if(teacherNextButton){teacherNextButton.hidden=locked;teacherNextButton.disabled=busy||session.pages.length>=120}
   if(btnSkip){btnSkip.hidden=locked;btnSkip.disabled=busy;btnSkip.textContent=session.allowSkip?'✓ Passage libre autorisé':'Autoriser à passer sans finir'}
   if(btnStop){btnStop.hidden=locked;btnStop.disabled=busy}
   if(answerPanel){answerPanel.hidden=locked||!joined||practicing;if(locked)clearAnswers()}
  }else{
   const can=joined&&!practicing&&canAdvance(phase?.finished===true,session.allowSkip,index,session.pageIndex);
   if(btnNext){btnNext.disabled=busy||!can;btnNext.textContent=index>=session.pageIndex?'En attente du professeur':
    (!phase?.finished&&!session.allowSkip?'Termine avant de continuer':'Suivant →')}
   if(btnCatchup){btnCatchup.hidden=!joined||practicing||!session.allowSkip||index>=session.pageIndex-1;btnCatchup.disabled=busy}
   if(btnPractice){btnPractice.hidden=!joined||practicing;btnPractice.disabled=busy}
   if(btnReturn){btnReturn.hidden=!joined||!practicing;btnReturn.disabled=busy}
  }
 }
 function mount(){
  doc=iframe.contentDocument;bridge=iframe.contentWindow?.MathasGuidedBridge;
  if(!doc||!bridge||!doc.getElementById('menuScreen'))return;
  bridge.onContinue=()=>teacher&&!isLocked()?void write('next'):
   !teacher?studentNext():say('La classe avance uniquement sur décision du professeur.');
  if(!doc.getElementById('mc-guided-styles')){
   const style=el('style');style.id='mc-guided-styles';style.textContent=
    '.mc-guided-slot{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;padding:10px;margin:5px 0 12px}'
   +'.mc-guided-class-badge{display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box;flex:none;min-height:22px;max-width:100%;padding:3px 8px;border:1px solid #6db2c4;border-radius:999px;background:#153f4a;color:#dcf7ff;font:800 11px/1.25 system-ui;text-align:center;white-space:normal}'
   +'.mc-guided-class-badge[hidden]{display:none!important}'
   +'.mc-guided-entry{display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin-top:7px}'

   +'#menuScreen .classic-launch-grid > .mc-guided-launch-row{grid-column:1/-1!important;display:grid!important;grid-template-columns:minmax(0,340px) minmax(135px,175px);align-items:stretch;justify-content:center;gap:10px;width:100%!important;min-width:0!important;margin:0 0 4px!important}'
   +'#menuScreen .classic-launch-grid > .mc-guided-launch-row > #startTraining{grid-column:auto!important;grid-row:auto!important;justify-self:stretch!important;align-self:start!important;width:100%!important;max-width:340px!important;min-width:0!important;margin:0!important}'
   +'#menuScreen .classic-launch-grid > .mc-guided-launch-row > .mc-guided-slot{grid-column:auto!important;min-width:0!important;margin:0!important;padding:0!important;align-items:stretch!important}'
   +'#menuScreen .mc-guided-launch-row .mc-guided-slot > button{width:100%;min-height:58px;line-height:1.25;white-space:normal}'

   +'.mathas-collective-button{padding:10px 13px;border:1px solid #76a8b6;border-radius:11px;background:#173f4c;color:#eaffff;font:700 13px system-ui;cursor:pointer;max-width:100%}'
   +'.mathas-collective-button:disabled{opacity:.44;cursor:not-allowed}'
   +'#mc-guided-bar{position:relative;z-index:9;margin:8px auto;padding:10px;border:1px solid #40aa9e;border-radius:12px;background:#092f35;color:#e8fffc;max-width:1130px}'
   +'#mc-guided-bar[hidden],.mc-guided-slot[hidden],#mc-guided-answers[hidden],.mc-controls[hidden]{display:none!important}'
   +'.mc-controls{display:flex;gap:7px;flex-wrap:wrap;margin-top:8px}.mc-controls .mathas-collective-button{font-size:12px}'
   +'.mc-notice{font:700 13px system-ui;min-height:18px}'
   +'#mc-guided-answers{margin:260px auto 50px;max-width:800px;padding:14px;border:1px solid #355c65;border-radius:13px;background:#08252b}'
   +'#mc-guided-answers summary{cursor:pointer;font-weight:750;color:#b6e7ed}'
   +'.mc-answer-item{display:flex;gap:8px;align-items:center;margin:15px 0}'
   +'.mc-result{font-weight:800;color:#f6dc9b}.mc-confirm{display:flex;gap:9px;flex-wrap:wrap;align-items:center;margin:12px 0}'
   +'.mc-neutral{background:#193d48;border-color:#456b77;color:#e8f1f4}'
   +'body.light .mc-guided-class-badge,body.light-mode .mc-guided-class-badge{background:#e7f6f9;color:#175369;border-color:#75b8ca}'
   +'@media(max-width:700px){#mc-guided-bar{margin:6px;padding:8px}.mc-controls{gap:5px}.mathas-collective-button{padding:9px 10px}}'
   +'@media(max-width:520px){#menuScreen .classic-launch-grid > .mc-guided-launch-row{grid-template-columns:minmax(0,1fr) minmax(100px,41%);gap:6px}#menuScreen .mc-guided-launch-row .mc-guided-slot > button{font-size:clamp(.7rem,2.7vw,.82rem);padding:6px!important;min-height:49px}}';
   doc.head.append(style);
  }
  // Le menu des élèves reste identique ; seule la version professeur possède
  // un deuxième bouton, aligné à droite du grand « Exercice guidé ».
  const training=doc.getElementById('startTraining');
  if(teacher&&training){
   menuSlot=el('div','mc-guided-slot');menuSlot.id='mc-guided-slot';
   menuButton=button('',()=>session?.active?void join():void start());
   menuSlot.append(menuButton,classBadge());
   const layout=el('div','mc-guided-launch-row');
   training.replaceWith(layout);
   layout.append(training,menuSlot);
  }
  training?.addEventListener('click',()=>requestAnimationFrame(render));
  bar=el('div');bar.id='mc-guided-bar';
  notice=el('div','mc-notice');
  teacherRow=el('div','mc-controls');
  pupilRow=el('div','mc-controls');
  teacherNextButton=button('Suivant →',()=>void write('next'));
  btnSkip=button('Autoriser à passer sans finir',()=>void write('set-skip',{allowSkip:!session.allowSkip}));
  btnStop=button('Terminer la séance',()=>{
   if(!isLocked()&&confirm('Terminer le guidé collectif pour toute la classe ?'))void write('stop');
  });
  btnBoard=button('🔐 Élève au tableau',()=>void toggleBoard());
  teacherRow.append(teacherNextButton,btnSkip,btnStop,btnBoard);
  const studentNextButton=button('Suivant →',()=>studentNext());
  // Évite de partager les mêmes éléments entre deux rangées.
  btnNext=studentNextButton;
  const pupilCatchup=button('Rejoindre le tableau',()=>studentNext(true));
  btnCatchup=pupilCatchup;
  btnPractice=button('M’entraîner en attendant',practice);
  const pupilReturn=button('Rejoindre la classe',practice);
  pupilRow.append(studentNextButton,pupilCatchup,btnPractice,pupilReturn);
  btnReturn=pupilReturn;
  // La rangée du professeur utilise sa commande propre, jamais le bouton élève.
  teacherRow.dataset.role='teacher';
  btnStartHere=button('👥 Démarrer avec la classe',()=>void start());
  btnJoinHere=button('Rejoindre la classe',()=>void join());
  const entry=el('div','mc-guided-entry');barClassBadge=classBadge();
  entry.append(btnStartHere,btnJoinHere,barClassBadge);
  bar.append(notice,entry,teacherRow,pupilRow);
  doc.getElementById('gameScreen')?.prepend(bar);
  answerPanel=el('details');answerPanel.id='mc-guided-answers';
  const summary=el('summary','', 'Outils professeur · corrigés (déplier uniquement en dehors du tableau)');
  answerPanel.append(summary);
  for(let i=0;i<2;i++){
   const item=el('div','mc-answer-item');
   const b=button('Afficher réponse · calcul '+(i+1),()=>showAnswer(i));
   const result=el('span','mc-result');
   teacherAnswers[i]=result;item.append(b,result);answerPanel.append(item);
  }
  confirmPanel=el('div','mc-confirm');answerPanel.append(confirmPanel);
  doc.getElementById('gameScreen')?.append(answerPanel);
  if(!teacher)answerPanel.hidden=true;
  if(teacher){
   // Références professeur dédiées, le bouton élève ne doit jamais publier une page.
   setInterval(render,950);
  }else setInterval(render,950);
  if(!started){
   started=true;setInterval(()=>{if(!document.hidden)void poll()},8000);
   document.addEventListener('visibilitychange',()=>{if(!document.hidden)void poll()});
   window.addEventListener('focus',()=>void poll());
  }
  void poll();render();
 }
 return {mount,refresh:poll};
}
