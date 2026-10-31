// Laboratoire de test : même backend Connect que les élèves, classe fixe, aucun contournement.
import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.95.0';
const BASE='https://awmhpfofacaglewammxt.supabase.co';
const KEY='sb_publishable_oI2Pyl3kXzmLkK-CBnw9Nw_66a4fZgM'; // publishable, not secret
const TEST_CLASS='4bf3400d-a315-4ea4-a2f3-afaca24dc9b9';
const TEST_LABEL='Classe démo - TEST';
const HUB='./hub.html?class='+encodeURIComponent(TEST_CLASS)+'&name='+encodeURIComponent(TEST_LABEL);
const appKeys=['addition-ecrite-simple','multiplication-ecrite-simple','soustraction-ecrite-simple','addition-ecrite-multiple','melange-calculs-ecrits'];
const fallbackApps=[
 {app_key:'addition-ecrite-simple',title:'Addition écrite',launch_url:'https://mr-tat.github.io/CE-Addition-simple/'},
 {app_key:'multiplication-ecrite-simple',title:'Multiplication écrite simple',launch_url:'./apps/multiplication-simple/'},
 {app_key:'soustraction-ecrite-simple',title:'Soustraction écrite',launch_url:'./apps/soustraction-simple/'},
 {app_key:'addition-ecrite-multiple',title:'Addition de plusieurs nombres',launch_url:'./apps/addition-plusieurs/'},
 {app_key:'melange-calculs-ecrits',title:'Calculs écrits mélangés',launch_url:'./apps/calculs-melanges/'}
];
const sb=createClient(BASE,KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,storageKey:'mathas-connect-professor-auth-v1'}});
const $=id=>document.getElementById(id);
const el=(tag,text,cls='')=>{const n=document.createElement(tag);n.textContent=text;if(cls)n.className=cls;return n};
const consent=()=>$('fictive-confirm').checked;
let verified=false,teacherReady=false,people=[],requested=[],apps=[],selectedStudent=null,locks=[];
const display=(message,error=false)=>{$('status').textContent=message;$('status').className='status '+(error?'error':'ok')};
const guard=()=>{if(!verified)throw Error('Classe de test non vérifiée par le serveur professeur.');if(!consent())throw Error('Confirme d’abord que les profils de cette classe sont fictifs.')};
async function session(){const {data:{session},error}=await sb.auth.getSession();if(error||!session?.access_token||session.user?.is_anonymous)throw Error('Connecte-toi d’abord à l’espace professeur.');return session}
async function rpc(edge,action,data={}){const s=await session();const response=await fetch(BASE+'/functions/v1/'+edge,{method:'POST',headers:{apikey:KEY,authorization:'Bearer '+s.access_token,'content-type':'application/json'},body:JSON.stringify({action,...data})});const v=await response.json().catch(()=>({}));if(!response.ok||!v.ok)throw Error(v.error||('Erreur Connect : '+response.status));return v}
const api=(action,data={})=>rpc('connect-api',action,data);
const results=(action,data={})=>{guard();return rpc('connect-results',action,{classId:TEST_CLASS,appKey:$('results-app').value,...data})};
async function run(fn){try{await fn()}catch(e){display('Laboratoire : '+(e.message||e),true)}}
function linkFor(app,prof=false){const href=app.launch_url||app.url;if(!href)return null;let url;try{url=new URL(href,location.href)}catch{return null}if(url.protocol!=='https:'&&url.protocol!=='http:')return null;if(url.origin===location.origin){url.searchParams.set('class',TEST_CLASS);if(prof&&appKeys.includes(app.app_key))url.searchParams.set('joueur','prof')}return url.href}
function copy(text){return navigator.clipboard.writeText(text).then(()=>display('Lien copié dans le presse-papiers.'))}
async function loadTeacher(){
 const scoped=await api('teacher-dashboard',{classId:TEST_CLASS});
 const match=(scoped.classes||[]).find(c=>c.id===TEST_CLASS);
 if(!match)throw Error('La classe de démonstration ne figure pas parmi les classes de ce professeur. Accès refusé.');
 verified=true;
 $('class-meta').textContent=(match.name||TEST_LABEL)+' · classe Connect dédiée aux tests';
 $('hub-link').href=new URL(HUB,location.href).href;
 $('lab').hidden=false;
 await loadClass(scoped);
 await loadApps();
 display('Laboratoire chargé. Les élèves et jeux utilisent les vrais contrôles Connect.');
}
async function loadClass(scoped=null){
 if(!verified)return;
 // Requêtes strictement limitées à la classe fictive : aucune demande d'élève réel chargée.
 const data=scoped||await api('teacher-dashboard',{classId:TEST_CLASS});
 people=data.students||[];
 requested=data.requests||[];
 renderPeople(data.devices||[]);
 renderRequests();
 if(consent())await loadSummary();
}
function renderPeople(devices){
 $('student-count').textContent=String(people.length);
 const container=$('students');container.replaceChildren();
 if(!people.length){container.append(el('p','Aucun élève inscrit.','muted'));return}
 for(const person of people){
  const card=el('article','','profile');
  card.append(el('strong',person.display_name));
  const own=devices.filter(d=>d.student_id===person.id);
  if(!own.length)card.append(el('p','Aucun appareil associé.','muted tiny'));
  for(const device of own){
    const line=el('div','','device');
    const state=device.state==='approved'?'✅ Approuvé':device.state==='revoked'?'⛔ Révoqué':'En attente';
    line.append(el('span',(device.device_label||'Appareil non nommé')+' · '+state));
    if(device.state==='approved'){
      const revoke=el('button','Révoquer','danger');
      revoke.disabled=!consent();
      revoke.onclick=()=>run(async()=>{guard();if(!confirm('Révoquer uniquement cet appareil de test ?'))return;await api('teacher-device-decision',{classId:TEST_CLASS,deviceId:device.id,decision:'revoked'});await loadClass();display('Appareil de test révoqué.')});
      line.append(revoke);
    }
    card.append(line);
  }
  container.append(card);
 }
}
function renderRequests(){
 $('request-count').textContent=String(requested.length);
 const container=$('requests');container.replaceChildren();
 if(!requested.length){container.append(el('p','Aucune demande en attente pour la classe de test.','muted'));return}
 for(const req of requested){
  const card=el('article','','request');
  card.append(el('strong',(req.first_name||'')+'.'+(req.last_initial||'')));
  card.append(el('p','Code de contrôle : '+(req.verify_code||'—'),'request-code'));
  // Le dashboard limité à une classe renvoie ses profils séparément, sans matches.
  // Rattacher un ancien élève fictif plutôt que créer un homonyme en double.
  const normalized=v=>String(v||'').normalize('NFC').toLocaleLowerCase('fr').replace(/[.\\s]+/g,'');
  const matches=Array.isArray(req.matches)?req.matches:people.filter(p=>normalized(p.display_name)===normalized((req.first_name||'')+'.'+(req.last_initial||'')));
  const select=document.createElement('select');
  if(matches.length){
    select.setAttribute('aria-label','Fiche associée à la demande');
    select.add(new Option('Créer une nouvelle fiche (fictive)','__new__'));
    for(const person of matches)select.add(new Option('Associer à '+person.display_name,person.id));
    if(matches.length===1)select.value=matches[0].id;
    if(matches.length>1){select.add(new Option('Choisis un profil existant ou une nouvelle fiche',''));select.value='';}
    card.append(select);
  }
  const buttons=el('div','','actions');
  for(const approved of [true,false]){
    const btn=el('button',approved?'Autoriser':'Refuser',approved?'':'danger');
    btn.disabled=!consent();
    btn.onclick=()=>run(async()=>{
      guard();
      const match=matches.length?select.value:null;
      if(approved&&matches.length&&!match)throw Error('Choisis la fiche à associer.');
      if(approved&&match==='__new__'&&!confirm('Une fiche de ce nom existe déjà. Créer une NOUVELLE fiche fictive ?'))return;
      if(!confirm((approved?'Autoriser':'Refuser')+' cette demande après vérification du code de l’appareil ?'))return;
      await api('teacher-review-join',{requestId:req.id,approve:approved,...(approved&&match&&match!=='__new__'?{existingStudentId:match}:{})});
      await loadClass();
      display('Demande de la classe de test traitée.');
    });
    buttons.append(btn);
  }
  card.append(buttons);container.append(card);
 }
}
async function loadApps(){
 let list=fallbackApps;
 try{const r=await resultsNoConsent('teacher-app-matrix-get');if(Array.isArray(r.apps)&&r.apps.length)list=r.apps.filter(x=>x.app_key!=='connect-lab')}catch{/* catalogue de secours local */}
 apps=list.filter(a=>linkFor(a));
 $('apps').replaceChildren();
 for(const app of apps){
  const card=el('article','','game'),name=el('h3',app.title||app.app_key);
  card.append(name,el('p',appKeys.includes(app.app_key)?'Connect · session approuvée requise':'Vérifier le mode disponible'));
  const buttons=el('div','','actions');
  const student=el('a','Tester côté élève','action');student.href=linkFor(app);student.target='_blank';student.rel='noopener noreferrer';buttons.append(student);
  if(appKeys.includes(app.app_key)&&new URL(linkFor(app)).origin===location.origin){
    const teacher=el('button','Monsieur T','secondary');teacher.disabled=!teacherReady;
    teacher.onclick=()=>run(async()=>{if(!teacherReady)throw Error('Active d’abord Monsieur T.');const href=linkFor(app,true);window.open(href,'_blank','noopener,noreferrer')});
    teacher.classList.add('teacher-game');buttons.append(teacher);
  }
  card.append(buttons);$('apps').append(card);
 }
 $('results-app').replaceChildren(...apps.filter(a=>appKeys.includes(a.app_key)).map(a=>new Option(a.title||a.app_key,a.app_key)));
 if(!$('results-app').options.length)for(const a of fallbackApps)$('results-app').add(new Option(a.title,a.app_key));
 $('results-app').value='melange-calculs-ecrits';
 refreshLockUI();
}
async function resultsNoConsent(action,data={}){if(!verified)throw Error('Classe non vérifiée');return rpc('connect-results',action,{classId:TEST_CLASS,...data})}
function lockAllowed(){return ['melange-calculs-ecrits','multiplication-ecrite-simple'].includes($('results-app').value)}
function refreshLockUI(){
 $('locks-panel').hidden=!lockAllowed()||!consent();
 $('locks-save').disabled=!consent();$('locks-clear').disabled=!consent();
}
async function loadSummary(){
 guard();selectedStudent=null;$('detail').hidden=true;
 $('results').replaceChildren(el('p','Lecture des résultats de test…','muted'));
 const r=await results('teacher-summary');
 $('results').replaceChildren();
 for(const person of r.students||[]){
   const card=el('article','','profile');
   card.append(el('strong',person.name));
   const details=el('button','Voir le détail','secondary');
   details.onclick=()=>run(async()=>{guard();const d=await results('teacher-detail',{studentId:person.id});showDetail(d,person.id,person.name)});
   card.append(el('p','Record : '+(person.bestPoints??'—')+' · séances récentes : '+(person.recent?.length||0),'muted tiny'),details);
   $('results').append(card);
 }
 if(!(r.students||[]).length)$('results').append(el('p','Aucun résultat dans cette application.','muted'));
 await loadLocks();
}
function showDetail(d,id,name){
 selectedStudent={id,name,appKey:$('results-app').value};
 $('detail').hidden=false;
 $('detail-title').textContent=name+' · '+$('results-app').selectedOptions[0]?.textContent;
 $('detail-xp').textContent=Number.isFinite(d.xp?.appXp)?'XP de cette application : '+d.xp.appXp:'XP non fournis pour cet état';
 const state=d.state||{},target=$('detail-records');target.replaceChildren();
 const grid=el('div','','result-grid');
 for(let level=0;level<3;level++){
   const box=el('p','Niveau '+(level+1)+': '+[4,10,20].map(n=>n+' calculs '+(state.classic?.[level]?.[n]??'—')).join(' · '));
   grid.append(box);
 }
 target.append(grid,el('p','Record : '+(state.bestPoints??'—')+' · dernières séries : '+(state.recent?.length||0),'muted tiny'));
 $('reset-student').disabled=!consent();
 const targetOption=$('lock-scope');
 targetOption.replaceChildren(new Option('Pour la classe de test','class'),new Option('Pour '+name,id));
 refreshLockUI();void loadLocks();
}
async function loadLocks(){
 if(!lockAllowed()||!consent())return;
 const r=await results('teacher-multipliers-get');
 locks=r.locks||[];renderLockChoice();
}
function renderLockChoice(){
 const scope=$('lock-scope').value==='class'?'class':$('lock-scope').value;
 const row=locks.find(x=>x.scope_key===scope);
 const inherited=scope==='class'?null:locks.find(x=>x.scope_key==='class');
 const selected=row?.multipliers||inherited?.multipliers||[];
 $('lock-tables').replaceChildren();
 for(let n=2;n<=9;n++){
  const label=document.createElement('label'),box=document.createElement('input');
  box.type='checkbox';box.value=String(n);box.checked=selected.includes(n);
  label.append(box,document.createTextNode(' '+n));$('lock-tables').append(label);
 }
 $('locks-feedback').textContent=row?'Verrouillage propre à cette portée':inherited?'Tables héritées de la classe':'Aucun verrouillage actif';
}
async function setLocks(multipliers){
 guard();if(!lockAllowed())throw Error('Cette application ne propose pas de verrouillage de tables.');
 const scope=$('lock-scope').value;
 if(scope!=='class'&&!people.some(p=>p.id===scope))throw Error('Élève non trouvé dans cette classe.');
 const label=scope==='class'?'toute la classe de test':'un seul élève fictif';
 if(!confirm((multipliers?'Enregistrer':'Retirer')+' le verrouillage pour '+label+' ?'))return;
 await results('teacher-multipliers-set',{studentId:scope==='class'?null:scope,multipliers});
 await loadLocks();display('Verrouillage de tables du laboratoire enregistré.');
}
$('copy-hub').onclick=()=>run(()=>copy(new URL(HUB,location.href).href));
$('refresh').onclick=()=>run(async()=>{await loadClass();display('Laboratoire actualisé.')});
$('fictive-confirm').onchange=()=>run(async()=>{
 const allowed=consent();
 $('results-refresh').disabled=!allowed;$('reset-student').disabled=!allowed||!selectedStudent;
 for(const button of document.querySelectorAll('#students button,#requests button'))button.disabled=!allowed;
 refreshLockUI();
 if(!allowed){$('results').replaceChildren();$('detail').hidden=true;selectedStudent=null;$('lock-scope').replaceChildren(new Option('Pour la classe de test','class'));return}
 await loadSummary();
});
$('teacher-mode').onclick=()=>run(async()=>{
 if(!verified)throw Error('Classe de test non vérifiée.');
 const r=await api('teacher-player',{classId:TEST_CLASS});
 if(r.status!=='approved'||r.displayName!=='Monsieur T')throw Error('Profil Monsieur T non autorisé pour ce compte.');
 teacherReady=true;$('teacher-status').textContent='Monsieur T approuvé sur cette session professeur.';
 document.querySelectorAll('.teacher-game').forEach(b=>b.disabled=false);
 display('Monsieur T vérifié : tests professeur disponibles.');
});
$('results-refresh').onclick=()=>run(loadSummary);
$('results-app').onchange=()=>run(async()=>{selectedStudent=null;$('lock-scope').replaceChildren(new Option('Pour la classe de test','class'));$('detail').hidden=true;refreshLockUI();if(consent())await loadSummary()});
$('lock-scope').onchange=renderLockChoice;
$('locks-save').onclick=()=>run(async()=>{const numbers=[...$('lock-tables').querySelectorAll('input:checked')].map(e=>Number(e.value));if(!numbers.length)throw Error('Choisis au moins une table.');await setLocks(numbers)});
$('locks-clear').onclick=()=>run(()=>setLocks(null));
$('reset-student').onclick=()=>run(async()=>{
 guard();const p=selectedStudent;
 if(!p||!people.some(s=>s.id===p.id)||p.appKey!==$('results-app').value)throw Error('Sélection d’élève ou d’application périmée.');
 const typed=prompt('REMETTRE À ZÉRO UNIQUEMENT le parcours '+$('results-app').selectedOptions[0]?.textContent+' de '+p.name+'. Les XP historiques restent acquis, aucun nouveau gain pour les mêmes paliers. Recopie exactement le nom du profil fictif :');
 if(typed!==p.name)return;
 if(!confirm('Confirmer la remise à zéro du seul profil fictif '+p.name+' pour cette application, sans recollection des XP ?'))return;
 await results('teacher-parcours-restart',{scope:'student',studentId:p.id,appKey:p.appKey,repeatXp:false});
 await loadSummary();display('Parcours fictif réinitialisé sans recollection des XP historiques.');
});
run(async()=>{await session();await loadTeacher()});
