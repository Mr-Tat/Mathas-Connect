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
const STYLE_ID='mathasTensFirstDuringGameStyle';
const CSS=`
.${LABEL_CLASS}{display:inline-flex;flex:0 0 auto;gap:6px;align-items:center;
 cursor:pointer;border:1px solid rgba(118,191,236,.6);border-radius:10px;
 padding:5px 9px;background:rgba(28,116,180,.17);color:inherit;
 font:700 12px/1.1 system-ui;white-space:nowrap;user-select:none}
.${LABEL_CLASS} input{width:17px;height:17px;margin:0;cursor:pointer;accent-color:#168ada}
.${LABEL_CLASS}:focus-within{outline:2px solid #ffdc83;outline-offset:2px}
#hardGameScreen .${LABEL_CLASS}{margin:0 6px}
@media(max-width:650px){.${LABEL_CLASS}{font-size:10px;padding:4px 6px;gap:4px}
.${LABEL_CLASS} input{width:16px;height:16px}}
`;

export function installTensFirstDuringGame(doc,appKey){
 if(!['addition-ecrite-simple','addition-ecrite-multiple'].includes(appKey))return false;
 const home=doc?.getElementById?.('tensFirstToggle');
 if(!home)return false;
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
 };
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
  if(back)bar.insertBefore(label,back);else bar.append(label);
  checkbox.addEventListener('change',()=>{
   home.checked=checkbox.checked;
   home.dispatchEvent(new doc.defaultView.Event('change',{bubbles:true}));
   sync();
   updateInstructions();
  });
 }
 sync();
 return true;
}
