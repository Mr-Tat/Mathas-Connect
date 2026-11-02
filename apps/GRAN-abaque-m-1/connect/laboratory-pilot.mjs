// Teacher-facing pilot controls. This module never grants XP or authenticates a pupil.
export const ABAQUE_ONLINE_APP=Object.freeze({
 app_key:'abaque-longueurs',title:'Abaque des longueurs',
 launch_url:'./apps/GRAN-abaque-m-1/?connect=1',enabled:false,visible:false,
});
export function includeAbaquePilot(apps){
 return apps.some(app=>app.app_key===ABAQUE_ONLINE_APP.app_key)?apps:
  [...apps,{...ABAQUE_ONLINE_APP,installationPending:true}];
}
export function mountAbaquePilot({card,app,launches,teacherButton,request,confirmed,profiles,teacherReady,notify,reloadCatalogue}){
 let ready=false,disposed=false,probe=0,busy=false;
 const message=document.createElement('p');message.className='muted tiny';message.dataset.abaquePilotStatus='';
 const actions=document.createElement('div');actions.className='actions';
 const approve=document.createElement('button');approve.type='button';approve.className='secondary';
 approve.textContent='Autoriser les profils fictifs';approve.dataset.abaquePilotApprove='';
 const refresh=document.createElement('button');refresh.type='button';refresh.className='secondary';refresh.textContent='Vérifier la connexion';
 const help=document.createElement('p');help.className='muted tiny';
 help.textContent='Avant le premier essai, confirme les profils fictifs puis autorise-les pour l’Abaque. Monsieur T utilise son propre profil.';
 actions.append(approve,refresh);card.append(message,actions,help);
 for(const link of launches)link.addEventListener('click',event=>{
  if(!ready){event.preventDefault();event.stopImmediatePropagation();notify('Le pilote Abaque attend son activation Connect.',true);}
 },true);
 function refreshConsent(){
  if(disposed)return;
  for(const link of launches)link.setAttribute('aria-disabled',String(!ready));
  if(teacherButton)teacherButton.disabled=!ready||!teacherReady();
  approve.disabled=busy||!ready||!confirmed();
 }
 async function refreshStatus(){
  const epoch=++probe;ready=false;message.textContent='Vérification du pilote connecté…';refreshConsent();
  if(app.installationPending||app.enabled!==true){
   message.textContent='Activation Connect en attente. La démonstration reste disponible dans « Test hors ligne ».';return;
  }
  refresh.disabled=true;
  try{
   const status=await request('teacher-pilot-status');
   if(disposed||epoch!==probe)return;
   ready=status.ready===true;
   message.textContent=ready?'XP, trophées et progression sauvegardés dans Connect.':'Activation Connect en attente.';
  }catch{
   if(disposed||epoch!==probe)return;
   message.textContent='Le pilote Connect n’est pas encore disponible. Aucun résultat d’essai n’est envoyé.';
  }finally{if(!disposed&&epoch===probe){refresh.disabled=false;refreshConsent();}}
 }
 approve.onclick=async()=>{
  if(!ready||!confirmed()||busy)return;
  const studentIds=[...new Set(profiles().filter(person=>!person.archived_at).map(person=>person.id))];
  const includeTeacher=teacherReady();
  if(!studentIds.length&&!includeTeacher){notify('Ajoute un profil fictif ou active Monsieur T avant de l’autoriser.',true);return;}
  busy=true;refreshConsent();
  try{
   const result=await request('teacher-pilot-approve',{fictiveConfirmed:true,studentIds,includeTeacher});
   if(!disposed)notify(result.approvedCount+' profil(s) fictif(s) autorisé(s) pour l’Abaque.');
  }catch{if(!disposed)notify('Impossible d’autoriser ces profils. Vérifie la connexion et les profils du Laboratoire.',true);}
  finally{busy=false;refreshConsent();}
 };
 refresh.onclick=()=>{if((app.installationPending||app.enabled!==true)&&reloadCatalogue)void reloadCatalogue();else void refreshStatus();};
 refreshConsent();void refreshStatus();
 return {refreshConsent,dispose(){disposed=true;probe++;}};
}
