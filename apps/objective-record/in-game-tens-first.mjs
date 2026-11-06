// Reprend la préférence « Écrire les dizaines d'abord » de l'accueil
// dans les barres des parties normales et HARD. Ne touche pas aux réponses,
// aux preuves serveur, aux records, aux XP ni aux trophées.
const SUFFIXES=[
 'En exercice guidé,',
 'Une erreur enlève',
 'Un calcul faux coûte',
 'La première erreur termine'
];
export function inGameCarryInstruction(current,enabled,appKey,level){
 if(typeof current!=='string')return current;
 const starts=SUFFIXES.map(s=>current.indexOf(s)).filter(n=>n>=0);
 if(!starts.length)return current;
 const suffix=current.slice(Math.min(...starts));
 const prefix=appKey==='addition-ecrite-multiple'
  ? `<strong>Niveau ${Number(level)||1}.</strong> Commence par les unités. ${enabled
   ?'S’il reste une ou plusieurs dizaines, écris d’abord cette retenue dans la petite case, puis écris le chiffre des unités de la somme.'
   :'Écris le chiffre des unités de la somme de la colonne. S’il reste une ou plusieurs dizaines, écris ensuite cette retenue dans la petite case au-dessus de la colonne de gauche.'}`
  : `<strong>Commence par les unités.</strong> ${enabled
   ?'Si la somme fait 10 ou plus, écris d’abord la dizaine du report dans la petite case, puis écris le chiffre des unités du résultat.'
   :'Écris le chiffre du résultat. Si la somme fait 10 ou plus, écris ensuite la retenue <strong>1</strong> dans la petite case au-dessus de la colonne de gauche.'}`;
 return prefix+' '+suffix;
}

const CONTROL_ID='mathasTensFirstDuringGame';
const LABEL_CLASS='mathas-tens-first-during-game';
const MANUAL_CLASS='mathas-manual-validation-during-game';
const STYLE_ID='mathasTensFirstDuringGameStyle';
const FOLLOWUP_CLASS='mathas-amber-followup';
const CSS=`
.${LABEL_CLASS},.${MANUAL_CLASS}{display:inline-flex;flex:0 0 auto;gap:6px;align-items:center;
 cursor:pointer;border:1px solid rgba(118,191,236,.6);border-radius:10px;
 padding:5px 9px;background:rgba(28,116,180,.17);color:inherit;
 font:700 12px/1.1 system-ui;white-space:nowrap;user-select:none}
.${LABEL_CLASS} input,.${MANUAL_CLASS} input{width:17px;height:17px;margin:0;cursor:pointer;accent-color:#168ada}
.${LABEL_CLASS}:focus-within,.${MANUAL_CLASS}:focus-within{outline:2px solid #ffdc83;outline-offset:2px}
#hardGameScreen .${LABEL_CLASS},#hardGameScreen .${MANUAL_CLASS}{margin:0 6px}
/* La case à remplir juste après une retenue est ambre, mais reste
   nettement plus discrète que la vraie case active (bleue). */
#gameScreen input.answer-input.${FOLLOWUP_CLASS}:not(.active-entry):not(:focus),
#hardGameScreen input.hard-answer.${FOLLOWUP_CLASS}:not(.active-entry):not(:focus){
 background:rgba(244,178,65,.13)!important;
 border-color:rgba(244,188,97,.43)!important;
 box-shadow:inset 0 0 0 1px rgba(255,195,104,.30),
            0 0 0 2px rgba(255,184,72,.045)!important;
 transition:background-color .14s ease,box-shadow .14s ease
}
body.light #gameScreen input.answer-input.${FOLLOWUP_CLASS},
body.light-mode #gameScreen input.answer-input.${FOLLOWUP_CLASS},
body.light #hardGameScreen input.hard-answer.${FOLLOWUP_CLASS},
body.light-mode #hardGameScreen input.hard-answer.${FOLLOWUP_CLASS}{
 background:rgba(255,194,83,.17)!important
}
@media(max-width:650px){.${LABEL_CLASS},.${MANUAL_CLASS}{font-size:10px;padding:4px 6px;gap:4px}
.${LABEL_CLASS} input,.${MANUAL_CLASS} input{width:16px;height:16px}}
`;


/** Renvoie la case d'unité qui sera remplie après la retenue active.
 * Même règle pour une petite case de report et pour une retenue qui crée
 * une nouvelle colonne de résultat (ex. 500 + 900 = 1 400).
 */
export function amberFollowerFor(active){
 if(!active?.closest||!active.matches)return null;
 const scope=active.closest('.operation,.hard-operation');
 if(!scope)return null;
 const hard=!!active.closest('.hard-operation');
 const answerSelector=hard?'.hard-answer':'.answer-input';
 let col=-1;
 if(active.matches(hard?'.hard-carry':'.carry-input')){
  col=Number(hard?active.dataset.col:active.dataset.carryCol)-1;
 }else if(active.matches(answerSelector)){
  const carried=[...scope.querySelectorAll(hard?'.hard-carry':'.carry-input')];
  if(!carried.length)return null;
  const maxCarry=Math.max(...carried.map(x=>Number(hard?x.dataset.col:x.dataset.carryCol)));
  const top=Number(active.dataset.col);
  if(Number.isInteger(top)&&top===maxCarry+1)col=top-1;
 }
 if(!Number.isInteger(col)||col<0)return null;
 const answer=scope.querySelector(`${answerSelector}[data-col="${col}"]`);
 return answer&&!answer.disabled&&!answer.value?answer:null;
}

export function updateAmberFollower(doc,enabled){
 if(!doc?.querySelectorAll)return null;
 doc.querySelectorAll('.'+FOLLOWUP_CLASS).forEach(node=>node.classList.remove(FOLLOWUP_CLASS));
 if(!enabled)return null;
 const follower=amberFollowerFor(doc.activeElement);
 if(follower)follower.classList.add(FOLLOWUP_CLASS);
 return follower;
}

export function installTensFirstDuringGame(doc,appKey,pupilId=null){
 if(!['addition-ecrite-simple','addition-ecrite-multiple'].includes(appKey))return false;
 const home=doc?.getElementById?.('tensFirstToggle');
 if(!home)return false;
 // Cette préférence n'appartient qu'au profil scolaire, pas au navigateur.
 const profile=typeof pupilId==='string'&&/^[0-9a-f-]{36}$/i.test(pupilId)
  ?pupilId.toLowerCase():null;
 const manualScope=profile?'mathas.manual-validation.v1.'+appKey+'.'+profile:null;
 if(doc.__mathasManualScope!==manualScope||!doc.__mathasManualScopeReady){
  doc.__mathasManualScope=manualScope;doc.__mathasManualScopeReady=true;
  let enabled=false;
  if(manualScope)try{
   enabled=doc.defaultView.localStorage.getItem(manualScope)==='1';
  }catch{}
  doc.defaultView.__mathasManualValidation=enabled;
 }
 const normal=doc.querySelector('#gameScreen .session-bar');
 const hard=doc.querySelector('#hardGameScreen .hard-session-bar');
 if(!normal&&!hard)return false;

 if(!doc.getElementById(STYLE_ID)){
  const style=doc.createElement('style');style.id=STYLE_ID;style.textContent=CSS;
  doc.head.append(style);
 }
 const sync=()=>{
  const value=!!home.checked;
  doc.querySelectorAll('.'+LABEL_CLASS+' input').forEach(input=>{input.checked=value});
  updateAmberFollower(doc,value);
 };
 if(!doc.__mathasAmberFollowerInstalled){
  doc.__mathasAmberFollowerInstalled=true;
  // Les moteurs natifs placent le focus à chaque chiffre (ou report).
  // Ne pas modifier leur gestion du clavier, des scores ou des preuves.
  doc.addEventListener('focusin',()=>updateAmberFollower(doc,!!home.checked),true);
 }
 if(!home.__mathasInGameCarrySync){
  home.__mathasInGameCarrySync=true;
  home.addEventListener('change',sync);
 }
 const updateInstructions=()=>{
  const instruction=doc.getElementById('instructionText');
  if(!instruction)return;
  const level=Number((doc.getElementById('sessionLevel')?.textContent||'').match(/[123]/)?.[0]||1);
  instruction.innerHTML=inGameCarryInstruction(instruction.innerHTML,home.checked,appKey,level);
 };
 for(const [bar,kind] of [[normal,'normal'],[hard,'hard']]){
  if(!bar)continue;
  const id=CONTROL_ID+'-'+kind;
  if(bar.querySelector('#'+id))continue;
  const label=doc.createElement('label');
  label.className=LABEL_CLASS;label.htmlFor=id;
  label.title='Changer l’ordre de saisie pendant la partie, sans perdre les réponses déjà écrites.';
  const checkbox=doc.createElement('input');
  checkbox.type='checkbox';checkbox.id=id;checkbox.checked=!!home.checked;
  checkbox.setAttribute('aria-label','Écrire les dizaines d’abord');
  const caption=doc.createElement('span');caption.textContent='Dizaines d’abord';
  label.append(checkbox,caption);
  const back=bar.querySelector(kind==='hard'?'#hardGameBack':'#menuBtn');
  // Certains moteurs placent Menu/HARD dans un sous-conteneur :
  // insertBefore impose un enfant direct, sinon il faut l'ajouter à la barre.
  if(back?.parentElement===bar)bar.insertBefore(label,back);
  else bar.append(label);
  checkbox.addEventListener('change',()=>{
   home.checked=checkbox.checked;
   home.dispatchEvent(new doc.defaultView.Event('change',{bubbles:true}));
   sync();
   updateInstructions();
  });
  // Opt-in pédagogique, immédiatement à droite de « Dizaines d’abord ».
  // La préférence appartient au profil Connect, jamais aux scores / XP.
  const manualId='mathasManualValidationDuringGame-'+kind;
  const manualLabel=doc.createElement('label');
  manualLabel.className=MANUAL_CLASS;manualLabel.htmlFor=manualId;
  manualLabel.title='Vérifier ses réponses avant de passer au calcul suivant. Désactivé : correction automatique.';
  const manualInput=doc.createElement('input');
  manualInput.type='checkbox';manualInput.id=manualId;
  manualInput.checked=!!doc.defaultView.__mathasManualValidation;
  manualInput.setAttribute('aria-label','Valider les réponses manuellement');
  const manualCaption=doc.createElement('span');
  manualCaption.textContent='Valider les réponses';
  manualLabel.append(manualInput,manualCaption);
  label.after(manualLabel);
  manualInput.addEventListener('change',()=>{
   const value=!!manualInput.checked;
   doc.defaultView.__mathasManualValidation=value;
   doc.querySelectorAll('.'+MANUAL_CLASS+' input').forEach(input=>{input.checked=value});
   if(manualScope)try{
    doc.defaultView.localStorage.setItem(manualScope,value?'1':'0');
   }catch{ /* Un stockage inaccessible ne bloque pas le calcul. */ }
  });
 }
 sync();
 return true;
}
