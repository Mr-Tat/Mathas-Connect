import {classId,classLabel} from './connect-context.js';
import {rankMultiClass,splitProjectedRanking} from './projection-v2-model.mjs';
import {avatarGlyph,avatarColor} from './avatar-catalog.js';
import {createOvertakeTracker,playerKey} from './projection-v2-overtakes.mjs';
import {animateOvertakeSegment} from './projection-v2-overtake-animation.mjs';

// Projection V2: écran séparé de la projection collective historique.
// Les scores proviennent uniquement de l'Edge Function professeur sécurisée.
// Le % reste INDISPONIBLE tant que les exercices réellement entamés ne sont
// pas journalisés par chaque application. Jamais de chiffres fictifs en ligne.
const endpoint='https://awmhpfofacaglewammxt.supabase.co';
const publishable='sb_publishable_oI2Pyl3kXzmLkK-CBnw9Nw_66a4fZgM';
const $=id=>document.getElementById(id);
const REFRESH_INTERVAL_MS=20000;
const ROTATION_SECONDS=40;
const clockFormatter=new Intl.DateTimeFormat('fr-BE',{hour:'2-digit',minute:'2-digit'});
const apps=[
 {key:'addition-ecrite-simple',title:'Addition écrite'},
 {key:'multiplication-ecrite-simple',title:'Multiplication écrite'},
 {key:'soustraction-ecrite-simple',title:'Soustraction écrite'},
 {key:'addition-ecrite-multiple',title:'Addition multiple'},
 {key:'melange-calculs-ecrits',title:'Mélange de calculs'}
];
const allKeys=apps.map(a=>a.key);
let client=null,classesAvailable=[],data=null,wasPaused=false,paused=false;
let hasLoaded=false,connected=false,optionsLoaded=false,pendingReset=null;
let currentApp=allKeys[0],secondsRemaining=ROTATION_SECONDS,fetching=false,refreshTicket=0;
let cycleStartedAt=0,nextRefreshAt=0;
// Une seule origine temporelle pour les deux MAJ de 20 s et la rotation de 40 s.
function startCycle(){
 cycleStartedAt=Date.now();
 nextRefreshAt=cycleStartedAt+REFRESH_INTERVAL_MS;
 secondsRemaining=ROTATION_SECONDS;
}
const tracker=createOvertakeTracker(),localRises=new Map();
let playingKey=null,animationEpoch=0;
const scoreCompared=()=>options.comparisonDisplay.filter(c=>c.score).map(c=>c.classId);
function cancelPlayback(){
 animationEpoch++;playingKey=null;
 for(const el of $('ranking-list').querySelectorAll('.entry')){
  for(const animation of el.getAnimations())animation.cancel();
  el.style.zIndex='';
 }
}
let options={scoreApps:[...allKeys],percentageApps:[...allKeys],comparisons:[],comparisonDisplay:[],rotationSeconds:ROTATION_SECONDS};
const comparedIds=()=>options.comparisonDisplay.filter(v=>v.score||v.percentage).map(v=>v.classId);
const currentComparison=id=>options.comparisonDisplay.find(v=>v.classId===id)||{classId:id,score:false,percentage:false};
const note=message=>{
 const status=$('live-status');status.textContent=message;
 status.classList.toggle('is-alert',
  /erreur|refus|expir|nécessaire|indisponible|ne gères|saisis ton|ouvre cette page|clique d’abord/i.test(message));
};
const enabled=()=>apps.filter(a=>options.scoreApps.includes(a.key));
function clearBoard(message){
 cancelPlayback();tracker.clear();localRises.clear();
 refreshTicket++;data=null;connected=false;hasLoaded=false;pendingReset=null;paused=true;
 cycleStartedAt=0;nextRefreshAt=0;secondsRemaining=ROTATION_SECONDS;
 updateRefreshCountdown();
 $('ranking-list').replaceChildren();$('classes').replaceChildren();
 $('exploits').replaceChildren();$('app-tabs').replaceChildren();
 $('app-name').textContent='Projection masquée';
 $('time-left').textContent='';
 $('reset-password').value='';
 for(const id of ['settings-left'])$(id).disabled=true;
 note(message);
}
async function call(functionName,action,body={}){
 const {data:{session},error}=await client.auth.getSession();
 if(error||!session?.access_token||session.user?.is_anonymous)throw Error('Connexion professeur nécessaire.');
 const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),12000);
 try{
  const res=await fetch(endpoint+'/functions/v1/'+functionName,{
   method:'POST',cache:'no-store',signal:abort.signal,
   headers:{apikey:publishable,authorization:'Bearer '+session.access_token,'content-type':'application/json'},
   body:JSON.stringify({action,classId,...body})
  });
  const result=await res.json().catch(()=>({}));
  if(!res.ok||result.ok!==true)throw Error(result.error==='forbidden'
   ?'Accès à cette classe refusé.':result.error==='password_refused'
    ?'Mot de passe professeur incorrect.':result.error||'Données indisponibles.');
  return result;
 }catch(error){
  if(abort.signal.aborted)throw Error('La connexion est trop lente : actualise manuellement.');
  throw error;
 }finally{clearTimeout(timer)}
}
const save=()=>call('connect-projection-v2','teacher-save-options',{options});
async function refresh(){
 if(fetching||!connected)return;
 fetching=true;const ticket=++refreshTicket;
 $('load-real').disabled=true;
 note('Chargement protégé des classements…');
 try{
  let result=await call('connect-projection-v2','teacher-load',{
   comparisons:comparedIds(),showTeacher:$('show-teacher').checked
  });
  if(ticket!==refreshTicket)return;
  const principal=result.classes.find(c=>c.classId===classId);
  if(!principal)throw Error('Classe absente du serveur.');
  if(!optionsLoaded){
   optionsLoaded=true;
   const remote=principal.options;
   if(remote&&Array.isArray(remote.scoreApps)&&Array.isArray(remote.percentageApps)
      &&Array.isArray(remote.comparisons)&&Number.isInteger(remote.rotationSeconds)){
    options={scoreApps:remote.scoreApps.filter(k=>allKeys.includes(k)),
     percentageApps:remote.percentageApps.filter(k=>allKeys.includes(k)),
     comparisons:remote.comparisons.filter(id=>classesAvailable.some(c=>c.id===id&&id!==classId)),
     comparisonDisplay:(Array.isArray(remote.comparisonDisplay)?remote.comparisonDisplay:remote.comparisons.map(id=>({classId:id,score:true,percentage:true})))
       .filter(v=>v&&classesAvailable.some(c=>c.id===v.classId&&v.classId!==classId))
       .map(v=>({classId:v.classId,score:v.score===true,percentage:v.percentage===true})),
     rotationSeconds:ROTATION_SECONDS};
    if(comparedIds().length){
     result=await call('connect-projection-v2','teacher-load',{
      comparisons:comparedIds(),showTeacher:$('show-teacher').checked
     });
     if(ticket!==refreshTicket)return;
    }
   }
  }
  // Observe every enabled app, including those not currently on screen.
  // A new verified score can queue an animation, but cannot play on another app.
  observeRankings(result);
  data=result;
  const firstDisplay=!hasLoaded;
  hasLoaded=true;
  if(firstDisplay)paused=false;
  if(!enabled().some(a=>a.key===currentApp))currentApp=enabled()[0]?.key??null;
  if(firstDisplay)startCycle();
  for(const id of ['settings-left'])$(id).disabled=false;
  render();
  note('Actualisé à '+clockFormatter.format(new Date()));
  updateRefreshCountdown();
 }catch(error){
  if(ticket!==refreshTicket)return;
  const message=error?.message||'Données indisponibles';
  if(/connexion professeur|auth_required|auth$|401/i.test(message))clearBoard('Session professeur expirée : reconnecte-toi.');
  else note('Erreur : '+message);
 }finally{fetching=false;$('load-real').disabled=false}
}
function mainData(){return data?.classes?.find(c=>c.classId===classId)}
function score(person,appKey){
 const row=person.scores?.find(x=>x.appKey===appKey);
 return Number.isFinite(row?.bestScore)?row.bestScore:null;
}
// Avatars du HUB uniquement pour les élèves autorisés à la projection.
function projectedAvatar(person){
 const initial=Array.from(String(person.name||'Élève').trim())[0]?.toLocaleUpperCase('fr')||'E';
 const raw=person.avatar;
 const selected=raw&&typeof raw==='object'&&
   ['letter','animal','object','smiley'].includes(raw.kind)&&
   typeof raw.value==='string'&&raw.value.length<=32&&raw.value
   ?raw:{kind:'letter',value:initial,color:'transparent'};
 const symbol=document.createElement('span');symbol.className='projection-avatar';
 symbol.setAttribute('aria-hidden','true');
 symbol.textContent=avatarGlyph(selected);
 const background=avatarColor(selected.color);
 symbol.style.background=background;
 symbol.classList.toggle('transparent',background==='transparent');
 return symbol;
}
function snapshotFor(appKey,result){
 const compared=scoreCompared();
 const classIds=[classId,...compared].sort();
 const periodStates=classIds.map(id=>{
  const c=result.classes.find(x=>x.classId===id);
  return [id,c?.scorePeriods?.find(p=>p.appKey===appKey)?.since||''];
 });
 return {appKey,context:JSON.stringify({classIds,periodStates,teacher:$('show-teacher').checked}),
  rows:rankMultiClass({classes:result.classes,primaryClassId:classId,
   scoreClassIds:compared,appKey,limit:16,includeTeacher:$('show-teacher').checked})};
}
function observeRankings(result){
 for(const app of enabled()){
  const observation=tracker.observe(snapshotFor(app.key,result));
  if(observation.reset&&playingKey===app.key)cancelPlayback();
 }
}
function rowFor(key){
 return [...$('ranking-list').querySelectorAll('.entry')].find(el=>el.dataset.entryKey===key)||null;
}
// Reuse each student's DOM node between positions so FLIP computes accurate
// coordinates, including crossings of the two ranking columns.
function paintRanking(people){
 const root=$('ranking-list'),multiple=scoreCompared().length>0;
 const existing=new Map([...root.querySelectorAll('.entry')]
  .map(el=>[el.dataset.entryKey,el]));
 const columns=people.length?splitProjectedRanking(people,multiple):[];
 root.classList.toggle('single',columns.length===1);
 root.classList.toggle('multi',multiple);
 const fragment=document.createDocumentFragment();
 let position=0;
 columns.forEach(group=>{
  const column=document.createElement('div');column.className='ranking-col';
  column.style.setProperty('--row-count',String(group.length));
  group.forEach(p=>{
   const place=++position,key=playerKey(p);
   const row=existing.get(key)||document.createElement('div');
   row.dataset.entryKey=key;
   row.className='entry rank-'+place;
   row.style.setProperty('--rank-progress',String((place-1)/15));
   const rank=document.createElement('span');rank.className='place';rank.textContent=String(place);
   const detail=document.createElement('div');
   const primary=document.createElement('div');primary.className='primary';
   const name=document.createElement('strong');name.textContent=p.name;
   const playerLabel=document.createElement('span');playerLabel.className='player-label';
   playerLabel.append(projectedAvatar(p),name);
   const points=document.createElement('span');points.className='points';
   points.textContent=Number.isFinite(p.score)?p.score+' pts':'—';
   const minor=document.createElement('div');minor.className='minor';
   minor.append(document.createTextNode('Niveau '+(p.level??'—')+'   🏆 '+(p.trophies??0)));
   if(multiple){
    const classMark=document.createElement('span');classMark.className='class-mark';
    classMark.textContent=p.className;minor.append(classMark);
   }
   primary.append(playerLabel,points);detail.append(primary,minor);
   row.replaceChildren(rank,detail);column.append(row);
  });
  fragment.append(column);
 });
 root.replaceChildren(fragment);
}
function addSpectacularRise(appKey,movement){
 if(movement.gained<3)return;
 const history=localRises.get(appKey)||[];
 const id=movement.key+':'+movement.newScore;
 if(history.some(entry=>entry.id===id))return;
 history.unshift({id,appKey,type:'rise',at:new Date().toISOString(),
  message:movement.name+' remonte de '+movement.gained+
   ' places grâce à un nouveau record ('+movement.newScore+' pts) !'});
 localRises.set(appKey,history.slice(0,5));
}
async function playCurrentApp(){
 const appKey=currentApp;
 if(!appKey||playingKey||!hasLoaded||!connected
  ||document.visibilityState!=='visible'||$('settings').open||!tracker.pending(appKey))return;
 const token=++animationEpoch;playingKey=appKey;
 const canContinue=()=>token===animationEpoch&&currentApp===appKey
  &&document.visibilityState==='visible'&&!$('settings').open;
 try{
  while(tracker.take(appKey)&&canContinue()){
   const segment=tracker.take(appKey);
   const completed=await animateOvertakeSegment({
    segment,paint:paintRanking,findRow:rowFor,canContinue,
    onStep:(_actor,passed)=>{
     const board=$('ranking-list');
     board.dataset.overtakeSteps=String(1+Number(board.dataset.overtakeSteps||0));
     board.dataset.lastPassed=passed;
    },
    onArrival:movement=>addSpectacularRise(appKey,movement)
   });
   if(!completed||!canContinue())break;
   tracker.finish(appKey,segment);
   renderExploits();
  }
 }finally{
  if(token===animationEpoch){
   playingKey=null;
   if(tracker.pending(appKey)&&currentApp===appKey)
    queueMicrotask(()=>{void playCurrentApp()});
  }
 }
}
function renderExploits(){
 const event=$('exploits');event.replaceChildren();
 if(!data)return;
 const latest=Array.isArray(data.exploits)?data.exploits.filter(x=>x?.appKey===currentApp
  &&['trophy','perfect','sudden','top'].includes(x.type)
  &&typeof x.message==='string'&&x.message.length<=180):[];
 const rises=localRises.get(currentApp)||[];
 const shown=[...rises,...latest].slice(0,5);
 if(!shown.length){
  event.append(exploit('pending',data.exploitsStatus==='unavailable'
   ?'Exploits temporairement indisponibles.':'Aucun exploit confirmé récemment pour cette application.'));
 }else shown.forEach(x=>event.append(exploit(x.type,x.message)));
}
function render(){
 const principal=mainData();
 const app=apps.find(a=>a.key===currentApp);
 $('app-name').textContent=app?.title||'Aucune application sélectionnée';
 if(!principal){$('ranking-list').replaceChildren();return}
 const visual=tracker.shown(currentApp)||snapshotFor(currentApp,data);
 if(playingKey!==currentApp)paintRanking(visual.rows);
 const tabs=$('app-tabs');tabs.replaceChildren();
 enabled().forEach(a=>{
  const btn=document.createElement('button');btn.type='button';
  btn.textContent=a.title;btn.classList.toggle('selected',a.key===currentApp);
  btn.onclick=()=>{
   if(currentApp!==a.key){cancelPlayback();$('ranking-list').dataset.overtakeSteps='0'}
   currentApp=a.key;startCycle();render();updateRefreshCountdown();
  };
  tabs.append(btn);
 });
 renderExploits();renderClasses();updateTime();
 if(!playingKey&&tracker.pending(currentApp))
  queueMicrotask(()=>{void playCurrentApp()});
}
// Les notifications n'affirment aucun exploit sans événement serveur confirmé.
// Types prévus : trophée, série parfaite, entrée Top 5 et, seulement après preuve serveur, remontée d'au moins 3 places avec nouveau record personnel.
function exploit(type,message){
 const kinds={trophy:['🏆','trophy'],perfect:['✨','perfect'],top:['🏅','rank-up'],
  rise:['📈','rank-up'],sudden:['🔥','perfect'],pending:['◌','empty']};
 const [symbol,style]=kinds[type]||kinds.pending;
 const el=document.createElement('div');el.className='event '+style;
 const icon=document.createElement('span');icon.className='event-icon';icon.textContent=symbol;icon.setAttribute('aria-hidden','true');
 const text=document.createElement('span');text.className='event-text';text.textContent=message;
 el.append(icon,text);return el;
}
function numericPercent(value){return typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=100?value:null}
function percentText(value){const n=numericPercent(value);return n===null?'— %':(Math.round(n*10)/10).toLocaleString('fr-BE')+' %'}
function makeSuccessRow(label,pct,global=false,compact=false){
 const row=document.createElement('div');row.className='classstat'+(global?' global-success':'');
 const headline=document.createElement('div');headline.className='headline';
 const name=document.createElement('span');name.textContent=label;
 const value=document.createElement('strong');value.textContent=percentText(pct);
 if(numericPercent(pct)===null)value.className='unavailable';
 headline.append(name,value);row.append(headline);
 if(numericPercent(pct)!==null&&!compact){
  const track=document.createElement('div');track.className='track';
  const fill=document.createElement('i');fill.style.width=numericPercent(pct)+'%';track.append(fill);row.append(track);
 }
 return row;
}
function renderClasses(){
 const root=$('classes'),comparisons=$('comparison-results');
 root.replaceChildren();comparisons.replaceChildren();
 if(!data)return;
 const principal=mainData();
 if(!principal)return;
 const percentages=principal.percentages;
 root.append(makeSuccessRow('Global',percentages?.global,true));
 for(const app of apps.filter(a=>options.percentageApps.includes(a.key))){
  root.append(makeSuccessRow(app.title,percentages?.apps?.[app.key]));
 }

 let shown=0;
 for(const display of options.comparisonDisplay.filter(v=>v.percentage)){
  const c=data.classes.find(v=>v.classId===display.classId);
  if(!c)continue;
  shown++;
  const panel=document.createElement('div');panel.className='compare-row';
  const name=document.createElement('strong');name.textContent=c.name;panel.append(name);
  // Les scores des autres classes s'affichent uniquement dans le classement central.
  if(display.percentage){
   panel.append(makeSuccessRow('Global',c.percentages?.global,true,true));
   for(const app of apps.filter(a=>options.percentageApps.includes(a.key))){
    const line=document.createElement('div');line.className='compare-line';
    const l=document.createElement('span');l.textContent=app.title;
    const v=document.createElement('span');v.className='not-ready';
    v.textContent=percentText(c.percentages?.apps?.[app.key]);
    line.append(l,v);panel.append(line);
   }
  }
  comparisons.append(panel);
 }
 if(!shown){
  const hint=document.createElement('small');hint.textContent='Pour comparer les %, coche une autre classe dans « Applications ».';
  comparisons.append(hint);
 }
}
function updateTime(){
 const active=enabled(),ix=active.findIndex(a=>a.key===currentApp);
 $('rotation-label').textContent=active.length>1?'Application '+(ix+1)+' / '+active.length:'';
 $('time-left').textContent=paused?'En pause':active.length>1?'Suivante dans '+secondsRemaining+' s':'Affichage fixe';
 $('pause').textContent=paused?'▶ Reprendre':'⏸ Pause';
}
function next(delta){
 const a=enabled();if(!a.length)return;
 cancelPlayback();
 const i=a.findIndex(x=>x.key===currentApp);
 currentApp=a[(i+delta+a.length)%a.length].key;
 $('ranking-list').dataset.overtakeSteps='0';
 startCycle();render();updateRefreshCountdown();
}
$('next-app').onclick=()=>next(1);
$('prev-app').onclick=()=>next(-1);
// La pause conserve le temps restant. À la reprise, les MAJ sont réalignées
// sur les étapes 20 s et 40 s du cycle en cours.
function pauseRotation(){
 if(!paused&&hasLoaded)
  secondsRemaining=Math.max(0,Math.ceil((cycleStartedAt+ROTATION_SECONDS*1000-Date.now())/1000));
 paused=true;updateTime();updateRefreshCountdown();
}
function resumeRotation(){
 if(paused&&hasLoaded){
  const elapsed=ROTATION_SECONDS-secondsRemaining;
  cycleStartedAt=Date.now()-elapsed*1000;
  nextRefreshAt=cycleStartedAt+(elapsed<20?20:40)*1000;
  if(nextRefreshAt<=Date.now())nextRefreshAt=Date.now()+REFRESH_INTERVAL_MS;
 }
 paused=false;updateTime();updateRefreshCountdown();
}
$('pause').onclick=()=>{if(paused)resumeRotation();else pauseRotation()};
document.addEventListener('visibilitychange',()=>{
 if(document.visibilityState!=='visible')cancelPlayback();
 else if(hasLoaded){render()}
});
// Un seul battement : MAJ à 20 s, puis MAJ + application suivante à 40 s.
// Les échéances sont horodatées pour ne pas dériver si l'onglet est ralenti.
function tickProjection(){
 if(!hasLoaded){updateRefreshCountdown();return}
 const now=Date.now();
 if(connected&&now>=nextRefreshAt){
  nextRefreshAt+=(Math.floor((now-nextRefreshAt)/REFRESH_INTERVAL_MS)+1)*REFRESH_INTERVAL_MS;
  if(document.visibilityState==='visible'&&!$('settings').open)void refresh();
 }
 if(!paused&&enabled().length>1){
  secondsRemaining=Math.max(0,Math.ceil((cycleStartedAt+ROTATION_SECONDS*1000-now)/1000));
  if(secondsRemaining===0&&!playingKey)next(1);
 }
 updateTime();updateRefreshCountdown();
}
setInterval(tickProjection,1000);
function updateRefreshCountdown(){
 const output=$('projection-refresh-countdown');
 const label=$('projection-refresh-label'),dot=$('projection-refresh-dot');
 dot.hidden=true;
 output.setAttribute('aria-label','Prochaine actualisation des scores');
 if(!connected||!hasLoaded){label.textContent='MAJ en attente';return}
 if(document.visibilityState!=='visible'||$('settings').open){
  label.textContent='MAJ suspendue';return;
 }
 const remaining=Math.max(0,Math.ceil((nextRefreshAt-Date.now())/1000));
 label.textContent='MAJ dans '+String(Math.floor(remaining/60)).padStart(2,'0')+':'+
  String(remaining%60).padStart(2,'0');
 // Le point doré identifie le DEUXIÈME cycle, jamais le premier.
 dot.hidden=paused||enabled().length<=1||Date.now()-cycleStartedAt<REFRESH_INTERVAL_MS;
 if(!dot.hidden)
  output.setAttribute('aria-label','Deuxième cycle de 20 secondes : application suivante après cette actualisation');
}
updateRefreshCountdown();
const dialog=$('settings');
function showSettings(){
 if(!hasLoaded)return note('Clique d’abord sur Afficher / Actualiser.');
 cancelPlayback();
 wasPaused=paused;pauseRotation();buildSettings();dialog.showModal();updateRefreshCountdown();
}
function closeSettings(){
 dialog.close();if(!wasPaused)resumeRotation();else updateRefreshCountdown();$('reset-password').value='';
 $('reset-confirm').hidden=true;pendingReset=null;render();
}
for(const id of ['settings-left'])$(id).onclick=showSettings;
$('close-settings').onclick=closeSettings;
dialog.addEventListener('cancel',event=>{event.preventDefault();closeSettings()});
async function commitOptions(){
 try{await save();render();note('Réglages enregistrés pour '+classLabel)}catch(error){
  note('Erreur de réglages : '+(error?.message||'Échec.'));
  return false;
 }
 return true;
}
function buildSettings(){
 const root=$('app-options');root.replaceChildren();
 for(const app of apps){
  const tr=document.createElement('tr');
  const name=document.createElement('td');name.textContent=app.title;tr.append(name);
  for(const field of ['scoreApps','percentageApps']){
   const cell=document.createElement('td');const cb=document.createElement('input');
   cb.type='checkbox';cb.checked=options[field].includes(app.key);
   cb.setAttribute('aria-label',app.title+' · '+(field==='scoreApps'?'Afficher score':'Afficher pourcentage'));
   cb.onchange=async()=>{
    const before=[...options[field]];
    options[field]=cb.checked?[...options[field],app.key]:options[field].filter(k=>k!==app.key);
    if(!await commitOptions()){options[field]=before;cb.checked=!cb.checked}
    if(field==='scoreApps'){
     cancelPlayback();tracker.drop(app.key);
    }
    if(!enabled().some(a=>a.key===currentApp))currentApp=enabled()[0]?.key??null;
    render();
    buildSettings();
   };
   cell.append(cb);tr.append(cell);
  }
  const action=document.createElement('td');
  const reset=document.createElement('button');reset.type='button';reset.className='reset';reset.textContent='↻';
  reset.title='Réinitialiser uniquement le score de '+app.title+' pour '+classLabel;
  reset.setAttribute('aria-label',reset.title);
  reset.disabled=!options.scoreApps.includes(app.key);
  reset.onclick=()=>{
   pendingReset=app.key;$('reset-heading').textContent='Réinitialiser les scores projetés · '+classLabel+' · '+app.title;
   $('reset-password').value='';$('reset-confirm').hidden=false;$('reset-password').focus();
  };
  action.append(reset);tr.append(action);root.append(tr);
 }
 const compare=$('comparison-options');compare.replaceChildren();
 for(const c of classesAvailable.filter(c=>c.id!==classId&&!c.name.includes('TEST'))){
  const tr=document.createElement('tr'),name=document.createElement('td');
  name.textContent=c.name;tr.append(name);
  for(const field of ['score','percentage']){
   const cell=document.createElement('td'),cb=document.createElement('input');
   cb.type='checkbox';cb.checked=currentComparison(c.id)[field];
   cb.setAttribute('aria-label',c.name+' · Comparer '+(field==='score'?'le score':'le pourcentage'));
   cb.onchange=async()=>{
    const before=options.comparisonDisplay.map(v=>({...v}));
    const next={...currentComparison(c.id),[field]:cb.checked};
    options.comparisonDisplay=[...before.filter(v=>v.classId!==c.id),next]
      .filter(v=>v.score||v.percentage);
    options.comparisons=comparedIds();
    if(!await commitOptions()){
     options.comparisonDisplay=before;options.comparisons=comparedIds();cb.checked=!cb.checked;return;
    }
    await refresh();
   };
   cell.append(cb);tr.append(cell);
  }
  compare.append(tr);
 }
 $('show-teacher').onchange=async()=>{await refresh()};
}
$('reset-cancel').onclick=()=>{pendingReset=null;$('reset-confirm').hidden=true;$('reset-password').value=''};
$('reset-apply').onclick=async()=>{
 if(!pendingReset)return;
 const app=apps.find(a=>a.key===pendingReset);
 const password=$('reset-password').value;
 if(!password)return note('Saisis ton mot de passe professeur.');
 if(!window.confirm('Réinitialiser UNIQUEMENT les scores projetés de '+app.title+' pour '+classLabel+' ?\nLes %, vrais résultats, XP et trophées restent intacts.'))return;
 $('reset-apply').disabled=true;
 try{
  await call('connect-projection-v2','teacher-reset-score',{appKey:pendingReset,password});
  pendingReset=null;$('reset-confirm').hidden=true;
  $('reset-password').value='';
  note('Nouvelle période de score démarrée pour cette application et cette classe.');
  closeSettings();await refresh();
 }catch(error){$('reset-password').value='';note('Réinitialisation refusée : '+(error?.message||'Erreur'))}
 finally{$('reset-apply').disabled=false}
};
$('load-real').onclick=refresh;
window.addEventListener('pagehide',()=>clearBoard('Projection masquée en quittant la page.'));
async function initialize(){
 $('header-class').textContent=classLabel||'Classe';
 clearBoard('Vérification de la session professeur…');
 if(!classId)return note('Ouvre cette page depuis une classe de l’accueil professeur.');
 try{
  const {createClient}=await import('https://esm.sh/@supabase/supabase-js@2.95.0');
  client=createClient(endpoint,publishable,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,storageKey:'mathas-connect-professor-auth-v1'}});
  client.auth.onAuthStateChange(event=>{
   if(event==='SIGNED_OUT'||event==='USER_DELETED')clearBoard('Session professeur terminée.');
  });
  const {data:{session}}=await client.auth.getSession();
  if(!session?.access_token||session.user?.is_anonymous)return note('Connexion professeur nécessaire. Reviens à l’accueil professeur.');
  const dashboard=await call('connect-api','teacher-dashboard');
  classesAvailable=(dashboard.classes||[]).filter(c=>c?.id&&typeof c.name==='string'&&!c.name.includes('TEST'));
  if(!classesAvailable.some(c=>c.id===classId))return note('Tu ne gères pas la classe demandée.');
  connected=true;paused=true;$('load-real').disabled=false;
  note('Clique sur Afficher / Actualiser pour charger '+classLabel+'.');
 }catch(error){note('Connexion refusée : '+(error?.message||'Erreur réseau'))}
}
initialize();
