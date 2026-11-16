import {judgeCompletion} from './completion-contract.mjs';
// Publication uniquement volontaire et après confirmation du résultat par Connect.
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function createAbaqueProjectionShare({classId,base,key,appKey,token,identity,status}){
 const css=document.createElement('style');
 css.textContent=`#abaque-projection-consent{box-sizing:border-box;border:3px solid #4ca79f;
 border-radius:27px;width:min(760px,95vw);max-width:95vw;max-height:90dvh;min-height:min(430px,68dvh);
 padding:clamp(22px,4vw,50px);background:#f5fcfd;color:#153e48;text-align:center;
 box-shadow:0 24px 110px #052d3c88;z-index:11000}
 #abaque-projection-consent::backdrop{background:rgba(2,22,39,.83);backdrop-filter:blur(5px)}
 #abaque-projection-consent h2{font-size:clamp(1.6rem,4vw,2.8rem);line-height:1.18;margin:12px 0 22px}
 #abaque-projection-consent p{font-size:clamp(1.1rem,2vw,1.55rem);margin:12px 0 24px}
 #abaque-projection-consent .abaque-share-choices{display:grid;grid-template-columns:1fr 1fr;
 gap:clamp(12px,3vw,36px);margin-top:30px}
 #abaque-projection-consent .abaque-share-choices button{min-height:100px;border:3px solid #217e86;
 border-radius:19px;background:#e1f2f2;color:#144b56;font-weight:900;
 font-size:clamp(1.55rem,4vw,2.4rem);cursor:pointer}
 #abaque-projection-consent .abaque-share-choices button:is(:hover,:focus-visible){
 background:#c9eaea;outline:3px solid #f5c66c}
 @media(max-width:410px){#abaque-projection-consent .abaque-share-choices button{min-height:80px}}
 @media(prefers-reduced-motion:reduce){#abaque-projection-consent::backdrop{backdrop-filter:none}}`;
 document.head.append(css);
 const dialog=document.createElement('dialog');dialog.id='abaque-projection-consent';
 const title=document.createElement('h2');title.textContent='📺 Envoyer ton score au tableau ?';title.tabIndex=-1;
 const intro=document.createElement('p');
 const actions=document.createElement('div');actions.className='abaque-share-choices';
 const yes=document.createElement('button');yes.id='abaque-share-yes';yes.type='button';yes.textContent='Oui';
 const no=document.createElement('button');no.id='abaque-share-no';no.type='button';no.textContent='Non';
 actions.append(yes,no);dialog.append(title,intro,actions);document.body.append(dialog);
 let offered=null;
 const acked=new Set(),sending=new Set();
 const storageKey=()=>{
  const {subject,pupil}=identity();
  return uuid.test(subject||'')&&uuid.test(pupil||'')
    ?'mathas.abaque.projection.intents.'+[classId,subject,pupil].join('.')+'.v1':null;
 };
 function read(){
  const k=storageKey();if(!k)return [];
  try{const v=JSON.parse(localStorage.getItem(k)||'[]');
   return Array.isArray(v)?v.filter(x=>uuid.test(x?.eventId)).slice(-30):[];
  }catch{return [];}
 }
 function write(items){
  const k=storageKey();if(!k)return false;
  try{localStorage.setItem(k,JSON.stringify(items.slice(-30)));return true}catch{return false;}
 }
 function drop(id){write(read().filter(x=>x.eventId!==id));}
 function close(){offered=null;if(dialog.open)dialog.close();}
 no.onclick=close;
 dialog.addEventListener('cancel',event=>{event.preventDefault();close()});
 async function publish(id){
  if(!uuid.test(id)||sending.has(id)||!read().some(x=>x.eventId===id))return;
  if(!identity().sessionActive||!navigator.onLine)return;
  sending.add(id);
  try{
   const bearer=await token();
   const response=await fetch(base+'/functions/v1/connect-projection-v2',{
    method:'POST',cache:'no-store',
    headers:{apikey:key,authorization:'Bearer '+bearer,'content-type':'application/json'},
    body:JSON.stringify({action:'student-share-score',classId,appKey,eventId:id})
   });
   const result=await response.json().catch(()=>null);
   if(response.ok&&result?.ok===true){
    drop(id);status.textContent='✅ Score envoyé au tableau !';
    window.MATHAS_CELEBRATE?.toast('📺 Score envoyé au tableau !');
   }else if(['not_improved','score_reset','invalid_score_event'].includes(result?.error)){
    drop(id);
    status.textContent=result.error==='not_improved'
      ?'Ton meilleur score envoyé est déjà supérieur ou égal.':'Ce score ne peut pas être publié.';
   }else status.textContent='Envoi au tableau en attente. Reconnecte-toi pour réessayer.';
  }catch{status.textContent='Envoi au tableau en attente : connexion nécessaire.';}
  finally{sending.delete(id);}
 }
 yes.onclick=()=>{
  const event=offered;close();if(!event)return;
  if(!write([...read().filter(x=>x.eventId!==event.eventId),{eventId:event.eventId}])){
   status.textContent='Le choix Oui n’a pas pu être enregistré. Vérifie le stockage.';return;
  }
  status.textContent='Envoi au tableau demandé · validation du score en cours…';
  if(acked.has(event.eventId))void publish(event.eventId);
 };
 return Object.freeze({
  offer(event){
   if(!event?.completed||!['one','three','five','sudden','lives'].includes(event.kind))return;
   let result;try{result=judgeCompletion(event)}catch{return;}
   if(result.points<=0)return;
   offered={eventId:event.eventId};
   intro.textContent=result.points+' points · C’est toi qui décides de partager ce score avec ta classe.';
   queueMicrotask(()=>{if(offered?.eventId===event.eventId&&!dialog.open
     &&!document.documentElement.dataset.abaqueBlocked){dialog.showModal();title.focus({preventScroll:true});}});
  },
  ack(event){
   if(uuid.test(event?.eventId)){
    acked.add(event.eventId);
    if(read().some(x=>x.eventId===event.eventId))void publish(event.eventId);
   }
  },
  flush(){for(const item of read())void publish(item.eventId);}
 });
}
