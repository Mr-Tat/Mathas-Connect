// Tableau personnel des deux additions scolaires. Source : événements validés
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

export function createSchoolScoreView({appKey,fetchHistory,consent,notify}){
 if(!['addition-ecrite-simple','addition-ecrite-multiple'].includes(appKey))
  throw Error('unsupported_score_app');
 let state={},remote=null,documentRef=null,loading=null,destroyed=false;
 const autoOffered=new Set();
 const select=()=>schoolScoreSnapshot(remote,state);
 const style=`
 #mathasSchoolScoreTop{box-sizing:border-box;display:flex;width:100%;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;
  border:1px solid #6c9fb8;border-radius:15px;padding:12px 16px;margin:9px 0;background:linear-gradient(130deg,#153a56,#1c4d66);
  color:#effaff;text-align:left;cursor:pointer;font:700 13px system-ui}
 #mathasSchoolScoreTop .mathas-school-number{font:950 clamp(1.4rem,4vw,2.05rem) system-ui;color:#ffe3a1}
 #mathasSchoolScoreTop .mathas-school-hint{display:block;font-size:11px;color:#c9e6f3;margin-top:4px}
 #mathasSchoolScoreTop:focus-visible{outline:3px solid #ffe3a1;outline-offset:3px}
 #mathasSchoolScoreHistory{margin-top:13px;padding:15px;border:1px solid #749eb5;border-radius:15px;background:#123049;color:#ecf9ff}
 #mathasSchoolScoreHistory h3{margin:0 0 10px;font-size:15px}
 #mathasSchoolScoreHistory h4{margin:12px 0 5px;font-size:12px;color:#ffdca5}
 #mathasSchoolScoreHistory ol{padding-left:22px;margin:4px 0 0}
 #mathasSchoolScoreHistory li{font:650 12px/1.5 system-ui;padding:3px 0;border-bottom:1px solid #ffffff24}
 #mathasSchoolScoreHistory .mathas-school-empty{font-size:12px;color:#c9e6f3}
 body.light #mathasSchoolScoreTop,body.light-mode #mathasSchoolScoreTop,
 body.light #mathasSchoolScoreHistory,body.light-mode #mathasSchoolScoreHistory{
  background:#e6f4fb;color:#244357;border-color:#86b0c6}
 body.light #mathasSchoolScoreTop .mathas-school-number,body.light-mode #mathasSchoolScoreTop .mathas-school-number,
 body.light #mathasSchoolScoreHistory h4,body.light-mode #mathasSchoolScoreHistory h4{color:#945f11}
 body.light #mathasSchoolScoreTop .mathas-school-hint,body.light-mode #mathasSchoolScoreTop .mathas-school-hint,
 body.light #mathasSchoolScoreHistory .mathas-school-empty,body.light-mode #mathasSchoolScoreHistory .mathas-school-empty{color:#426779}
 `;
 function textList(container,rows,empty){
  if(!container)return;
  container.replaceChildren();
  if(!rows.length){const p=documentRef.createElement('p');p.className='mathas-school-empty';p.textContent=empty;container.append(p);return;}
  const list=documentRef.createElement('ol');
  for(const entry of rows){
   const li=documentRef.createElement('li');
   const at=new Date(entry.at).toLocaleDateString('fr-BE',{day:'2-digit',month:'2-digit',timeZone:'Europe/Brussels'});
   li.textContent=at+' · '+viewMode(entry.mode)+' · '+entry.score+(entry.total!=null?'/'+entry.total:'')+
    ' · '+entry.points+' points';
   list.append(li);
  }
  container.append(list);
 }
 function render(){
  if(!documentRef||destroyed)return;
  const snapshot=select(),button=documentRef.getElementById('mathasSchoolScoreTop');
  if(!button)return;
  const todayScore=snapshot.today;
  button.querySelector('[data-score-today]').textContent=todayScore?String(todayScore.points):'—';
  const hint=button.querySelector('[data-score-hint]');
  hint.textContent=!todayScore?'Aucune partie certifiée aujourd’hui.'
   :!snapshot.official?'Historique en cours de synchronisation.'
   :!todayScore.eventId?'Preuve de ce record indisponible pour le partage.'
   :canShareBestScore(snapshot)?'Cliquer pour proposer cet envoi au tableau.'
   :'Le tableau possède déjà un score au moins aussi élevé.';
  button.setAttribute('aria-label',todayScore
   ?'Meilleur score du jour : '+todayScore.points+' points. '+hint.textContent
   :'Aucun score certifié aujourd’hui');
  textList(documentRef.querySelector('#mathasSchoolScoreHistory [data-best-three]'),snapshot.top,
   'Aucun record certifié enregistré.');
  textList(documentRef.querySelector('#mathasSchoolScoreHistory [data-score-history]'),snapshot.recent.slice(0,12),
   'Aucune partie certifiée enregistrée.');
 }
 async function load(force=false){
  if(destroyed)return false;
  if(loading){
   if(!force)return loading;
   await loading; // Relire après ACK même si une ancienne lecture était en vol.
  }
  loading=(async()=>{
   try{
    const result=await fetchHistory();
    if(result?.ok!==true||!Array.isArray(result.events))return false;
    if(destroyed)return false;
    remote=result;render();return true;
   }catch{return false}
   finally{loading=null}
  })();
  return loading;
 }
 async function offerBest(){
  if(destroyed)return false;
  await load(true);
  const snapshot=select();
  if(!snapshot.today){notify('Aucun score certifié aujourd’hui.');return false;}
  if(!snapshot.official||!snapshot.today.eventId){
   notify('Le score est conservé, mais son envoi nécessite la synchronisation Connect.');return false;
  }
  if(!canShareBestScore(snapshot)){
   notify('Envoi refusé : le score du jour n’améliore pas les points déjà au tableau.');return false;
  }
  return !!consent()?.offer(snapshot.today.eventId);
 }
 async function recorded(eventId){
  if(!UUID.test(eventId)||destroyed)return false;
  if(autoOffered.has(eventId))return false;
  const ok=await load(true);
  if(!ok)return false;
  const snapshot=select();
  const row=[...snapshot.recent,...snapshot.top,snapshot.today].find(e=>e?.eventId===eventId);
  if(!row||snapshot.boardBest===null||row.points<=snapshot.boardBest)return false;
  const offered=!!consent()?.offer(eventId);
  if(offered)autoOffered.add(eventId);
  return offered;
 }
 function mount(doc){
  if(destroyed||!doc?.getElementById('menuScreen'))return;
  documentRef=doc;
  let css=doc.getElementById('mathasSchoolScoreStyle');
  if(!css){css=doc.createElement('style');css.id='mathasSchoolScoreStyle';css.textContent=style;doc.head.append(css)}
  const nativeTop=doc.getElementById('mathasPointsQuick');
  const nativeHistory=doc.getElementById('mathasPointsDetail');
  if(nativeTop)nativeTop.style.setProperty('display','none','important');
  if(nativeHistory)nativeHistory.style.setProperty('display','none','important');
  let button=doc.getElementById('mathasSchoolScoreTop');
  if(!button){
   button=doc.createElement('button');button.type='button';button.id='mathasSchoolScoreTop';
   button.innerHTML='<span><strong>🏅 Meilleur score du jour · Connect</strong><span class="mathas-school-hint" data-score-hint></span></span><span><span class="mathas-school-number" data-score-today>—</span> pts</span>';
   button.addEventListener('click',()=>{void offerBest()});
   if(nativeTop)nativeTop.insertAdjacentElement('afterend',button);
   else doc.getElementById('menuScreen').prepend(button);
  }
  let history=doc.getElementById('mathasSchoolScoreHistory');
  if(!history){
   history=doc.createElement('section');history.id='mathasSchoolScoreHistory';
   history.setAttribute('aria-label','Historique des scores officiels');
   history.innerHTML='<h3>📘 Mes résultats certifiés Connect</h3><h4>Mes 3 meilleurs records</h4><div data-best-three></div><h4>Historique récent</h4><div data-score-history></div>';
   if(nativeHistory)nativeHistory.insertAdjacentElement('afterend',history);
   else doc.getElementById('menuScreen').append(history);
  }
  render();
 }
 function destroy(){
  destroyed=true;remote=null;state={};
  if(documentRef){
   documentRef.getElementById('mathasSchoolScoreTop')?.remove();
   documentRef.getElementById('mathasSchoolScoreHistory')?.remove();
   documentRef.getElementById('mathasSchoolScoreStyle')?.remove();
   for(const id of ['mathasPointsQuick','mathasPointsDetail'])
    documentRef.getElementById(id)?.style.removeProperty('display');
  }
  documentRef=null;
 }
 return Object.freeze({updateState(value){state=value&&typeof value==='object'?value:{};render()},
  load,recorded,mount,offerBest,destroy,read:select});
}
