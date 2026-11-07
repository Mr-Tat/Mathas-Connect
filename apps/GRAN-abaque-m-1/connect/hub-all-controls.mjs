// Administration minimale du pilote dans le HUB Toutes.
// Aucun gain XP, changement scolaire ou approbation implicite ; RPC TEST seule.
export function mountAbaqueAllHubControls({panel,teacherClient,getProfiles,baseUrl,publicKey,testClass}){
 const root=document.createElement('details');root.id='toutes-abaque-controls';root.className='toutes-abaque-controls';
 const summary=document.createElement('summary');summary.textContent='📏 Abaque des longueurs · accès Connect';
 const content=document.createElement('div');content.className='toutes-abaque-details';
 const description=document.createElement('p');
 description.textContent='Active les profils fictifs de TEST pour essayer l’Abaque exactement comme un élève : vrais XP, records et trophées. Les autres classes restent fermées.';
 const consent=document.createElement('label');consent.className='toutes-abaque-consent';
 const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.id='toutes-abaque-fictive';
 consent.append(checkbox,document.createTextNode(' Je confirme que les profils utilisés sont fictifs et appartiennent à TEST.'));
 const actions=document.createElement('div');actions.className='toutes-abaque-actions';
 const pupil=document.createElement('button');pupil.type='button';pupil.className='ghost-btn';pupil.id='toutes-abaque-approve-student';pupil.textContent='Autoriser le profil choisi';
 const teacher=document.createElement('button');teacher.type='button';teacher.className='ghost-btn';teacher.id='toutes-abaque-approve-teacher';teacher.textContent='Autoriser Monsieur T';
 const status=document.createElement('p');status.id='toutes-abaque-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 actions.append(pupil,teacher);content.append(description,consent,actions,status);root.append(summary,content);panel.append(root);
 let ready=false,busy=false,disposed=false;
 const selected=()=>panel.querySelector('#toutes-student-select')?.value;
 const refreshButtons=()=>{
  const profiles=getProfiles();
  pupil.disabled=!ready||busy||!checkbox.checked||!profiles.some(p=>p.id===selected()&&!p.archived_at);
  teacher.disabled=!ready||busy||!checkbox.checked;
 };
 checkbox.onchange=refreshButtons;
 panel.querySelector('#toutes-student-select')?.addEventListener('change',refreshButtons);
 async function request(action,additional={}){
  const client=await teacherClient();const {data:{session}}=await client.auth.getSession();
  if(!session?.access_token||session.user?.is_anonymous)throw Error('Session professeur requise.');
  const response=await fetch(baseUrl+'/functions/v1/connect-abaque',{
   method:'POST',cache:'no-store',headers:{apikey:publicKey,authorization:'Bearer '+session.access_token,'content-type':'application/json'},
   body:JSON.stringify({action,appKey:'abaque-longueurs',classId:testClass,...additional})
  });
  const answer=await response.json().catch(()=>null);
  if(!response.ok||answer?.ok!==true)throw Error(answer?.error||'Pilote Connect indisponible.');
  return answer;
 }
 async function refresh(){
  if(disposed)return;
  ready=false;status.textContent='Vérification du service connecté…';refreshButtons();
  try{
   const answer=await request('teacher-pilot-status');
   if(disposed)return;
   ready=answer.ready===true;
   status.textContent=ready?'Service Abaque actif pour TEST. Sélectionne un profil puis confirme son autorisation.':'Abaque Connect non disponible. Aucun profil ne sera autorisé.';
  }catch(e){if(disposed)return;status.textContent='Abaque Connect indisponible : '+(e.message||'Connexion impossible.');}
  refreshButtons();
 }
 async function approve(includeTeacher){
  if(!ready||busy||!checkbox.checked)return;
  const profile=includeTeacher?null:getProfiles().find(p=>p.id===selected()&&!p.archived_at);
  if(!includeTeacher&&!profile){status.textContent='Choisis d’abord un profil fictif de TEST.';return;}
  const label=includeTeacher?'Monsieur T':profile.display_name;
  if(!confirm('Autoriser uniquement '+label+' à jouer à l’Abaque en mode Connect dans la classe fictive TEST ?'))return;
  busy=true;refreshButtons();
  try{
   const result=await request('teacher-pilot-approve',{fictiveConfirmed:true,studentIds:profile?[profile.id]:[],includeTeacher});
   status.textContent=label+' autorisé pour l’Abaque. '+result.approvedCount+' profil(s) traité(s). Le lancement exige toujours un appareil ou compte approuvé.';
  }catch(e){status.textContent='Autorisation refusée : '+(e.message||'Erreur Connect.');}
  finally{busy=false;refreshButtons();}
 }
 pupil.onclick=()=>void approve(false);
 teacher.onclick=()=>void approve(true);
 refreshButtons();
 return {refresh,dispose(){disposed=true;root.remove();}};
}
