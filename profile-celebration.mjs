import {PROFILE_REWARDS} from './profile-rewards.mjs?v=20261104-levels-v2';

export const CELEBRATION_DETAILS=Object.freeze({
 animal:Object.freeze({icon:'🐾',preview:'🦊',title:'Un nouvel ami t’attend !',description:'Tu peux maintenant choisir un avatar animal.'}),
 color:Object.freeze({icon:'🎨',preview:'🌈',title:'À toi les couleurs !',description:'Tu peux maintenant choisir la couleur de fond de ton avatar.'}),
 smiley:Object.freeze({icon:'😀',preview:'🤩',title:'Exprime ton humeur !',description:'Tu peux maintenant choisir un avatar smiley.'}),
 alias:Object.freeze({icon:'✏️',preview:'✍️',title:'Ton nom d’aventurier !',description:'Tu peux maintenant choisir un pseudo pour ton profil.'}),
 object:Object.freeze({icon:'⚽',preview:'🚀',title:'De nouveaux avatars !',description:'Tu peux maintenant choisir un avatar objet.'})
});
const rewardByLevel=new Map(PROFILE_REWARDS.map(reward=>[reward.level,reward]));

export function eligibleCelebrations(pending,unlockLevel){
 if(!Array.isArray(pending))return [];
 return [...new Set(pending)]
  .filter(level=>Number.isSafeInteger(level)&&level<=unlockLevel&&rewardByLevel.has(level))
  .sort((a,b)=>a-b);
}

// Controller sans accès réseau : le HUB lui fournit une fonction d'ACK
// JWT-authentifiée. On ne célèbre rien sans preuve de niveau renvoyée par l'API.
export function createProfileCelebrations({documentRef,acknowledge,onPersonalize,enabled=true}){
 const $=id=>documentRef.getElementById(id);
 const root=$('reward-celebration');
 if(!root)throw Error('missing_profile_celebration');
 const continueButton=$('reward-continue'),customizeButton=$('reward-customize'),laterButton=$('reward-later');
 const confetti=$('reward-confetti');
 const praised=new Set(),deferred=new Set();
 let pending=[],current=null,busy=false,wantsPersonalize=false,focusBefore=null;
 for(let i=0;i<38;i++){
  const bit=documentRef.createElement('i');
  bit.className='reward-confetti-piece';
  bit.style.setProperty('--x',((i*37+11)%101)+'%');
  bit.style.setProperty('--delay',((i*17)%35)/10+'s');
  bit.style.setProperty('--drift',((i%2?-1:1)*(28+(i*13)%100))+'px');
  bit.style.setProperty('--turn',(i*67%720)+'deg');
  bit.style.setProperty('--duration',(2.3+(i%7)*.24)+'s');
  bit.style.setProperty('--hue',String([47,190,287,330,155][i%5]));
  confetti.append(bit);
 }
 function drawTimeline(reward){
  const strip=$('reward-milestones');strip.replaceChildren();
  for(const step of PROFILE_REWARDS){
   const item=documentRef.createElement('div');
   item.className='reward-milestone'+(step.level===reward.level?' current':step.level<reward.level?' earned':' upcoming');
   const number=documentRef.createElement('span');number.className='reward-milestone-level';number.textContent='Niv. '+step.level;
   const icon=documentRef.createElement('span');icon.className='reward-milestone-icon';
   icon.textContent=step.icon;
   const state=documentRef.createElement('span');state.className='reward-milestone-state';
   state.textContent=step.level===reward.level?'✓ Débloqué !':step.level<reward.level?'✓':'🔒';
   item.append(number,icon,state);strip.append(item);
  }
 }
 function present(){
  if(!enabled||current||!pending.length)return;
  const level=pending[0],reward=rewardByLevel.get(level);
  if(!reward)return;
  current=level;
  const details=CELEBRATION_DETAILS[reward.key];
  $('reward-level').textContent='Niveau '+level+' atteint !';
  $('reward-detail-title').textContent=details.title;
  $('reward-detail-text').textContent=details.description;
  $('reward-icon').textContent=details.icon;
  $('reward-preview').textContent=details.preview;
  $('reward-feedback').textContent='';
  continueButton.textContent=pending.length>1?'Découvrir la suite ✨':'Continuer vers le HUB';
  drawTimeline(reward);
  focusBefore=documentRef.activeElement;
  root.hidden=false;
  documentRef.body.classList.add('reward-celebration-open');
  const page=documentRef.querySelector('main.page-shell');
  if(page)page.inert=true;
  const header=documentRef.querySelector('header.topbar');
  if(header)header.inert=true;
  // Rejouer l'apparition pour chaque palier (sans minuteur ni polling).
  const card=$('reward-card');card.classList.remove('reward-pop');
  void card.offsetWidth;
  card.classList.add('reward-pop');
  continueButton.focus();
 }
 function hide(){
  root.hidden=true;
  documentRef.body.classList.remove('reward-celebration-open');
  const page=documentRef.querySelector('main.page-shell');
  if(page)page.inert=false;
  const header=documentRef.querySelector('header.topbar');
  if(header)header.inert=false;
  current=null;
  if(focusBefore?.isConnected)focusBefore.focus();
 }
 function receive(profile){
  if(!enabled||!profile||profile.status!=='approved'||profile.xp?.active!==true)return;
  const levels=eligibleCelebrations(profile.pendingProfileRewards,profile.unlockLevel);
  pending=[...new Set([...pending,...levels])]
   .filter(level=>!praised.has(level)&&!deferred.has(level))
   .sort((a,b)=>a-b);
  present();
 }
 async function finish(personalize=false){
  if(!enabled||current===null||busy)return;
  busy=true;
  continueButton.disabled=customizeButton.disabled=laterButton.disabled=true;
  $('reward-feedback').textContent='Enregistrement de ta récompense…';
  try{
   const acknowledged=await acknowledge(current);
   if(acknowledged?.celebratedLevel!==current)throw Error('confirmation_invalide');
   praised.add(current);
   pending=pending.filter(level=>level!==current);
   wantsPersonalize ||= personalize;
   $('reward-feedback').textContent='';
   hide();
   present();
   if(!current&&wantsPersonalize){
    wantsPersonalize=false;
    onPersonalize();
   }
  }catch{
   $('reward-feedback').textContent='Connexion momentanément indisponible. Réessaie ou choisis « Plus tard ».';
  }finally{
   busy=false;
   continueButton.disabled=customizeButton.disabled=laterButton.disabled=false;
  }
 }
 function later(){
  if(busy||current===null)return;
  // N'est PAS enregistré comme célébré ; sera reproposé lors d'une
  // prochaine visite au HUB, mais pas en boucle dans cet onglet.
  for(const level of pending)deferred.add(level);
  pending=[];wantsPersonalize=false;hide();
 }
 continueButton.onclick=()=>{void finish(false)};
 customizeButton.onclick=()=>{void finish(true)};
 laterButton.onclick=later;
 root.addEventListener('keydown',event=>{
  if(event.key==='Escape'){event.preventDefault();later();return}
  if(event.key!=='Tab')return;
  const focusable=[continueButton,customizeButton,laterButton].filter(b=>!b.disabled);
  if(!focusable.length){event.preventDefault();return}
  const first=focusable[0],last=focusable[focusable.length-1];
  if(event.shiftKey&&documentRef.activeElement===first){event.preventDefault();last.focus()}
  if(!event.shiftKey&&documentRef.activeElement===last){event.preventDefault();first.focus()}
 });
 return {receive,isOpen:()=>current!==null,reset(){
  pending=[];praised.clear();deferred.clear();wantsPersonalize=false;
  if(current!==null)hide();
 }};
}
