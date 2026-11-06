// HABILLAGE scolaire de Soustraction : fonds et moteur graphique natifs intacts.
import {xpStillAvailable} from '../objective-record/native-connect-bridge.mjs?v=20261106-survival-40xp-v1';
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
 // Le menu réserve d'emblée l'espace XP et coupes : leur arrivée asynchrone
 // ne déplace pas les boutons 4 / 10 / 20 sous le pointeur de l'élève.
 '#menuScreen #classicCountPicker .classic-count-btn[data-count]{position:relative!important;padding-top:19px!important;padding-bottom:24px!important}',
 '.mathas-sub-survival-pair,.mathas-sous-record-buttons{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:9px!important;width:100%!important}',
 '/* Survie : empêcher les règles natives grid-column:1/-1 de faire passer Mort subite dessous. */',
 '#menuScreen .mode-card.sudden .mathas-sous-record-buttons{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;grid-auto-flow:row!important;gap:9px!important;width:100%!important;min-width:0!important;align-items:stretch!important}',
 '#menuScreen .mode-card.sudden .mathas-sous-record-buttons>#mathasSousThreeLives{grid-column:1!important;grid-row:1!important;min-width:0!important;width:100%!important}',
 '#menuScreen .mode-card.sudden .mathas-sous-record-buttons>#startSudden{grid-column:2!important;grid-row:1!important;min-width:0!important;width:100%!important}',
 '#menuScreen .mode-card.sudden>.mathas-sous-three-info{grid-column:1/-1!important;display:block!important;text-align:center!important;margin:5px 0 0!important}',
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
 '#menuScreen .mode-card:has(#classicCountPicker){position:relative!important}',
 '#menuScreen .mathas-sub-classic-mastered{position:absolute;top:11px;right:12px;display:inline-flex;align-items:center;justify-content:center;pointer-events:none;z-index:5;filter:drop-shadow(0 1px 4px #f6c45d88)}',
 '#menuScreen .mathas-sub-classic-mastered .mathas-v602-trophy-cup{font-size:24px!important}',
 // La bande de trophées native garde son clic (ouvre les défis).
 // Son indication est un cadre discret et non un second bouton.
 '#menuScreen #mathasTrophiesStrip .mathas-trophies-hint{display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:0!important;max-width:100%!important;width:max-content!important;padding:5px 9px!important;border:1px solid rgba(143,199,218,.44)!important;border-radius:8px!important;background:rgba(33,80,104,.37)!important;color:#c5e7f6!important;font:800 11px/1.2 system-ui!important;letter-spacing:.03em!important;white-space:nowrap!important;text-transform:uppercase!important;cursor:pointer!important}',
 '#menuScreen #mathasTrophiesStrip .mathas-trophies-hint::after{content:"›"!important;margin-left:8px!important;color:#eed48d!important;font-size:16px!important;line-height:1!important}',
 'body.light-mode #menuScreen #mathasTrophiesStrip .mathas-trophies-hint{background:rgba(215,238,247,.72)!important;color:#24536c!important}',
 '#menuScreen #mathasTrophiesStrip .mathas-trophies-hint:hover{border-color:#b4dbe9!important}',
 '@media(max-width:440px){.mathas-sub-survival-pair>button,#hardLevelGrid .hard-mode-buttons>button{font-size:12px!important}}'
 ].join('\n');doc.head.append(css);
}
export function installSubtractionSchoolUi(doc,{connected=false,xp=null,rewards=null}={}){
 if(!connected||!doc?.getElementById?.('menuScreen'))return false;
 style(doc);
 const sudden=doc.getElementById('startSudden');
 if(sudden)sudden.title='Mort subite · défi officiel Connect';
 if(sudden&&!doc.getElementById('mathasSousThreeLives')){
  const three=doc.createElement('button');three.id='mathasSousThreeLives';
  three.type='button';three.className=sudden.className;
  three.textContent='❤️ 3 vies';three.title='Trois erreurs permises · preuve Connect';
  sudden.insertAdjacentElement('afterend',three);
 }
 const life=doc.getElementById('mathasSousThreeLives');
 // Sur un compte Connect, les deux modes donnent accès aux épreuves officielles.
 // Ne pas conserver l'étiquette d'entraînement de la version libre.
 const practiceNote=doc.querySelector('#menuScreen .mathas-sous-three-info');
 if(practiceNote)practiceNote.textContent='3 vies et Mort subite : résultats certifiés par Connect.';
 // Ces boutons sont déjà réunis par le lanceur. Leur position doit rester
 // identique même si le moteur natif réapplique des règles de grille.
 const recordPair=doc.querySelector('#menuScreen .mode-card.sudden .mathas-sous-record-buttons');
 if(recordPair&&sudden&&life){
  recordPair.style.setProperty('display','grid','important');
  recordPair.style.setProperty('grid-template-columns','repeat(2,minmax(0,1fr))','important');
  recordPair.style.setProperty('grid-auto-flow','row','important');
  recordPair.style.setProperty('gap','9px','important');
  for(const [button,column] of [[life,'1'],[sudden,'2']]){
   if(button.parentElement!==recordPair)recordPair.append(button);
   button.style.setProperty('grid-column',column,'important');
   button.style.setProperty('grid-row','1','important');
   button.style.setProperty('min-width','0','important');
   button.style.setProperty('width','100%','important');
  }
 }
 if(life)life.title='Trois erreurs possibles · défi officiel Connect';
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
 const earnedXp=Array.isArray(xp?.milestones)?xp:
  Array.isArray(xp?.currentMilestones)?{...xp,milestones:xp.currentMilestones}:null;
 if(!earnedXp)doc.querySelectorAll('.'+XP).forEach(n=>n.remove());
 else{
  const classicLevel=level(doc,'classicMaxDigits');
  for(const button of doc.querySelectorAll('#classicCountPicker .classic-count-btn[data-count]'))
   badge(doc,button,xpStillAvailable(earnedXp,'classic',classicLevel,Number(button.dataset.count)));
  const suddenLevel=level(doc,'suddenMaxDigits');
  badge(doc,sudden,xpStillAvailable(earnedXp,'sudden',suddenLevel));
  badge(doc,life,xpStillAvailable(earnedXp,'three-lives',suddenLevel));
  for(const btn of doc.querySelectorAll('#hardLevelGrid .hard-start[data-mode="sudden"],#hardLevelGrid .hard-start[data-mode="three-lives"]')){
   badge(doc,btn,xpStillAvailable(earnedXp,btn.dataset.mode==='three-lives'?'hard-three-lives':'hard-sudden',hardLevel(btn)));
  }
 }
 // L'indicateur de maîtrise porte sur les trois séries 4/10, 10/10 et
 // 20/20 du niveau sélectionné, et non sur des XP ou un score local.
 const classicCard=doc.querySelector('#menuScreen .mode-card:has(#classicCountPicker)');
 const masteryLevel=level(doc,'classicMaxDigits');
 const mastered=rewards?.version===3&&[4,10,20].every(n=>rewards?.mastery?.[n]?.[masteryLevel-1]===true);
 const oldMastery=classicCard?.querySelector(':scope > .mathas-sub-classic-mastered');
 if(classicCard&&mastered){
  let indicator=oldMastery;
  if(!indicator){
   indicator=doc.createElement('span');indicator.className='mathas-sub-classic-mastered';
   indicator.setAttribute('aria-label','Maîtrise complète du niveau');
   classicCard.append(indicator);
  }
  const native=doc.querySelector('.mathas-v602-trophy-cup[data-trophy-color="'+NAMES[masteryLevel-1]+'"]');
  if(!indicator.firstChild){indicator.append(native?.cloneNode(true)||doc.createTextNode('🏆'))}
  indicator.title='Maîtrise du niveau '+masteryLevel+' : 4/4, 10/10 et 20/20 obtenus';
 }else oldMastery?.remove();
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
