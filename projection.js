import {summarizeProjection} from './projection-model.mjs';
import {classId as requestedClassId} from './connect-context.js';

// Vue professeur uniquement. Lecture de résumés existants, jamais d'écriture serveur.
const endpoint='https://awmhpfofacaglewammxt.supabase.co';
const publicKey='sb_publishable_oI2Pyl3kXzmLkK-CBnw9Nw_66a4fZgM';
const $=id=>document.getElementById(id);
let client,catalog=[],generation=0,loading=false;

function note(message){$('status').textContent=message}
function clearBoard(message='Chiffres masqués. Clique sur « Afficher / Actualiser » pour les consulter.'){
 generation++;
 $('board').hidden=true;
 $('blank').hidden=false;
 $('blank').firstElementChild.textContent=message;
 for(const id of ['total','participants','today','class-name','updated'])$(id).textContent='';
 $('apps').replaceChildren();
 note(message);
}
function loginRequired(message){
 clearBoard(message);
 $('controls').hidden=true;
 $('login-needed').hidden=false;
}
async function api(functionName,action,data={}){
 const {data:{session},error}=await client.auth.getSession();
 if(error||!session?.access_token||session.user?.is_anonymous)throw Error('Connexion professeur requise.');
 const response=await fetch(endpoint+'/functions/v1/'+functionName,{
  method:'POST',cache:'no-store',
  headers:{apikey:publicKey,authorization:'Bearer '+session.access_token,'content-type':'application/json'},
  body:JSON.stringify({action,...data})
 });
 const result=await response.json().catch(()=>({}));
 if(!response.ok||result.ok!==true)throw Error(result.error==='forbidden'?'Accès professeur refusé.':result.error||'Données indisponibles.');
 return result;
}
function metric(id,value){$(id).textContent=String(value)}
function render(data,classLabel){
 $('class-name').textContent=classLabel;
 $('updated').textContent='Actualisé à '+new Intl.DateTimeFormat('fr-BE',{hour:'2-digit',minute:'2-digit'}).format(new Date());
 metric('total',data.total);
 metric('participants',data.participants);
 metric('today',data.activeToday);
 const apps=$('apps');apps.replaceChildren();
 if(!data.apps.length){
  const p=document.createElement('p');p.textContent='Aucune application publique dans cette première version.';apps.append(p);
 }
 for(const app of data.apps){
  const row=document.createElement('div');row.className='app-row';
  const name=document.createElement('strong');name.textContent=app.title;
  const track=document.createElement('div');track.className='track';
  track.setAttribute('role','progressbar');
  track.setAttribute('aria-label','Participation dans '+app.title);
  track.setAttribute('aria-valuemin','0');track.setAttribute('aria-valuemax',String(data.total));
  track.setAttribute('aria-valuenow',String(app.recent));
  const fill=document.createElement('div');fill.className='fill';
  fill.style.width=(data.total?Math.round(100*app.recent/data.total):0)+'%';
  track.append(fill);
  const amount=document.createElement('output');amount.textContent=app.recent+' / '+data.total;
  row.append(name,track,amount);apps.append(row);
 }
 $('blank').hidden=true;
 $('board').hidden=false;
 note('Tableau collectif affiché · lecture seule · actualisation manuelle.');
}
async function refresh(){
 if(loading)return;
 const classId=$('class-choice').value;
 if(!classId)return note('Choisis une classe.');
 const label=$('class-choice').selectedOptions[0]?.textContent||'Classe';
 const ticket=++generation;
 loading=true;$('load').disabled=true;
 note('Chargement du résumé collectif…');
 try{
  const results=await api('connect-results','teacher-overview',{classId});
  if(ticket!==generation||$('class-choice').value!==classId)return;
  const aggregate=summarizeProjection(results.students,catalog,new Date());
  render(aggregate,label);
 }catch(error){
  if(ticket!==generation)return;
  clearBoard('Impossible de charger le tableau collectif.');
  note('Erreur : '+(error?.message||'Réseau indisponible.'));
 }finally{
  loading=false;$('load').disabled=false;
 }
}
async function initialize(){
 try{
  const {createClient}=await import('https://esm.sh/@supabase/supabase-js@2.95.0');
  client=createClient(endpoint,publicKey,{auth:{
   persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,
   storageKey:'mathas-connect-professor-auth-v1'
  }});
  const {data:{session}}=await client.auth.getSession();
  if(!session?.access_token||session.user?.is_anonymous){
   loginRequired('Connecte-toi d’abord à l’espace professeur.');
   return;
  }
  // Une lecture de classes lors de l'ouverture ; aucune requête périodique.
  const [dashboard,response]=await Promise.all([
   api('connect-api','teacher-dashboard'),
   fetch('./hub-catalog.json',{cache:'no-store'})
  ]);
  if(!response.ok)throw Error('Catalogue indisponible.');
  const config=await response.json();
  catalog=Array.isArray(config.apps)?config.apps:[];
  const classes=(Array.isArray(dashboard.classes)?dashboard.classes:[])
   .filter(c=>c?.id&&typeof c.name==='string'&&!c.name.includes('TEST'));
  const select=$('class-choice');
  select.replaceChildren(new Option('Choisir une classe',''),
   ...classes.map(c=>new Option(c.name,c.id)));
  // Les quatre boutons Projection du professeur présélectionnent leur classe.
  // L'identifiant URL ne donne aucun droit et ne déclenche aucune lecture de résultats.
  if(requestedClassId&&classes.some(c=>c.id===requestedClassId))select.value=requestedClassId;
  $('login-needed').hidden=true;
  $('controls').hidden=false;
  clearBoard(classes.length?'Sélectionne une classe et lance l’affichage collectif.':'Aucune classe disponible pour cette connexion professeur.');
 }catch(error){
  loginRequired('Accès impossible : '+(error?.message||'Erreur réseau')+'. Ouvre l’espace professeur et réessaie.');
 }
}
$('class-choice').addEventListener('change',()=>clearBoard('Classe changée : le tableau précédent a été effacé.'));
$('load').addEventListener('click',refresh);
$('hide').addEventListener('click',()=>clearBoard());
$('fullscreen').addEventListener('click',async()=>{
 try{
  if(document.fullscreenElement)await document.exitFullscreen();
  else await document.documentElement.requestFullscreen();
 }catch{note('Le mode plein écran n’est pas disponible dans ce navigateur.')}
});
window.addEventListener('pagehide',()=>clearBoard('Tableau masqué après fermeture de la page.'));
initialize();
