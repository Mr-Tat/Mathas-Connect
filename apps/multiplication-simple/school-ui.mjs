// Interface additionnelle pour la multiplication existante : aucun calcul
// de récompense n'est fait ici. Les jalons proviennent de Connect.
import {xpStillAvailable} from '../objective-record/native-connect-bridge.mjs';

const STYLE='mathas-multi-school-style';
const BADGE='mathas-multi-official-xp';
const TOGGLE='mathas-multi-tens-control';
const AMBER='mathas-multi-amber-next-unit';

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
 putBadge(doc,doc.getElementById('startSudden'),xpStillAvailable(xp,'sudden',level(doc,'suddenLevel')));
 for(const card of doc.querySelectorAll('#hardMenu .hard-level-card')){
  const n=Number(card.querySelector('h3')?.textContent.match(/NIV\s*([123])/i)?.[1]);
  const button=card.querySelector('.hard-sudden:not(:disabled)');
  if(button)putBadge(doc,button,xpStillAvailable(xp,'hard',n));
 }
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
export function installMultiplicationSchoolUi(doc,{connected=false,xp=null}={}){
 const home=doc?.getElementById?.('tensFirstToggle');
 if(!home||!doc.querySelector('#menuScreen'))return false;
 ensureStyle(doc);
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
 return true;
}
