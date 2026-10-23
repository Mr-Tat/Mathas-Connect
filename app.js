import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.95.0';
const url='https://awmhpfofacaglewammxt.supabase.co', key='sb_publishable_oI2Pyl3kXzmLkK-CBnw9Nw_66a4fZgM';
const sb=createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
const $=id=>document.getElementById(id), cls=new URLSearchParams(location.search).get('class');
let busy=false;
function show(v){document.querySelectorAll('[data-view]').forEach(e=>e.hidden=e.dataset.view!==v);msg('')}
function msg(s='',success=false){const e=$('message');e.textContent=s;e.hidden=!s;e.classList.toggle('ok',success)}
async function run(fn){if(busy)return;busy=true;try{await fn()}catch(e){msg(e.message||'Erreur')}finally{busy=false}}
async function call(action,data={}){const {data:{session}}=await sb.auth.getSession();if(!session)throw Error('Connexion requise');
 const r=await fetch(url+'/functions/v1/connect-api',{method:'POST',headers:{'content-type':'application/json','apikey':key,'authorization':'Bearer '+session.access_token},body:JSON.stringify({action,...data})});
 const v=await r.json().catch(()=>({}));if(!r.ok||!v.ok)throw Error(({forbidden:'Accès refusé',join_failed:'Demande impossible',decision_failed:'Demande déjà traitée ou expirée',auth_required:'Connexion expirée'})[v.error]||v.error||'Erreur réseau');return v}
async function teacher(){const r=await call('teacher-classes');const box=$('class-selector');box.replaceChildren(...r.classes.map(c=>new Option(c.name,c.id)));show('teacher');await refresh()}
async function refresh(){const id=$('class-selector').value;if(!id)return;const [j,s]=await Promise.all([call('teacher-join-requests',{classId:id}),call('teacher-students',{classId:id})]);$('request-count').textContent=j.requests.length;const out=$('requests-list');out.replaceChildren();
 if(!j.requests.length)out.textContent='Aucune demande.';
 for(const req of j.requests){const card=document.createElement('div');card.className='request-card';const head=document.createElement('div');head.className='request-heading';const name=document.createElement('strong');name.textContent=req.first_name+'.'+req.last_initial;const code=document.createElement('span');code.className='request-code';code.textContent=req.verify_code;head.append(name,code);card.append(head);const row=document.createElement('div');row.className='button-row';
 for(const [label,approve] of [['Autoriser',true],['Refuser',false]]){const btn=document.createElement('button');btn.textContent=label;if(!approve)btn.className='danger';btn.onclick=()=>run(async()=>{await call('teacher-review-join',{requestId:req.id,approve});await refresh();msg(approve?'Appareil autorisé':'Demande refusée',true)});row.append(btn)}card.append(row);out.append(card)}
 const students=$('students-list');students.replaceChildren();if(!s.students.length)students.textContent='Aucun élève.';else for(const e of s.students){const item=document.createElement('div');item.className='student-card';item.textContent=e.display_name;students.append(item)}}
async function student(){if(!cls){show('welcome');msg('Ouvre le lien donné par le professeur.');return}
 const {data:{user}}=await sb.auth.getUser();if(user&&!user.is_anonymous)throw Error('Ouvre le lien élève dans une fenêtre privée.');
 if(!user){const r=await sb.auth.signInAnonymously();if(r.error)throw Error('Connexion anonyme indisponible')}
 await status()}
async function status(){const {request:r}=await call('student-join-status',{classId:cls});
 if(!r||['cancelled','expired','rejected'].includes(r.state)){show('student-form');if(r?.state==='rejected')msg('Demande refusée : adresse-toi au professeur.');return}
 if(['approved','revoked'].includes(r.state)){$('result-title').textContent=r.state==='approved'?'Appareil autorisé':'Appareil révoqué';$('result-description').textContent=r.state==='approved'?'L’accès est confirmé.':'Adresse-toi au professeur.';show('approved');return}
 $('verification-code').textContent=r.verify_code;show('waiting')}
$('home').onclick=()=>show('welcome');
$('teacher-entry').onclick=()=>show('login');
$('back-login').onclick=()=>show('welcome');
$('student-entry').onclick=()=>run(student);
$('login-form').onsubmit=e=>{e.preventDefault();run(async()=>{const r=await sb.auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value});if(r.error)throw Error('Identifiants incorrects');$('password').value='';await teacher()})};
$('logout').onclick=()=>run(async()=>{await sb.auth.signOut();show('welcome')});
$('class-selector').onchange=()=>run(refresh);
$('refresh-teacher').onclick=()=>run(refresh);
$('copy-student-link').onclick=()=>run(async()=>{if(!$('class-selector').value)throw Error('Aucune classe');const u=new URL(location.href);u.search='';u.hash='';u.searchParams.set('class',$('class-selector').value);await navigator.clipboard.writeText(u.href);msg('Lien élève copié',true)});
$('clear-form').onclick=()=>{$('first-name').value='';$('last-initial').value=''};
$('join-form').onsubmit=e=>{e.preventDefault();run(async()=>{const firstName=$('first-name').value.trim(),lastInitial=$('last-initial').value.trim().toUpperCase();if(!/^[\p{L}][\p{L} '-]{0,39}$/u.test(firstName)||!/^[\p{L}]$/u.test(lastInitial))throw Error('Vérifie le prénom et la lettre du nom');const {request}=await call('student-join',{classId:cls,firstName,lastInitial});$('verification-code').textContent=request.code;show('waiting')})};
$('check-status').onclick=()=>run(status);
$('cancel-request').onclick=()=>run(async()=>{await call('student-cancel-join',{classId:cls});show('student-form')});
$('result-home').onclick=()=>show('welcome');
$('reset-local').onclick=()=>run(async()=>{if(!confirm('Effacer la connexion sur cet appareil ?'))return;await sb.auth.signOut();show('welcome')});
if(cls){show('student-form');run(student)}else show('welcome');