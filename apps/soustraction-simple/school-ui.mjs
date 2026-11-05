// HABILLAGE scolaire de Soustraction : fonds et moteur graphique natifs intacts.
import {xpStillAvailable} from '../objective-record/native-connect-bridge.mjs';
const CSSID='mathas-sub-school-css';
const XP='mathas-sub-official-xp';
const CUP='mathas-sub-cups';
const NAMES=['bronze','silver','gold'];
function level(doc,id){
 const value=Number(doc.getElementById(id)?.value);
 return ({3:1,5:2,7:3})[value]||0;
}
function hardLevel(button){
 const n=Number(button?.dataset.level||button?.closest('.hard-level-card')?.querySelector('h3')?.textContent.match(/NIV\s*([123])/i)?.[1]);
 return [1,2,3].includes(n)?n:0;
}
function officialCups(rewards,mode,level){
 if(rewards?.version!==3||![1,2,3].includes(level))return null;
 const i=level-1;
 if(mode==='classic'){
  if(![4,10,20].every(n=>typeof rewards?.mastery?.[n]?.[i]==='boolean'))return null;
  return [{color:NAMES[i],earned:[4,10,20].every(n=>rewards.mastery[n][i]),
   title:'Maîtrise complète : 4/4, 10/10 et 20/20'}];
 }
 if(mode==='sudden'){
  return typeof rewards?.sudden?.[i]==='boolean'
   ?[{color:NAMES[i],earned:rewards.sudden[i],title:'Mort subite : 25 réussites'}]:null;
 }
 if(mode==='hard-sudden'){
  return NAMES.every(n=>typeof rewards?.hardAwards?.[n]?.[i]==='boolean')
   ?NAMES.map((color,j)=>({color,earned:rewards.hardAwards[color][i],
    title:'HARD · Mort subite : '+[3,5,10][j]+' réussites'})):null;
 }
 return null;
}
function badge(doc,button,amount){
 if(!button||amount===null)return;
 let row=button.querySelector(':scope > .'+XP);
 if(!row){row=doc.createElement('span');row.className=XP;button.append(row)}
 const label='Reste '+amount+' XP';
 if(row.textContent!==label)row.textContent=label;
 row.title='XP officiels encore accessibles';
 button.style.setProperty('position','relative','important');
 button.style.setProperty('padding-bottom','24px','important');
}
function cups(doc,button,items){
 if(!button||!items)return;
 let row=button.querySelector(':scope > .'+CUP);
 if(!row){row=doc.createElement('span');row.className=CUP;button.append(row)}
 const sig=items.map(x=>x.color+':'+Number(x.earned)).join(';');
 if(row.dataset.sig===sig)return;
 row.dataset.sig=sig;row.replaceChildren();
 for(const item of items){
  const wrapper=doc.createElement('span');
  wrapper.className='mathas-sub-cup '+(item.earned?'earned':'locked');
  wrapper.title=item.title+(item.earned?' · Acquise':' · À gagner');
  const native=doc.querySelector('.mathas-v602-trophy-cup[data-trophy-color="'+item.color+'"]');
  const visual=native?.cloneNode(true)||doc.createElement('span');
  if(!native)visual.textContent='🏆';
  wrapper.append(visual);row.append(wrapper);
 }
 button.style.setProperty('position','relative','important');
 button.style.setProperty('padding-top','19px','important');
}
function style(doc){
 if(doc.getElementById(CSSID))return;
 const css=doc.createElement('style');css.id=CSSID;
 css.textContent=[
 '.mathas-sub-survival-pair,.mathas-sous-record-buttons{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:9px!important;width:100%!important}',
 '.mathas-sub-survival-pair>button{min-width:0;width:100%;min-height:48px;white-space:normal}',
 '#hardLevelGrid .hard-mode-buttons:has(.mathas-sub-hard-three){display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}',
 '#hardLevelGrid .hard-mode-buttons:has(.mathas-sub-hard-three)>button{min-width:0;min-height:52px;white-space:normal}',
 '#hardLevelGrid .hard-mode-buttons:has(.mathas-sub-hard-three)>button[data-mode="training"]{grid-column:1/-1}',
 '.mathas-sub-official-xp{display:block!important;position:absolute!important;bottom:4px!important;right:6px!important;font:650 10px/1.1 system-ui!important;color:#f9e5ac!important;white-space:nowrap;pointer-events:none;z-index:3;text-shadow:0 1px 2px #17202b}',
 'body.light-mode .mathas-sub-official-xp{color:#4e3311!important;text-shadow:none}',
 '.mathas-sub-cups{position:absolute!important;right:5px!important;top:1px!important;display:inline-flex;gap:2px;align-items:center;pointer-events:none;z-index:4}',
 '.mathas-sub-cup{display:inline-flex;font-size:15px;align-items:center;justify-content:center}',
 '.mathas-sub-cup .mathas-v602-trophy-cup{font-size:16px!important}',
 '.mathas-sub-cup.locked{opacity:.36;filter:grayscale(1)}',
 '.mathas-sub-cup.earned{opacity:1;filter:drop-shadow(0 1px 3px #ffdc8b77)}',
 '@media(max-width:440px){.mathas-sub-survival-pair>button,#hardLevelGrid .hard-mode-buttons>button{font-size:12px!important}}'
 ].join('\n');doc.head.append(css);
}
export function installSubtractionSchoolUi(doc,{connected=false,xp=null,rewards=null}={}){
 if(!connected||!doc?.getElementById?.('menuScreen'))return false;
 style(doc);
 const sudden=doc.getElementById('startSudden');
 if(sudden&&!doc.getElementById('mathasSousThreeLives')){
  const three=doc.createElement('button');three.id='mathasSousThreeLives';
  three.type='button';three.className=sudden.className;
  three.textContent='❤️ 3 vies';three.title='Trois erreurs permises · preuve Connect';
  sudden.insertAdjacentElement('afterend',three);
 }
 const life=doc.getElementById('mathasSousThreeLives');
 if(sudden&&life&&!sudden.closest('.mathas-sub-survival-pair')&&!sudden.closest('.mathas-sous-record-buttons')){
  const row=doc.createElement('div');row.className='mathas-sub-survival-pair';
  sudden.parentElement.insertBefore(row,sudden);row.append(life,sudden);
 }
 for(const card of doc.querySelectorAll('#hardLevelGrid .hard-level-card')){
  const native=card.querySelector('.hard-start[data-mode="sudden"]');
  if(!native||card.querySelector('.mathas-sub-hard-three'))continue;
  const three=doc.createElement('button');three.type='button';
  three.className=native.className+' mathas-sub-hard-three';
  three.dataset.mode='three-lives';three.dataset.level=native.dataset.level;
  three.textContent='❤️ 3 vies';three.disabled=native.disabled;
  native.insertAdjacentElement('beforebegin',three);
 }
 if(!xp||!Array.isArray(xp.milestones))doc.querySelectorAll('.'+XP).forEach(n=>n.remove());
 else{
  const classicLevel=level(doc,'classicMaxDigits');
  for(const button of doc.querySelectorAll('#classicCountPicker .classic-count-btn[data-count]'))
   badge(doc,button,xpStillAvailable(xp,'classic',classicLevel,Number(button.dataset.count)));
  const suddenLevel=level(doc,'suddenMaxDigits');
  badge(doc,sudden,xpStillAvailable(xp,'sudden',suddenLevel));
  badge(doc,life,xpStillAvailable(xp,'three-lives',suddenLevel));
  for(const btn of doc.querySelectorAll('#hardLevelGrid .hard-start[data-mode="sudden"],#hardLevelGrid .hard-start[data-mode="three-lives"]')){
   badge(doc,btn,xpStillAvailable(xp,btn.dataset.mode==='three-lives'?'hard-three-lives':'hard-sudden',hardLevel(btn)));
  }
 }
 if(!rewards)doc.querySelectorAll('.'+CUP).forEach(n=>n.remove());
 else{
  for(const btn of doc.querySelectorAll('#classicCountPicker .classic-count-btn[data-count]'))
   cups(doc,btn,officialCups(rewards,'classic',level(doc,'classicMaxDigits')));
  cups(doc,sudden,officialCups(rewards,'sudden',level(doc,'suddenMaxDigits')));
  for(const btn of doc.querySelectorAll('#hardLevelGrid .hard-start[data-mode="sudden"]'))
   cups(doc,btn,officialCups(rewards,'hard-sudden',hardLevel(btn)));
 }
 return true;
}
