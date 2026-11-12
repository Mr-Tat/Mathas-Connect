import {validSession,mayMoveForward,latestUnlockedPage} from './collective-contract.mjs?v=20261110-v3';
import {createGuidedDraftStore} from './collective-draft.mjs?v=20261110-v1';

// Contrôleur visuel du guidé collectif : mêmes nombres, copies individuelles.
// Il ne transmet jamais les chiffres saisis par les élèves.
export function createSubtractionCollective({iframe,teacher,call,onClose,classId,classLabel='',storage=null,studentId=''}){
 let doc=null,bridge=null,session=null,joined=false,practicing=false,index=-1,busy=false;
 let bar=null,notice=null,entry=null,teacherRow=null,pupilRow=null,barClassBadge=null;
 let btnNext=null,btnPrevious=null,teacherNextButton=null,teacherPreviousButton=null,btnStartHere=null,btnJoinHere=null,btnRequired=null,btnStop=null,btnAnswers=null,btnPractice=null,btnReturn=null;
 let answerPanel=null,answerVisible=false,confirmPanel=null,started=false,lastError='';
 // sessionStorage appartient à cet onglet seulement. Le compte élève authentifié
 // et la classe isolent les brouillons ; l'UUID de la séance les invalide.
 const drafts=teacher?null:createGuidedDraftStore({storage,classId,studentId});
 let restoredSessionId=null,saveTimer=null;
 let teacherPresenceTimer=null;
 const syncTeacherPresence=()=>{
  if(!teacher)return;
  if(session?.active&&teacherPresenceTimer===null){
   teacherPresenceTimer=setInterval(()=>{void keepTeacherPresence()},25000);
  }else if(!session?.active&&teacherPresenceTimer!==null){
   clearInterval(teacherPresenceTimer);teacherPresenceTimer=null;
  }
 };
 // Clé propre à l'onglet. Elle survit à F5, pas à une ouverture ordinaire
 // dans un nouvel onglet (aucune donnée élève stockée ici).
 const hostKey='mathas.sub.guided.host-tab.'+classId;
 let hostId=null;
 const pageId=teacher?crypto.randomUUID():null;
 if(teacher){
  try{
   const stored=sessionStorage.getItem(hostKey);
   hostId=/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(stored||'')?stored:crypto.randomUUID();
   sessionStorage.setItem(hostKey,hostId);
  }catch{hostId=crypto.randomUUID()}
 }
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
 const saveDraft=()=>{
  if(!drafts?.enabled||!joined||!validSession(session)||index<0)return false;
  return drafts.save(session,index,bridge?.snapshot?.()||[]);
 };
 // Les touches du pavé peuvent déclencher plusieurs événements successifs.
 // Regrouper les écritures plutôt que sérialiser toutes les pages à chaque touche.
 const queueDraft=()=>{
  if(!drafts?.enabled||!joined||practicing)return;
  if(saveTimer!==null)clearTimeout(saveTimer);
  saveTimer=setTimeout(()=>{saveTimer=null;saveDraft()},300);
 };
 const flushDraft=()=>{
  if(saveTimer!==null){clearTimeout(saveTimer);saveTimer=null}
  saveDraft();
 };
 const restoreDraft=()=>{
  if(!drafts?.enabled||!validSession(session)||restoredSessionId===session.sessionId)return null;
  restoredSessionId=session.sessionId;
  const saved=drafts.read(session);
  if(!saved||!bridge?.restoreSnapshot)return null;
  const count=bridge.restoreSnapshot(saved.pages,session);
  return count>0?saved.pageIndex:null;
 };
 const displayCurrent=()=>{
  if(!validSession(session)||index<0||index>=session.pages.length)return false;
  const inGame=doc?.getElementById('gameScreen')?.classList.contains('hidden')===false;
  if(inGame&&bridge?.status()?.collective)return bridge.show(session.pages[index],index);
  return bridge?.enter(session.pages[index],index,session)===true;
 };
 const updateSession=s=>{
  if(!validSession(s)){
   if(session&&joined){bridge?.leave();say('Le professeur a terminé la séance. Tu peux continuer en guidé individuel.')}
   drafts?.clear();restoredSessionId=null;
   session=null;joined=false;practicing=false;index=-1;syncTeacherPresence();render();return;
  }
  if(!sameSession(s)){bridge?.leave();bridge?.useSession?.(s.sessionId);session=s;joined=false;practicing=false;index=-1;restoredSessionId=null;clearAnswers();}
  else session=s;
  syncTeacherPresence();render();
 };
 async function poll(){
  // Aucune découverte périodique. Garder cette lecture explicite pour
  // les tests, les erreurs de commande et la reprise professeur.
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
   if((action==='next'||action==='previous')&&previouslyJoined&&validSession(session)){
    index=session.pageIndex;joined=true;practicing=false;clearAnswers();displayCurrent();
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
    const savedPage=teacher?null:restoreDraft();
    index=Number.isInteger(savedPage)?Math.min(savedPage,latestUnlockedPage(session)):session.pageIndex;
    // Une arrivée tardive commence à la première page obligatoire non réussie.
    // Sinon, elle rejoint directement la page que le professeur affiche.
    if(!teacher){
     for(let p=0;p<index;p++){
      if(session.requiredPages[p]&&bridge?.finishedAt?.(p)!==true){index=p;break}
     }
    }
   }else if(index>latestUnlockedPage(session))index=latestUnlockedPage(session);
   joined=true;practicing=false;
   if(!displayCurrent()){
    say('Moteur guidé indisponible. Recharge la page.');
    joined=false;
   }else{lastError='';saveDraft()}
  }catch(e){
   say('Impossible de vérifier la séance pour le moment. Réessaie.');
  }finally{busy=false;render()}
 }
 async function start(){
  if(!teacher||busy||!bridge||session?.active)return;
  const cfg=bridge.getConfig();
  if(![1,2,3].includes(cfg.level)||!['addBottom','takeTop'].includes(cfg.borrowMethod)){say('Choisis le niveau et la méthode d’emprunt.');return}
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
 async function studentNext(){
  if(!joined||practicing||busy||!validSession(session))return;
  // C'est le clic « Suivant » qui vérifie les nouveautés et les
  // obligations, même si la page suivante n'était pas connue localement.
  busy=true;render();
  try{
   const current=await call('status',{hostId});
   if(current?.ok!==true)throw Error(current?.error||'vérification indisponible');
   updateSession(current);
   if(!validSession(session)){
    say('La séance collective est terminée. Continue le guidé individuel.');
    return;
   }
   const next=index+1;
   if(next>latestUnlockedPage(session)){
    say('Le professeur n’a pas encore ouvert la page suivante.');
    return;
   }
   if(!mayMoveForward({
    session,from:index,to:next,isFinished:page=>bridge?.finishedAt?.(page)===true
   })){
    say('Page obligatoire : réussis les deux calculs avant de continuer.');
    return;
   }
   index=next;displayCurrent();saveDraft();lastError='';
  }catch(e){
   say('Impossible de vérifier la suite pour le moment. Réessaie.');
  }finally{busy=false;render()}
 }
 function studentPrevious(){
  if(!joined||practicing||busy||index<=0)return;
  index--;displayCurrent();saveDraft();say('');render();
 }
 function practice(){
  if(!joined||busy)return;
  if(!practicing){bridge?.practice();practicing=true}
  else {practicing=false;displayCurrent()}
  saveDraft();render();
 }
 // Corrigé visuel : lignes ajoutées APRÈS les cases de saisie, sans jamais
 // écrire dans un input ou dans l'état de correction du moteur natif.
 function removeAnswerComparison(){
  doc?.querySelectorAll('#calculationsPair .mc-guided-answer-overlay').forEach(node=>node.remove());
 }
 function showAnswerComparison(){
  if(!teacher||!joined||practicing||!validSession(session))return false;
  const current=session.pages[index];
  if(!Array.isArray(current)||current.length!==2)return false;
  const rows=[];
  for(let i=0;i<2;i++){
   const op=doc.querySelector('#calculationsPair .operation[data-calc="'+i+'"]');
   if(!op)return false;
   const {a,b}=current[i];
   const answer=(BigInt(a)-BigInt(b)).toString().padStart(a.length,'0');
   const inputs=op.querySelectorAll('.answer-input');
   if(!inputs.length||inputs.length<answer.length)return false;
   const length=inputs.length;
   const count=a.length;
   const needed=Array(count).fill(false);
   let borrow=0;
   for(let c=0;c<count;c++){
    const top=Number(a[a.length-1-c]||0),bottom=Number(b[b.length-1-c]||0);
    needed[c]=top<bottom+borrow;
    borrow=needed[c]?1:0;
   }
   const resultMarker=el('div','mc-guided-answer-overlay mc-guided-answer-marker','=');
   resultMarker.title='Résultat correct à comparer avec les cases au-dessus';
   const reportMarker=el('div','mc-guided-answer-overlay mc-guided-report-marker','r');
   reportMarker.title='Emprunts corrects, alignés sur les mêmes colonnes';
   const elements=[resultMarker];
   for(let c=length-1;c>=0;c--){
    const digit=answer[answer.length-1-c]||'';
    const cell=el('div','mc-guided-answer-overlay mc-guided-answer-digit group-shift',digit);
    cell.dataset.calc=String(i);cell.dataset.col=String(c);
    cell.style.setProperty('--group-step',String(Math.floor(c/3)));
    cell.setAttribute('aria-label','Résultat correct, colonne '+(c+1)+': '+(digit||'vide'));
    elements.push(cell);
   }
   elements.push(reportMarker);
   for(let c=length-1;c>=0;c--){
    // Les reports du moteur sont les retenues entrantes dans la colonne c.
    // Pas de report pour l'unité ni de zéro affiché inutilement.
    const digit=c>=1&&c<count&&needed[c-1]
      ?session.borrowMethod==='addBottom'?'1'
       :String(Number(a[a.length-1-c]||0)+(needed[c]?10:0)-1)
      :'';
    const cell=el('div','mc-guided-answer-overlay mc-guided-report-digit group-shift',digit);
    cell.dataset.calc=String(i);cell.dataset.col=String(c);
    cell.style.setProperty('--group-step',String(Math.floor(c/3)));
    cell.setAttribute('aria-label','Report correct, colonne '+(c+1)+': '+(digit||'aucun'));
    elements.push(cell);
   }
   rows.push({op,elements});
  }
  removeAnswerComparison();
  rows.forEach(({op,elements})=>op.append(...elements));
  return true;
 }
 function clearAnswers(){
  answerVisible=false;
  removeAnswerComparison();
  if(confirmPanel)confirmPanel.replaceChildren();
  if(answerPanel)answerPanel.hidden=true;
 }
 function toggleAnswers(){
  if(!teacher||busy||!joined||practicing||!validSession(session))return;
  if(answerVisible){clearAnswers();render();return}
  if(!confirmPanel)return;
  confirmPanel.replaceChildren();
  const label=el('span','', 'Afficher le résultat et les emprunts sous les cases des deux calculs ?');
  const yes=button('Oui',()=>{
   if(!teacher||!validSession(session))return;
   confirmPanel.replaceChildren();
   if(!showAnswerComparison()){
    clearAnswers();
    say('Impossible d’afficher les réponses sur cette page. Recharge le jeu.');
    render();return;
   }
   answerVisible=true;render();
  });
  const no=button('Non',()=>{clearAnswers();render()});
  yes.classList.add('mc-neutral');no.classList.add('mc-neutral');
  // Oui et Non : même présentation, ordre non constant.
  const pair=crypto.getRandomValues(new Uint8Array(1))[0]%2?[yes,no]:[no,yes];
  confirmPanel.append(label,...pair);
  render();
 }
 function render(){
  if(!doc)return;
  const active=validSession(session);
  const gameVisible=doc.getElementById('gameScreen')?.classList.contains('hidden')===false;
  const inGuided=gameVisible&&bridge?.status()?.training===true;
  const startHere=teacher&&!active&&inGuided;
  const studentJoinHere=!teacher&&inGuided&&!practicing&&!joined;
  const joinHere=(active&&inGuided&&!practicing&&!joined)||studentJoinHere;
  if(bar)bar.hidden=!((active&&(joined||inGuided))||startHere||studentJoinHere);
  if(btnStartHere){btnStartHere.hidden=!startHere;btnStartHere.disabled=busy}
  if(btnJoinHere){btnJoinHere.hidden=!joinHere;btnJoinHere.disabled=busy;
   btnJoinHere.textContent=teacher?'Reprendre la séance':'Rejoindre la classe'}
  // Ne pas réserver de hauteur pour une ligne dont les commandes sont masquées.
  if(entry)entry.hidden=!startHere&&!joinHere;
  if(!active){
   if(notice)notice.textContent=lastError||(startHere
    ?'Guidé individuel · lance la séance collective pour ta classe'
    :inGuided&&!teacher?'Guidé individuel · rejoins la classe quand tu le souhaites':'');
   if(teacherRow)teacherRow.hidden=true;
   if(pupilRow)pupilRow.hidden=true;
   if(answerVisible||confirmPanel?.childNodes.length)clearAnswers();
   return;
  }
  if(notice){
   const info=joined?(practicing?'Entraînement libre en attendant':
    'Guidé collectif · page '+(index+1)+' / '+session.pages.length+
    (session.requiredPages[index]?' · Page obligatoire':'')):'Séance collective disponible';
   notice.textContent=lastError||info+(teacher?' · Professeur':' · Élève');
  }
  if(teacherRow)teacherRow.hidden=!teacher||!joined;
  if(pupilRow)pupilRow.hidden=teacher||!joined;
  if(teacher){
   if(teacherPreviousButton)teacherPreviousButton.disabled=busy||index<=0;
   if(teacherNextButton){
    teacherNextButton.disabled=busy||(index>=session.pages.length-1&&session.pages.length>=120);
    teacherNextButton.textContent=index<session.pages.length-1?'Page suivante →':'Nouvelle page →';
   }
   if(btnRequired){btnRequired.disabled=busy;
    btnRequired.textContent=session.requiredPages[index]?'✓ Page obligatoire':'□ Page obligatoire';
    btnRequired.setAttribute('aria-pressed',String(session.requiredPages[index]));
   }
   if(btnAnswers){btnAnswers.disabled=busy;btnAnswers.textContent=answerVisible?'Masquer les réponses':'Afficher les réponses'}
   if(btnStop)btnStop.disabled=busy;
   if(answerPanel)answerPanel.hidden=!joined||practicing||!confirmPanel?.childNodes.length;
  }else{
   const unlocked=latestUnlockedPage(session);
   if(btnPrevious)btnPrevious.disabled=busy||!joined||practicing||index<=0;
   if(btnNext){
    // Toujours cliquable : aucune interrogation automatique en arrière-plan.
    btnNext.disabled=busy||!joined||practicing;
    btnNext.textContent=index>=unlocked?'Vérifier la suite →':'Suivant →';
   }
   if(btnPractice){btnPractice.hidden=!joined||practicing;btnPractice.disabled=busy}
   if(btnReturn){btnReturn.hidden=!joined||!practicing;btnReturn.disabled=busy}
  }
 }
 function mount(){
  doc=iframe.contentDocument;bridge=iframe.contentWindow?.MathasGuidedBridge;
  if(!doc||!bridge||!doc.getElementById('menuScreen'))return;
  bridge.onContinue=()=>teacher?void write('next'):
   !teacher?studentNext():say('La classe avance uniquement sur décision du professeur.');
  if(!doc.getElementById('mc-guided-styles')){
   const style=el('style');style.id='mc-guided-styles';style.textContent=
    '.mc-guided-head{display:flex;align-items:center;justify-content:flex-start;gap:12px;flex-wrap:wrap;min-width:0}'
   +'.mc-guided-class-badge{display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box;flex:none;min-height:22px;max-width:100%;padding:3px 8px;border:1px solid #6db2c4;border-radius:999px;background:#153f4a;color:#dcf7ff;font:800 11px/1.25 system-ui;text-align:center;white-space:normal}'
   +'.mc-guided-class-badge[hidden]{display:none!important}'
   +'.mc-guided-entry{display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin-top:7px}'
   +'.mc-guided-entry[hidden]{display:none!important}'
   +'.mathas-collective-button{padding:10px 13px;border:1px solid #76a8b6;border-radius:11px;background:#173f4c;color:#eaffff;font:700 13px system-ui;cursor:pointer;max-width:100%}'
   +'.mathas-collective-button:disabled{opacity:.44;cursor:not-allowed}'
   +'#mc-guided-bar{position:relative;z-index:9;margin:8px auto;padding:8px 12px;border:1px solid #40aa9e;border-radius:12px;background:#092f35;color:#e8fffc;max-width:1130px}'
   +'#mc-guided-bar[hidden],#mc-guided-answers[hidden],.mc-controls[hidden]{display:none!important}'
   +'.mc-controls{display:flex;gap:16px;flex-wrap:wrap;align-items:stretch;margin-top:8px}'
   +'.mc-control-group{display:flex;gap:11px;flex-wrap:wrap;align-items:stretch}'
   +'.mc-control-group+.mc-control-group{border-left:4px solid #f68c36;padding-left:16px}'
   +'.mc-controls .mathas-collective-button{font-size:12px}'
   +'.mc-notice{font:700 13px/1.25 system-ui;min-height:0}'
   +'.mc-guided-answers{margin:10px 0 0;padding:12px;border:1px solid #355c65;border-radius:10px;background:#08252b}'
   +'.mc-guided-answer-overlay{box-sizing:border-box;pointer-events:none;user-select:text;text-align:center;align-self:center}'
   +'.mc-guided-answer-marker,.mc-guided-answer-digit{min-height:36px;display:flex;align-items:center;justify-content:center;color:#ffe08a;font:900 1.45rem/1 system-ui}'
   +'.mc-guided-answer-marker{font-size:1.2rem;opacity:.75}'
   +'.mc-guided-answer-digit{width:var(--cell);min-width:var(--cell);padding:2px;border-bottom:2px solid rgba(255,224,138,.65);border-radius:7px;background:rgba(177,126,35,.14)}'
   +'.mc-guided-report-marker,.mc-guided-report-digit{min-height:22px;display:flex;align-items:center;justify-content:center;color:#a7d8e2;font:750 .92rem/1 system-ui}'
   +'.mc-guided-report-marker{font-size:.73rem;opacity:.75}'
   +'.mc-guided-report-digit{min-width:var(--cell);font-size:.88rem;opacity:.9}'
   +'body.light .mc-guided-answer-digit,body.light-mode .mc-guided-answer-digit{background:#fff2ce;color:#6f410a;border-bottom-color:#ba8a2f}'
   +'body.light .mc-guided-report-digit,body.light-mode .mc-guided-report-digit{color:#175369}'
   +'.mc-confirm{display:flex;gap:9px;flex-wrap:wrap;align-items:center;margin:6px 0}'
   +'.mc-neutral{background:#193d48;border-color:#456b77;color:#e8f1f4}'
   +'.mathas-collective-button[aria-pressed="true"]{border-color:#f6dc9b;color:#fff0ba}'
   +'body.light .mc-guided-class-badge,body.light-mode .mc-guided-class-badge{background:#e7f6f9;color:#175369;border-color:#75b8ca}'
   +'@media(max-width:700px){#mc-guided-bar{margin:6px;padding:8px}.mc-guided-head{gap:8px}.mc-controls{gap:10px}.mc-control-group{gap:8px}.mc-control-group+.mc-control-group{padding-left:10px;border-left-width:3px}.mathas-collective-button{padding:9px 10px}}';
   doc.head.append(style);
  }
  // Un parcours identique : le professeur ET l'élève ouvrent d'abord « Exercice guidé ».
  doc.getElementById('startTraining')?.addEventListener('click',()=>requestAnimationFrame(render));
  bar=el('div');bar.id='mc-guided-bar';
  notice=el('div','mc-notice');
  teacherRow=el('div','mc-controls');teacherRow.dataset.role='teacher';
  pupilRow=el('div','mc-controls');pupilRow.dataset.role='student';
  teacherPreviousButton=button('← Précédente',()=>void write('previous'));
  teacherNextButton=button('Nouvelle page →',()=>void write('next'));
  btnRequired=button('□ Page obligatoire',()=>void write('set-required',
   {pageIndex:index,required:!session.requiredPages[index]}));
  btnAnswers=button('Afficher les réponses',toggleAnswers);
  btnStop=button('Terminer la séance',()=>{
   if(confirm('Terminer le guidé collectif pour toute la classe ?'))void write('stop');
  });
  // Trois groupes lisibles : navigation | outils pédagogiques | fin de séance.
  const group=(...controls)=>{const row=el('div','mc-control-group');row.append(...controls);return row};
  teacherRow.append(group(teacherPreviousButton,teacherNextButton),
   group(btnRequired,btnAnswers),group(btnStop));
  btnPrevious=button('← Précédente',studentPrevious);
  btnNext=button('Suivant →',studentNext);
  btnPractice=button('M’entraîner en attendant',practice);
  btnReturn=button('Rejoindre la classe',()=>void join());
  // Même séparation orange : navigation | entraînement / retour à la classe.
  pupilRow.append(group(btnPrevious,btnNext),group(btnPractice,btnReturn));
  btnStartHere=button('👥 Lancer la séance',()=>void start());
  btnJoinHere=button('Rejoindre la classe',()=>void join());
  const heading=el('div','mc-guided-head');barClassBadge=classBadge();
  heading.append(notice,barClassBadge);
  entry=el('div','mc-guided-entry');
  entry.append(btnStartHere,btnJoinHere);
  bar.append(heading,entry,teacherRow,pupilRow);
  answerPanel=el('div','mc-guided-answers');answerPanel.id='mc-guided-answers';
  confirmPanel=el('div','mc-confirm');
  answerPanel.append(confirmPanel);answerPanel.hidden=true;
  bar.append(answerPanel);
  doc.getElementById('gameScreen')?.prepend(bar);
  // Certains parcours démarrent le guidé via le moteur natif plutôt que via
  // le clic du bouton. Observer la visibilité des deux écrans (pas tout le DOM)
  // remplace le rendu permanent sans laisser le bandeau bloqué ou invisible.
  const screenObserver=new MutationObserver(()=>render());
  for(const screenId of ['menuScreen','gameScreen']){
   const screen=doc.getElementById(screenId);
   if(screen)screenObserver.observe(screen,{attributes:true,attributeFilter:['class']});
  }
  // Saisie : une écriture locale regroupée après une rafale de touches ;
  // navigation et sortie : sauvegarde immédiate, sans aucune requête réseau.
  if(!teacher){
   doc.addEventListener('click',queueDraft);
   doc.addEventListener('input',queueDraft);
   doc.addEventListener('keyup',queueDraft);
  }
  if(!started){
   started=true;
   document.addEventListener('visibilitychange',()=>{
    if(teacher){if(document.hidden)void keepTeacherPresence()}
    else if(document.hidden)flushDraft();
   });
   if(!teacher)window.addEventListener('pagehide',flushDraft);
   if(teacher){
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
    .catch(()=>{void poll()});
  }
  // Le pilote n'a plus de boucles render(950ms) ou status(8s).
  // Le bandeau est mis à jour lors des interactions et retours réseau.
  render();
 }
 return {mount,refresh:poll};
}
