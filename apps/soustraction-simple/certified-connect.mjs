// Soustraction écrite : raccord scolaire certifié, sans scores déclaratifs du navigateur.
// Les épreuves sont émises et validées par connect-soustraction-school.
import {createCertifiedSubtraction} from './certified-school.mjs';
import {installSubtractionSchoolUi} from './school-ui.mjs';
import {createSchoolScoreView} from '../objective-record/school-score-view.mjs';

const NORMAL_LEVELS=Object.freeze({3:1,5:2,7:3});
export function createSubtractionSchoolConnect({
 iframe,cloud,session,classId,appKey,url,key,consent,
 getState,setState,applyState,loadXp,queueXpGain,notify=()=>{}
}){
 if(!iframe||!cloud||!session?.user?.id)throw Error('Connect non approuvé');
 const getToken=async()=>{
  const auth=(await cloud.auth.getSession()).data.session;
  if(!auth?.access_token||auth.user?.id!==session.user.id)throw Error('connect_session_changed');
  return auth.access_token;
 };
 async function endpoint(slug,body){
  const token=await getToken();
  const response=await fetch(url+'/functions/v1/'+slug,{
   method:'POST',headers:{apikey:key,authorization:'Bearer '+token,'content-type':'application/json'},
   body:JSON.stringify(body)
  });
  const data=await response.json().catch(()=>null);
  if(!response.ok||data?.ok!==true)throw Error(data?.error||'school_service_unavailable');
  return data;
 }
 const scoreView=createSchoolScoreView({
  appKey,
  fetchHistory:()=>endpoint('connect-projection-v2',
   {action:'student-score-history',classId,appKey}),
  consent:()=>consent,
  notify
 });
 scoreView.updateState(getState()||{});
 void scoreView.load();
 async function refresh(){
  const fresh=await endpoint('connect-results',{action:'student-load',classId,appKey});
  setState(fresh);
  applyState(fresh.state);
  if(fresh.state?.rewards){
   localStorage.setItem('mathas_trophies_v3_soustraction-ecrite',
    JSON.stringify(fresh.state.rewards));
  }
  scoreView.updateState(fresh.state||{});
  void scoreView.load(true);
  iframe.contentWindow?.MathasPoints?.render?.();
  const xp=await loadXp();
  mount();
  return xp;
 }
 const certified=createCertifiedSubtraction({
  documentRef:document,storage:localStorage,
  getContext:()=>({connected:true,classId,studentId:session.user.id}),
  call:(action,body)=>endpoint('connect-soustraction-school',{action,classId,...body}),
  refresh,
  onVerified:async receipt=>{
   if(receipt.ack?.proofVerified!==true)return;
   const xp=receipt.ack.xp;
   if(receipt.ack.duplicate!==true&&Number.isSafeInteger(xp?.delta)&&xp.delta>0)
    queueXpGain(xp);
   if(receipt.ack.duplicate!==true)await scoreView.recorded(receipt.eventId);
  },
  notify
 });
 const getNormalLevel=(doc,id)=>NORMAL_LEVELS[Number(doc.getElementById(id)?.value)]||0;
 function mount(){
  const doc=iframe.contentDocument;
  if(!doc?.getElementById('menuScreen'))return false;
  installSubtractionSchoolUi(doc,{
   connected:true,xp:getState()?.xp??currentXp,rewards:getState()?.state?.rewards
  });
  scoreView.mount(doc);
  if(doc.__mathasSubCertifiedRouter)return true;
  doc.__mathasSubCertifiedRouter=true;
  doc.addEventListener('click',event=>{
   // L'événement humain passe AVANT les gestionnaires du jeu autonome.
   if(!event.isTrusted)return;
   const btn=event.target?.closest?.('button');
   if(!btn||btn.disabled)return;
   let choice=null;
   if(btn.id==='startClassic'||btn.matches('#classicCountPicker .classic-count-btn[data-count]')){
    // Le moteur V6 lance immédiatement la série depuis 4/10/20. Intercepter
    // le VRAI clic humain sur ce choix, et non le startClassic.click() synthétique.
    if(btn.id==='startClassic'&&doc.getElementById('trainingChoiceBtn')?.classList.contains('active'))return;
    const total=btn.matches('.classic-count-btn[data-count]')?Number(btn.dataset.count)
      :Number(doc.querySelector('#classicCountPicker .classic-count-btn.active[data-count]')?.dataset.count||10);
    choice={mode:'classic',level:getNormalLevel(doc,'classicMaxDigits'),total};
   }else if(btn.id==='startSudden'||btn.id==='mathasSousThreeLives'){
    choice={mode:btn.id==='startSudden'?'sudden':'three-lives',
     level:getNormalLevel(doc,'suddenMaxDigits')};
   }else if(btn.matches('#hardLevelGrid .hard-start[data-mode="sudden"],#hardLevelGrid .hard-start[data-mode="three-lives"]')){
    choice={mode:btn.dataset.mode==='three-lives'?'hard-three-lives':'hard-sudden',
     level:Number(btn.dataset.level)};
   }
   if(!choice||![1,2,3].includes(choice.level)||
    (choice.mode==='classic'&&![4,10,20].includes(choice.total)))return;
   event.preventDefault();
   event.stopImmediatePropagation();
   const method=doc.querySelector('input[name="borrowMethod"]:checked')?.value==='takeTop'
    ?'takeTop':'addBottom';
   void certified.start({...choice,method});
  },true);
  return true;
 }
 let currentXp=null;
 function setXp(data){currentXp=data;mount()}
 function destroy(){certified.destroy();scoreView.destroy()}
 return Object.freeze({mount,setXp,destroy,certified,scoreView});
}
