import {hubUrl} from './connect-context.js';
import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.95.0';
const url='https://awmhpfofacaglewammxt.supabase.co', key='sb_publishable_oI2Pyl3kXzmLkK-CBnw9Nw_66a4fZgM';
const sb=createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
const $=id=>document.getElementById(id), cls=new URLSearchParams(location.search).get('class');
const hubLink=hubUrl();
let busy=false;
function show(v){document.querySelectorAll('[data-view]').forEach(e=>e.hidden=e.dataset.view!==v);msg('')}
function msg(s='',success=false){const e=$('message');e.textContent=s;e.hidden=!s;e.classList.toggle('ok',success)}
async function run(fn){if(busy)return;busy=true;try{await fn()}catch(e){msg(e.message||'Erreur')}finally{busy=false}}
async function ensureStudentSession(){
 const {data:{session},error}=await sb.auth.getSession();
 if(error)throw Error('Impossible de vérifier la connexion élève.');
 if(session?.access_token){
   if(!session.user?.is_anonymous)throw Error('Compte professeur actif ici : utilise une fenêtre privée pour l’élève.');
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
 const v=await r.json().catch(()=>({}));if(!r.ok||!v.ok)throw Error(({forbidden:'Accès refusé',join_failed:'Demande impossible',decision_failed:'Demande déjà traitée ou expirée',auth_required:'Connexion expirée'})[v.error]||v.error||'Erreur réseau');return v}
async function teacher(){const r=await call('teacher-dashboard');const box=$('class-selector');box.replaceChildren(...r.classes.map(c=>new Option(c.name,c.id)));$('year-selector').replaceChildren(...r.years.map(v=>new Option(v.label,v.id)));show('teacher');showTeacherTab('home');await refresh();await showResults().catch(e=>showResultMessage('Suivi indisponible : '+e.message))}
async function refresh(){const id=$('class-selector').value;if(!id){$('request-count').textContent='0';$('requests-list').textContent='Aucune demande.';$('students-list').textContent='Aucun élève.';return;}const data=await call('teacher-dashboard',{classId:id});const j={requests:data.requests},s={students:data.students},d={devices:data.devices};$('request-count').textContent=j.requests.length;const out=$('requests-list');out.replaceChildren();
 if(!j.requests.length)out.textContent='Aucune demande.';
 for(const req of j.requests){const card=document.createElement('div');card.className='request-card';const head=document.createElement('div');head.className='request-heading';const name=document.createElement('strong');name.textContent=req.first_name+'.'+req.last_initial;const code=document.createElement('span');code.className='request-code';code.textContent=req.verify_code;head.append(name,code);card.append(head);const row=document.createElement('div');row.className='button-row';
 // Même prénom + initiale : présélection seulement si une seule fiche correspond.
 // Une correspondance de nom NE PROUVE PAS l'identité : le professeur valide toujours la demande et le code.
 const canonicalName=v=>String(v||'').normalize('NFC').toLocaleLowerCase('fr').replace(/[.\\s]+/g,'');
 const requestedName=canonicalName(req.first_name+'.'+req.last_initial);
 const matches=s.students.filter(e=>canonicalName(e.display_name)===requestedName);
 if(matches.length){
   const sel=document.createElement('select');sel.setAttribute('aria-label','Associer la demande à une fiche élève');sel.className='match-selector';
   const first=new Option(matches.length>1?'Plusieurs élèves homonymes : choisis la bonne fiche':'Créer une nouvelle fiche (autre élève)',matches.length>1?'':'__new__');
   if(matches.length>1){first.disabled=true;first.selected=true}
   sel.append(first,...matches.map(e=>new Option('Élève existant : '+e.display_name,e.id)));
   if(matches.length>1)sel.append(new Option('Créer une nouvelle fiche (autre élève)','__new__'));
   if(matches.length===1)sel.value=matches[0].id;
   card.append(sel);
   const notice=document.createElement('p');notice.className='match-note';
   notice.textContent=matches.length===1
     ?'Élève déjà présent : fiche présélectionnée. Vérifie le code et l’identité avant d’autoriser.'
     :'Homonymes : choisis manuellement la bonne fiche avant d’autoriser.';
   card.append(notice);
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
     await refresh();
     msg(approve?(existingStudentId?'Appareil associé à la fiche élève existante':'Appareil autorisé : nouvelle fiche élève'):'Demande refusée',true)
   });
   row.append(btn)
 }
 card.append(row);out.append(card)}
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
   students.append(item);
 }
}
async function student(){if(!cls){show('welcome');msg('Ouvre le lien donné par le professeur.');return}
 await ensureStudentSession();await status()}
async function status(){await ensureStudentSession();const {request:r}=await call('student-join-status',{classId:cls});
 if(!r||['cancelled','expired','rejected'].includes(r.state)){show('student-form');if(r?.state==='rejected')msg('Demande refusée : adresse-toi au professeur.');return}
 if(['approved','revoked'].includes(r.state)){if(r.state==='approved'){try{localStorage.removeItem('mathas.connect.mode-libre.v1')}catch{}}$('open-hub').hidden=r.state!=='approved';$('result-title').textContent=r.state==='approved'?'Appareil autorisé':'Appareil révoqué';$('result-description').textContent=r.state==='approved'?'L’accès est confirmé.':'Adresse-toi au professeur.';show('approved');return}
 if(r.state==='wrong_class'){show('welcome');msg('Cet appareil est associé à une autre classe. Ouvre le lien de ta classe ou demande au professeur de changer de profil.');return}
 $('verification-code').textContent=r.verify_code;show('waiting')}
$('home').onclick=()=>show('welcome');
$('teacher-entry').onclick=()=>show('login');
$('back-login').onclick=()=>show('welcome');
$('student-entry').onclick=()=>run(student);
$('login-form').onsubmit=e=>{e.preventDefault();run(async()=>{const r=await sb.auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value});if(r.error)throw Error('Identifiants incorrects');$('password').value='';await teacher()})};
$('logout').onclick=()=>run(async()=>{await sb.auth.signOut();show('welcome')});
$('open-hub').onclick=()=>{location.href=hubLink};
$('teacher-hub').onclick=()=>{location.href=hubLink};
$('add-year-form').onsubmit=e=>{e.preventDefault();run(async()=>{const label=$('new-year-label').value.trim(),startsOn=$('year-start').value,endsOn=$('year-end').value;if(endsOn<=startsOn)throw Error('La date de fin doit suivre la date de début');await call('teacher-create-year',{label,startsOn,endsOn});$('add-year-form').reset();await teacher();msg('Année scolaire ajoutée',true)})};
$('add-class-form').onsubmit=e=>{e.preventDefault();run(async()=>{const yearId=$('year-selector').value,name=$('new-class-name').value.trim();if(!yearId)throw Error('Ajoute d’abord une année scolaire.');const r=await call('teacher-create-class',{yearId,name});$('new-class-name').value='';await teacher();$('class-selector').value=r.class.id;await refresh();msg('Classe créée',true)})};
$('add-student-form').onsubmit=e=>{e.preventDefault();run(async()=>{const classId=$('class-selector').value,name=$('new-student-name').value.trim();await call('teacher-create-student',{classId,name});$('new-student-name').value='';await refresh();msg('Élève ajouté',true)})};
$('class-selector').onchange=()=>run(async()=>{await refresh();await showResults().catch(e=>showResultMessage('Suivi indisponible : '+e.message))});
$('refresh-teacher').onclick=()=>run(refresh);
$('copy-student-link').onclick=()=>run(async()=>{const box=$('class-selector');if(!box.value)throw Error('Aucune classe');await navigator.clipboard.writeText(hubUrl(box.value,box.selectedOptions[0]?.textContent||'Ma classe'));msg('Lien du HUB de classe copié',true)});
$('clear-form').onclick=()=>{$('first-name').value='';$('last-initial').value=''};
$('join-form').onsubmit=e=>{e.preventDefault();run(async()=>{const firstName=$('first-name').value.trim(),lastInitial=$('last-initial').value.trim().toUpperCase();if(!/^[\p{L}][\p{L} '-]{0,39}$/u.test(firstName)||!/^[\p{L}]$/u.test(lastInitial))throw Error('Vérifie le prénom et la lettre du nom');await ensureStudentSession();const {request}=await call('student-join',{classId:cls,firstName,lastInitial});$('verification-code').textContent=request.code;show('waiting')})};
$('check-status').onclick=()=>run(status);
$('cancel-request').onclick=()=>run(async()=>{await call('student-cancel-join',{classId:cls});show('student-form')});
$('result-home').onclick=()=>show('welcome');
$('reset-local').onclick=()=>run(async()=>{if(!confirm('Révoquer cet appareil et oublier ce profil ici ? Les résultats Connect restent enregistrés. Pour reprendre le compte, il faudra une nouvelle autorisation du professeur.'))return;await call('student-release');const {error}=await sb.auth.signOut({scope:'local'});if(error)throw error;location.href=hubLink});
if(cls){show('student-form');run(student)}else show('welcome');
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
 if(!['mathas-connect-class-backup-v1','mathas-connect-class-backup-v2'].includes(backup.format))throw Error('Format de sauvegarde inconnu.');
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
  if(!['mathas-connect-class-backup-v1','mathas-connect-class-backup-v2'].includes(doc.format))throw Error('Format JSON de sauvegarde inconnu');
  if(doc.projectRef&&doc.projectRef!=='awmhpfofacaglewammxt')throw Error('Sauvegarde provenant d’un autre projet');
  if(doc.classId!==$('class-selector').value)throw Error('Sélectionne la classe correspondant à cette sauvegarde');
  if(!Array.isArray(doc.students)||doc.students.length>250)throw Error('Liste d’élèves invalide');
  restoreDraft=doc;
  const choices=[];
  for(const student of doc.students){
   if(!student||typeof student.id!=='string'||!Array.isArray(student.apps))continue;
   for(const app of student.apps)if(app.appKey==='addition-ecrite-simple'&&app.state&&Number.isInteger(app.revision)&&Number.isInteger(app.resetEpoch))
     choices.push({student,app});
  }
  if(!choices.length)throw Error('Aucun résultat Addition à restaurer dans ce fichier');
  window.__restoreOptions=choices;
  const menu=$('results-restore-select');menu.replaceChildren();
  choices.forEach((o,i)=>{const option=document.createElement('option');option.value=String(i);option.textContent=o.student.displayName+' · Addition écrite (sauvegarde rev. '+o.app.revision+')';menu.appendChild(option)});
  $('results-restore-panel').hidden=false;$('results-restore-summary').textContent='Fichier chargé. Choisis un élève et clique « Prévisualiser ». Aucune donnée modifiée.';
 }catch(err){msg(err.message||'Fichier illisible')}
});
$('results-restore-preview').addEventListener('click',()=>run(async()=>{
 const o=window.__restoreOptions?.[Number($('results-restore-select').value)];if(!o)throw Error('Choisis un élève');
 restoreCheck=null;restoreHasSafety=false;$('results-restore-confirm').disabled=true;
 async function preview(recoverPastReset){
  return resultCall('teacher-restore-preview',{studentId:o.student.id,appKey:'addition-ecrite-simple',backupFormat:restoreDraft.format,backupProjectRef:restoreDraft.projectRef,
   backupRevision:o.app.revision,backupResetEpoch:o.app.resetEpoch,backupState:o.app.state,recoverPastReset});
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
 $('results-restore-summary').textContent='AVANT : '+JSON.stringify(v.before)+'\\n\\nAPRÈS : '+JSON.stringify(v.after)+'\\n\\n'+(v.recoveringPastReset?'⚠ Ancienne remise à zéro : réintroduction de records possible.':'Fusion sans remplacement des meilleurs records récents.')+(v.changed?'':' Aucune différence : rien à restaurer.');
 $('results-restore-confirm').disabled=!v.changed;
}));
$('results-restore-confirm').addEventListener('click',()=>run(async()=>{
 if(!restoreCheck||!restoreCheck.data.changed)throw Error('Prévisualisation nécessaire');
 const {choice:o,data:v}=restoreCheck;
 if(!confirm('Opération sensible : une sauvegarde de sécurité ACTUELLE doit être téléchargée avant la restauration. Continuer ?'))return;
 const safety=await resultCall('teacher-export');
 if(!['mathas-connect-class-backup-v1','mathas-connect-class-backup-v2'].includes(safety.format))throw Error('Export de sécurité indisponible');
 const blob=new Blob([JSON.stringify(safety,null,2)],{type:'application/json'});
 const link=document.createElement('a'),uri=URL.createObjectURL(blob);
 link.href=uri;link.download='mathas-AVANT-restauration-'+new Date().toISOString().replaceAll(':','-')+'.json';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(uri),10000);
 if(!confirm('Vérifie maintenant que le fichier « AVANT-restauration » a bien été téléchargé et conservé en lieu sûr.\\n\\nConfirmer la restauration de '+o.student.displayName+' ?'))return;
 const phrase=prompt('Dernière confirmation : écris RESTAURER en majuscules');
 if(phrase!=='RESTAURER')return;
 const out=await resultCall('teacher-restore-apply',{studentId:o.student.id,appKey:'addition-ecrite-simple',
  backupFormat:restoreDraft.format,backupProjectRef:restoreDraft.projectRef,
  backupRevision:o.app.revision,backupResetEpoch:o.app.resetEpoch,backupState:o.app.state,
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
async function showResults(){
 const id=$('class-selector').value;if(!id){showResultMessage('Aucune classe.');return}
 $('results-detail').hidden=true;$('results-list').hidden=false;
 showResultMessage('Lecture des résultats…');
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
 for(const text of ['Niveau','/4','/10','/20','Mort subite']){const th=document.createElement('th');th.textContent=text;head.append(th)}table.append(head);
 for(let i=0;i<3;i++){const tr=document.createElement('tr');const vals=['Niveau '+(i+1),...[4,10,20].map(c=>s.classic?.[i]?.[c]==null?'—':s.classic[i][c]+'/'+c),s.sudden?.[i]??'—'];for(const text of vals){const td=document.createElement('td');td.textContent=text;tr.append(td)}table.append(tr)}
 div.append(table);
 if(s.hard?.some(x=>x!=null)){const hard=document.createElement('p');hard.textContent='HARD : '+[1,2,3].map(i=>'H'+i+' '+(s.hard[i-1]??'—')).join(' · ');div.append(hard)}
 const summary=document.createElement('p');summary.textContent='Record absolu : '+points(s.bestPoints)+' · Aujourd’hui : '+points(s.todayBest?.day===dateBE()?s.todayBest.points:null);div.append(summary);
 const last=document.createElement('p');last.textContent='Derniers exercices : '+(s.recent?.length?s.recent.map(recentLabel).join(' ; '):'aucun');div.append(last);
}
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
 if(selected==='results')run(showResults);
 window.scrollTo({top:0,behavior:'instant'});
}
document.querySelectorAll('[data-teacher-tab]').forEach(b=>b.addEventListener('click',()=>showTeacherTab(b.dataset.teacherTab)));
document.querySelectorAll('[data-results]').forEach(b=>b.addEventListener('click',()=>{
 const label={observation:'Observation',phase1:'Phase 1',phase2:'Phase 2','2eco':'2 ECO'}[b.dataset.results];
 $('teacher-results-context').textContent='Espace '+label+' · résultats des élèves de la classe administrative sélectionnée. Le filtrage par espace sera ajouté au prochain bloc.';
 showTeacherTab('results');
}));
document.querySelectorAll('[data-space]').forEach(a=>a.addEventListener('click',()=>{
 const box=$('class-selector');
 const id=box?.value;
 if(id){const url=new URL(a.href);url.searchParams.set('class',id);url.searchParams.set('name',box.selectedOptions[0]?.textContent||'Ma classe');a.href=url.href;}
}));
async function loadTeacherAppPreview(){
 const body=$('teacher-app-tbody');
 if(!body)return;
 try{
  const response=await fetch('./hub-catalog.json',{cache:'no-cache'});
  if(!response.ok)throw Error('Catalogue non disponible');
  const data=await response.json();
  const apps=Array.isArray(data.apps)?data.apps:[];
  body.replaceChildren();
  if(!apps.length){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=8;td.textContent='Aucune application pour le moment.';tr.append(td);body.append(tr);return}
  for(const [i,app] of apps.entries()){
   const tr=document.createElement('tr'),cell=document.createElement('td');
   const link=document.createElement('a');link.className='teacher-app-title';link.href=app.launch_url;link.target='_blank';link.rel='noopener noreferrer';
   if(app.image_url){const im=document.createElement('img');im.src=app.image_url;im.alt='';im.loading='lazy';link.append(im)}
   const name=document.createElement('span');name.textContent=app.title;link.append(name);cell.append(link);tr.append(cell);
   for(let j=0;j<4;j++){const td=document.createElement('td');const small=document.createElement('small');small.textContent='Réglages à venir';td.append(small);tr.append(td)}
   for(const value of ['À venir',String(app.display_order??'—'),String(i+1)]){const td=document.createElement('td');td.textContent=value;tr.append(td)}
   body.append(tr);
  }
 }catch(e){body.textContent=e.message||'Catalogue indisponible'}
}
