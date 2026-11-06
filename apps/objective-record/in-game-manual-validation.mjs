// Contrôle pédagogique facultatif pour les moteurs natifs Soustraction / Multiplication.
// La validation reste automatique par défaut : aucune preuve serveur, aucun score ou XP
// n'est modifié ici. État personnel conservé uniquement pour le profil Connect approuvé.
const ALLOWED=new Set(['soustraction-ecrite-simple','multiplication-ecrite-simple']);
const STYLE_ID='mathasManualWrittenCalcStyle';
const MANUAL_CLASS='mathas-manual-validation-during-game';
const TENS_CLASS='mathas-tens-first-during-game';
const CSS=[
  '.'+MANUAL_CLASS+',.'+TENS_CLASS+'{display:inline-flex;flex:0 0 auto;gap:6px;align-items:center;cursor:pointer;border:1px solid rgba(118,191,236,.6);border-radius:10px;padding:5px 9px;background:rgba(28,116,180,.17);color:inherit;font:700 12px/1.1 system-ui;white-space:nowrap;user-select:none}',
  '.'+MANUAL_CLASS+' input,.'+TENS_CLASS+' input{width:17px;height:17px;margin:0;cursor:pointer;accent-color:#168ada}',
  '.'+MANUAL_CLASS+':focus-within,.'+TENS_CLASS+':focus-within{outline:2px solid #ffdc83;outline-offset:2px}',
  '#hardGameScreen .'+MANUAL_CLASS+',#hardGameScreen .'+TENS_CLASS+'{margin:0 6px}',
  '@media(max-width:650px){.'+MANUAL_CLASS+',.'+TENS_CLASS+'{font-size:10px;padding:4px 6px;gap:4px}.'+MANUAL_CLASS+' input,.'+TENS_CLASS+' input{width:16px;height:16px}}'
].join('\n');
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function installManualValidationForWrittenCalc(doc,appKey,studentId=null){
 if(!ALLOWED.has(appKey)||!doc?.defaultView)return false;
 const normal=doc.querySelector('#gameScreen .session-bar');
 const hard=doc.querySelector('#hardGameScreen .hard-session-bar');
 if(!normal&&!hard)return false;
 const view=doc.defaultView;
 const profile=typeof studentId==='string'&&UUID.test(studentId)?studentId.toLowerCase():null;
 const scope=profile?'mathas.manual-validation.v1.'+appKey+'.'+profile:null;
 if(doc.__mathasManualScope!==scope||!doc.__mathasManualScopeReady){
  doc.__mathasManualScope=scope;
  doc.__mathasManualScopeReady=true;
  let enabled=false;
  if(scope)try{enabled=view.localStorage.getItem(scope)==='1'}catch{}
  view.__mathasManualValidation=enabled;
 }
 if(!doc.getElementById(STYLE_ID)){
  const style=doc.createElement('style');
  style.id=STYLE_ID;style.textContent=CSS;doc.head.append(style);
 }
 const home=appKey==='multiplication-ecrite-simple'?doc.getElementById('tensFirstToggle'):null;
 const syncTens=()=>{
  if(!home)return;
  const value=!!home.checked;
  doc.querySelectorAll('.'+TENS_CLASS+' input').forEach(input=>{input.checked=value});
 };
 if(home&&!home.__mathasInGameCarrySync){
  home.__mathasInGameCarrySync=true;
  home.addEventListener('change',syncTens);
 }
 for(const [bar,kind] of [[normal,'normal'],[hard,'hard']]){
  if(!bar)continue;
  const manualId='mathasManualValidationDuringGame-'+kind;
  if(bar.querySelector('#'+manualId))continue;
  const back=bar.querySelector(kind==='hard'?'#hardGameBack':'#menuBtn');
  let tensLabel=null;
  if(home){
   const tensId='mathasTensFirstDuringGame-'+kind;
   tensLabel=doc.createElement('label');
   tensLabel.className=TENS_CLASS;tensLabel.htmlFor=tensId;
   tensLabel.title='Changer l’ordre des dizaines pendant la partie, sans effacer le calcul.';
   const tensInput=doc.createElement('input');tensInput.type='checkbox';
   tensInput.id=tensId;tensInput.checked=!!home.checked;
   tensInput.setAttribute('aria-label','Écrire les dizaines d’abord');
   const caption=doc.createElement('span');caption.textContent='Dizaines d’abord';
   tensLabel.append(tensInput,caption);
   if(back?.parentElement===bar)bar.insertBefore(tensLabel,back);
   else bar.append(tensLabel);
   tensInput.addEventListener('change',()=>{
    home.checked=tensInput.checked;
    home.dispatchEvent(new view.Event('change',{bubbles:true}));
    syncTens();
   });
  }
  const label=doc.createElement('label');
  label.className=MANUAL_CLASS;label.htmlFor=manualId;
  label.title='Vérifier ses réponses avant la correction. Désactivé : correction automatique.';
  const input=doc.createElement('input');input.type='checkbox';
  input.id=manualId;input.checked=!!view.__mathasManualValidation;
  input.setAttribute('aria-label','Valider les réponses manuellement');
  const caption=doc.createElement('span');caption.textContent='Valider les réponses';
  label.append(input,caption);
  if(tensLabel)tensLabel.after(label);
  else if(back?.parentElement===bar)bar.insertBefore(label,back);
  else bar.append(label);
  input.addEventListener('change',()=>{
   const enabled=!!input.checked;
   view.__mathasManualValidation=enabled;
   doc.querySelectorAll('.'+MANUAL_CLASS+' input').forEach(item=>{item.checked=enabled});
   const currentScope=doc.__mathasManualScope;
   if(currentScope)try{view.localStorage.setItem(currentScope,enabled?'1':'0')}catch{}
  });
 }
 doc.querySelectorAll('.'+MANUAL_CLASS+' input').forEach(input=>{
  input.checked=!!view.__mathasManualValidation;
 });
 syncTens();
 return true;
}
