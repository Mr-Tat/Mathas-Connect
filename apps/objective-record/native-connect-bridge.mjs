// Production addition games: the native menu is the entry point to the
// SAME server-issued arithmetic proofs. This module never grants XP itself.
const APPS=new Set(['addition-ecrite-simple','addition-ecrite-multiple']);
const CLASSIC={4:[['perfect',22]],10:[['pass',30],['bonus',6]],20:[['pass',50],['bonus',10]]};
const OTHER={sudden:[[5,10],[10,10]],hard:[[3,10],[7,10]]};
function nativeLevel(select,fallback=1){
 const chosen=select?.selectedOptions?.[0]?.textContent||'';
 const match=chosen.match(/Niveau\s*([123])/i);
 return match?Number(match[1]):fallback;
}
function hardLevel(button){
 const title=button.closest('.hard-level-card,.hard-card')?.querySelector('h3')?.textContent||'';
 const match=title.match(/(?:HARD\s*)?NIV(?:EAU)?\s*([123])/i);
 return Number(button.dataset.level||match?.[1]||0);
}
export function classifyNativeLaunch(button,doc){
 if(!button||button.disabled)return null;
 if(button.id==='startClassic'){
  const count=Number(doc.querySelector('#menuScreen .classic-count-btn.active')?.dataset.count||10);
  const level=nativeLevel(doc.getElementById('classicMaxDigits'));
  return [4,10,20].includes(count)?{mode:'classic',level,total:count}:null;
 }
 if(button.id==='startThreeLives'||button.id==='startSudden'){
  return {mode:button.id==='startThreeLives'?'three-lives':'sudden',
   level:nativeLevel(doc.getElementById('suddenMaxDigits'))};
 }
 const hard=button.closest('#hardMenu')||button.matches('.hard-start,.hard-three,.hard-sudden,.mlab-three,.mlab-pair button');
 if(!hard)return null;
 const raw=button.dataset.mode||(button.matches('.mlab-three,.hard-three')?'three-lives'
   :button.matches('.hard-sudden')?'sudden':'');
 if(!['sudden','three-lives'].includes(raw))return null;
 const level=hardLevel(button);
 return [1,2,3].includes(level)?{mode:raw==='sudden'?'hard-sudden':'hard-three-lives',level}:null;
}
function milestonePool(xp){
 if(!Array.isArray(xp?.milestones))return null;
 if(xp.repeatXp===true&&Number(xp.parcours)>=2){
  return Array.isArray(xp.currentMilestones)?new Set(xp.currentMilestones):null;
 }
 return new Set(xp.milestones);
}
export function xpStillAvailable(xp,mode,level,total=null){
 if(![1,2,3].includes(level))return null;
 const pool=milestonePool(xp);
 if(!pool)return null;
 let awards;
 if(mode==='classic')awards=CLASSIC[total]?.map(([key,points])=>[`classic:\${level}:\${total}:\${key}`,points]);
 else awards=OTHER[mode]?.map(([n,points])=>[`\${mode}:\${level}:\${n}`,points]);
 if(!awards)return null;
 return awards.reduce((n,[key,amount])=>n+(pool.has(key)?0:amount),0);
}
function applyBadge(button,amount,title){
 if(!button||amount===null||button.disabled)return;
 let label=button.querySelector('.mathas-connect-official-xp');
 if(!label){
  label=button.ownerDocument.createElement('span');
  label.className='mathas-connect-official-xp';
  button.appendChild(label);
 }
 const text='Reste '+amount+' XP';
 if(label.textContent!==text)label.textContent=text;
 label.title=title;
}
export function renderNativeOfficialXp(doc,appKey,xp){
 if(!doc?.head||!APPS.has(appKey)||!milestonePool(xp))return;
 if(!doc.getElementById('mathas-connect-official-xp-style')){
  const css=doc.createElement('style');
  css.id='mathas-connect-official-xp-style';
  css.textContent=`
    #menuScreen .classic-count-btn[data-count],#menuScreen #startThreeLives,
    #menuScreen #startSudden,#hardMenu button.hard-start,
    #hardMenu .mlab-pair button{position:relative!important;padding-bottom:21px!important}
    #menuScreen .mathas-connect-official-xp,#hardMenu .mathas-connect-official-xp{
      position:absolute!important;bottom:3px!important;right:7px!important;
      max-width:calc(100% - 11px)!important;display:block!important;
      pointer-events:none!important;white-space:nowrap!important;
      line-height:1.1!important;font-size:clamp(9px,1.25vw,11px)!important;
      font-weight:650!important;letter-spacing:0!important;opacity:.94!important;
      color:#f9e5ac!important;text-shadow:0 1px 2px #10202b!important;
      background:transparent!important;border:0!important;padding:0!important;
    }
    body.light-mode .mathas-connect-official-xp,body.light .mathas-connect-official-xp{
      color:#492f08!important;text-shadow:none!important
    }
  `;
  doc.head.append(css);
 }
 const classicLevel=nativeLevel(doc.getElementById('classicMaxDigits'));
 for(const button of doc.querySelectorAll('#menuScreen .classic-count-btn[data-count]')){
  const total=Number(button.dataset.count);
  applyBadge(button,xpStillAvailable(xp,'classic',classicLevel,total),
   'XP officiels encore accessibles pour cette série');
 }
 const lifeLevel=nativeLevel(doc.getElementById('suddenMaxDigits'));
 const lifeXp=xpStillAvailable(xp,'sudden',lifeLevel);
 for(const id of ['startThreeLives','startSudden'])
  applyBadge(doc.getElementById(id),lifeXp,'Récompenses XP communes aux modes 3 vies et Mort subite');
 for(const button of doc.querySelectorAll('#hardMenu .hard-start,#hardMenu .mlab-three,#hardMenu .hard-sudden')){
  const level=hardLevel(button);
  applyBadge(button,xpStillAvailable(xp,'hard',level),
   'Récompenses XP communes aux modes HARD 3 vies et Mort subite');
 }
}
export function installNativeCertifiedLaunch(doc,appKey,onLaunch){
 if(!doc?.addEventListener||!APPS.has(appKey)||typeof onLaunch!=='function')return;
 if(doc.__mathasCertifiedNativeRouter===true)return;
 doc.__mathasCertifiedNativeRouter=true;
 // Capture before the native engine's handlers. Programmatic clicks made by
 // the verified proof controller stay intact (isTrusted=false).
 doc.addEventListener('click',event=>{
  if(!event.isTrusted)return;
  const button=event.target?.closest?.('button');
  const choice=classifyNativeLaunch(button,doc);
  if(!choice)return;
  event.preventDefault();
  event.stopImmediatePropagation();
  onLaunch(choice);
 },true);
}
