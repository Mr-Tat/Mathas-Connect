// Interface additionnelle pour la multiplication existante : aucun calcul
// de récompense n'est fait ici. Les jalons proviennent de Connect.
import {xpStillAvailable} from '../objective-record/native-connect-bridge.mjs';

const STYLE='mathas-multi-school-style';
const BADGE='mathas-multi-official-xp';
const TOGGLE='mathas-multi-tens-control';
const AMBER='mathas-multi-amber-next-unit';
const CUPS='mathas-multi-school-cups';

// Une maîtrise classique est UNE coupe visuelle (4/4, 10/10 ET 20/20),
// pas trois trophées. Les conditions distinctes restent celles du moteur.
export function officialMultiplicationCups(rewards,mode,level){
 if(!rewards||rewards.version!==3||![1,2,3].includes(level))return null;
 const i=level-1,color=['bronze','silver','gold'][i];
 if(mode==='classic'){
  const m=rewards.mastery;
  if(!m||![4,10,20].every(n=>Array.isArray(m[n])&&typeof m[n][i]==='boolean'))return null;
  return [{key:'mastery:'+level,color,earned:[4,10,20].every(n=>m[n][i]),
   title:'Maîtrise niveau '+level+' : 4/4, 10/10 et 20/20'}];
 }
 if(mode==='sudden'){
  if(!Array.isArray(rewards.sudden)||typeof rewards.sudden[i]!=='boolean')return null;
  return [{key:'sudden:'+level,color,earned:rewards.sudden[i],
   title:'Mort subite niveau '+level+' : 25 réussites'}];
 }
 if(mode==='hard-sudden'){
  const a=rewards.hardAwards;
  if(!a||!['bronze','silver','gold'].every(c=>Array.isArray(a[c])&&typeof a[c][i]==='boolean'))return null;
  return ['bronze','silver','gold'].map((c,j)=>({key:'hard:'+c+':'+level,color:c,
   earned:a[c][i],title:'Mort subite HARD niveau '+level+' : '+[3,5,10][j]+' réussites'}));
 }
 return null;
}
function putCups(doc,button,specs){
 if(!button||!specs)return;
 let row=button.querySelector(':scope > .'+CUPS);
 if(!row){row=doc.createElement('span');row.className=CUPS;button.append(row)}
 const nativeArtReady=!!doc.querySelector('.mathas-v602-trophy-cup[data-trophy-color]');
 const signature=specs.map(x=>x.key+':'+(x.earned?'1':'0')).join('|')+(nativeArtReady?'|native':'|fallback');
 if(row.dataset.signature===signature)return;
 row.dataset.signature=signature;row.replaceChildren();
 for(const spec of specs){
  const slot=doc.createElement('span');slot.className='mathas-multi-school-cup '+(spec.earned?'earned':'locked');
  slot.title=spec.title+(spec.earned?' · Coupe acquise':' · Coupe à gagner');
  slot.setAttribute('aria-label',slot.title);
  const native=doc.querySelector('.mathas-v602-trophy-cup[data-trophy-color="'+spec.color+'"]');
  const cup=native?.cloneNode(true)||doc.createElement('span');
  if(!native)cup.textContent='🏆';
  cup.classList.add('mathas-multi-school-cup-art');
  slot.append(cup);row.append(slot);
 }
 button.style.setProperty('position','relative','important');
 if(button.matches('button'))button.style.setProperty('padding-top','19px','important');
}


export function multiplicationAmberFollower(active,doc){
 if(!active?.matches||!doc?.querySelector)return null;
 let target=null;
 if(active.matches('.carry-input[data-carry-col]')){
  const col=Number(active.dataset.carryCol)-1;
  if(Number.isInteger(col)&&col>=0)
   target=active.closest('.operation[data-calc]')?.querySelector('.answer-input[data-col="'+col+'"]');
 }else if(active.matches('.hard-carry[data-col]')){
  const col=Number(active.dataset.col)-1;
  if(Number.isInteger(col)&&col>=0)
   target=active.closest('.hard-operation')?.querySelector('.hard-answer[data-col="'+col+'"]');
 }else if(active.matches('.side-carry-input')){
  const index=active.closest('.side-carry-panel')?.dataset.sideCalc;
  if(/^\d+$/.test(index||'')){
   const op=doc.querySelector('.operation[data-calc="'+index+'"]');
   target=firstBlank(op,'.answer-input[data-col]');
  }
 }else if(active.matches('.hard-side-carry')){
  target=firstBlank(doc.getElementById('hardOperationCard'),'.hard-answer[data-col]');
 }
 return target&&!target.disabled&&!target.value?target:null;
}
function firstBlank(scope,selector){
 return [...(scope?.querySelectorAll(selector)||[])]
  .filter(x=>!x.disabled&&!x.value)
  .sort((a,b)=>Number(a.dataset.col)-Number(b.dataset.col))[0]||null;
}
export function updateMultiplicationAmber(doc,enabled){
 if(!doc?.querySelectorAll)return null;
 doc.querySelectorAll('.'+AMBER).forEach(x=>x.classList.remove(AMBER));
 if(!enabled)return null;
 const target=multiplicationAmberFollower(doc.activeElement,doc);
 if(target)target.classList.add(AMBER);
 return target;
}
function ensureStyle(doc){
 if(doc.getElementById(STYLE))return;
 const el=doc.createElement('style');el.id=STYLE;
 el.textContent=[
 '.mathas-multi-tens-control{display:inline-flex;align-items:center;gap:5px;padding:5px 8px;border:1px solid rgba(118,191,236,.5);border-radius:9px;background:rgba(28,116,180,.17);color:inherit;white-space:nowrap;cursor:pointer;font:700 11px/1.1 system-ui}',
 '.mathas-multi-tens-control input{width:16px;height:16px;margin:0;accent-color:#168ada}',
 '.mathas-multi-tens-control:focus-within{outline:2px solid #ffdc83;outline-offset:2px}',
 '#gameScreen .answer-input.mathas-multi-amber-next-unit:not(.active-entry):not(:focus),#hardGame .hard-answer.mathas-multi-amber-next-unit:not(.hard-active):not(:focus){background:rgba(244,178,65,.13)!important;border-color:rgba(244,188,97,.43)!important;box-shadow:inset 0 0 0 1px rgba(255,195,104,.30)!important}',
 '.mathas-multi-official-xp{position:absolute!important;right:6px!important;bottom:3px!important;color:#f9e5ac!important;font:650 10px/1.1 system-ui!important;white-space:nowrap!important;pointer-events:none!important;z-index:2}',
 '#startSudden>.mathas-multi-official-xp,#hardMenu .hard-sudden>.mathas-multi-official-xp{left:6px!important;right:auto!important}',
 'body.light .mathas-multi-official-xp,body.light-mode .mathas-multi-official-xp{color:#523107!important}',
 '.mathas-multi-instruction-note{font:700 12px/1.4 system-ui;color:#f7cb76;margin-top:5px}',
 '.mathas-multi-school-cups{position:absolute!important;bottom:10px!important;top:auto!important;right:9px!important;display:inline-flex!important;gap:3px!important;align-items:center!important;pointer-events:none!important;z-index:3}',
 '#menuScreen .mode-card.classic{position:relative!important}',
 '#menuScreen .mode-card.classic>.mathas-multi-school-cups{bottom:12px!important;right:16px!important}',
 '.mathas-multi-school-cup{display:inline-flex!important;align-items:center!important;justify-content:center!important;min-width:15px;min-height:16px}',
 '.mathas-multi-school-cup .mathas-multi-school-cup-art{display:inline-flex!important;width:16px!important;height:17px!important;font-size:15px!important}',
 '.mathas-multi-school-cup .mathas-multi-school-cup-art svg{width:100%!important;height:100%!important}',
 '.mathas-multi-school-cup.locked{opacity:.38;filter:grayscale(1)}',
 '.mathas-multi-school-cup.earned{opacity:1;filter:drop-shadow(0 1px 3px #f4d48a77)}',
 '/* Les fonds et couleurs natifs restent inchangés : disposition et relief seulement. */',
 '/* Le groupe de survie doit couvrir les deux colonnes de la grille icône/titre du moteur V7. */',
 '#menuScreen .mode-card.sudden>.mathas-multi-survival-options{grid-column:1/-1!important;grid-row:auto!important;display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:clamp(8px,1vw,14px)!important;width:100%!important;max-width:100%!important;min-width:0!important;box-sizing:border-box!important;align-items:stretch!important;justify-self:stretch!important}',
 '#menuScreen .mode-card.sudden>.mathas-multi-survival-options>.big-mode-choice{min-width:0!important;max-width:none!important;width:100%!important;min-height:154px!important;margin:0!important;box-sizing:border-box!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;gap:8px!important;white-space:normal!important;overflow-wrap:normal!important;word-break:normal!important;text-align:center!important;font-size:clamp(.88rem,1.25vw,1.15rem)!important;line-height:1.18!important;padding:16px 10px 29px!important}',
 '#menuScreen .mode-card.sudden>.mathas-multi-survival-options>.big-mode-choice:disabled{cursor:not-allowed!important;opacity:.56!important;filter:grayscale(.42)!important}',
 '#menuScreen .mode-card.sudden>.mathas-multi-survival-options>.big-mode-choice>.mathas-multi-official-xp{left:auto!important;right:8px!important;bottom:7px!important}',
 '#menuScreen .mode-card.sudden>.mathas-multi-survival-options>.big-mode-choice>.mathas-multi-school-cups{right:8px!important;bottom:22px!important}',
 '/* La disposition du moteur reste intacte ; uniquement la carte de sélection est harmonisée. */',
 '#menuScreen .mode-card.sudden>.mode-description,#menuScreen .mode-card.sudden>.mathas-multi-unlock-note{grid-column:1/-1!important;width:100%!important}',
 '#menuScreen .mode-card.sudden>.mathas-multi-unlock-note{font:750 12px/1.45 system-ui;color:#ffdfa1;text-align:center;padding:2px 4px;box-sizing:border-box}',
 '#menuScreen .mode-card.sudden>.mathas-multi-survival-options>.big-mode-choice:not(:disabled){box-shadow:inset 0 2px 0 #ffffff25,inset 0 -4px 0 #0004,0 5px 0 #0005,0 11px 19px #0004!important}',
 '@media(hover:hover) and (pointer:fine){#menuScreen .mode-card.sudden>.mathas-multi-survival-options>.big-mode-choice:not(:disabled):hover{transform:translateY(-3px)!important;filter:brightness(1.12)!important}}',
 '#menuScreen .mode-card.sudden>.mathas-multi-survival-options>.big-mode-choice:not(:disabled):active{transform:translateY(3px)!important;box-shadow:inset 0 2px 5px #0005,0 2px 0 #0005!important}',
 '@media(max-width:570px){#menuScreen .mode-card.sudden>.mathas-multi-survival-options{gap:7px!important}#menuScreen .mode-card.sudden>.mathas-multi-survival-options>.big-mode-choice{min-height:115px!important;font-size:.88rem!important;padding:10px 5px 30px!important}}',
 '#menuScreen .mathas-multi-survival-options{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:clamp(7px,1.1vw,13px);width:100%;min-width:0;align-items:stretch}',
 '#menuScreen .mathas-multi-survival-options>.big-mode-choice{min-width:0;width:100%;min-height:88px;margin:0!important;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;white-space:normal;text-align:center}',
 '#hardMenu .hard-actions:has(.mathas-multi-hard-three-lives){display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}',
 '#hardMenu .hard-actions:has(.mathas-multi-hard-three-lives)>.hard-train{grid-column:1/-1}',
 '#hardMenu .hard-actions:has(.mathas-multi-hard-three-lives)>.hard-sudden{min-width:0;min-height:54px;padding:9px 5px}',
 '#menuScreen .mathas-multi-survival-options>button,#hardMenu .hard-actions:has(.mathas-multi-hard-three-lives)>button{transition:transform .14s ease,filter .14s ease}',
 '@media(hover:hover) and (pointer:fine){#menuScreen .mathas-multi-survival-options>button:not(:disabled):hover,#hardMenu .hard-actions>button:not(:disabled):hover{transform:translateY(-2px);filter:brightness(1.08)}}',
 '#menuScreen .mathas-multi-survival-options>button:not(:disabled):active,#hardMenu .hard-actions>button:not(:disabled):active{transform:translateY(2px);filter:brightness(.94)}',
 '@media(prefers-reduced-motion:reduce){#menuScreen .mathas-multi-survival-options>button,#hardMenu .hard-actions>button{transition:none}}',
 '@media(max-width:420px){#menuScreen .mathas-multi-survival-options>.big-mode-choice{font-size:clamp(.72rem,2.6vw,.96rem)!important;padding:9px 4px}}',
 '@media(max-width:650px){.mathas-multi-tens-control{font-size:10px;padding:4px 6px;gap:4px}#gameScreen .session-bar,#hardGame .hard-session-bar{flex-wrap:wrap}.mathas-multi-official-xp{font-size:9px!important}}'
 ].join('\n');
 doc.head.append(el);
}
function putBadge(doc,button,amount){
 if(!button||amount===null)return;
 let el=button.querySelector(':scope > .'+BADGE);
 if(!el){el=doc.createElement('span');el.className=BADGE;button.append(el)}
 const text='Reste '+amount+' XP';
 if(el.textContent!==text)el.textContent=text;
 el.title='Jalons Connect encore accessibles pour cette configuration';
 button.style.setProperty('position','relative','important');
 button.style.setProperty('padding-bottom','24px','important');
}
function level(doc,id){
 const n=Number(doc.getElementById(id)?.value);
 return [1,2,3].includes(n)?n:0;
}
function renderXp(doc,xp){
 if(!Array.isArray(xp?.milestones)||
    (xp.repeatXp===true&&Number(xp.parcours)>=2&&!Array.isArray(xp.currentMilestones)))return;
 const classicLevel=level(doc,'classicLevel');
 for(const btn of doc.querySelectorAll('#menuScreen .classic-count-btn[data-count]'))
  putBadge(doc,btn,xpStillAvailable(xp,'classic',classicLevel,Number(btn.dataset.count)));
 const lifeLevel=level(doc,'suddenLevel');
 putBadge(doc,doc.getElementById('startSudden'),
  xpStillAvailable(xp,'sudden',lifeLevel));
 putBadge(doc,doc.getElementById('mathasMultiThreeLives'),
  xpStillAvailable(xp,'three-lives',lifeLevel));
 for(const card of doc.querySelectorAll('#hardMenu .hard-level-card')){
  const n=Number(card.querySelector('h3')?.textContent.match(/NIV\s*([123])/i)?.[1]);
  const button=card.querySelector('.hard-sudden:not(.mathas-multi-hard-three-lives):not(:disabled)');
  const lives=card.querySelector('.mathas-multi-hard-three-lives:not(:disabled)');
  if(button)putBadge(doc,button,xpStillAvailable(xp,'hard-sudden',n));
  if(lives)putBadge(doc,lives,xpStillAvailable(xp,'hard-three-lives',n));
 }
}
function renderCups(doc,rewards){
 // Un seul trophée de maîtrise pour les trois séries : la carte Calculs,
 // plutôt que trois coupes trompeuses à l'intérieur des boutons 4/10/20.
 doc.querySelectorAll('#menuScreen .classic-count-btn[data-count] .'+CUPS).forEach(x=>x.remove());
 const classicCard=doc.querySelector('#menuScreen .mode-card.classic');
 putCups(doc,classicCard,officialMultiplicationCups(rewards,'classic',level(doc,'classicLevel')));
 putCups(doc,doc.getElementById('startSudden'),
  officialMultiplicationCups(rewards,'sudden',level(doc,'suddenLevel')));
 for(const card of doc.querySelectorAll('#hardMenu .hard-level-card')){
  const n=Number(card.querySelector('h3')?.textContent.match(/NIV\s*([123])/i)?.[1]);
  const button=card.querySelector('.hard-sudden:not(.mathas-multi-hard-three-lives):not(:disabled)');
  if(button)putCups(doc,button,officialMultiplicationCups(rewards,'hard-sudden',n));
 }
}
function polishSurvivalMenu(doc){
 const card=doc.querySelector('#menuScreen .mode-card.sudden');
 if(!card)return;
 const title=card.querySelector('.mode-title');
 if(title&&title.textContent!=='Objectif record')title.textContent='Objectif record';
 const icon=card.querySelector('.mode-icon');
 if(icon&&icon.textContent!=='👑')icon.textContent='👑';
 const description=card.querySelector('.mode-description');
 if(description&&description.textContent!=='Pour marquer un plus gros score !')
  description.textContent='Pour marquer un plus gros score !';
 const lives=doc.getElementById('mathasMultiThreeLives');
 const sudden=doc.getElementById('startSudden');
 // Les scripts natifs peuvent réécrire textContent lorsqu'un mode est débloqué.
 // Restituer l'habillage sans supprimer les coupes et les badges XP officiels.
 function label(button,emoji,name,aria){
  if(!button)return;
  const rendered=button.querySelector(':scope > .mathas-multi-choice-name');
  if(rendered?.textContent===name)return;
  const extras=[...button.children].filter(x=>x.classList.contains(BADGE)||x.classList.contains(CUPS));
  const symbol=doc.createElement('span');
  symbol.className='mathas-multi-choice-icon';symbol.textContent=emoji;
  const text=doc.createElement('strong');
  text.className='mathas-multi-choice-name';text.textContent=name;
  button.replaceChildren(symbol,text,...extras);
  button.setAttribute('aria-label',aria);
 }
 label(lives,'❤️ ❤️ ❤️','3 vies','Mode 3 vies');
 label(sudden,'💀','Mort subite','Mode Mort subite');
 let note=card.querySelector(':scope > .mathas-multi-unlock-note');
 if(!note){note=doc.createElement('div');note.className='mathas-multi-unlock-note';card.append(note)}
 const locked=!!(lives?.disabled||sudden?.disabled);
 const detail=locked?'🔒 Réussis 8/10 ou 16/20 au niveau choisi pour débloquer ces modes.':'Deux moyens de battre ton record !';
 if(note.textContent!==detail)note.textContent=detail;
}
function instruction(doc,enabled){
 const root=doc.getElementById('instructionText');
 if(!root)return;
 let note=root.querySelector('.mathas-multi-instruction-note');
 if(!note){note=doc.createElement('div');note.className='mathas-multi-instruction-note';root.append(note)}
 const loc=doc.querySelector('input[name="carryMethod"]:checked')?.value==='side'?'dans le cadre latéral':'au-dessus';
 note.textContent=enabled
  ?'Dizaines d’abord : note le report '+loc+' avant le chiffre des unités.'
  :'Unités d’abord : écris les unités avant de noter le report '+loc+'.';
}
export function installMultiplicationSchoolUi(doc,{connected=false,xp=null,rewards=null}={}){
 const home=doc?.getElementById?.('tensFirstToggle');
 if(!home||!doc.querySelector('#menuScreen'))return false;
 ensureStyle(doc);
 polishSurvivalMenu(doc);
 const sync=()=>{
  doc.querySelectorAll('.'+TOGGLE+' input').forEach(x=>{x.checked=!!home.checked});
  updateMultiplicationAmber(doc,home.checked);
  if(!doc.getElementById('gameScreen')?.classList.contains('hidden'))instruction(doc,home.checked);
 };
 if(!doc.__mathasMultiTensInstalled){
  doc.__mathasMultiTensInstalled=true;
  doc.addEventListener('focusin',()=>updateMultiplicationAmber(doc,home.checked),true);
  home.addEventListener('change',sync);
  doc.querySelectorAll('input[name="carryMethod"]').forEach(x=>x.addEventListener('change',sync));
 }
 for(const [kind,bar] of [
  ['normal',doc.querySelector('#gameScreen .session-bar')],
  ['hard',doc.querySelector('#hardGame .hard-session-bar')]
 ]){
  if(!bar||bar.querySelector('.'+TOGGLE))continue;
  const label=doc.createElement('label');label.className=TOGGLE;
  label.title='Changer l’ordre de saisie pendant la partie sans effacer les réponses';
  const input=doc.createElement('input');input.id='mathasMultiTens-'+kind;
  input.type='checkbox';input.checked=!!home.checked;
  input.setAttribute('aria-label','Écrire les dizaines d’abord pendant la partie');
  label.htmlFor=input.id;const title=doc.createElement('span');
  title.textContent='Dizaines d’abord';label.append(input,title);bar.append(label);
  input.addEventListener('change',()=>{
   home.checked=input.checked;
   home.dispatchEvent(new doc.defaultView.Event('change',{bubbles:true}));
   sync();
  });
 }
 sync();
 if(connected&&xp)renderXp(doc,xp);
 else doc.querySelectorAll('.'+BADGE).forEach(x=>x.remove());
 if(connected&&rewards)renderCups(doc,rewards);
 else doc.querySelectorAll('.'+CUPS).forEach(x=>x.remove());
 return true;
}
