import {classId,classLabel} from './connect-context.js';
import {rankMultiClass,splitProjectedRanking} from './projection-v2-model.mjs';

// Projection V2: écran séparé de la projection collective historique.
// Les scores proviennent uniquement de l'Edge Function professeur sécurisée.
// Le % reste INDISPONIBLE tant que les exercices réellement entamés ne sont
// pas journalisés par chaque application. Jamais de chiffres fictifs en ligne.
const endpoint='https://awmhpfofacaglewammxt.supabase.co';
const publishable='sb_publishable_oI2Pyl3kXzmLkK-CBnw9Nw_66a4fZgM';
const $=id=>document.getElementById(id);
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
let currentApp=allKeys[0],secondsRemaining=30,fetching=false,refreshTicket=0;
let options={scoreApps:[...allKeys],percentageApps:[...allKeys],comparisons:[],comparisonDisplay:[],rotationSeconds:30};
const comparedIds=()=>options.comparisonDisplay.filter(v=>v.score||v.percentage).map(v=>v.classId);
const currentComparison=id=>options.comparisonDisplay.find(v=>v.classId===id)||{classId:id,score:false,percentage:false};
const note=message=>{$('live-status').textContent=message};
const enabled=()=>apps.filter(a=>options.scoreApps.includes(a.key));
function clearBoard(message){
 refreshTicket++;data=null;connected=false;hasLoaded=false;pendingReset=null;paused=true;
 $('ranking-list').replaceChildren();$('classes').replaceChildren();
 $('exploits').replaceChildren();$('rises').replaceChildren();$('app-tabs').replaceChildren();
 $('app-name').textContent='Projection masquée';
 $('ranking-note').textContent='Aucune donnée d’élève visible';
 $('count-label').textContent='';
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
     rotationSeconds:30};
    if(comparedIds().length){
     result=await call('connect-projection-v2','teacher-load',{
      comparisons:comparedIds(),showTeacher:$('show-teacher').checked
     });
     if(ticket!==refreshTicket)return;
    }
   }
  }
  data=result;
  const firstDisplay=!hasLoaded;
  hasLoaded=true;
  if(firstDisplay)paused=false;
  if(!enabled().some(a=>a.key===currentApp))currentApp=enabled()[0]?.key??null;
  if(firstDisplay)secondsRemaining=options.rotationSeconds;
  for(const id of ['settings-left'])$(id).disabled=false;
  render();
  note('Tableau de '+classLabel+' · données autorisées · '+new Intl.DateTimeFormat('fr-BE',{hour:'2-digit',minute:'2-digit'}).format(new Date()));
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
function render(){
 const principal=mainData();
 const app=apps.find(a=>a.key===currentApp);
 $('app-name').textContent=app?.title||'Aucune application sélectionnée';
 $('ranking-list').replaceChildren();
 if(!principal)return;
 const compared=options.comparisonDisplay.filter(c=>c.score).map(c=>c.classId);
 const people=rankMultiClass({
  classes:data.classes,primaryClassId:classId,scoreClassIds:compared,
  appKey:currentApp,limit:20,includeTeacher:$('show-teacher').checked
 });
 const multiple=compared.length>0;
 const columns=splitProjectedRanking(people,multiple);
 $('ranking-list').classList.toggle('single',columns.length===1);
 let position=0;
 columns.forEach(group=>{
  const column=document.createElement('div');column.className='ranking-col';
  group.forEach(p=>{
   const place=++position;
   const row=document.createElement('div');row.className='entry rank-'+place+(p.score===null?' unplayed':'');
   row.style.setProperty('--rank-progress',String((place-1)/19));
   const rank=document.createElement('span');rank.className='place';
   rank.textContent=place<=3?['🥇','🥈','🥉'][place-1]:String(place);
   const detail=document.createElement('div');
   const primary=document.createElement('div');primary.className='primary';
   const name=document.createElement('strong');name.textContent=p.name;
   const points=document.createElement('span');points.className='points';
   points.textContent=p.score===null?'—':p.score+' pts';
   const minor=document.createElement('div');minor.className='minor';
   const classMark=document.createElement('span');classMark.className='class-mark';
   classMark.textContent=p.className;
   minor.append(document.createTextNode('Niveau '+(p.level??'—')+'   🏆 '+(p.trophies??0)));
   if(multiple)minor.append(classMark);
   primary.append(name,points);detail.append(primary,minor);
   row.append(rank,detail);column.append(row);
  });
  $('ranking-list').append(column);
 });
 const period=principal.scorePeriods?.find(p=>p.appKey===currentApp);
 const total=people.length;
 $('ranking-note').textContent=classLabel+' · '+total+' élève'+(total>1?'s':'')+
  (multiple?' · défi interclasses':'')+(period?' · depuis le '+
    new Intl.DateTimeFormat('fr-BE',{day:'2-digit',month:'2-digit'}).format(new Date(period.since)):'');
 const tabs=$('app-tabs');tabs.replaceChildren();
 enabled().forEach(a=>{
  const btn=document.createElement('button');btn.type='button';
  btn.textContent=a.title;btn.classList.toggle('selected',a.key===currentApp);
  btn.onclick=()=>{currentApp=a.key;secondsRemaining=options.rotationSeconds;render()};
  tabs.append(btn);
 });
 const event=$('exploits');event.replaceChildren();
 event.append(exploit('pending','Pas encore de nouvel exploit confirmé pour cette application.'));
 const rises=$('rises');rises.replaceChildren();
 rises.append(exploit('rise','Les remontées seront affichées après une progression de rang confirmée.'));
 renderClasses();updateTime();
}
// Les notifications n'affirment aucun exploit sans événement serveur confirmé.
// Types prévus : trophée, série parfaite, entrée Top 5 et remontée.
function exploit(type,message){
 const kinds={trophy:['🏆','trophy'],perfect:['✨','perfect'],top:['🏅','rank-up'],
  rise:['📈','rank-up'],pending:['◌','empty']};
 const [symbol,style]=kinds[type]||kinds.pending;
 const el=document.createElement('div');el.className='event '+style;
 const icon=document.createElement('span');icon.className='event-icon';icon.textContent=symbol;icon.setAttribute('aria-hidden','true');
 const text=document.createElement('span');text.className='event-text';text.textContent=message;
 el.append(icon,text);return el;
}
function numericPercent(value){return typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=100?value:null}
function percentText(value){const n=numericPercent(value);return n===null?'— %':(Math.round(n*10)/10).toLocaleString('fr-BE')+' %'}
function makeSuccessRow(label,pct,global=false){
 const row=document.createElement('div');row.className='classstat'+(global?' global-success':'');
 const headline=document.createElement('div');headline.className='headline';
 const name=document.createElement('span');name.textContent=label;
 const value=document.createElement('strong');value.textContent=percentText(pct);
 if(numericPercent(pct)===null)value.className='unavailable';
 headline.append(name,value);row.append(headline);
 if(numericPercent(pct)!==null){
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
 $('percentage-note').textContent=options.percentageApps.length
  ?'Global = exercices commencés des applications cochées ; Mort subite exclue. « — » = mesure non disponible.'
  :'Aucune application cochée en « % ».';
 let shown=0;
 for(const display of options.comparisonDisplay.filter(v=>v.percentage)){
  const c=data.classes.find(v=>v.classId===display.classId);
  if(!c)continue;
  shown++;
  const panel=document.createElement('div');panel.className='compare-row';
  const name=document.createElement('strong');name.textContent=c.name;panel.append(name);
  // Les scores des autres classes s'affichent uniquement dans le classement central.
  if(display.percentage){
   const global=document.createElement('div');global.className='compare-line';
   const label=document.createElement('span');label.textContent='Réussite globale';
   const value=document.createElement('span');value.className='not-ready';
   value.textContent=percentText(c.percentages?.global);
   global.append(label,value);panel.append(global);
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
 const i=a.findIndex(x=>x.key===currentApp);
 currentApp=a[(i+delta+a.length)%a.length].key;
 secondsRemaining=options.rotationSeconds;render();
}
$('next-app').onclick=()=>next(1);
$('prev-app').onclick=()=>next(-1);
$('pause').onclick=()=>{paused=!paused;updateTime()};
setInterval(()=>{if(hasLoaded&&!paused&&enabled().length>1){
 if(--secondsRemaining<=0)next(1);else updateTime();
}},1000);
setInterval(()=>{if(hasLoaded&&connected&&document.visibilityState==='visible'&&!$('settings').open)refresh()},30000);
const dialog=$('settings');
function showSettings(){
 if(!hasLoaded)return note('Clique d’abord sur Afficher / Actualiser.');
 wasPaused=paused;paused=true;buildSettings();dialog.showModal();updateTime();
}
function closeSettings(){
 dialog.close();paused=wasPaused;$('reset-password').value='';
 $('reset-confirm').hidden=true;pendingReset=null;updateTime();
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
