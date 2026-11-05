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
// Réutilise les cartes natives : Top du jour, coupes et podium historique.
// Le clic ne propose que l'envoi volontaire d'un score certifié Connect.
export function createSchoolScoreView({appKey,fetchHistory,consent,notify}){
 if(!['addition-ecrite-simple','addition-ecrite-multiple','multiplication-ecrite-simple','soustraction-ecrite-simple'].includes(appKey))
  throw Error('unsupported_score_app');
 let state={},remote=null,documentRef=null,loading=null,destroyed=false,clickTarget=null;
 const autoOffered=new Set();
 const select=()=>schoolScoreSnapshot(remote,state);
 const css='#mathasPointsQuick .mathas-points-quick-item--best.mathas-school-shareable{cursor:pointer;outline-offset:3px}'
  +'#mathasPointsQuick .mathas-points-quick-item--best.mathas-school-shareable:focus-visible{outline:3px solid #ffe3a1}'
  +'#mathasPointsQuick .mathas-school-share-hint{display:block;font:750 11px/1.35 system-ui;color:#c5e7f6;margin-top:4px}'
  +'body.light #mathasPointsQuick .mathas-school-share-hint,body.light-mode #mathasPointsQuick .mathas-school-share-hint{color:#24536c}';
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
    remote=result;return true;
   }catch{return false}
   finally{loading=null}
  })();
  return loading;
 }
 async function offerBest(){
  if(destroyed)return false;
  // L'élève choisit de proposer le score ; rien n'est publié sans Oui.
  const displayed=nativeBestPoints();
  await load(true);
  const snapshot=select();
  if(!snapshot.today){notify('Aucun score certifié aujourd’hui.');return false;}
  if(!snapshot.official||!snapshot.today.eventId){
   notify('Le score est conservé, mais son envoi nécessite une preuve certifiée Connect.');return false;
  }
  if(displayed===null||displayed!==snapshot.today.points){
   notify('Le score affiché ne correspond pas au meilleur score certifié Connect. Vérifie la synchronisation.');return false;
  }
  if(!canShareBestScore(snapshot)){
   notify('Ce score ne dépasse pas les points déjà présents au tableau de projection.');return false;
  }
  return !!consent()?.offer(snapshot.today.eventId);
 }
 async function recorded(eventId){
  if(!UUID.test(eventId)||destroyed||autoOffered.has(eventId))return false;
  if(!await load(true))return false;
  const snapshot=select();
  const row=[...snapshot.recent,...snapshot.top,snapshot.today].find(e=>e?.eventId===eventId);
  if(!row||snapshot.boardBest===null||row.points<=snapshot.boardBest)return false;
  const offered=!!consent()?.offer(eventId);
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
  hint.textContent='Cliquer pour proposer ce score à la projection';
  target.append(hint);
  target.addEventListener('click',onClick);
  target.addEventListener('keydown',onKeydown);
  // Ne PAS masquer mathasPointsQuick ni mathasPointsDetail, et ne pas
  // créer une deuxième section historique : les coupes natives restent.
 }
 function destroy(){
  destroyed=true;remote=null;state={};
  unbind();
  documentRef?.getElementById('mathasSchoolScoreActionStyle')?.remove();
  documentRef=null;
 }
 return Object.freeze({updateState(value){state=value&&typeof value==='object'?value:{}},
  load,recorded,mount,offerBest,destroy,read:select});
}
