import {avatarGlyph,avatarColor} from './avatar-catalog.js';
import {hubUrl} from './connect-context.js';
import {listRecentProfiles,rememberRecentProfile,rememberRecentAvatar} from './recent-profiles.js?v=20261027avatars2';
import {beginJoinAvatar,useApprovedAvatar,editedJoinAvatar,clearJoinAvatarDraft} from './join-avatar.js?v=20261027avatars2';
import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.95.0';
const url='https://awmhpfofacaglewammxt.supabase.co', key='sb_publishable_oI2Pyl3kXzmLkK-CBnw9Nw_66a4fZgM';
const params=new URLSearchParams(location.search);
const cls=params.get('class');
const teacherPortal=params.get('portail')==='prof'&&!cls;
// Administrateur : stockage séparé ; joueur : stockage historique préservé.
const sb=createClient(url,key,{auth:{
 persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,
 ...(teacherPortal?{storageKey:'mathas-connect-professor-auth-v1'}:{})
}});
const $=id=>document.getElementById(id);
const hubLink=hubUrl();
// Les sections restent dans le DOM pour les événements, mais sont inaccessibles
// via show() et invisibles dans le parcours élève. Aucun lien élève vers Professeur.
if(!teacherPortal){document.getElementById('teacher-entry').hidden=true;}

const CLASS_SPACES={
 observation:{id:'8fe170fa-9e8f-4e80-885a-b0ba68026f64',name:'Observation'},
 phase1:{id:'71f5f4a5-3f25-4ec7-ac29-c33d2e6b395e',name:'Phase 1'},
 phase2:{id:'1b021ed9-4846-4203-9c7b-4b5fa8d7adab',name:'Phase 2'},
 '2eco':{id:'a9195199-0a28-4e86-99ce-47b36dd6e646',name:'2 ECO'}
};
let currentTeacherSpace=null;
let teacherPlayerActive=false;
const teacherPlayerKey=id=>'mathas.connect.teacher-player-enabled.v1:'+id;

let busy=false;
function show(v){if(!teacherPortal&&['teacher','login','welcome','checking'].includes(v)){location.replace(hubLink);return}if(teacherPortal&&!['teacher','login','checking'].includes(v))v='login';document.documentElement.classList.remove('prof-initial-loading');const loading=document.getElementById('prof-initial-loading');if(loading)loading.hidden=v!=='checking';document.querySelectorAll('[data-view]').forEach(e=>e.hidden=e.dataset.view!==v);msg('')}
function msg(s='',success=false){const e=$('message');e.textContent=s;e.hidden=!s;e.classList.toggle('ok',success)}
async function run(fn){if(busy)return;busy=true;try{await fn()}catch(e){msg(e.message||'Erreur')}finally{busy=false}}
async function ensureStudentSession(){
 const {data:{session},error}=await sb.auth.getSession();
 if(error)throw Error('Impossible de vérifier la connexion élève.');
 if(session?.access_token){
   if(!session.user?.is_anonymous){
     $('legacy-professor-session').hidden=false;
     throw Error('Ancienne connexion professeur détectée. Clique « Activer la connexion élève » pour utiliser une session élève indépendante.');
   }
   return session;
 }
 const created=await sb.auth.signInAnonymously();
 if(created.error){
   const reason=(created.error.code||'')+' '+(created.error.message||'');
   if(/anonymous_provider_disabled|anonymous sign.ins are disabled/i.test(reason)){
     throw Error('Connexion élève désactivée dans Supabase Connect. Vérifie Authentication → Providers → Anonymous Sign-Ins.');
   }
   throw Error('Connexion élève impossible. Vérifie la configuration Supabase et réessaie.');
 }
 const signed=created.data?.session||(await sb.auth.getSession()).data.session;
 if(!signed?.access_token)throw Error('Connexion élève non établie. Réessaie.');
 return signed;
}
async function call(action,data={}){const {data:{session}}=await sb.auth.getSession();if(!session)throw Error('Connexion requise');
 const r=await fetch(url+'/functions/v1/connect-api',{method:'POST',headers:{'content-type':'application/json','apikey':key,'authorization':'Bearer '+session.access_token},body:JSON.stringify({action,...data})});
 const v=await r.json().catch(()=>({}));if(!r.ok||!v.ok)throw Error(({forbidden:'Accès refusé',join_failed:'Demande impossible. Vérifie ton profil actuel ou demande au professeur',device_already_approved:'Cet appareil est déjà associé à un élève. Choisis le profil existant ou change de compte',decision_failed:'Demande déjà traitée ou expirée',auth_required:'Connexion expirée'})[v.error]||v.error||'Erreur réseau');return v}
async function teacher(){
 const r=await call('teacher-dashboard');
 const box=$('class-selector');
 box.replaceChildren(...(r.classes||[]).filter(c=>!c.name.includes('TEST')).map(c=>new Option(c.name,c.id)));
 $('year-selector').replaceChildren(...(r.years||[]).map(v=>new Option(v.label,v.id)));
 show('teacher');showTeacherTab('home');
 // Accueil GLOBAL : une seule requête pour toutes les classes.
 renderGlobalRequests(r);
 const currentTeacher=(await sb.auth.getSession()).data.session?.user;
 teacherPlayerActive=!!currentTeacher&&localStorage.getItem(teacherPlayerKey(currentTeacher.id))==='1';
 applyTeacherPlayerMode();
 // Le raccourci Master Mode mène à la classe concernée, après authentification.
 const linkedClass=params.get('profClass');
 if(teacherPortal&&linkedClass&&[...box.options].some(o=>o.value===linkedClass)){
  box.value=linkedClass;
  currentTeacherSpace=Object.keys(CLASS_SPACES).find(k=>CLASS_SPACES[k].id===linkedClass)||null;
  syncResultsClassPicker();showTeacherTab('results');
  await showResults().catch(e=>showResultMessage('Résultats indisponibles : '+e.message));
 }
}
function renderGlobalRequests(all){
 const requests=Array.isArray(all.requests)?all.requests:[];
 $('request-count').textContent=String(requests.length);
 const out=$('requests-list');out.replaceChildren();
 if(!requests.length){out.textContent='Aucune demande en attente dans tes classes.';return;}
 for(const req of requests){const card=document.createElement('div');card.className='request-card';const head=document.createElement('div');head.className='request-heading';const name=document.createElement('strong');name.textContent=req.first_name+'.'+req.last_initial+' · '+(all.classes.find(c=>c.id===req.class_id)?.name||'Classe');const code=document.createElement('span');code.className='request-code';code.textContent=req.verify_code;const person=document.createElement('div');person.className='request-person';person.append(name);head.append(person,code);card.append(head);const row=document.createElement('div');row.className='button-row';
 // Même prénom + initiale : présélection seulement si une seule fiche correspond.
 // Une correspondance de nom NE PROUVE PAS l'identité : le professeur valide toujours la demande et le code.
 const matches=Array.isArray(req.matches)?req.matches:[];
 if(matches.length){
   // Cette correspondance de NOM n'est pas une preuve d'identité :
   // la fiche et le code restent à vérifier manuellement avant approbation.
   const reconnect=document.createElement(matches.length===1?'button':'span');
   reconnect.className='request-reconnect-badge';
   reconnect.textContent='RECONNEXION';
   reconnect.title='Une fiche porte ce nom. Vérifie le code et l’identité de l’élève avant d’autoriser.';
   if(matches.length===1){
     reconnect.type='button';
     reconnect.title+=' Clique ici pour choisir une autre fiche si nécessaire.';
     reconnect.setAttribute('aria-expanded','false');
     reconnect.setAttribute('aria-label','RECONNEXION : modifier l’association à la fiche élève');
   }
   person.append(reconnect);
   const sel=document.createElement('select');sel.setAttribute('aria-label','Associer la demande à une fiche élève');sel.className='match-selector';
   const first=new Option(matches.length>1?'Plusieurs élèves homonymes : choisis la bonne fiche':'Créer une nouvelle fiche (autre élève)',matches.length>1?'':'__new__');
   if(matches.length>1){first.disabled=true;first.selected=true}
   sel.append(first,...matches.map(e=>new Option('Élève existant : '+e.display_name,e.id)));
   if(matches.length>1)sel.append(new Option('Créer une nouvelle fiche (autre élève)','__new__'));
   if(matches.length===1){
     sel.value=matches[0].id;
     // Conserver l'association choisie, mais masquer l'ancienne section redondante.
     // La pastille permet de rouvrir le choix en cas d'homonyme non reconnu.
     sel.hidden=true;
     reconnect.onclick=()=>{
       sel.hidden=!sel.hidden;
       reconnect.setAttribute('aria-expanded',String(!sel.hidden));
     };
   }
   card.append(sel);
   if(matches.length>1){
     const notice=document.createElement('p');notice.className='match-note';
     notice.textContent='Plusieurs fiches portent ce nom : choisis la bonne avant d’autoriser.';
     card.append(notice);
   }
 }
 for(const [label,approve] of [['Autoriser',true],['Refuser',false]]){
   const btn=document.createElement('button');btn.textContent=label;if(!approve)btn.className='danger';
   btn.onclick=()=>run(async()=>{
     const selected=card.querySelector('.match-selector')?.value;
     if(approve&&matches.length&&!selected)throw Error('Choisis la fiche élève correspondante.');
     if(approve&&matches.length&&selected==='__new__'
        &&!confirm('Une fiche de ce nom existe déjà. Créer une fiche différente malgré cette correspondance ?'))return;
     const existingStudentId=approve&&selected&&selected!=='__new__'?selected:undefined;
     await call('teacher-review-join',{requestId:req.id,approve,...(existingStudentId?{existingStudentId}:{})});
     await refreshGlobalRequests();
     const message=approve?(existingStudentId?'Appareil associé à la fiche élève existante':'Appareil autorisé : nouvelle fiche élève'):'Demande refusée';
     const notice=$('teacher-requests-feedback');if(notice){notice.textContent=message;notice.hidden=false}
     msg('')
   });
   row.append(btn)
 }
 card.append(row);out.append(card)}
}
async function refreshGlobalRequests(){
 const out=$('requests-list');
 try{
  const all=await call('teacher-dashboard');
  renderGlobalRequests(all);
 }catch(e){
  $('request-count').textContent='!';
  out.textContent='Impossible de récupérer les demandes. Vérifie ta session professeur puis clique sur « Actualiser les demandes ».';
  throw e;
 }
}
async function refresh(){
 // Réservé à la gestion des élèves et des appareils de la classe sélectionnée.
 const id=$('class-selector').value;
 if(!id){$('students-list').textContent='Aucun élève.';return;}
 const data=await call('teacher-dashboard',{classId:id});
 renderArchives(data,id);
 const s={students:data.students||[]},d={devices:data.devices||[]};
 const students=$('students-list');students.replaceChildren();
 if(!s.students.length){students.textContent='Aucun élève.';return}
 const devicesByStudent=new Map();
 for(const device of d.devices||[]){const arr=devicesByStudent.get(device.student_id)||[];arr.push(device);devicesByStudent.set(device.student_id,arr)}
 for(const e of s.students){
   const item=document.createElement('div');item.className='student-card';
   const name=document.createElement('strong');name.textContent=e.display_name;item.append(name);
   const devices=devicesByStudent.get(e.id)||[];
   if(!devices.length){const info=document.createElement('p');info.className='hint';info.textContent='Aucun appareil autorisé.';item.append(info)}
   devices.forEach((device,index)=>{
     const row=document.createElement('div');row.className='device-row';
     const info=document.createElement('span');info.textContent=(device.device_label||'Appareil non nommé '+(index+1))+' · '+(device.state==='approved'?'Autorisé':device.state==='revoked'?'Révoqué':'En attente');row.append(info);
     if(device.state==='approved'){
       const revoke=document.createElement('button');revoke.type='button';revoke.className='danger';revoke.textContent='Révoquer';
       revoke.setAttribute('aria-label','Révoquer l’appareil '+(index+1)+' de '+e.display_name);
       revoke.onclick=()=>{if(!confirm('Révoquer cet appareil de '+e.display_name+' ? Il perdra son accès Connect.'))return;
         run(async()=>{await call('teacher-device-decision',{classId:id,deviceId:device.id,decision:'revoked'});await refresh();msg('Appareil révoqué pour '+e.display_name,true)})};
       row.append(revoke);
     }
     item.append(row);
   });
   const archive=document.createElement('button');archive.type='button';archive.className='soft';archive.textContent='Archiver cet élève';archive.title='Désactiver le compte tout en conservant ses résultats';
   archive.onclick=()=>run(async()=>{
    if(!confirm('Archiver '+e.display_name+' ? Tous ses appareils seront révoqués, mais ses résultats seront conservés.'))return;
    await call('teacher-manage-student',{classId:id,studentId:e.id,operation:'archive'});
    await refresh();msg('Élève archivé et résultats conservés.',true)
   });
   item.append(archive);
   students.append(item);
 }
}
function renderArchives(data,classId){
 const list=$('archived-students-list');if(!list)return;
 const people=data.archivedStudents||[];$('archived-students-count').textContent=String(people.length);list.replaceChildren();
 if(!people.length){const empty=document.createElement('p');empty.className='hint';empty.textContent='Aucun élève archivé.';list.append(empty);return}
 for(const person of people){
  const item=document.createElement('div');item.className='student-card';
  const name=document.createElement('strong');name.textContent=person.display_name;
  const restore=document.createElement('button');restore.type='button';restore.className='soft';restore.textContent='Restaurer';
  restore.onclick=()=>run(async()=>{await call('teacher-manage-student',{classId,studentId:person.id,operation:'restore'});await refresh();msg('Fiche restaurée. Les appareils devront être réautorisés.',true)});
  const remove=document.createElement('button');remove.type='button';remove.className='danger';remove.textContent='Supprimer définitivement';
  remove.onclick=()=>run(async()=>{
   if(!confirm('SUPPRESSION IRRÉVERSIBLE de '+person.display_name+' et de tous ses résultats Connect ?'))return;
   const entered=prompt('Pour confirmer, recopie exactement le nom : '+person.display_name);
   if(entered!==person.display_name)return;
   const phrase=prompt('Dernière confirmation : écris SUPPRIMER DÉFINITIVEMENT');
   if(phrase!=='SUPPRIMER DÉFINITIVEMENT')return;
   const outcome=await call('teacher-manage-student',{classId,studentId:person.id,operation:'delete',confirmName:entered,confirmPhrase:phrase});
   await refresh();msg(outcome.accountCleanupPending?'Fiche et résultats supprimés, mais le nettoyage de certains identifiants techniques reste à vérifier.':'Fiche et résultats supprimés de Connect. Pense aussi à supprimer les anciennes sauvegardes téléchargées si nécessaire.',true)
  });
  const row=document.createElement('div');row.className='button-row';row.append(restore,remove);item.append(name,row);list.append(item);
 }
}
function renderRecentProfiles() {
  const known = listRecentProfiles(cls);
  const wrapper = $('recent-profiles'), list = $('recent-profiles-list');
  list.replaceChildren();
  // Si aucun ancien compte n'est enregistré : inscription classique.
  wrapper.hidden = known.length === 0;
  $('join-form').hidden = known.length > 0;
  for (const name of known) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'recent-profile';
    button.textContent = name;
    button.setAttribute('aria-label', 'Demander l’accès pour ' + name);
    button.onclick = () => run(async () => {
      // Nom mémorisé localement : envoi immédiat de la demande normale.
      // Le professeur doit TOUJOURS vérifier le code et autoriser l'appareil.
      const space = name.lastIndexOf(' ');
      const firstName = name.slice(0, space);
      const lastInitial = name.slice(space + 1);
      await requestStudentAccess(firstName, lastInitial);
    });
    list.append(button);
  }
}
$('other-profile').onclick = () => {
  $('recent-profiles').hidden = true; $('join-form').hidden = false;
  $('first-name').value = ''; $('last-initial').value = ''; $('first-name').focus();
};
$('free-student-session').onclick=()=>run(async()=>{
  // Transition unique des anciens navigateurs où la session professeur
  // partageait le stockage du joueur. Ne rien révoquer sans consentement.
  if(!confirm('Une ancienne connexion professeur utilise encore cet espace. Pour connecter un élève sur ce navigateur, fermer cette ancienne session ? Les comptes, résultats et XP seront conservés. Tu pourras te reconnecter à la page professeur séparément.'))return;
  const {data:{session}}=await sb.auth.getSession();
  if(session?.user&&!session.user.is_anonymous){
    const {error}=await sb.auth.signOut({scope:'local'});
    if(error)throw error;
  }
  $('legacy-professor-session').hidden=true;
  await student();
});
async function student(){if(!cls){location.replace('./connexion.html');return}
 renderRecentProfiles();
 await ensureStudentSession();await status()}
let waitingTimer=null,waitingApproved=false,waitingBusy=false,existingProfileClass=null;

function waitAvatar(){
 const target=$('waiting-avatar-editor'),field=document.querySelector('.join-avatar-field');
 if(target&&field&&!target.contains(field))target.append(field);
}
function stopWaiting(){if(waitingTimer){clearTimeout(waitingTimer);waitingTimer=null}}
function startWaiting(){
 stopWaiting();waitAvatar();show('waiting');$('finish-avatar').hidden=!waitingApproved;
 $('waiting-actions').hidden=waitingApproved;
 $('waiting-expiry').hidden=waitingApproved;
 if(waitingApproved){$('waiting-status-note').textContent='✅ Demande acceptée ! Conserve ton avatar ou change-le, puis appuie sur le bouton.';return}
 $('waiting-status-note').textContent='En attente du professeur…';
 // Contrôle rare : une requête toutes les 15 secondes maximum, onglet visible.
 waitingTimer=setTimeout(async()=>{
  waitingTimer=null;
  if(document.hidden||document.querySelector('[data-view="waiting"]').hidden)return;
  if(waitingBusy)return;
  waitingBusy=true;
  try{await status(true)}catch{ /* le bouton Vérifier reste disponible */ }
  finally{waitingBusy=false}
  if(!waitingApproved&&!document.querySelector('[data-view="waiting"]').hidden)startWaiting();
 },15000);
}
document.addEventListener('visibilitychange',()=>{
 if(!document.hidden&&!waitingApproved&&!document.querySelector('[data-view="waiting"]').hidden&&!waitingTimer&&!waitingBusy)startWaiting();
});
async function status(silent=false){
 await ensureStudentSession();
 const {request:r}=await call('student-join-status',{classId:cls,awaitingApproval:waitingApproved||!document.querySelector('[data-view="waiting"]').hidden});
 if(!r||['cancelled','expired','rejected'].includes(r.state)){
  stopWaiting();waitingApproved=false;
  if(silent&&r?.state==='expired'){show('student-form');renderRecentProfiles();msg('Demande expirée après 15 minutes. Tu peux recommencer.');return}
  show('student-form');renderRecentProfiles();if(r?.state==='rejected')msg('Demande refusée. Tu peux refaire une demande, avec le même prénom ou un autre.');return
 }
 if(r.state==='already_approved'){
  rememberRecentProfile(cls,r.displayName);
  rememberRecentAvatar(r.classId,r.displayName,r.avatar);
  stopWaiting();existingProfileClass=r.classId;
  $('account-name').textContent=(r.displayName||'Élève').replace(/\.\s*(?=[\p{L}]$)/u,' ');
  $('account-avatar').textContent=avatarGlyph(r.avatar);
  $('account-avatar').style.background=avatarColor(r.avatar?.color);
  show('account-choice');return
 }
 if(r.state==='approved'){
  waitingApproved=true;stopWaiting();
  try{localStorage.removeItem('mathas.connect.mode-libre.v1')}catch{}
  try{
   const profile=await call('student-me',{classId:cls});
   if(profile.status==='approved'){
    useApprovedAvatar(profile.avatar);
    rememberRecentProfile(cls,profile.displayName);
    rememberRecentAvatar(cls,profile.displayName,profile.avatar);
   }
  }catch(e){console.warn('Impossible de préselectionner l’avatar officiel : l’ancien choix reste conservé.',e)}
  startWaiting();return
 }
 if(r.state==='revoked'){stopWaiting();$('open-hub').hidden=true;$('result-title').textContent='Appareil révoqué';$('result-description').textContent='Adresse-toi au professeur.';show('approved');return}
 $('verification-code').textContent=r.verify_code||r.code||'••••';
 if(document.querySelector('[data-view="waiting"]').hidden)startWaiting();
}

$('home').onclick=()=>{if(teacherPortal)show('login');else location.assign(hubLink)};
if(teacherPortal&&$('teacher-entry'))$('teacher-entry').onclick=()=>show('login');
$('back-login').onclick=()=>{location.href=hubLink};
$('student-entry').onclick=()=>run(student);
$('login-form').onsubmit=e=>{e.preventDefault();run(async()=>{const r=await sb.auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value});if(r.error)throw Error('Identifiants incorrects');$('password').value='';await teacher()})};
$('logout').onclick=()=>run(async()=>{
 const account=(await sb.auth.getSession()).data.session?.user;
 if(account)try{localStorage.removeItem(teacherPlayerKey(account.id))}catch{}
 teacherPlayerActive=false;
 applyTeacherPlayerMode();
 await sb.auth.signOut();show('login');
});
$('open-hub').onclick=()=>{location.href=hubLink};
$('teacher-hub').onclick=()=>{location.href=hubLink};
$('add-year-form').onsubmit=e=>{e.preventDefault();run(async()=>{const label=$('new-year-label').value.trim(),startsOn=$('year-start').value,endsOn=$('year-end').value;if(endsOn<=startsOn)throw Error('La date de fin doit suivre la date de début');await call('teacher-create-year',{label,startsOn,endsOn});$('add-year-form').reset();await teacher();msg('Année scolaire ajoutée',true)})};
$('add-class-form').onsubmit=e=>{e.preventDefault();run(async()=>{const yearId=$('year-selector').value,name=$('new-class-name').value.trim();if(!yearId)throw Error('Ajoute d’abord une année scolaire.');const r=await call('teacher-create-class',{yearId,name});$('new-class-name').value='';await teacher();$('class-selector').value=r.class.id;await refresh();msg('Classe créée',true)})};
$('add-student-form').onsubmit=e=>{e.preventDefault();run(async()=>{const classId=$('class-selector').value,name=$('new-student-name').value.trim();await call('teacher-create-student',{classId,name});$('new-student-name').value='';await refresh();msg('Élève ajouté',true)})};
$('class-selector').onchange=()=>run(async()=>{syncResultsClassPicker();await refresh();await showResults().catch(e=>showResultMessage('Suivi indisponible : '+e.message))});
function syncResultsClassPicker(){
 const management=$('class-selector'),picker=$('results-class-selector');if(!picker)return;
 picker.replaceChildren(...[...management.options].map(o=>new Option(o.textContent,o.value)));
 picker.value=management.value;
 const name=management.selectedOptions[0]?.textContent||'Aucune classe';
 $('teacher-results-context').textContent='Résultats de '+name+' · classe sélectionnée';
}
$('results-class-selector').onchange=()=>run(async()=>{
 const id=$('results-class-selector').value;
 if(!id)return;
 $('class-selector').value=id;
 currentTeacherSpace=Object.keys(CLASS_SPACES).find(k=>CLASS_SPACES[k].id===id)||null;
 // Changer de classe invalide toute ancienne restauration prévisualisée.
 restoreDraft=null;restoreCheck=null;restoreHasSafety=false;
 $('results-restore-confirm').disabled=true;$('results-restore-panel').hidden=true;$('results-restore-file').value='';
 updateBackupReminder();
 syncResultsClassPicker();
 await refresh();await showResults();
});
$('refresh-teacher').onclick=()=>run(refresh);
$('requests-refresh')?.addEventListener('click',()=>run(refreshGlobalRequests));
// Rafraîchissement lent, seulement quand l'accueil professeur est ouvert et visible.
setInterval(()=>{if(!document.hidden&&teacherPortal&&!document.querySelector('[data-view="teacher"]').hidden&&!$('teacher-home').hidden&&!busy)run(refreshGlobalRequests)},45000);
$('copy-student-link').onclick=()=>run(async()=>{const box=$('class-selector');if(!box.value)throw Error('Aucune classe');await navigator.clipboard.writeText(hubUrl(box.value,box.selectedOptions[0]?.textContent||'Ma classe'));msg('Lien du HUB de classe copié',true)});
$('clear-form').onclick=()=>{$('first-name').value='';$('last-initial').value=''};
async function requestStudentAccess(firstName, lastInitial) {
 firstName=firstName.trim();lastInitial=lastInitial.trim().toUpperCase();
 if(!/^[\p{L}][\p{L} '-]{0,39}$/u.test(firstName)||!/^[\p{L}]$/u.test(lastInitial))
   throw Error('Vérifie le prénom et la lettre du nom');
 await ensureStudentSession();
 const {request}=await call('student-join',{classId:cls,firstName,lastInitial});
 beginJoinAvatar(firstName+' '+lastInitial);
 // Les valeurs restent disponibles pour mémoriser le profil après approbation.
 $('first-name').value=firstName;
 $('last-initial').value=lastInitial;
 $('verification-code').textContent=request.code;
 waitingApproved=false;startWaiting();
}
$('join-form').onsubmit=e=>{e.preventDefault();run(()=>requestStudentAccess($('first-name').value,$('last-initial').value))};
async function cancelStudentRequestAndReturn() {
 // Annulation serveur avant navigation : la demande disparaît du portail professeur.
 // En l'absence de demande, le retour au HUB est simplement une navigation.
 if(!document.querySelector('[data-view="waiting"]').hidden){
   await call('student-cancel-join',{classId:cls});
 }
 clearJoinAvatarDraft();stopWaiting();
 location.assign(hubLink);
}
$('cancel-student-form').onclick=()=>run(cancelStudentRequestAndReturn);
$('finish-avatar').onclick=()=>run(async()=>{
 if(!waitingApproved)return;
 const choice=editedJoinAvatar();
 if(choice){
  try{await call('student-avatar',choice)}
  catch(e){$('waiting-status-note').textContent='Avatar non enregistré. Vérifie la connexion et réessaie.';return}
  rememberRecentAvatar(cls,$('first-name').value.trim()+' '+$('last-initial').value.trim(),choice);
 }
 clearJoinAvatarDraft();
 rememberRecentProfile(cls,$('first-name').value.trim()+' '+$('last-initial').value.trim().toUpperCase());
 stopWaiting();location.href=hubLink;
});
$('continue-profile').onclick=()=>{if(existingProfileClass)location.href=hubUrl(existingProfileClass);else location.href=hubLink};
$('switch-profile').onclick=()=>run(async()=>{
 if(!confirm('Changer de profil sur cet appareil ? Les scores et XP restent sauvegardés. Le professeur devra autoriser de nouveau cet appareil si tu reviens à ce profil.'))return;
 await call('student-release');const {error}=await sb.auth.signOut({scope:'local'});if(error)throw error;
 existingProfileClass=null;waitingApproved=false;clearJoinAvatarDraft();location.reload()
});
$('check-status').onclick=()=>run(async()=>{if(!waitingApproved)await status()});
$('cancel-request').onclick=()=>run(async()=>{if(waitingApproved)return;await cancelStudentRequestAndReturn()});
$('result-home').onclick=()=>location.assign(hubLink);
$('reset-local').onclick=()=>run(async()=>{if(!confirm('Révoquer cet appareil et oublier ce profil ici ? Les résultats Connect restent enregistrés. Pour reprendre le compte, il faudra une nouvelle autorisation du professeur.'))return;await call('student-release');const {error}=await sb.auth.signOut({scope:'local'});if(error)throw error;location.href=hubLink});
if(!teacherPortal){if(cls){show('student-form');renderRecentProfiles();run(student)}else location.replace('./connexion.html')}
else {
  // Afficher l'accueil sans passage visible par le formulaire si la session est conservée.
  show('checking');
  run(async()=>{
    try{
      const {data:{session},error}=await sb.auth.getSession();
      if(error)throw error;
      if(session&&!session.user?.is_anonymous)await teacher();
      else show('login');
    }catch(e){
      show('login');
      msg('Vérification automatique indisponible. Connecte-toi si nécessaire.');
      console.warn('Session professeur non vérifiée',e);
    }
  });
}
const resultsUrl=url+'/functions/v1/connect-results';
async function resultCall(action,data={}) {
 const {data:{session}}=await sb.auth.getSession();
 if(!session||session.user?.is_anonymous)throw Error('Compte professeur requis');
 const response=await fetch(resultsUrl,{method:'POST',headers:{apikey:key,authorization:'Bearer '+session.access_token,'content-type':'application/json'},body:JSON.stringify({action,classId:$('class-selector').value,appKey:$('results-app').value,...data})});
 const result=await response.json().catch(()=>({}));
 if(!response.ok||!result.ok)throw Error(result.error||'Résultats indisponibles');
 return result;
}
// Rappel hebdomadaire local, sans requête ni stockage serveur.
const backupKey=classId=>'mathas-connect-last-export-v1:'+classId;
function updateBackupReminder(){
 const element=$('results-backup-reminder');if(!element)return;
 const cls=$('class-selector').value;
 if(!cls){element.textContent='Sélectionne une classe pour les sauvegardes.';return}
 let last=null;try{last=localStorage.getItem(backupKey(cls))}catch{}
 const days=last?Math.floor((Date.now()-Date.parse(last))/86400000):Infinity;
 element.textContent=Number.isFinite(days)&&days<7
  ?'Dernier téléchargement demandé depuis ce navigateur il y a '+Math.max(0,days)+' jour(s). Prochain rappel dans '+(7-Math.max(0,days))+' jour(s).'
  :'Sauvegarde hebdomadaire conseillée : télécharge une copie privée de cette classe. Le rappel est propre à ce navigateur.';
}
$('class-selector').addEventListener('change',updateBackupReminder);
updateBackupReminder();
$('results-backup').addEventListener('click',()=>run(async()=>{
 const cls=$('class-selector').value;
 if(!cls)throw Error('Choisis une classe avant de télécharger.');
 if(!confirm('Exporter une copie PRIVÉE des noms et résultats des élèves de cette classe ?\\n\\nConserve ce fichier dans un endroit protégé, jamais sur un GitHub public.'))return;
 const backup=await resultCall('teacher-export');
 if(!['mathas-connect-class-backup-v1','mathas-connect-class-backup-v2','mathas-connect-class-backup-v3','mathas-connect-class-backup-v4'].includes(backup.format))throw Error('Format de sauvegarde inconnu.');
 const contents=JSON.stringify(backup,null,2);
 const blob=new Blob([contents],{type:'application/json;charset=utf-8'});
 const url=URL.createObjectURL(blob);
 const link=document.createElement('a');link.href=url;link.download='mathas-connect-sauvegarde-'+cls+'-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json';
 document.body.appendChild(link);link.click();link.remove();
 try{localStorage.setItem(backupKey(cls),new Date().toISOString())}catch{}
 updateBackupReminder();
 setTimeout(()=>URL.revokeObjectURL(url),1500);
 msg('Téléchargement demandé : vérifie que le fichier existe et conserve-le hors de GitHub.',true);
}));
// Import sécurisé et facultatif : uniquement les comptes déjà présents dans la classe.
let restoreDraft=null,restoreCheck=null,restoreHasSafety=false;
// Un changement de classe invalide toute prévisualisation précédente.
$('class-selector').addEventListener('change',()=>{restoreDraft=null;restoreCheck=null;restoreHasSafety=false;$('results-restore-confirm').disabled=true;$('results-restore-panel').hidden=true;$('results-restore-file').value='';});
$('results-restore-file').addEventListener('change',async event=>{
 restoreDraft=null;restoreCheck=null;restoreHasSafety=false;$('results-restore-confirm').disabled=true;
 const file=event.target.files?.[0];if(!file)return;
 if(file.size>1000000){msg('Fichier trop volumineux (maximum 1 Mo).');return}
 try{
  const doc=JSON.parse(await file.text());
  if(!['mathas-connect-class-backup-v1','mathas-connect-class-backup-v2','mathas-connect-class-backup-v3','mathas-connect-class-backup-v4'].includes(doc.format))throw Error('Format JSON de sauvegarde inconnu');
  if(doc.projectRef&&doc.projectRef!=='awmhpfofacaglewammxt')throw Error('Sauvegarde provenant d’un autre projet');
  if(doc.classId!==$('class-selector').value)throw Error('Sélectionne la classe correspondant à cette sauvegarde');
  if(!Array.isArray(doc.students)||doc.students.length>250)throw Error('Liste d’élèves invalide');
  restoreDraft=doc;
  const choices=[];
  for(const student of doc.students){
   if(!student||typeof student.id!=='string'||!Array.isArray(student.apps))continue;
   for(const app of student.apps)if(['addition-ecrite-simple','multiplication-ecrite-simple'].includes(app.appKey)&&app.state&&Number.isInteger(app.revision)&&Number.isInteger(app.resetEpoch))
     choices.push({student,app});
  }
  if(!choices.length)throw Error("Aucun résultat d'application Connect à restaurer dans ce fichier");
  window.__restoreOptions=choices;
  const menu=$('results-restore-select');menu.replaceChildren();
  choices.forEach((o,i)=>{const option=document.createElement('option');option.value=String(i);option.textContent=o.student.displayName+' · '+(o.app.appKey==='addition-ecrite-simple'?'Addition':'Multiplication')+' écrite (sauvegarde rev. '+o.app.revision+')';menu.appendChild(option)});
  $('results-restore-panel').hidden=false;$('results-restore-summary').textContent='Fichier chargé. Choisis un élève et clique « Prévisualiser ». Aucune donnée modifiée.';
 }catch(err){msg(err.message||'Fichier illisible')}
});
$('results-restore-preview').addEventListener('click',()=>run(async()=>{
 const o=window.__restoreOptions?.[Number($('results-restore-select').value)];if(!o)throw Error('Choisis un élève');
 restoreCheck=null;restoreHasSafety=false;$('results-restore-confirm').disabled=true;
 async function preview(recoverPastReset){
  return resultCall('teacher-restore-preview',{studentId:o.student.id,appKey:o.app.appKey,backupFormat:restoreDraft.format,backupProjectRef:restoreDraft.projectRef,
   backupRevision:o.app.revision,backupResetEpoch:o.app.resetEpoch,backupState:o.app.state,backupMilestones:restoreDraft.format==='mathas-connect-class-backup-v4'?(o.student.xpMilestones||[]).filter(x=>x.appKey===o.app.appKey):[],recoverPastReset});
 }
 let v;
 try{v=await preview(false)}
 catch(e){
  if(e.message!=='previous_reset_requires_confirmation')throw e;
  if(!confirm('ATTENTION : cette sauvegarde est antérieure à une remise à zéro volontaire de ce compte.\\n\\nRestaurer les anciens records pourrait annuler cet effacement. Souhaites-tu uniquement PRÉVISUALISER cette possibilité ?'))return;
  v=await preview(true);
 }
 restoreCheck={choice:o,data:v};
 // Prévisualisation liée à l'élève, à la sauvegarde et à l'état courant.
 // Ne jamais autoriser l'application d'une autre sélection sans nouvelle prévisualisation.
 $('results-restore-summary').textContent='AVANT : '+JSON.stringify(v.before)+'\\n\\nAPRÈS : '+JSON.stringify(v.after)+'\\n\\n'+(v.recoveringPastReset?'⚠ Ancienne remise à zéro : réintroduction de records possible.':'Fusion sans remplacement des meilleurs records récents.')+'\nJalons XP à récupérer : '+(v.restoringXpMilestones||0)+(v.changed?'':' Aucune différence : rien à restaurer.');
 $('results-restore-confirm').disabled=!v.changed;
}));
$('results-restore-confirm').addEventListener('click',()=>run(async()=>{
 if(!restoreCheck||!restoreCheck.data.changed)throw Error('Prévisualisation nécessaire');
 const {choice:o,data:v}=restoreCheck;
 if(!confirm('Opération sensible : une sauvegarde de sécurité ACTUELLE doit être téléchargée avant la restauration. Continuer ?'))return;
 const safety=await resultCall('teacher-export');
 if(!['mathas-connect-class-backup-v1','mathas-connect-class-backup-v2','mathas-connect-class-backup-v3','mathas-connect-class-backup-v4'].includes(safety.format))throw Error('Export de sécurité indisponible');
 const blob=new Blob([JSON.stringify(safety,null,2)],{type:'application/json'});
 const link=document.createElement('a'),uri=URL.createObjectURL(blob);
 link.href=uri;link.download='mathas-AVANT-restauration-'+new Date().toISOString().replaceAll(':','-')+'.json';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(uri),10000);
 if(!confirm('Vérifie maintenant que le fichier « AVANT-restauration » a bien été téléchargé et conservé en lieu sûr.\\n\\nConfirmer la restauration de '+o.student.displayName+' ?'))return;
 const phrase=prompt('Dernière confirmation : écris RESTAURER en majuscules');
 if(phrase!=='RESTAURER')return;
 const out=await resultCall('teacher-restore-apply',{studentId:o.student.id,appKey:o.app.appKey,
  backupFormat:restoreDraft.format,backupProjectRef:restoreDraft.projectRef,
  backupRevision:o.app.revision,backupResetEpoch:o.app.resetEpoch,backupState:o.app.state,
  backupMilestones:restoreDraft.format==='mathas-connect-class-backup-v4'?(o.student.xpMilestones||[]).filter(x=>x.appKey===o.app.appKey):[],
  recoverPastReset:v.recoveringPastReset,expectedRevision:v.currentRevision,expectedResetEpoch:v.currentResetEpoch,previewDigest:v.previewDigest,
  confirmed:true,confirmationPhrase:'RESTAURER',safetyBackupExported:true});
 $('results-restore-summary').textContent='Restauration enregistrée pour '+o.student.displayName+'. Révision : '+out.revision+'. Relire les résultats professeur.';
 restoreCheck=null;$('results-restore-confirm').disabled=true;
 await showResults();
}));
$('results-restore-select').addEventListener('change',()=>{restoreCheck=null;$('results-restore-confirm').disabled=true;$('results-restore-summary').textContent='Sélection modifiée : prévisualise cet élève avant toute restauration.'});
const showResultMessage=t=>$('results-message').textContent=t;
const dateBE=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Brussels',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const points=n=>n==null?'—':String(n)+' pts';
function recentLabel(r){
 const mode={classic:'Classique',sudden:'Mort subite',hard:'HARD'}[r.mode]||r.mode;
 return mode+' N'+r.level+' : '+r.score+(r.total!=null?'/'+r.total:'');
}

const formatRecentTime=at=>{
 const date=new Date(at||'');
 return Number.isNaN(date.getTime())?'—':new Intl.DateTimeFormat('fr-BE',{timeZone:'Europe/Brussels',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(date);
};
function makeOverviewCell(state){
 const cell=document.createElement('div');
 if(!state){cell.className='results-no-data';cell.textContent='Aucun résultat';return cell}
 cell.className='results-overview-cell';
 const history=document.createElement('div');history.className='results-last';
 const title=document.createElement('span');title.className='results-last-title';title.textContent='3 derniers';history.append(title);
 for(let i=0;i<3;i++){
  const r=state.recent?.[i],line=document.createElement('div');line.className='results-recent-line';
  if(!r)line.textContent='—';
  else{
   const score=document.createElement('span');score.textContent=String(r.score??'—')+(r.total!=null?'/'+r.total:'')+' · ';
   const time=document.createElement('time');time.dateTime=r.at||'';time.textContent=formatRecentTime(r.at);
   line.append(score,time);
  }
  history.append(line);
 }
 const scores=document.createElement('div');scores.className='results-score-values';
 for(const [label,value] of [['Jour',state.todayBest?.day===dateBE()?state.todayBest.points:null],['Record',state.bestPoints]]){
  const t=document.createElement('span');t.className='results-score-label';t.textContent=label;
  const p=document.createElement('span');p.className='results-score-value';p.textContent=points(value);
  scores.append(t,p);
 }
 cell.append(history,scores);return cell;
}
async function showOverview(){
 const [catalogRes,exported]=await Promise.all([fetch('./hub-catalog.json'),resultCall('teacher-overview')]);
 if(!catalogRes.ok)throw Error('Catalogue indisponible');
 const {apps=[]}=await catalogRes.json();
 const people=(exported.students||[]).sort((a,b)=>a.displayName.localeCompare(b.displayName,'fr'));
 const last=app=>Math.max(0,...people.map(p=>Date.parse(p.apps?.find(a=>a.appKey===app.app_key)?.state?.recent?.[0]?.at||0)||0));
 const ordered=apps.slice().sort((a,b)=>last(b)-last(a)||a.display_order-b.display_order);
 const container=$('results-list');container.replaceChildren();
 if(!people.length){showResultMessage('Aucun élève dans cette classe.');return}
 const scroll=document.createElement('div');scroll.className='results-overview-scroll';
 const table=document.createElement('table');table.className='results-overview-table';
 const tr=document.createElement('tr'),name=document.createElement('th');name.textContent='Élève';tr.append(name);
 for(const app of ordered){
  const th=document.createElement('th'),wrap=document.createElement('div');wrap.className='results-app-heading';
  if(app.image_url){const img=document.createElement('img');img.src=app.image_url;img.alt='';wrap.append(img)}
  const label=document.createElement('span');label.textContent=app.title;wrap.append(label);th.append(wrap);tr.append(th);
 }
 const thead=document.createElement('thead');thead.append(tr);table.append(thead);
 const body=document.createElement('tbody');
 for(const person of people){
  const row=document.createElement('tr'),n=document.createElement('td'),btn=document.createElement('button');
  btn.type='button';btn.className='results-student-link';btn.textContent=person.displayName;btn.title='Voir toutes les applications de cet élève';
  btn.onclick=()=>showOverviewDetail(person,ordered);
  n.append(btn);row.append(n);
  for(const app of ordered){
   const td=document.createElement('td'),open=document.createElement('button');
   open.type='button';open.className='results-app-cell-button';
   open.setAttribute('aria-label','Voir les résultats de '+person.displayName+' dans '+app.title);
   open.title='Voir les résultats détaillés de '+person.displayName+' · '+app.title;
   open.append(makeOverviewCell(person.apps?.find(x=>x.appKey===app.app_key)?.state));
   open.onclick=()=>showOverviewDetail(person,[app],true);
   td.append(open);row.append(td);
  }
  body.append(row);
 }
 table.append(body);scroll.append(table);container.append(scroll);
 showResultMessage(people.length+' élèves · '+ordered.length+' applications');
}
function showOverviewDetail(person,apps,focusedApp=false){
 $('results-student-name').textContent=person.displayName+(focusedApp&&apps[0]?' · '+apps[0].title:' · Toutes les applications');
 $('results-back').textContent='← Retour au tableau récapitulatif';
 $('results-list').hidden=true;$('results-detail').hidden=false;
 const target=$('results-student-content');target.replaceChildren();
 for(const app of apps){
  const section=document.createElement('section');section.className='results-detail-block';
  const heading=document.createElement('h3');heading.textContent=app.title;section.append(heading);
  const state=person.apps?.find(x=>x.appKey===app.app_key)?.state;
  section.append(makeOverviewCell(state));
  if(state&&['addition-ecrite-simple','multiplication-ecrite-simple'].includes(app.app_key)){
   const table=document.createElement('table');table.className='result-table';
   const header=document.createElement('tr');
   for(const label of ['Niveau','/4','/10','/20','Mort subite','HARD','HARD 5 calculs']){const th=document.createElement('th');th.textContent=label;header.append(th)}
   table.append(header);
   for(let i=0;i<3;i++){
    const row=document.createElement('tr');
    for(const x of ['Niveau '+(i+1),...[4,10,20].map(c=>state.classic?.[i]?.[c]==null?'—':state.classic[i][c]+'/'+c),state.sudden?.[i]??'—',state.hard?.[i]??'—',state.hardThree?.[i]==null?'—':state.hardThree[i]+'/5']){
     const td=document.createElement('td');td.textContent=String(x);row.append(td);
    }
    table.append(row);
   }
   section.append(table);
  }
  target.append(section);
  // Le reboot appartient à l'application sélectionnée, jamais à la fiche globale.
  if(focusedApp&&['addition-ecrite-simple','multiplication-ecrite-simple'].includes(app.app_key))
   addParcoursControls(section,person.id,person.displayName,app.app_key,app.title);
 }
}
async function showResults(){
 $('results-class-restart').hidden=!['addition-ecrite-simple','multiplication-ecrite-simple'].includes($('results-app').value);
 syncResultsClassPicker();
 const id=$('class-selector').value;if(!id){showResultMessage('Aucune classe.');return}
 $('results-detail').hidden=true;$('results-list').hidden=false;
 const lockRoot=$('results-multiplier-class-lock');if(lockRoot){lockRoot.hidden=$('results-app').value!=='multiplication-ecrite-simple';if(!lockRoot.hidden){lockRoot.replaceChildren();multiplierLockPanel(lockRoot)}}
 showResultMessage('Lecture des résultats…');
 if($('results-app').value==='__summary__')return showOverview();
 const v=await resultCall('teacher-summary');
 const list=$('results-list');list.replaceChildren();
 for(const student of v.students){
   const item=document.createElement('button');item.type='button';item.className='student-card result-person';
   const title=document.createElement('strong');title.textContent=student.name;
   const info=document.createElement('span');info.className='result-mini';
   const today=student.todayBest;
   info.textContent='Record '+points(student.bestPoints)+' · Aujourd’hui '+points(today)+' · '+(student.recent?.length?student.recent.map(recentLabel).join(' ; '):'Aucun exercice terminé');
   item.append(title,info);
   item.onclick=()=>run(async()=>{const detail=await resultCall('teacher-detail',{studentId:student.id});showDetail(detail)});
   list.append(item);
 }
 showResultMessage(v.students.length?v.students.length+' élèves · données enregistrées uniquement dans Connect':'Aucun élève dans cette classe.');
}
function showDetail(v){
 $('results-student-name').textContent=v.name;
 $('results-list').hidden=true;$('results-detail').hidden=false;
 const s=v.state||{},div=$('results-student-content');div.replaceChildren();
 const table=document.createElement('table');table.className='result-table';
 const head=document.createElement('tr');
 for(const text of ['Niveau','/4','/10','/20','Mort subite','HARD','HARD 5 calculs']){const th=document.createElement('th');th.textContent=text;head.append(th)}table.append(head);
 for(let i=0;i<3;i++){const tr=document.createElement('tr');const vals=['Niveau '+(i+1),...[4,10,20].map(c=>s.classic?.[i]?.[c]==null?'—':s.classic[i][c]+'/'+c),s.sudden?.[i]??'—',s.hard?.[i]??'—',s.hardThree?.[i]==null?'—':s.hardThree[i]+'/5'];for(const text of vals){const td=document.createElement('td');td.textContent=text;tr.append(td)}table.append(tr)}
 div.append(table);
 if(s.hard?.some(x=>x!=null)){const hard=document.createElement('p');hard.textContent='HARD : '+[1,2,3].map(i=>'H'+i+' '+(s.hard[i-1]??'—')).join(' · ');div.append(hard)}
 const summary=document.createElement('p');summary.textContent='Record absolu : '+points(s.bestPoints)+' · Aujourd’hui : '+points(s.todayBest?.day===dateBE()?s.todayBest.points:null);div.append(summary);
 const last=document.createElement('p');last.textContent='Derniers exercices : '+(s.recent?.length?s.recent.map(recentLabel).join(' ; '):'aucun');div.append(last);
 if(v.studentId&&['addition-ecrite-simple','multiplication-ecrite-simple'].includes($('results-app').value))addParcoursControls(div,v.studentId,v.name,$('results-app').value,$('results-app').selectedOptions[0]?.textContent||'Application');
}

function openParcoursDialog({scope,studentId=null,studentName='',count=null,appKey='addition-ecrite-simple',appName='Addition écrite simple'}){
 const name=scope==='class'?$('class-selector').selectedOptions[0]?.textContent||'Classe':studentName;
 const dialog=document.createElement('dialog');dialog.className='parcours-dialog';
 const form=document.createElement('form');const title=document.createElement('h2');title.textContent='Recommencer le parcours';
 const description=document.createElement('p');
 description.textContent=appName+' · '+name+(scope==='class'?' · toute la classe ('+count+' élèves)':'')+'. Les anciens résultats sont archivés et les XP restent acquis.';
 const xpLabel=document.createElement('label');xpLabel.className='parcours-xp-choice';const xp=document.createElement('input');xp.type='checkbox';xp.checked=true;
 const xpText=document.createElement('span');xpText.textContent='Permettre de regagner des XP au cours du nouveau parcours (en plus des acquis)';xpLabel.append(xp,xpText);
 const checkLabel=document.createElement('label');checkLabel.textContent='Pour confirmer, recopie exactement : '+name;
 const check=document.createElement('input');check.required=true;check.autocomplete='off';checkLabel.append(check);
 const feedback=document.createElement('p');feedback.setAttribute('role','alert');
 const buttons=document.createElement('div');buttons.className='button-row';
 const back=document.createElement('button');back.type='button';back.className='soft';back.textContent='Annuler';back.onclick=()=>dialog.close();
 const go=document.createElement('button');go.type='submit';go.className='danger';go.textContent='Confirmer le nouveau parcours';
 buttons.append(back,go);form.append(title,description,xpLabel,checkLabel,feedback,buttons);dialog.append(form);document.body.append(dialog);
 dialog.addEventListener('close',()=>dialog.remove(),{once:true});
 form.onsubmit=async e=>{
  e.preventDefault();
  if(check.value.trim()!==name){feedback.textContent='Le nom de confirmation ne correspond pas.';return}
  go.disabled=true;back.disabled=true;feedback.textContent='Enregistrement du nouveau parcours…';
  try{
   const outcome=await resultCall('teacher-parcours-restart',{scope,studentId,repeatXp:xp.checked,appKey});
   dialog.close();
   msg(scope==='class'?'Nouveau parcours ouvert pour '+outcome.count+' élèves.':'Nouveau parcours ouvert pour '+studentName+'.',true);
   await showResults();
  }catch(e){feedback.textContent='Opération non confirmée : '+(e.message||'Erreur');go.disabled=false;back.disabled=false}
 };
 dialog.showModal();check.focus();
}
// Gestion légère des multiplicateurs : un appel à l'ouverture et un à l'enregistrement.
function multiplierLockPanel(container,studentId=null){
 const details=document.createElement('details');details.className='management';
 const summary=document.createElement('summary');summary.textContent=studentId?'🔒 Multiplicateurs de cet élève':'🔒 Multiplicateurs de toute la classe';
 const area=document.createElement('div');area.style.cssText='padding:12px 0;display:flex;gap:9px;flex-wrap:wrap;align-items:center';
 const checks=new Map();
 for(let n=2;n<=9;n++){const label=document.createElement('label');label.style.cssText='display:inline-flex;align-items:center;gap:3px;padding:5px';
 const cb=document.createElement('input');cb.type='checkbox';cb.value=String(n);cb.checked=true;checks.set(n,cb);label.append(cb,document.createTextNode(String(n)));area.append(label)}
 const save=document.createElement('button');save.type='button';save.className='soft';save.textContent='Verrouiller les tables choisies';
 const unlock=document.createElement('button');unlock.type='button';unlock.className='soft';unlock.textContent='Retirer le verrouillage';
 const feedback=document.createElement('p');feedback.className='hint';feedback.setAttribute('role','status');
 details.append(summary,area,save,unlock,feedback);container.append(details);
 details.addEventListener('toggle',async()=>{if(!details.open)return;feedback.textContent='Lecture du réglage…';
 try{const r=await resultCall('teacher-multipliers-get',{appKey:'multiplication-ecrite-simple'});
 const key=studentId||'class',found=(r.locks||[]).find(x=>x.scope_key===key);
 const fallback=(r.locks||[]).find(x=>x.scope_key==='class');
 const chosen=found?.multipliers||(studentId?fallback?.multipliers:null);
 for(const [n,cb] of checks)cb.checked=!chosen||chosen.includes(n);
 feedback.textContent=found?'Verrouillage actif'+(studentId?' (personnalisé)':''):studentId&&fallback?'Réglage hérité de la classe':'Aucun verrouillage actif';
 }catch(e){feedback.textContent='Impossible de charger : '+e.message}});
 async function update(values){
 save.disabled=unlock.disabled=true;feedback.textContent='Enregistrement…';
 try{await resultCall('teacher-multipliers-set',{appKey:'multiplication-ecrite-simple',studentId,multipliers:values});
 feedback.textContent=values?'Enregistré. Appliqué au prochain lancement du jeu.':'Verrouillage retiré. Application au prochain lancement.';
 }catch(e){feedback.textContent='Échec : '+e.message}
 finally{save.disabled=unlock.disabled=false}
 }
 save.onclick=()=>{const selected=[...checks].filter(([,cb])=>cb.checked).map(([n])=>n);
 if(!selected.length){feedback.textContent='Choisis au moins un multiplicateur.';return}update(selected)};
 unlock.onclick=()=>update(null);
}
function addParcoursControls(container,studentId,name,appKey,appName){
 // Chaque application Connect pourra brancher ici son propre parcours.
 if(!studentId||!['addition-ecrite-simple','multiplication-ecrite-simple'].includes(appKey))return;
 const panel=document.createElement('section');panel.className='parcours-student-actions';
 const title=document.createElement('strong');title.textContent='Parcours de cet élève';
 const summary=document.createElement('div');summary.textContent='Chargement des anciens parcours…';
 const reset=document.createElement('button');reset.type='button';reset.className='results-restart-button';reset.textContent='↻ Recommencer le parcours';
 reset.onclick=()=>openParcoursDialog({scope:'student',studentId,studentName:name,appKey,appName});
 panel.append(title,summary,reset);container.append(panel);if(appKey==='multiplication-ecrite-simple')multiplierLockPanel(container,studentId);
 resultCall('teacher-parcours-history',{studentId,appKey}).then(r=>{
  if(!summary.isConnected)return;
  summary.replaceChildren();
  const current=document.createElement('p');current.textContent='Parcours '+(r.current?.parcours_number||1)+(r.current?.repeat_xp?' · XP à regagner activés':' · XP historiques protégés');
  summary.append(current);
  const history=r.history||[];
  if(history.length){
   const details=document.createElement('details');
   const label=document.createElement('summary');label.textContent='Anciens parcours ('+history.length+')';details.append(label);
   for(const row of history){
    const p=document.createElement('p');p.textContent='Parcours '+row.parcours_number+' · record '+(row.state_data?.bestPoints??'—')+' pts · XP cumulés : '+row.archived_xp;
    details.append(p)
   }
   summary.append(details)
  }
 }).catch(()=>{if(summary.isConnected)summary.textContent='Historique indisponible.'});
}
$('results-class-restart').onclick=()=>run(async()=>{
 const students=await resultCall('teacher-overview');
 openParcoursDialog({scope:'class',count:students.students?.length||0,appKey:$('results-app').value,appName:$('results-app').selectedOptions[0]?.textContent||'Application'});
});

$('results-refresh').onclick=()=>run(showResults);
$('results-app').onchange=()=>run(showResults);
$('results-back').onclick=()=>{$('results-detail').hidden=true;$('results-list').hidden=false};

/* B1 : navigation visuelle professeur (sans changer les API éprouvées). */
const teacherTabs=['home','apps','other','results','management'];
function showTeacherTab(tab){
 const selected=teacherTabs.includes(tab)?tab:'home';
 for(const t of teacherTabs){
  const node=document.getElementById('teacher-'+t);
  if(node)node.hidden=t!==selected;
 }
 if(selected==='apps')loadTeacherAppPreview();
 if(selected==='management'&&!busy)run(refresh);
 if(selected==='home'&&!busy)run(refreshGlobalRequests);
 if(selected==='results' && !currentTeacherSpace)run(showResults);
 window.scrollTo({top:0,behavior:'instant'});
}
document.querySelectorAll('[data-teacher-tab]').forEach(b=>b.addEventListener('click',()=>showTeacherTab(b.dataset.teacherTab)));
document.querySelectorAll('[data-results]').forEach(b=>b.addEventListener('click',()=>{
 const label=CLASS_SPACES[b.dataset.results]?.name; if(!label)return; currentTeacherSpace=b.dataset.results; $('class-selector').value=CLASS_SPACES[currentTeacherSpace].id;
 syncResultsClassPicker();
 showTeacherTab('results'); refresh().then(showResults).catch(e=>msg(e.message));
}));
function applyTeacherPlayerMode(){
 const btn=$('teacher-player-connect');
 if(btn)btn.hidden=teacherPlayerActive;
 document.querySelectorAll('.teacher-space-main[data-space]').forEach(link=>{
  const target=new URL(link.href);
  if(teacherPlayerActive)target.searchParams.set('joueur','prof');
  else target.searchParams.delete('joueur');
  link.href=target.href;
 });
}
$('teacher-player-connect').onclick=()=>run(async()=>{
 const classroom=$('class-selector').value;
 if(!classroom)throw Error('Aucune classe professeur disponible.');
 // Le serveur vérifie la session professeur et sa fiche joueur, sans créer de compte.
 const player=await call('teacher-player',{classId:classroom});
 if(player.status!=='approved'||player.displayName!=='Monsieur T')
  throw Error('Le profil Monsieur T n’est pas disponible pour ce compte professeur.');
 const owner=(await sb.auth.getSession()).data.session?.user;
 if(!owner||owner.is_anonymous)throw Error('Session professeur requise.');
 try{localStorage.setItem(teacherPlayerKey(owner.id),'1')}catch{
  throw Error('Impossible d’enregistrer la connexion joueur sur cet appareil.');
 }
 teacherPlayerActive=true;
 applyTeacherPlayerMode();
 alert('Connecté à Monsieur T');
});
document.querySelectorAll('[data-space]').forEach(a=>{
 const space=CLASS_SPACES[a.dataset.space];
 if(!space)return;
 const u=new URL(a.href);
 u.searchParams.set('class',space.id);
 u.searchParams.set('name',space.name);
 a.href=u.href;
});
document.querySelectorAll('.teacher-space .teacher-space-small[href]').forEach(a=>{
 const slug=new URL(a.href).searchParams.get('space');
 const space=CLASS_SPACES[slug];
 if(space){const u=new URL(a.href);u.searchParams.set('class',space.id);u.searchParams.set('name',space.name);a.href=u.href}
});
const APP_SECTIONS=[['objectif','Objectif'],['calculs_ecrits','Calculs écrits'],['depassement','Dépassement'],['revision','Révision'],['outil','Outils'],['jeux','Jeux']];
const APP_SPACES=[['observation','Observation'],['phase1','Phase 1'],['phase2','Phase 2'],['2eco','2 ECO']];
async function loadTeacherAppPreview(){
 const body=$('teacher-app-tbody');if(!body)return;
 body.textContent='Chargement du tableau…';
 try{
 const data=await resultCall('teacher-app-matrix-get');
 body.replaceChildren();
 const entries=new Map((data.entries||[]).map(x=>[x.preset_slug+'|'+x.app_key,x]));
 for(const [i,app] of (data.apps||[]).entries()){
  if(app.app_key==='connect-lab')continue;
  const tr=document.createElement('tr'),first=document.createElement('td');
  const title=document.createElement('strong');title.textContent=app.title;
  first.append(title);tr.append(first);
  const controls=[];
  for(const [slug] of APP_SPACES){
   const entry=entries.get(slug+'|'+app.app_key)||{visible:app.enabled,featured:false,section:'calculs_ecrits',display_order:app.display_order??i*10};
   const td=document.createElement('td');td.style.minWidth='175px';
   const makeCheck=(caption,val)=>{const label=document.createElement('label');label.style.display='block';const cb=document.createElement('input');cb.type='checkbox';cb.checked=!!val;label.append(cb,document.createTextNode(' '+caption));td.append(label);return cb};
   const visible=makeCheck('Visible',entry.visible),featured=makeCheck('Du jour',entry.featured);
   const section=document.createElement('select');for(const [value,label] of APP_SECTIONS){let o=document.createElement('option');o.value=value;o.textContent=label;section.append(o)}section.value=entry.section;td.append(section);
   const save=document.createElement('button');save.type='button';save.className='soft';save.textContent='OK';
   const status=document.createElement('small');status.setAttribute('role','status');
   save.onclick=async()=>{save.disabled=true;status.textContent='…';try{
    await resultCall('teacher-app-matrix-save',{changes:[{slug,appKey:app.app_key,visible:visible.checked,featured:featured.checked,section:section.value,order:Number(order.value)}]});
    status.textContent='✓';
   }catch(e){status.textContent='Erreur : '+e.message}finally{save.disabled=false}};
   td.append(save,status);tr.append(td);controls.push({visible,featured,save,slug});
  }
  const everywhere=document.createElement('td');
  for(const [label,on] of [['Visible partout',true],['Cacher partout',false]]){
   const b=document.createElement('button');b.type='button';b.className='soft';b.textContent=label;
   b.onclick=async()=>{b.disabled=true;try{for(const c of controls){c.visible.checked=on;await resultCall('teacher-app-matrix-save',{changes:[{slug:c.slug,appKey:app.app_key,visible:on,featured:c.featured.checked,section:c.save.parentElement.querySelector('select').value,order:Number(order.value)}]})}}catch(e){alert('Erreur : '+e.message)}finally{b.disabled=false}};everywhere.append(b)
  }tr.append(everywhere);
  const orderCell=document.createElement('td'),order=document.createElement('input');order.type='number';order.min='0';order.max='100000';order.value=String(app.display_order??(i+1)*10);order.style.width='72px';orderCell.append(order);tr.append(orderCell);
  const pos=document.createElement('td');pos.textContent=String(i+1);tr.append(pos);
  body.append(tr);
 }
 }catch(e){body.textContent='Impossible de charger : '+e.message}
}
