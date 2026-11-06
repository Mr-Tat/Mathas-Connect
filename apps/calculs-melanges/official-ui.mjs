// UI scolaire de Mélange : contrôles officiels ajoutés SANS remplacer le moteur.
import {milestones,MAX_XP,RULES,HALF_RULES,QUARTER_RULES} from './xp-model.mjs';
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
 #mathasMixedXp{display:inline-flex;align-items:center;justify-content:center;padding:5px 9px;border-radius:8px;
  border:1px solid #caa44b;background:linear-gradient(160deg,#5b4518,#302614);color:#ffe4a3;
  font:800 11px system-ui;white-space:nowrap;cursor:default}
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
 @media(max-width:600px){#mathasMixedConnected,#mathasMixedXp{font-size:10px;min-height:25px}
  #mathasMixedReturn{font-size:11px;min-height:28px}}
 `;
 doc.head.append(style);
 const cluster=doc.querySelector('.mathas-top-cluster'),actions=doc.querySelector('.mathas-top-actions');
 if(!cluster||!actions)return null;
 const back=doc.createElement('a');back.id='mathasMixedReturn';back.href=returnHref;back.textContent='← HUB';
 actions.prepend(back);
 const connectedLabel=doc.createElement('span');connectedLabel.id='mathasMixedConnected';
 connectedLabel.textContent=connected?'● Connecté'+(className?' · '+className:''):'Mode libre';
 const xpLabel=doc.createElement('span');xpLabel.id='mathasMixedXp';
 cluster.insertBefore(connectedLabel,actions);cluster.insertBefore(xpLabel,actions);
 const source=()=>({
  level:Number(doc.getElementById('levelSelect')?.value)||1,
  ops:Math.max(1,doc.querySelectorAll('#opsSelector [data-op].active').length)
 });
 let currentState=state??{},currentXp=xp??null,lastShareId=null,lastSharePoints=null;
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
  xpLabel.textContent=connected?'⭐ '+scoreNumber(currentXp?.appXp)+' / '+MAX_XP+' XP':'XP : mode libre';
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
  update({state,xp,eventId,verifiedPoints}={}){if(state)currentState=state;if(xp)currentXp=xp;
   if(eventId){lastShareId=eventId;lastSharePoints=Number.isSafeInteger(Number(verifiedPoints))?Number(verifiedPoints):null}
   refresh()},
  destroy(){observer.disconnect();style.remove();back.remove();connectedLabel.remove();xpLabel.remove();share.remove()}
 });
}
