/* Abaque: a single, non-blocking celebration only after local persistence or server acknowledgement. */
(()=>{'use strict';
 const names={stage1:'Construction',stage2:'Déplacements',one:'4 calculs',three:'12 calculs',five:'20 calculs',lives:'3 vies',sudden:'Mort subite'};
 const modal=document.getElementById('celebrateDialog');
 const nativeModal=window.MATHAS_CELEBRATE.modal;
 let pending=null,expiry=0;
 const banner=document.createElement('aside');banner.id='abaque-personal-celebration';banner.setAttribute('role','status');banner.setAttribute('aria-live','polite');banner.hidden=true;
 document.body.append(banner);
 const score=(n,total)=>total?String(n)+' / '+total:String(n).replace(/\B(?=(\d{3})+(?!\d))/g,' ')+' points';
 function message(info){
  const record=Number.isSafeInteger(info.previous)&&info.previous>0&&Number.isSafeInteger(info.result)&&info.result>info.previous;
  const trophies=Number.isSafeInteger(info.newTrophies)?Math.max(0,info.newTrophies):0;
  if(!record&&!trophies)return null;
  const title=trophies?(trophies>1?'Nouveaux trophées !':'Nouveau trophée !'):'Nouveau record personnel !';
  const mode=names[info.kind]||'Abaque';
  const detail=record?('Ton record en '+mode+' : '+score(info.previous,info.total)+' → '+score(info.result,info.total)):('Un nouvel exploit en '+mode+' !');
  const reward=[trophies?(trophies+' trophée'+(trophies>1?'s':'')+' débloqué'+(trophies>1?'s':'')):'',Number.isSafeInteger(info.xp)&&info.xp>0?('+'+info.xp+' XP confirmés'):''].filter(Boolean).join(' · ');
  return {title,detail,reward};
 }
 function decorate(){
  if(!pending||!modal.open)return false;
  const card=modal.querySelector('.celebrateCard');
  if(!card)return false;
  card.classList.add('abaque-personal-spotlight');
  card.querySelector('.abaque-personal-recap')?.remove();
  const section=document.createElement('section');section.className='abaque-personal-recap';section.setAttribute('role','status');
  const title=document.createElement('strong');title.textContent='✨ '+pending.title+' ✨';
  const detail=document.createElement('span');detail.textContent=pending.detail;
  section.append(title,detail);
  if(pending.reward){const extra=document.createElement('b');extra.textContent=pending.reward;section.append(extra);}
  const confetti=document.createElement('div');confetti.className='abaque-personal-confetti';confetti.setAttribute('aria-hidden','true');
  for(let i=0;i<16;i++){
   const piece=document.createElement('i');piece.style.setProperty('--i',String(i));piece.style.setProperty('--angle',((i*137)%360)+'deg');confetti.append(piece);
  }
  section.append(confetti);
  card.insertBefore(section,card.querySelector('.celebrateActions'));
  banner.hidden=true;banner.classList.remove('show');pending=null;
  return true;
 }
 window.MATHAS_CELEBRATE.modal=function(opts){
  modal.querySelector('.abaque-personal-recap')?.remove();
  modal.querySelector('.celebrateCard')?.classList.remove('abaque-personal-spotlight');
  nativeModal(opts);
  decorate();
 };
 function show(info){
  if(document.documentElement.dataset.abaqueBlocked)return false;
  const next=message(info);if(!next)return false;
  window.clearTimeout(expiry);
  pending=next;
  document.getElementById('celebrateToast')?.classList.remove('show');
  if(decorate())return true;
  banner.replaceChildren();
  const trophy=document.createElement('span');trophy.className='abaque-personal-icon';trophy.textContent=next.title.includes('trophée')?'🏆':'🌟';
  const title=document.createElement('strong');title.textContent=next.title;
  const detail=document.createElement('span');detail.textContent=next.detail;
  banner.append(trophy,title,detail);
  if(next.reward){const reward=document.createElement('b');reward.textContent=next.reward;banner.append(reward);}
  const confetti=document.createElement('div');confetti.className='abaque-personal-confetti';confetti.setAttribute('aria-hidden','true');
  for(let i=0;i<18;i++){const piece=document.createElement('i');piece.style.setProperty('--i',String(i));piece.style.setProperty('--angle',((i*139)%360)+'deg');confetti.append(piece);}
  banner.append(confetti);banner.hidden=false;banner.classList.remove('show');void banner.offsetWidth;banner.classList.add('show');
  expiry=window.setTimeout(()=>{banner.classList.remove('show');banner.hidden=true;pending=null;},3600);
  return true;
 }
 function fromServer(before,after,event){
  if(!before||!after||!event||event.completed!==true||after.duplicate)return false;
  const kind=event.kind,oldState=before.state||{},newState=after.state||{};
  let previous=0,result=0,total=null;
  if(kind==='build'||kind==='moves'){
   const key=kind==='build'?'stage1':'stage2';
   const stage=newState[key]||{},prior=oldState[key]||{};
   const priorScores=[...(prior.passScores||[]),prior.failedScore].filter(Number.isSafeInteger);
   previous=Math.max(0,prior.best||0,...priorScores);
   result=stage.best||0;total=kind==='build'?12:8;
  }else if(['one','three','five'].includes(kind)){
   previous=oldState.modeScores?.[kind]||0;
   result=newState.modeScores?.[kind]||0;
   total={one:4,three:12,five:20}[kind];
  }else if(kind==='sudden'||kind==='lives'){
   previous=oldState.recordsByMode?.[kind]||0;
   result=newState.recordsByMode?.[kind]||0;
  }else return false;
  const oldTrophies=new Set(before.trophies||[]);
  const newTrophies=(after.trophies||[]).filter(key=>!oldTrophies.has(key)).length;
  return show({kind:kind==='build'?'stage1':kind==='moves'?'stage2':kind,previous,result,total,newTrophies,xp:after.xp?.delta||0});
 }
 window.MATHAS_ABAQUE_HIGHLIGHT=Object.freeze({show,fromServer});
})();