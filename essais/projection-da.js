/* Projection DA — données inventées. Aucun fetch, aucune authentification ni lecture locale élève. */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const DEMO={
  classeA:{label:'Classe exemple · 5A',total:26,participants:19,activeToday:11,apps:[
    {title:'Addition simple',recent:17,today:10},
    {title:'Addition multiple',recent:14,today:8},
    {title:'Soustraction écrite',recent:12,today:6},
    {title:'Multiplication simple',recent:15,today:9},
    {title:'Mélange de calculs écrits',recent:9,today:4}
  ]},
  classeB:{label:'Classe exemple · 6B',total:24,participants:21,activeToday:14,apps:[
    {title:'Addition simple',recent:20,today:12},
    {title:'Addition multiple',recent:18,today:9},
    {title:'Soustraction écrite',recent:17,today:8},
    {title:'Multiplication simple',recent:19,today:11},
    {title:'Mélange de calculs écrits',recent:15,today:6}
  ]}
};
let displayed=null,period='recent';
function mark(message){$('status').textContent=message}
function renderBars(){
  const apps=$('apps');apps.replaceChildren();
  $('period-recent').setAttribute('aria-pressed',String(period==='recent'));
  $('period-today').setAttribute('aria-pressed',String(period==='today'));
  $('period-help').textContent=period==='today'
    ?'Élèves ayant joué aujourd’hui, selon les trois dernières parties fictives conservées par application. Les parties plus anciennes ne sont pas comptabilisées.'
    :'Élèves ayant une partie dans les trois dernières parties fictives disponibles par application. Ce n’est pas un décompte de toutes les parties historiques.';
  if(!displayed)return;
  for(const app of displayed.apps){
    const n=period==='today'?app.today:app.recent;
    const row=document.createElement('div');row.className='app-row';
    const name=document.createElement('strong');name.textContent=app.title;
    const track=document.createElement('div');track.className='track';track.setAttribute('role','progressbar');
    track.setAttribute('aria-label',(period==='today'?'Participation aujourd’hui : ':'Historique récent : ')+app.title);
    track.setAttribute('aria-valuemin','0');track.setAttribute('aria-valuemax',String(displayed.total));track.setAttribute('aria-valuenow',String(n));
    const fill=document.createElement('div');fill.className='fill';fill.style.width=(displayed.total?Math.round(100*n/displayed.total):0)+'%';track.append(fill);
    const amount=document.createElement('output');amount.textContent=n+' / '+displayed.total;
    row.append(name,track,amount);apps.append(row);
  }
}
function show(){
  displayed=DEMO[$('class-choice').value]||DEMO.classeA;
  $('class-name').textContent=displayed.label;
  $('updated').textContent='Exemple actualisé à '+new Intl.DateTimeFormat('fr-BE',{hour:'2-digit',minute:'2-digit'}).format(new Date())+' · simulation';
  $('total').textContent=String(displayed.total);
  $('participants').textContent=String(displayed.participants);
  $('today').textContent=String(displayed.activeToday);
  $('blank').hidden=true;$('board').hidden=false;
  renderBars();mark('Démonstration fictive affichée · lecture seule · aucun serveur contacté.');
}
function hide(message){
  displayed=null;$('board').hidden=true;$('blank').hidden=false;
  $('class-name').textContent='';$('updated').textContent='';$('apps').replaceChildren();
  mark(message||'Chiffres masqués (maquette locale).');
}
$('load').addEventListener('click',show);
$('hide').addEventListener('click',()=>hide());
$('class-choice').addEventListener('change',()=>hide('Classe de démonstration changée : affiche les chiffres pour voir l’autre exemple.'));
$('period-recent').addEventListener('click',()=>{period='recent';renderBars()});
$('period-today').addEventListener('click',()=>{period='today';renderBars()});
$('fullscreen').addEventListener('click',async()=>{
  try{
    if(document.fullscreenElement){await document.exitFullscreen()}
    else if(document.documentElement.requestFullscreen){await document.documentElement.requestFullscreen()}
    else mark('Le plein écran n’est pas disponible dans ce navigateur.');
  }catch{mark('Plein écran indisponible dans cet environnement.')}
});
document.addEventListener('fullscreenchange',()=>{$('fullscreen').textContent=document.fullscreenElement?'Quitter le plein écran':'Plein écran'});
window.addEventListener('pagehide',()=>hide('Tableau masqué à la fermeture de la maquette.'));
show();
})();
