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
const MAX_VISIBLE_APPS=3;
const clockFormatter=new Intl.DateTimeFormat('fr-BE',{hour:'2-digit',minute:'2-digit'});
const apps=[
 {key:'addition-ecrite-simple',title:'Addition écrite'},
 {key:'multiplication-ecrite-simple',title:'Multiplication écrite'},
 {key:'soustraction-ecrite-simple',title:'Soustraction écrite'},
 {key:'addition-ecrite-multiple',title:'Addition multiple'},
 {key:'melange-calculs-ecrits',title:'Mélange de calculs'}
];
const allKeys=apps.map(a=>a.key);
let client=null,classesAvailable=[],data=null,fetching=false,refreshTicket=0;
let hasLoaded=false,connected=false,optionsLoaded=false,pendingReset=null;
let nextRefreshAt=0,refreshCycleStartedAt=0,refreshPausedAt=0;
const tracker=createOvertakeTracker(),localRises=new Map();
const playingKeys=new Map();let animationEpoch=0;
const scoreCompared=()=>options.comparisonDisplay.filter(c=>c.score).map(c=>c.classId);
// Les animations sont indépendantes pour chaque panneau affiché.
function cancelPlayback(){
 animationEpoch++;playingKeys.clear();
 for(const el of document.querySelectorAll('#ranking-board .entry')){
  for(const animation of el.getAnimations())animation.cancel();
  el.style.zIndex='';
 }
}
// rotationSeconds subsiste seulement pour la validation du contrat Supabase.
let options={scoreApps:allKeys.slice(0,MAX_VISIBLE_APPS),percentageApps:[...allKeys],comparisons:[],comparisonDisplay:[],rotationSeconds:40};
const comparedIds=()=>options.comparisonDisplay.filter(v=>v.score||v.percentage).map(v=>v.classId);
const currentComparison=id=>options.comparisonDisplay.find(v=>v.classId===id)||{classId:id,score:false,percentage:false};
const note=message=>{
 const status=$('live-status');status.textContent=message;
 status.classList.toggle('is-alert',
  /erreur|refus|expir|nécessaire|indisponible|ne gères|saisis ton|ouvre cette page|clique d’abord/i.test(message));
};
const enabled=()=>apps.filter(a=>options.scoreApps.includes(a.key)).slice(0,MAX_VISIBLE_APPS);
const cardFor=key=>[...$('ranking-board').querySelectorAll('.ranking-card')].find(card=>card.dataset.appKey===key)||null;
function clearBoard(message){
 cancelPlayback();tracker.clear();localRises.clear();
 refreshTicket++;data=null;connected=false;hasLoaded=false;pendingReset=null;
 nextRefreshAt=0;refreshCycleStartedAt=0;refreshPausedAt=0;updateRefreshProgress();
 $('ranking-board').replaceChildren();$('classes').replaceChildren();
 $('exploits').replaceChildren();$('app-tabs').replaceChildren();
 $('visible-app-count').textContent='Projection masquée';
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
    options={scoreApps:apps.filter(app=>remote.scoreApps.includes(app.key)).map(app=>app.key).slice(0,MAX_VISIBLE_APPS),
     percentageApps:remote.percentageApps.filter(k=>allKeys.includes(k)),
     comparisons:remote.comparisons.filter(id=>classesAvailable.some(c=>c.id===id&&id!==classId)),
     comparisonDisplay:(Array.isArray(remote.comparisonDisplay)?remote.comparisonDisplay:remote.comparisons.map(id=>({classId:id,score:true,percentage:true})))
       .filter(v=>v&&classesAvailable.some(c=>c.id===v.classId&&v.classId!==classId))
       .map(v=>({classId:v.classId,score:v.score===true,percentage:v.percentage===true})),
     rotationSeconds:40};
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
  hasLoaded=true;
  for(const id of ['settings-left'])$(id).disabled=false;
  render();
  note('Actualisé à '+clockFormatter.format(new Date()));
  updateRefreshProgress();
 }catch(error){
  if(ticket!==refreshTicket)return;
  const message=error?.message||'Données indisponibles';
  if(/connexion professeur|auth_required|auth$|401/i.test(message))clearBoard('Session professeur expirée : reconnecte-toi.');
  else note('Erreur : '+message);
 }finally{
  fetching=false;$('load-real').disabled=false;
  // Après une lecture manuelle ou automatique, repartir de zéro pour 20 s.
  // Après un échec, réessayer dans 20 s sans rafale de requêtes.
  if(ticket===refreshTicket&&connected&&hasLoaded)startRefreshCycle();
 }
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
  if(observation.reset&&playingKeys.has(app.key))cancelPlayback();
 }
}
function rowFor(appKey,key){
 return [...(cardFor(appKey)?.querySelectorAll('.entry')||[])]
  .find(el=>el.dataset.entryKey===key)||null;
}
// Chaque panneau garde ses propres cartes pour les animations FLIP.
// À trois applications, les 16 élèves se répartissent sur une seule colonne.
function paintRanking(appKey,people){
 const card=cardFor(appKey);if(!card)return;
 const root=card.querySelector('.ranking-list'),multiple=scoreCompared().length>0;
 const existing=new Map([...root.querySelectorAll('.entry')].map(el=>[el.dataset.entryKey,el]));
 const columns=people.length?(enabled().length===3?[people]:splitProjectedRanking(people,multiple)):[];
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
async function playApp(appKey){
 if(!appKey||playingKeys.has(appKey)||!hasLoaded||!connected
  ||!enabled().some(a=>a.key===appKey)||!cardFor(appKey)
  ||document.visibilityState!=='visible'||$('settings').open||!tracker.pending(appKey))return;
 const token=animationEpoch;playingKeys.set(appKey,true);
 const canContinue=()=>token===animationEpoch&&playingKeys.has(appKey)
  &&enabled().some(a=>a.key===appKey)&&!!cardFor(appKey)
  &&document.visibilityState==='visible'&&!$('settings').open;
 try{
  while(tracker.take(appKey)&&canContinue()){
   const segment=tracker.take(appKey);
   const completed=await animateOvertakeSegment({
    segment,paint:rows=>paintRanking(appKey,rows),findRow:key=>rowFor(appKey,key),canContinue,
    onStep:(_actor,passed)=>{
     const board=cardFor(appKey)?.querySelector('.ranking-list');
     if(board){
      board.dataset.overtakeSteps=String(1+Number(board.dataset.overtakeSteps||0));
      board.dataset.lastPassed=passed;
     }
    },
    onArrival:movement=>addSpectacularRise(appKey,movement)
   });
   if(!completed||!canContinue())break;
   tracker.finish(appKey,segment);
   renderExploits();
  }
 }finally{
  if(token===animationEpoch){
   playingKeys.delete(appKey);
   if(tracker.pending(appKey)&&cardFor(appKey))
    queueMicrotask(()=>{void playApp(appKey)});
  }
 }
}
function renderExploits(){
 const event=$('exploits');event.replaceChildren();
 if(!data)return;
 const active=enabled(),activeKeys=new Set(active.map(a=>a.key));
 const appName=key=>apps.find(a=>a.key===key)?.title||'Application';
 const latest=Array.isArray(data.exploits)?data.exploits.filter(x=>activeKeys.has(x?.appKey)
  &&['trophy','perfect','sudden','top'].includes(x.type)
  &&typeof x.message==='string'&&x.message.length<=180):[];
 const rises=active.flatMap(app=>localRises.get(app.key)||[]);
 const shown=[...rises,...latest].slice(0,5);
 if(!shown.length){
  event.append(exploit('pending',data.exploitsStatus==='unavailable'
   ?'Exploits temporairement indisponibles.':'Aucun exploit confirmé récemment pour les applications affichées.'));
 }else shown.forEach(x=>event.append(exploit(x.type,appName(x.appKey)+' · '+x.message)));
}
function createRankingCard(app){
 const card=document.createElement('section');
 card.className='ranking ranking-card';card.dataset.appKey=app.key;
 card.setAttribute('aria-label','Classement · '+app.title);
 const head=document.createElement('div');head.className='ranking-head';
 const over=document.createElement('div');over.className='over';
 over.textContent='🏆 MEILLEURS SCORES · PÉRIODE DE PROJECTION';
 const title=document.createElement('h2');title.textContent=app.title;
 head.append(over,title);
 const wrap=document.createElement('div');wrap.className='ranking-wrap';
 const list=document.createElement('div');list.className='ranking-list';
 list.dataset.overtakeSteps='0';
 wrap.append(list);card.append(head,wrap);
 return card;
}
function render(){
 const active=enabled(),count=active.length;
 const board=$('ranking-board'),main=$('projection-main');
 board.dataset.appCount=String(count);main.dataset.appCount=String(count);
 $('visible-app-count').textContent=count+' application'+(count>1?'s':'')+' affichée'+(count>1?'s':'')+' simultanément';
 const principal=mainData();
 if(!principal){board.replaceChildren();return}
 // Réutiliser les cartes entre deux rafraîchissements préserve les animations,
 // les classements et la position verticale du professeur.
 const desired=new Set(active.map(a=>a.key));
 for(const card of [...board.children]){
  if(!desired.has(card.dataset.appKey))card.remove();
 }
 for(const app of active){
  let card=cardFor(app.key);
  if(!card){card=createRankingCard(app);board.append(card)}
  const visual=tracker.shown(app.key)||snapshotFor(app.key,data);
  if(!playingKeys.has(app.key))paintRanking(app.key,visual.rows);
 }
 for(const [index,app] of active.entries()){
  const card=cardFor(app.key);
  if(board.children[index]!==card)board.insertBefore(card,board.children[index]||null);
 }
 const tabs=$('app-tabs');tabs.replaceChildren();
 active.forEach(app=>{
  const btn=document.createElement('button');btn.type='button';btn.textContent=app.title;
  btn.setAttribute('aria-label','Voir le classement '+app.title);
  btn.onclick=()=>cardFor(app.key)?.scrollIntoView({behavior:'smooth',block:'start'});
  tabs.append(btn);
 });
 renderExploits();renderClasses();updateRefreshProgress();
 for(const app of active)if(!playingKeys.has(app.key)&&tracker.pending(app.key))
  queueMicrotask(()=>{void playApp(app.key)});
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
// La barre représente l'attente avant la PROCHAINE lecture du serveur.
// Une seule horloge : aucune simulation de chargement ni rotation de classements.
function startRefreshCycle(){
 const now=Date.now();
 refreshCycleStartedAt=now;nextRefreshAt=now+REFRESH_INTERVAL_MS;
 refreshPausedAt=(document.visibilityState!=='visible'||$('settings').open)?now:0;
 updateRefreshProgress();
}
function pauseRefreshCycle(){
 if(hasLoaded&&nextRefreshAt&&!refreshPausedAt)refreshPausedAt=Date.now();
 updateRefreshProgress();
}
function resumeRefreshCycle(){
 if(refreshPausedAt){
  const pausedFor=Date.now()-refreshPausedAt;
  refreshCycleStartedAt+=pausedFor;nextRefreshAt+=pausedFor;
  refreshPausedAt=0;
 }
 // Si l'autre cause de pause est encore présente, ne pas relancer le cycle.
 if(document.visibilityState!=='visible'||$('settings').open)pauseRefreshCycle();
 updateRefreshProgress();
}
function updateRefreshProgress(){
 const bar=$('projection-refresh-progress'),fill=$('projection-refresh-fill');
 const active=connected&&hasLoaded&&nextRefreshAt>0;
 bar.classList.toggle('is-inactive',!active);
 bar.classList.toggle('is-paused',active&&Boolean(refreshPausedAt));
 if(!active){
  fill.style.transform='scaleX(0)';
  bar.setAttribute('aria-valuenow','0');
  bar.setAttribute('aria-valuetext','En attente du premier affichage');
  bar.title='La MAJ automatique démarrera après le premier affichage.';
  return;
 }
 const now=refreshPausedAt||Date.now();
 const elapsed=Math.max(0,Math.min(REFRESH_INTERVAL_MS,now-refreshCycleStartedAt));
 const fraction=elapsed/REFRESH_INTERVAL_MS;
 const remaining=Math.ceil((REFRESH_INTERVAL_MS-elapsed)/1000);
 fill.style.transform='scaleX('+fraction+')';
 bar.setAttribute('aria-valuenow',String(Math.round(fraction*100)));
 bar.setAttribute('aria-valuetext',refreshPausedAt
  ?'MAJ suspendue : '+remaining+' secondes restantes'
  :'Prochaine MAJ automatique dans '+remaining+' secondes');
 bar.title=refreshPausedAt
  ?'MAJ auto suspendue · '+remaining+' s restantes'
  :'Prochaine MAJ automatique dans '+remaining+' s';
}
function tickProjection(){
 if(hasLoaded&&connected&&!refreshPausedAt&&nextRefreshAt&&Date.now()>=nextRefreshAt
   &&!fetching&&document.visibilityState==='visible'&&!$('settings').open){
  void refresh();
 }
 updateRefreshProgress();
}
// Pas d'intervalle de lecture lorsque le tableau est masqué.
// Au retour : reprendre au temps restant, sans rattrapage des cycles.
let refreshTickerId=null;
function stopRefreshTicker(){
 if(refreshTickerId!==null){
  clearInterval(refreshTickerId);
  refreshTickerId=null;
 }
}
function startRefreshTicker(){
 if(refreshTickerId!==null||document.visibilityState!=='visible'||$('settings').open)return;
 refreshTickerId=setInterval(tickProjection,250);
 tickProjection();
}
startRefreshTicker();
document.addEventListener('visibilitychange',()=>{
 if(document.visibilityState!=='visible'){
  stopRefreshTicker();
  cancelPlayback();pauseRefreshCycle();
 }else{
  resumeRefreshCycle();
  startRefreshTicker();
  if(hasLoaded)render();
 }
});
updateRefreshProgress();
const dialog=$('settings');
function showSettings(){
 if(!hasLoaded)return note('Clique d’abord sur Afficher / Actualiser.');
 cancelPlayback();buildSettings();dialog.showModal();pauseRefreshCycle();stopRefreshTicker();
}
function closeSettings(){
 dialog.close();resumeRefreshCycle();startRefreshTicker();$('reset-password').value='';
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
   if(field==='scoreApps')cb.disabled=(cb.checked&&options.scoreApps.length<=1)
     ||(!cb.checked&&options.scoreApps.length>=MAX_VISIBLE_APPS);
   cb.setAttribute('aria-label',app.title+' · '+(field==='scoreApps'?'Afficher score':'Afficher pourcentage'));
   cb.onchange=async()=>{
    const before=[...options[field]];
    if(field==='scoreApps'&&((cb.checked&&before.length>=MAX_VISIBLE_APPS)
      ||(!cb.checked&&before.length<=1))){cb.checked=!cb.checked;return}
    options[field]=cb.checked?[...options[field],app.key]:options[field].filter(k=>k!==app.key);
    if(!await commitOptions()){options[field]=before;cb.checked=!cb.checked}
    if(field==='scoreApps'){
     cancelPlayback();tracker.drop(app.key);
    }
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
window.addEventListener('pagehide',()=>{stopRefreshTicker();clearBoard('Projection masquée en quittant la page.')});
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
  connected=true;$('load-real').disabled=false;
  note('Clique sur Afficher / Actualiser pour charger '+classLabel+'.');
 }catch(error){note('Connexion refusée : '+(error?.message||'Erreur réseau'))}
}
initialize();
