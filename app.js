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
async function teacher(){const [r,y]=await Promise.all([call('teacher-classes'),call('teacher-years')]);const box=$('class-selector');box.replaceChildren(...r.classes.map(c=>new Option(c.name,c.id)));$('year-selector').replaceChildren(...y.years.map(v=>new Option(v.label,v.id)));show('teacher');await refresh()}
async function refresh(){const id=$('class-selector').value;if(!id)return;const [j,s,d]=await Promise.all([call('teacher-join-requests',{classId:id}),call('teacher-students',{classId:id}),call('teacher-devices',{classId:id})]);$('request-count').textContent=j.requests.length;const out=$('requests-list');out.replaceChildren();
 if(!j.requests.length)out.textContent='Aucune demande.';
 for(const req of j.requests){const card=document.createElement('div');card.className='request-card';const head=document.createElement('div');head.className='request-heading';const name=document.createElement('strong');name.textContent=req.first_name+'.'+req.last_initial;const code=document.createElement('span');code.className='request-code';code.textContent=req.verify_code;head.append(name,code);card.append(head);const row=document.createElement('div');row.className='button-row';
 const matches=s.students.filter(e=>e.display_name.toLocaleLowerCase('fr')===(req.first_name+'.'+req.last_initial).toLocaleLowerCase('fr'));
 if(matches.length){const sel=document.createElement('select');sel.setAttribute('aria-label','Associer à un élève existant');sel.className='match-selector';sel.append(new Option('Nouvel élève',''),...matches.map(e=>new Option('Même élève : '+e.display_name,e.id)));card.append(sel)}
 for(const [label,approve] of [['Autoriser',true],['Refuser',false]]){const btn=document.createElement('button');btn.textContent=label;if(!approve)btn.className='danger';btn.onclick=()=>run(async()=>{const existingStudentId=card.querySelector('.match-selector')?.value||undefined;await call('teacher-review-join',{requestId:req.id,approve,...(approve&&existingStudentId?{existingStudentId}:{})});await refresh();msg(approve?'Appareil autorisé':'Demande refusée',true)});row.append(btn)}card.append(row);out.append(card)}
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
     const info=document.createElement('span');info.textContent='Appareil '+(index+1)+' · '+(device.state==='approved'?'Autorisé':device.state==='revoked'?'Révoqué':'En attente');row.append(info);
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
$('class-selector').onchange=()=>run(refresh);
$('refresh-teacher').onclick=()=>run(refresh);
$('copy-student-link').onclick=()=>run(async()=>{const box=$('class-selector');if(!box.value)throw Error('Aucune classe');await navigator.clipboard.writeText(hubUrl(box.value,box.selectedOptions[0]?.textContent||'Ma classe'));msg('Lien du HUB de classe copié',true)});
$('clear-form').onclick=()=>{$('first-name').value='';$('last-initial').value=''};
$('join-form').onsubmit=e=>{e.preventDefault();run(async()=>{const firstName=$('first-name').value.trim(),lastInitial=$('last-initial').value.trim().toUpperCase();if(!/^[\p{L}][\p{L} '-]{0,39}$/u.test(firstName)||!/^[\p{L}]$/u.test(lastInitial))throw Error('Vérifie le prénom et la lettre du nom');await ensureStudentSession();const {request}=await call('student-join',{classId:cls,firstName,lastInitial});$('verification-code').textContent=request.code;show('waiting')})};
$('check-status').onclick=()=>run(status);
$('cancel-request').onclick=()=>run(async()=>{await call('student-cancel-join',{classId:cls});show('student-form')});
$('result-home').onclick=()=>show('welcome');
$('reset-local').onclick=()=>run(async()=>{if(!confirm('Oublier ce profil sur cet ordinateur ? Tu devras faire une nouvelle demande pour le retrouver.'))return;await sb.auth.signOut();location.href=hubLink});
if(cls){show('student-form');run(student)}else show('welcome');