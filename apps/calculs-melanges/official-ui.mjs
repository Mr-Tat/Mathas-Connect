// UI scolaire de Mélange : contrôles officiels ajoutés SANS remplacer le moteur.
import {milestones,MAX_XP,RULES,HALF_RULES,QUARTER_RULES} from './xp-model.mjs';
import {renderCertifiedHistoricalPodium} from '../objective-record/school-score-view.mjs?v=20261106-history-top3-v1';
const COUNT=[2,3,4,5,6,7,8,9];
const scoreNumber=(v)=>Number.isSafeInteger(v)&&v>=0?v:0;
const rateRules=n=>n===3?RULES:n===2?HALF_RULES:QUARTER_RULES;
const scoreAt=(points,k)=>scoreNumber(points[k]);
export function mixedRemainingXp(state,mode,level,total=0,operationCount=3){
 if(![1,2,3].includes(level)||![1,2,3].includes(operationCount))return null;
 const rules=rateRules(operationCount),points=milestones(state||{}).points;
 if(mode==='classic'){
  const awards=total===4?[['4:perfect',rules.perfect4]]:total===10?[['10:pass',rules.pass10],['10:bonus',rules.bonus10]]
   :total===20?[['20:pass',rules.pass20],['20:bonus',rules.bonus20]]:[];
  return awards.reduce((s,[key,max])=>s+Math.max(0,max-scoreAt(points,'classic:'+level+':'+key)),0);
 }
 const isHard=mode.startsWith('hard');
 const three=mode.endsWith('three-lives');
 const key=isHard?'hard':'sudden';
 const levels=isHard?[[3,rules.hard3],[7,rules.hard7]]:[[5,rules.sudden5],[10,rules.sudden10]];
 return levels.reduce((s,[n,max])=>s+Math.max(0,(three?Math.round(max/2):max)-scoreAt(points,key+':'+level+':'+n)),0);
}
export function installMixedOfficialUi(doc,{connected=false,returnHref='../../hub.html',className='',state=null,xp=null,onShare=null}={}){
 if(!doc?.body||!doc.getElementById('menuScreen'))return null;
 const style=doc.createElement('style');style.id='mixed-connect-school-ui';style.textContent=`
 #mathasMixedConnected{display:inline-flex;align-items:center;padding:5px 9px;border-radius:8px;
  border:1px solid #568ba1;background:#15374b;color:#c5edf8;font:750 11px system-ui;white-space:nowrap}
 #mathasMixedXp{display:inline-flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;
  box-sizing:border-box;flex:0 0 177px;width:177px;height:51px;padding:6px 7px;border-radius:10px;
  border:1px solid #caa44b;background:linear-gradient(160deg,#795920,#4e3813);color:#ffe4a3;
  font:850 11px/1.14 system-ui;white-space:nowrap;cursor:pointer;
  box-shadow:inset 0 1px #ffffff40,0 4px 0 #36240d,0 8px 18px #0004}
 #mathasMixedXp:hover:not(:disabled){filter:brightness(1.13);transform:translateY(-1px)}
 #mathasMixedXp:active:not(:disabled){transform:translateY(3px);box-shadow:inset 0 1px 4px #0008,0 1px 0 #36240d}
 #mathasMixedXp:disabled{cursor:default;opacity:.7}
 #mathasMixedXp .mathas-xp-action-main{font-variant-numeric:tabular-nums}
 #mathasMixedXp .mathas-xp-action-detail{font:650 9.5px/1.12 system-ui;opacity:.75}
 #mathasMixedXpDetails{position:fixed;z-index:20020;top:12px;right:12px;box-sizing:border-box;
  width:min(430px,calc(100vw - 24px));max-height:calc(100dvh - 24px);overflow:auto;
  padding:15px;background:#102b40;color:#f6f8ff;border:1px solid #ab8948;border-radius:13px;
  box-shadow:0 14px 34px #0009;font:12px/1.42 system-ui}
 #mathasMixedXpDetails[hidden]{display:none!important}
 #mathasMixedXpDetails header{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:0 0 12px!important}
 #mathasMixedXpDetails header button{border:1px solid #bb9855;border-radius:7px;background:#49391d;color:#f9e9bf;padding:5px 10px;cursor:pointer}
 #mathasMixedXpDetails table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}
 #mathasMixedXpDetails td{padding:6px 2px;border-bottom:1px solid #ffffff20}
 #mathasMixedXpDetails td:last-child{text-align:right;white-space:nowrap}
 #mathasMixedXpDetails .mixed-xp-level{font-weight:850;color:#ffe4a3;background:#ffffff0c}
 #mathasMixedReturn{display:inline-flex;align-items:center;justify-content:center;min-height:34px;
  padding:7px 12px;border-radius:9px;border:1px solid #5d90ad;background:#254259;color:#e3f5ff;
  font:800 12px system-ui;text-decoration:none;white-space:nowrap}
 #mathasMixedReturn:hover{filter:brightness(1.16)}
 #mathasMixedShare{display:inline-flex;align-items:center;margin:7px 0 0;padding:4px 9px;
  border-radius:7px;border:1px solid rgba(140,194,217,.35);background:rgba(87,149,181,.10);
  color:inherit;font:750 11px system-ui;white-space:nowrap;cursor:pointer;transition:filter .16s}
 #mathasMixedShare:hover{filter:brightness(1.22)}
 #mathasMixedShare[hidden]{display:none!important}
 .mathas-mixed-xp-badge{position:absolute!important;right:5px!important;bottom:4px!important;
  font:750 10px system-ui!important;color:#f9e5ac!important;pointer-events:none!important;
  background:rgba(0,0,0,.12)!important;padding:2px 4px!important;border-radius:5px!important;white-space:nowrap!important}
 #menuScreen .countBtn,#menuScreen #suddenBtn,#menuScreen #mixedThreeLives,#hardMenu .hard-sudden,
 #hardMenu .hard-three-lives{position:relative!important;padding-bottom:21px!important}
 #menuScreen .mathas-mixed-survival-pair>button{grid-column:auto!important}
 .mathas-trophies-hint,.mathas-platinum-action{display:inline-flex!important;border-radius:6px!important;
  padding:3px 7px!important;border:1px solid rgba(140,194,217,.35)!important;white-space:nowrap!important;
  text-transform:none!important;letter-spacing:0!important}
 .mathas-trophies-hint::after,.mathas-platinum-action::after{content:'›';padding-left:8px}
 .mathas-top-actions{display:flex!important;align-items:center!important;flex-wrap:wrap!important;gap:6px!important}
 .mathas-top-cluster{display:flex!important;align-items:center!important;flex-wrap:wrap!important;gap:8px!important}
 body.light-mode #mathasMixedConnected{background:#e8f3fc;color:#224456}
 body.light-mode .mathas-mixed-xp-badge{color:#492f08!important;background:#fff4d7!important}
 @media(max-width:600px){#mathasMixedConnected{font-size:10px;min-height:25px}
  #mathasMixedXp{width:158px;flex-basis:158px;height:51px;font-size:10px;padding:6px 4px}
  #mathasMixedXp .mathas-xp-action-detail{font-size:9px}
  #mathasMixedReturn{font-size:11px;min-height:28px}}
 `;
 doc.head.append(style);
 const cluster=doc.querySelector('.mathas-top-cluster'),actions=doc.querySelector('.mathas-top-actions');
 if(!cluster||!actions)return null;
 const back=doc.createElement('a');back.id='mathasMixedReturn';back.href=returnHref;back.textContent='← HUB';
 actions.prepend(back);
 const connectedLabel=doc.createElement('span');connectedLabel.id='mathasMixedConnected';
 connectedLabel.textContent=connected?'● Connecté'+(className?' · '+className:''):'Mode libre';
 const xpLabel=doc.createElement('button');xpLabel.id='mathasMixedXp';xpLabel.type='button';
 xpLabel.title='Voir les XP acquis et les récompenses encore possibles';
 const xpMain=doc.createElement('span');xpMain.className='mathas-xp-action-main';
 const xpDetail=doc.createElement('span');xpDetail.className='mathas-xp-action-detail';xpDetail.textContent='Voir le détail ›';
 xpLabel.append(xpMain,xpDetail);
 const xpPanel=doc.createElement('section');xpPanel.id='mathasMixedXpDetails';xpPanel.hidden=true;
 const xpHead=doc.createElement('header');
 const xpTitle=doc.createElement('strong');xpTitle.textContent='✨ Mes XP dans Mélange';
 const xpClose=doc.createElement('button');xpClose.type='button';xpClose.textContent='Fermer';
 xpClose.onclick=()=>{xpPanel.hidden=true;xpLabel.setAttribute('aria-expanded','false')};
 xpHead.append(xpTitle,xpClose);
 const xpContent=doc.createElement('div');
 xpPanel.append(xpHead,xpContent);doc.body.append(xpPanel);
 xpLabel.setAttribute('aria-controls',xpPanel.id);xpLabel.setAttribute('aria-expanded','false');
 cluster.insertBefore(connectedLabel,actions);cluster.insertBefore(xpLabel,actions);
 const source=()=>({
  level:Number(doc.getElementById('levelSelect')?.value)||1,
  ops:Math.max(1,doc.querySelectorAll('#opsSelector [data-op].active').length)
 });
 let currentState=state??{},currentXp=xp??null,lastShareId=null,lastSharePoints=null,currentHistory=null;
 const onEsc=e=>{if(e.key==='Escape'&&!xpPanel.hidden)xpClose.click()};doc.addEventListener('keydown',onEsc);
 function renderXpDetails(){
  if(xpPanel.hidden)return;
  xpContent.replaceChildren();
  const summary=doc.createElement('p');summary.textContent=scoreNumber(currentXp?.appXp)+' / '+MAX_XP+' XP acquis dans ce jeu.';xpContent.append(summary);
  const keys=milestones(currentState).points;
  const table=doc.createElement('table');
  const groups=[['4 calculs',[['4:perfect',RULES.perfect4]],'classic'],
   ['10 calculs',[['10:pass',RULES.pass10],['10:bonus',RULES.bonus10]],'classic'],
   ['20 calculs',[['20:pass',RULES.pass20],['20:bonus',RULES.bonus20]],'classic'],
   ['3 vies / Mort subite',[[5,RULES.sudden5],[10,RULES.sudden10]],'sudden'],
   ['HARD · 3 vies / Mort subite',[[3,RULES.hard3],[7,RULES.hard7]],'hard']];
  for(let lvl=1;lvl<=3;lvl++){
   const section=doc.createElement('tr');section.className='mixed-xp-level';const title=doc.createElement('td');
   title.colSpan=2;title.textContent='Niveau '+lvl;section.append(title);table.append(section);
   for(const [name,items,mode] of groups){
    const earned=items.reduce((sum,[key])=>sum+scoreNumber(keys[mode+':'+lvl+':'+key]),0);
    const max=items.reduce((sum,[,points])=>sum+points,0);
    const row=doc.createElement('tr'),a=doc.createElement('td'),b=doc.createElement('td');
    a.textContent=name;b.textContent=earned+' / '+max+' XP';row.append(a,b);table.append(row);
   }
  }
  xpContent.append(table);
 }
 xpLabel.onclick=()=>{if(!connected)return;xpPanel.hidden=!xpPanel.hidden;xpLabel.setAttribute('aria-expanded',String(!xpPanel.hidden));renderXpDetails()};
 const share=doc.createElement('button');share.type='button';share.id='mathasMixedShare';
 share.textContent='Proposer ce score ›';share.title='Proposer le score certifié du jour au tableau de projection';
 share.hidden=true;
 const top=doc.querySelector('#mathasPointsQuick .mathas-points-quick-item--best');
 top?.append(share);
 share.onclick=()=>{if(share.hidden||!lastShareId)return;onShare?.(lastShareId)};
 const badge=(button,value)=>{
  if(!button)return;
  let span=button.querySelector(':scope>.mathas-mixed-xp-badge');
  if(!span){span=doc.createElement('span');span.className='mathas-mixed-xp-badge';button.append(span)}
  const label=value===null?'':('Reste '+value+' XP');
  if(span.textContent!==label)span.textContent=label;
  span.hidden=value===null;
 };
 const refresh=()=>{
  const displayed=Number((doc.querySelector('#mathasPointsQuick [data-points="daily"]')?.textContent||'').replace(/[^\d]/g,''));
  const recent=Array.isArray(currentState?.recent)?currentState.recent.find(e=>e.eventId===lastShareId):null;
  const available=Number.isFinite(lastSharePoints)?lastSharePoints:Number(recent?.points);
  share.hidden=!(connected&&onShare&&lastShareId&&Number.isSafeInteger(available)&&available>0&&available===displayed);
  const totalXp=Number(currentXp?.total);
  const level=Number.isFinite(totalXp)&&totalXp>=0
   ?(totalXp<300?Math.floor(totalXp/50)+1:Math.floor((totalXp-300)/100)+7):null;
  connectedLabel.textContent=connected?'● Connecté'+(className?' · '+className:'')+(level!==null?' · Niveau '+level:''):'Mode libre';
  xpLabel.disabled=!connected;
  xpMain.textContent=connected?'✨ '+scoreNumber(currentXp?.appXp)+' / '+MAX_XP+' XP récupérés':'XP : mode libre';
  renderXpDetails();
  renderCertifiedHistoricalPodium(doc,currentHistory);
  if(!connected)return;
  const {level,ops}=source();
  for(const button of doc.querySelectorAll('#menuScreen .countBtn[data-count]'))
   badge(button,mixedRemainingXp(currentState,'classic',level,Number(button.dataset.count),ops));
  badge(doc.getElementById('suddenBtn'),mixedRemainingXp(currentState,'sudden',level,0,ops));
  badge(doc.getElementById('mixedThreeLives'),mixedRemainingXp(currentState,'three-lives',level,0,ops));
  for(const card of doc.querySelectorAll('#hardMenu .hard-card')){
   const n=Number(card.querySelector('h3')?.textContent.match(/[123]/)?.[0]||0);
   badge(card.querySelector('.hard-sudden'),mixedRemainingXp(currentState,'hard-sudden',n));
   badge(card.querySelector('.hard-three-lives'),mixedRemainingXp(currentState,'hard-three-lives',n));
  }
 };
 let scheduled=false;
 const observer=new MutationObserver(()=>{if(scheduled)return;scheduled=true;queueMicrotask(()=>{scheduled=false;refresh()})});
 observer.observe(doc.getElementById('menuScreen'),{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
 observer.observe(doc.getElementById('hardMenu'),{childList:true,subtree:true});
 refresh();
 return Object.freeze({
  update({state,xp,eventId,verifiedPoints,history}={}){if(state)currentState=state;if(xp)currentXp=xp;if(history?.ok===true&&Array.isArray(history.bestThree))currentHistory=history;
   if(eventId){lastShareId=eventId;lastSharePoints=Number.isSafeInteger(Number(verifiedPoints))?Number(verifiedPoints):null}
   refresh()},
  destroy(){observer.disconnect();doc.removeEventListener('keydown',onEsc);xpPanel.remove();style.remove();back.remove();connectedLabel.remove();xpLabel.remove();share.remove()}
 });
}
