// Tableau personnel scolaire des deux additions et de Multiplication. Source : événements validés
// côté Connect, jamais les scores libres en localStorage.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const day=value=>{
 const date=new Date(value);
 return Number.isFinite(date.getTime())
  ?new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Brussels',year:'numeric',month:'2-digit',day:'2-digit'}).format(date):'';
};
const today=()=>day(new Date());
const points=value=>value!==null&&value!==undefined&&value!==''&&Number.isSafeInteger(Number(value))&&Number(value)>=0?Number(value):null;
const modeNames={'classic':'Exercices','three-lives':'3 vies','sudden':'Mort subite',
 'hard-three-lives':'HARD · 3 vies','hard-sudden':'HARD · Mort subite'};
const viewMode=mode=>modeNames[mode]||'Partie certifiée';
export function cleanScoreEntry(row){
 if(!row||typeof row!=='object')return null;
 const score=points(row.score),pts=points(row.points),at=String(row.at||'');
 if(score===null||pts===null||!day(at))return null;
 return {eventId:UUID.test(row.eventId)?row.eventId:null,mode:String(row.mode||''),
  score,points:pts,total:points(row.total),at};
}
export function schoolScoreSnapshot(remote,state={}){
 const recent=(Array.isArray(remote?.events)?remote.events:state?.recent||[])
  .map(cleanScoreEntry).filter(Boolean);
 const top=(Array.isArray(remote?.bestThree)?remote.bestThree:recent)
  .map(cleanScoreEntry).filter(Boolean).sort((a,b)=>b.points-a.points||b.at.localeCompare(a.at)).slice(0,3);
 const remoteDay=cleanScoreEntry(remote?.todayBest);
 // student-load is already authenticated. Keep its certified daily best visible
 // even when the separate projection-history endpoint fails or is delayed.
 const localToday=state?.todayBest?.day===today()?points(state.todayBest.points):null;
 // Le serveur conserve le meilleur du jour même s'il est ancien et que
 // sa preuve ne figure plus dans les derniers événements. Ne pas l'inventer.
 const sameDay=recent.filter(x=>day(x.at)===today()).sort((a,b)=>b.points-a.points||b.at.localeCompare(a.at))[0]||null;
 const best=(remoteDay&&day(remoteDay.at)===today()?remoteDay:sameDay);
 const current=localToday!==null&&localToday>(best?.points??-1)
  ?{points:localToday,mode:'',eventId:null,score:0,at:''}:best;
 const boardBest=points(remote?.boardBest);
 return {recent,top,today:current,boardBest,official:remote?.ok===true};
}
export function canShareBestScore(snapshot){
 return !!(snapshot?.official&&snapshot.today?.eventId
  &&snapshot.boardBest!==null&&snapshot.today.points>snapshot.boardBest);
}

export function nativeDayPoints(top){
 // Le moteur met le nombre dans le premier span, puis ajoute parfois un
 // macaron RECORD. Ne jamais lire la concaténation « 20RECORD ».
 const box=top?.querySelector('[data-points="daily"]');
 const value=(box?.firstElementChild?.textContent??box?.textContent??'').trim();
 if(!/^\d[\d\s]*$/.test(value))return null;
 const n=Number(value.replace(/\s/g,''));
 return Number.isSafeInteger(n)&&n>=0?n:null;
}
// Affichage DOM uniquement : le serveur reste l'autorité des records Connect.
export function renderCertifiedHistoricalPodium(doc,history){
 if(history?.ok!==true||!Array.isArray(history.bestThree)||!doc?.querySelector)return false;
 const target=doc.querySelector('#mathasPointsDetail [data-points="allThree"]');
 if(!target)return false;
 const places=target.querySelectorAll('.mathas-v541-place');
 if(places.length!==3)return false; // Attendre le rendu natif pour préserver coupes et médailles.
 const records=history.bestThree.map(cleanScoreEntry).filter(Boolean)
  .sort((a,b)=>b.points-a.points||b.at.localeCompare(a.at)).slice(0,3);
 for(let i=0;i<3;i++){
  const label=places[i].querySelector('.mathas-v541-place-score');
  if(!label)continue;
  const record=records[i];
  const expected=record?record.points+' pts':'—';
  if(label.textContent.replace(/\s+/g,' ').trim()===expected)continue;
  label.textContent=record?String(record.points):'—';
  label.classList.remove('mathas-points-aid');
  if(record){const small=doc.createElement('small');small.textContent=' pts';label.append(small)}
 }
 return true;
}
// Le TOP DU JOUR natif était encore calculé avec l'ancien localStorage et
// pouvait afficher 0 malgré 27 points certifiés. Affichage exclusivement depuis
// le résumé authentifié (aucune écriture de score ou de XP).
export function renderCertifiedTodayPoints(doc,history,state={}){
 if(!doc?.querySelector)return false;
 const savedToday=state?.todayBest?.day===today()?points(state.todayBest.points):null;
 if(history?.ok!==true&&savedToday===null)return false;
 const box=doc.querySelector('#mathasPointsQuick [data-points="daily"]');
 if(!box)return false;
 const today=schoolScoreSnapshot(history,state).today;
 const value=String(today?.points??0);
 if(nativeDayPoints({querySelector:()=>box})===Number(value))return true;
 // Le premier élément doit porter le nombre pour l'outil de projection.
 // Aucun score local n'est converti en record officiel.
 box.textContent='';
 const num=doc.createElement('span');num.textContent=value;
 box.append(num);
 return true;
}
// Réutilise les cartes natives : Top du jour, coupes et podium historique.
// Le clic ne propose que l'envoi volontaire d'un score certifié Connect.
export function createSchoolScoreView({appKey,fetchHistory,consent,notify}){
 if(!['addition-ecrite-simple','addition-ecrite-multiple','multiplication-ecrite-simple','soustraction-ecrite-simple'].includes(appKey))
  throw Error('unsupported_score_app');
 let state={},remote=null,documentRef=null,loading=null,destroyed=false,clickTarget=null,podiumTarget=null,podiumObserver=null,dailyTarget=null,dailyObserver=null;
 const autoOffered=new Set();
 const select=()=>schoolScoreSnapshot(remote,state);
 const renderPodium=()=>{if(documentRef)renderCertifiedHistoricalPodium(documentRef,remote)};
 const renderToday=()=>{if(documentRef)renderCertifiedTodayPoints(documentRef,remote,state)};
 function mountToday(doc){
  const target=doc.querySelector('#mathasPointsQuick [data-points="daily"]');
  if(!target)return;
  if(target!==dailyTarget){
   dailyObserver?.disconnect();dailyTarget=target;
   if(typeof MutationObserver!=='undefined'){
    dailyObserver=new MutationObserver(renderToday);
    dailyObserver.observe(target,{childList:true,subtree:true,characterData:true});
   }
  }
  renderToday();
 }
 function mountPodium(doc){
  const target=doc.querySelector('#mathasPointsDetail [data-points="allThree"]');
  if(!target)return;
  if(target!==podiumTarget){
   podiumObserver?.disconnect();podiumTarget=target;
   if(typeof MutationObserver!=='undefined'){
    podiumObserver=new MutationObserver(renderPodium);
    podiumObserver.observe(target,{childList:true,subtree:true,characterData:true});
   }
  }
  renderPodium();
 }
 const css='#mathasPointsQuick .mathas-points-quick-item--best.mathas-school-shareable{cursor:pointer;outline-offset:3px}'
  +'#mathasPointsQuick .mathas-points-quick-item--best.mathas-school-shareable:focus-visible{outline:3px solid #ffe3a1}'
  // Le cadre est un repère VISUEL dans la carte déjà cliquable : aucune nouvelle zone de clic.
  +'#mathasPointsQuick .mathas-school-share-hint{display:inline-flex;align-items:center;justify-content:center;align-self:flex-start;flex:0 0 auto;width:max-content;max-width:calc(100% - 76px);box-sizing:border-box;padding:3px 6px;margin-top:4px;border:1px solid rgba(143,199,218,.36);border-radius:6px;background:rgba(35,83,110,.30);box-shadow:inset 0 1px 0 rgba(255,255,255,.05);font:750 10px/1.25 system-ui;color:#c5e7f6;white-space:normal;text-align:center;pointer-events:none}'
  +'#mathasPointsQuick .mathas-school-share-hint::after{content:"›";margin-left:7px;flex:none;font-size:1.12em;line-height:1;color:#eed48d}'
  +'#mathasPointsQuick .mathas-school-shareable:hover .mathas-school-share-hint,#mathasPointsQuick .mathas-school-shareable:focus-visible .mathas-school-share-hint{border-color:rgba(172,220,235,.64);background:rgba(40,100,125,.40)}'
  +'body.light #mathasPointsQuick .mathas-school-share-hint,body.light-mode #mathasPointsQuick .mathas-school-share-hint{color:#24536c;background:rgba(215,238,247,.72);border-color:rgba(69,127,153,.35)}';
 function nativeBestPoints(){return nativeDayPoints(clickTarget)}
 async function load(force=false){
  if(destroyed)return false;
  if(loading){
   if(!force)return loading;
   await loading;
  }
  loading=(async()=>{
   try{
    const result=await fetchHistory();
    if(result?.ok!==true||!Array.isArray(result.events)||destroyed)return false;
    remote=result;renderPodium();renderToday();return true;
   }catch{return false}
   finally{loading=null}
  })();
  return loading;
 }
 async function offerBest(){
  if(destroyed)return false;
  // L'élève choisit de proposer le score ; rien n'est publié sans Oui.
  if(!await load(true)){notify('Synchronisation du meilleur score indisponible. Réessaie.');return false;}
  const snapshot=select();
  if(!snapshot.today){notify('Aucun score certifié aujourd’hui.');return false;}
  if(!snapshot.official||!snapshot.today.eventId){
   notify('Le score est conservé, mais son envoi nécessite une preuve certifiée Connect.');return false;
  }
  if(!canShareBestScore(snapshot)){
   notify('Ce score ne dépasse pas les points déjà présents au tableau de projection.');return false;
  }
  return !!consent()?.offer(snapshot.today.eventId,{points:snapshot.today.points,mode:snapshot.today.mode});
 }
 async function recorded(eventId){
  if(!UUID.test(eventId)||destroyed||autoOffered.has(eventId))return false;
  if(!await load(true))return false;
  const snapshot=select();
  const row=[...snapshot.recent,...snapshot.top,snapshot.today].find(e=>e?.eventId===eventId);
  if(!row||!snapshot.today||snapshot.today.eventId!==eventId
   ||snapshot.boardBest===null||row.points<=snapshot.boardBest)return false;
  const offered=!!consent()?.offer(eventId,{points:row.points,mode:row.mode});
  if(offered)autoOffered.add(eventId);
  return offered;
 }
 const onClick=()=>{void offerBest()};
 const onKeydown=event=>{
  if(event.key==='Enter'||event.key===' '){event.preventDefault();void offerBest()}
 };
 function unbind(){
  if(!clickTarget)return;
  clickTarget.removeEventListener('click',onClick);
  clickTarget.removeEventListener('keydown',onKeydown);
  clickTarget.classList.remove('mathas-school-shareable');
  clickTarget.removeAttribute('role');
  clickTarget.removeAttribute('tabindex');
  clickTarget.removeAttribute('title');
  clickTarget.querySelector('.mathas-school-share-hint')?.remove();
  clickTarget=null;
 }
 function mount(doc){
  if(destroyed||!doc?.getElementById('menuScreen'))return;
  documentRef=doc;
  mountPodium(doc);
  mountToday(doc);
  const nativeTop=doc.getElementById('mathasPointsQuick');
  const target=nativeTop?.querySelector('.mathas-points-quick-item--best');
  if(!target)return;
  if(target===clickTarget)return; // Le watcher rappelle mount plusieurs fois.
  unbind();
  clickTarget=target;
  let style=doc.getElementById('mathasSchoolScoreActionStyle');
  if(!style){
   style=doc.createElement('style');style.id='mathasSchoolScoreActionStyle';
   style.textContent=css;doc.head.append(style);
  }
  target.classList.add('mathas-school-shareable');
  target.setAttribute('role','button');
  target.setAttribute('tabindex','0');
  target.setAttribute('title','Vérifier et proposer le meilleur score du jour au tableau');
  const hint=doc.createElement('span');hint.className='mathas-school-share-hint';
  hint.textContent='Proposer ce score à la projection';
  target.append(hint);
  target.addEventListener('click',onClick);
  target.addEventListener('keydown',onKeydown);
  // Ne PAS masquer mathasPointsQuick ni mathasPointsDetail, et ne pas
  // créer une deuxième section historique : les coupes natives restent.
 }
 function destroy(){
  destroyed=true;remote=null;state={};
  podiumObserver?.disconnect();podiumObserver=null;podiumTarget=null;
  dailyObserver?.disconnect();dailyObserver=null;dailyTarget=null;
  unbind();
  documentRef?.getElementById('mathasSchoolScoreActionStyle')?.remove();
  documentRef=null;
 }
 return Object.freeze({updateState(value){state=value&&typeof value==='object'?value:{};renderToday()},
  load,recorded,mount,offerBest,destroy,read:select});
}
