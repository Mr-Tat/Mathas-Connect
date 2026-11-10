import {validSession,canReachPage,mandatoryBlocker} from './collective-contract.mjs?v=20261110-v2';

// Contrôleur visuel du guidé collectif : mêmes nombres, copies individuelles.
// Il ne transmet jamais les chiffres saisis par les élèves.
export function createMultiplicationCollective({iframe,teacher,call,onClose,classId,classLabel=''}){
 let doc=null,bridge=null,session=null,joined=false,practicing=false,index=-1,busy=false;
 let menuSlot=null,menuButton=null,bar=null,notice=null,teacherRow=null,pupilRow=null,barClassBadge=null;
 let btnNext=null,btnPrev=null,teacherNextButton=null,teacherPrevButton=null,btnStartHere=null,btnJoinHere=null,btnRequired=null,btnStop=null,btnAnswers=null,btnPractice=null,btnReturn=null,btnCatchup=null;
 let answerPanel=null,teacherAnswers=[],confirmPanel=null,answersVisible=false,started=false,lastError='';
 // Clé propre à l'onglet. Elle survit à F5, pas à une ouverture ordinaire
 // dans un nouvel onglet (aucune donnée élève stockée ici).
 const hostKey='mathas.mul.guided.host-tab.'+classId;
 let hostId=null;
 const pageId=teacher?crypto.randomUUID():null;
 if(teacher){
  try{
   const stored=sessionStorage.getItem(hostKey);
   hostId=/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(stored||'')?stored:crypto.randomUUID();
   sessionStorage.setItem(hostKey,hostId);
  }catch{hostId=crypto.randomUUID()}
 }
 // Plus de mode « Élève au tableau » : le professeur garde ses propres commandes.
 // Les corrigés demandent une confirmation neutre, indépendante du score.
 const say=msg=>{lastError=msg;if(notice)notice.textContent=msg;};
 const el=(tag,cls,text)=>{const x=doc.createElement(tag);if(cls)x.className=cls;if(text!==undefined)x.textContent=text;return x};
 const button=(label,fn)=>{const x=el('button','mathas-collective-button',label);x.type='button';x.addEventListener('click',fn);return x};
 const classBadge=()=>{
  const node=el('span','mc-guided-class-badge',classLabel);
  node.hidden=!classLabel;
  node.title=classLabel+' · classe utilisée pour le guidé collectif';
  return node;
 };
  const sameSession=s=>session?.sessionId===s?.sessionId;
 const required=()=>Array.isArray(session?.requiredPages)?session.requiredPages:[];
 const pageFinished=i=>bridge?.isFinished(i)===true;
 const canOpen=i=>canReachPage({
  current:index,target:i,unlocked:session?.pageIndex??-1,
  requiredPages:required(),isFinished:pageFinished
 });
 function hideAnswers(){
  answersVisible=false;
  if(confirmPanel)confirmPanel.replaceChildren();
  if(answerPanel)answerPanel.hidden=true;
  if(btnAnswers)btnAnswers.textContent='Afficher les réponses';
 }
 function revealAnswers(){
  if(!teacher||!joined||!validSession(session)||busy||!confirmPanel)return;
  if(answersVisible){hideAnswers();render();return}
  confirmPanel.replaceChildren();
  const label=el('span','', 'Afficher les deux réponses de cette page ?');
  const yes=button('Oui',()=>{
   if(!validSession(session)||!teacher)return;
   const current=session.pages[index];
   if(!Array.isArray(current))return;
   for(let i=0;i<2;i++)teacherAnswers[i].textContent=
     'Calcul '+(i+1)+' : '+current[i].a+' × '+current[i].m+' = '+(BigInt(current[i].a)*BigInt(current[i].m)).toString();
   answersVisible=true;
   confirmPanel.replaceChildren();render();
  });
  const no=button('Non',()=>confirmPanel.replaceChildren());
  yes.classList.add('mc-neutral');no.classList.add('mc-neutral');
  const buttons=crypto.getRandomValues(new Uint8Array(1))[0]%2?[yes,no]:[no,yes];
  confirmPanel.append(label,...buttons);
 }
 const displayCurrent=()=>{
  if(!validSession(session)||index<0||index>=session.pages.length)return false;
  const inGame=doc?.getElementById('gameScreen')?.classList.contains('hidden')===false;
  if(inGame&&bridge?.status()?.collective)return bridge.show(session.pages[index],index);
  return bridge?.enter(session.pages[index],index,session)===true;
 };
 const updateSession=s=>{
  if(!validSession(s)){
   if(session&&joined){bridge?.leave();say('Le professeur a terminé la séance. Tu peux continuer en guidé individuel.')}
   if(session)bridge?.resetSaved();
   session=null;joined=false;practicing=false;index=-1;hideAnswers();render();return;
  }
  if(!sameSession(s)){
   bridge?.resetSaved();session=s;joined=false;practicing=false;index=-1;hideAnswers();
  }else session=s;
  render();
 };
 async function poll(){
  // Aucun appel de découverte côté élève avant son clic explicite.
  // Une fois dans la séance, le suivi léger permet d'activer « Suivant ».
  if(!teacher&&!joined)return;
  if(busy||doc?.hidden||document.hidden)return;
  try{
   const s=await call('status',{hostId});
   if(s?.ok!==true)throw Error(s?.error||'synchronisation_indisponible');
   lastError='';
   if(!sameSession(s)||session?.revision!==s.revision||!s.active)updateSession(s);
  }catch(e){say('Synchronisation momentanément indisponible. Réessaie.');render()}
 }
 async function write(action,payload={}){
  if(!teacher||busy||!session||!validSession(session))return false;
  busy=true;render();
  try{
   const result=await call(action,{sessionId:session.sessionId,revision:session.revision,hostId,pageId,...payload});
   if(result?.ok!==true)throw Error(result?.error||'opération refusée');
   const previouslyJoined=joined;
   updateSession(result);
   if((action==='next'||action==='set-page')&&previouslyJoined&&validSession(session)){
    index=session.teacherPageIndex??session.pageIndex;
    joined=true;practicing=false;hideAnswers();displayCurrent();
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
   const current=await call('status',{hostId});
   if(current?.ok!==true)throw Error(current?.error||'vérification indisponible');
   updateSession(current);
   if(!validSession(session)){
    say('Aucune séance collective lancée pour ta classe. Continue le guidé individuel.');
    return;
   }
   if(!joined){
    const wanted=session.teacherPageIndex??session.pageIndex;
    // Un élève arrivé tard ne doit pas contourner une page obligatoire.
    index=teacher?wanted:required().filter(i=>i<=wanted&&!pageFinished(i)).sort((a,b)=>a-b)[0]??wanted;
   }else if(index>session.pageIndex)index=session.pageIndex;
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
  if(!teacher||busy||!bridge||session?.active)return;
  const cfg=bridge.getConfig();
  if(![1,2,3].includes(cfg.level)||!['top','side'].includes(cfg.carryMethod)||!Array.isArray(cfg.multipliers)||!cfg.multipliers.length){say('Choisis le niveau, la méthode et les tables.');return}
  busy=true;render();
  try{
   const result=await call('start',{...cfg,hostId,pageId});
   if(!validSession(result))throw Error(result?.error||'démarrage impossible');
   updateSession(result);index=0;joined=true;practicing=false;
   displayCurrent();lastError='';
  }catch(e){say('La séance n’a pas démarré : '+String(e.message||e))}
  finally{busy=false;render()}
 }
 // La présence continue pendant qu'un autre onglet est au premier plan :
 // NE PAS déduire une fermeture de document.hidden / visibilitychange.
 async function keepTeacherPresence(){
  if(!teacher||!hostId||!session?.active)return;
  try{await call('heartbeat',{sessionId:session.sessionId,hostId,pageId})}
  catch{ /* Une microcoupure n'arrête pas la classe ; délai de secours serveur. */ }
 }
 function studentNext(toLatest=false){
  if(!joined||practicing||busy||!validSession(session))return;
  const next=toLatest?session.pageIndex:index+1;
  if(next<=index||next>session.pageIndex)return;
  if(!canOpen(next)){
   const blocker=mandatoryBlocker({target:next,requiredPages:required(),isFinished:pageFinished});
   say(blocker===null?'Cette page n’est pas encore accessible.':
     'Termine et réussis la page '+(blocker+1)+' (ses deux calculs) pour avancer.');
   render();return;
  }
  index=next;hideAnswers();displayCurrent();say('');render();
 }
 function studentPrevious(){
  if(!joined||practicing||busy||index<=0)return;
  index--;hideAnswers();displayCurrent();say('');render();
 }
 function teacherNext(){
  if(!teacher||busy||!validSession(session)||!joined)return;
  void(index<session.pageIndex
   ?write('set-page',{pageIndex:index+1}):write('next'));
 }
 function teacherPrevious(){
  if(!teacher||busy||!validSession(session)||index<=0)return;
  void write('set-page',{pageIndex:index-1});
 }
 function practice(){
  if(!joined||busy)return;
  if(!practicing){bridge?.practice();practicing=true}
  else {practicing=false;displayCurrent()}
  render();
 }
 function render(){
  if(!doc)return;
  const active=validSession(session);
  const gameVisible=doc.getElementById('gameScreen')?.classList.contains('hidden')===false;
  const inGuided=gameVisible&&bridge?.status()?.training===true;
  // Même entrée professeur/élève : d'abord « Exercice guidé », ensuite la classe.
  const startHere=teacher&&inGuided&&!joined;
  const studentJoinHere=!teacher&&inGuided&&!practicing&&(!joined||bridge?.status()?.collective!==true);
  if(bar)bar.hidden=!((active&&joined&&gameVisible)||startHere||studentJoinHere);
  if(btnStartHere){
   btnStartHere.hidden=!startHere;btnStartHere.disabled=busy;
   btnStartHere.textContent=active?'Reprendre la séance':'👥 Lancer la séance';
  }
  if(btnJoinHere){btnJoinHere.hidden=!studentJoinHere;btnJoinHere.disabled=busy}
  if(!active){
   if(notice)notice.textContent=lastError||(startHere
    ?'Guidé individuel · lance ta séance collective'
    :studentJoinHere?'Guidé individuel · rejoins la classe quand tu le souhaites':'');
   if(teacherRow)teacherRow.hidden=true;
   if(pupilRow)pupilRow.hidden=true;
   hideAnswers();return;
  }
  if(notice){
   const text=joined?(practicing?'Entraînement libre en attendant':
    'Guidé collectif · page '+(index+1)+' / '+(session.pageIndex+1)):'Séance collective disponible';
   const mandatory=joined&&required().includes(index)?' · PAGE OBLIGATOIRE':'';
   notice.textContent=lastError||text+mandatory+(teacher?' · Professeur':' · Élève');
  }
  if(teacherRow)teacherRow.hidden=!teacher||!joined;
  if(pupilRow)pupilRow.hidden=teacher||!joined;
  if(teacher){
   if(teacherPrevButton)teacherPrevButton.disabled=busy||index<=0;
   if(teacherNextButton){
    teacherNextButton.disabled=busy||(index>=session.pageIndex&&session.pages.length>=120);
    teacherNextButton.textContent=index<session.pageIndex?'Page suivante →':'Nouvelle page →';
   }
   if(btnRequired){
    const on=required().includes(index);
    btnRequired.disabled=busy;
    btnRequired.textContent=on?'✓ Page obligatoire':'Page obligatoire';
    btnRequired.setAttribute('aria-pressed',String(on));
   }
   if(btnStop)btnStop.disabled=busy;
   if(btnAnswers){btnAnswers.disabled=busy;btnAnswers.textContent=answersVisible?'Masquer les réponses':'Afficher les réponses'}
   if(answerPanel)answerPanel.hidden=!answersVisible;
  }else{
   const next=index+1;
   const can=joined&&!practicing&&canOpen(next);
   const blocker=mandatoryBlocker({target:next,requiredPages:required(),isFinished:pageFinished});
   if(btnNext){
    btnNext.disabled=busy||!can;
    btnNext.textContent=index>=session.pageIndex?'En attente du professeur':
     blocker!==null?'Page '+(blocker+1)+' obligatoire':'Suivant →';
   }
   if(btnPrev)btnPrev.disabled=busy||!joined||practicing||index<=0;
   if(btnCatchup){
    btnCatchup.hidden=!joined||practicing||index>=session.pageIndex-1;
    btnCatchup.disabled=busy||!canOpen(session.pageIndex);
   }
   if(btnPractice){btnPractice.hidden=!joined||practicing;btnPractice.disabled=busy}
   if(btnReturn){btnReturn.hidden=!joined||!practicing;btnReturn.disabled=busy}
  }
 }
 function mount(){
  doc=iframe.contentDocument;bridge=iframe.contentWindow?.MathasGuidedBridge;
  if(!doc||!bridge||!doc.getElementById('menuScreen'))return;
  bridge.onContinue=()=>teacher?teacherNext():studentNext();
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
   +'#mc-guided-answers[hidden]{display:none!important}'
   +'#mc-guided-answers summary{cursor:pointer;font-weight:750;color:#b6e7ed}'
   +'.mc-answer-item{display:flex;gap:8px;align-items:center;margin:15px 0}'
   +'.mc-result{font-weight:800;color:#f6dc9b}.mc-confirm{display:flex;gap:9px;flex-wrap:wrap;align-items:center;margin:12px 0}'
   +'.mc-neutral{background:#193d48;border-color:#456b77;color:#e8f1f4}'
   +'.mc-guided-answers{display:flex;flex-direction:column;gap:6px;margin-top:8px;padding:9px 12px;border:1px solid #6d9ca9;border-radius:10px;background:#102f39}'
   +'.mc-guided-answers .mc-result{display:block}'
   +'.mc-guided-required[aria-pressed="true"]{border-color:#ffc36a;background:#5f411b;color:#fff4db}'
   +'.mc-confirm:empty{display:none}'
   +'body.light .mc-guided-class-badge,body.light-mode .mc-guided-class-badge{background:#e7f6f9;color:#175369;border-color:#75b8ca}'
   +'@media(max-width:700px){#mc-guided-bar{margin:6px;padding:8px}.mc-controls{gap:5px}.mathas-collective-button{padding:9px 10px}}'
   +'@media(max-width:520px){#menuScreen .classic-launch-grid > .mc-guided-launch-row{grid-template-columns:minmax(0,1fr) minmax(100px,41%);gap:6px}#menuScreen .mc-guided-launch-row .mc-guided-slot > button{font-size:clamp(.7rem,2.7vw,.82rem);padding:6px!important;min-height:49px}}';
   doc.head.append(style);
  }
  // Un seul chemin pédagogique pour tous : « Exercice guidé ».
  // Les commandes de séance sont dans le jeu, jamais à côté du bouton du menu.
  const training=doc.getElementById('startTraining');
  training?.addEventListener('click',()=>requestAnimationFrame(render));
  bar=el('div');bar.id='mc-guided-bar';
  notice=el('div','mc-notice');
  teacherRow=el('div','mc-controls');
  pupilRow=el('div','mc-controls');
  teacherPrevButton=button('← Précédente',teacherPrevious);
  teacherNextButton=button('Nouvelle page →',teacherNext);
  btnRequired=button('Page obligatoire',()=>void write('set-required',{
   pageIndex:index,required:!required().includes(index)
  }));
  btnRequired.classList.add('mc-guided-required');
  btnAnswers=button('Afficher les réponses',revealAnswers);
  btnStop=button('Terminer la séance',()=>{
   if(confirm('Terminer le guidé collectif pour toute la classe ?'))void write('stop');
  });
  teacherRow.append(teacherPrevButton,teacherNextButton,btnRequired,btnAnswers,btnStop);
  teacherRow.dataset.role='teacher';
  btnPrev=button('← Précédente',studentPrevious);
  btnNext=button('Suivant →',()=>studentNext());
  btnCatchup=button('Dernière page →',()=>studentNext(true));
  btnPractice=button('M’entraîner en attendant',practice);
  btnReturn=button('Rejoindre la classe',practice);
  pupilRow.append(btnPrev,btnNext,btnCatchup,btnPractice,btnReturn);
  btnStartHere=button('👥 Lancer la séance',()=>session?.active?void join():void start());
  btnJoinHere=button('Rejoindre la classe',()=>void join());
  const entry=el('div','mc-guided-entry');barClassBadge=classBadge();
  entry.append(btnStartHere,btnJoinHere,barClassBadge);
  confirmPanel=el('div','mc-confirm');
  answerPanel=el('div','mc-guided-answers');answerPanel.id='mc-guided-answers';
  answerPanel.hidden=true;
  for(let i=0;i<2;i++){
   teacherAnswers[i]=el('span','mc-result');
   answerPanel.append(teacherAnswers[i]);
  }
  bar.append(notice,entry,teacherRow,confirmPanel,answerPanel,pupilRow);
  doc.getElementById('gameScreen')?.prepend(bar);
  if(teacher){
   // Références professeur dédiées, le bouton élève ne doit jamais publier une page.
   setInterval(render,950);
  }else setInterval(render,950);
  if(!started){
   started=true;setInterval(()=>{if(!document.hidden)void poll()},8000);
   document.addEventListener('visibilitychange',()=>{
    if(!document.hidden)void poll();
    else if(teacher)void keepTeacherPresence();
   });
   window.addEventListener('focus',()=>void poll());
   if(teacher){
    setInterval(()=>{void keepTeacherPresence()},25000);
    window.addEventListener('pagehide',event=>{
     if(event.persisted||!session?.active||!hostId)return;
     // Page vraiment quittée ou fermée : un changement d'onglet n'émet
     // PAS pagehide. Recharger conserve la session grâce au délai serveur.
     try{onClose?.({sessionId:session.sessionId,hostId,pageId})}catch{}
    });
   }
  }
  if(teacher){
   // Seul un VRAI nouveau chargement relance l'onglet après F5.
   // Un statut déjà en vol ne peut pas annuler une fermeture de page.
   void call('resume',{hostId,pageId})
    .then(s=>{if(s?.ok===true)updateSession(s)})
    .catch(()=>{})
    .finally(()=>{void poll()});
  }else void poll();
  render();
 }
 return {mount,refresh:poll};
}
