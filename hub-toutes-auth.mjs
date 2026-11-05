// HUB Toutes: aucun passe-droit. Deux sessions Supabase déjà utilisées par Connect.
export async function mountHubToutesAuth({teacherClient,studentClient,isTeacherMode,testClass,baseUrl,publicKey}){
 const host=document.querySelector('main.page-shell');if(!host)return;
 const panel=document.createElement('section');panel.id='toutes-auth';panel.className='panel toutes-auth';
 panel.setAttribute('aria-labelledby','toutes-auth-title');
 panel.innerHTML='<div class="toutes-auth-heading"><div><h2 id="toutes-auth-title">🧪 Connexions de test</h2><p>Deux sessions indépendantes, classe fictive TEST. Les XP restent liés au profil approuvé.</p></div><span id="toutes-auth-current">Vérification…</span></div>'+
 '<div class="toutes-auth-actions"><button id="toutes-switch" class="ghost-btn" type="button" disabled>Vérification…</button>'+
 '<label id="toutes-student-picker" for="toutes-student-select">Profil fictif <select id="toutes-student-select" disabled><option>Chargement…</option></select></label>'+
 '<button id="toutes-connect-student" class="ghost-btn" type="button" disabled>Se connecter avec ce profil</button>'+
 '<button id="toutes-requests-open" class="ghost-btn" type="button" aria-expanded="false" disabled>Demandes d’accès</button></div>'+
 '<p id="toutes-auth-feedback" role="status" aria-live="polite"></p>'+
 '<section id="toutes-request-panel" hidden><h3>Accepter une connexion de TEST</h3>'+
 '<label class="toutes-fictive-confirm"><input id="toutes-fictive-confirm" type="checkbox"> Je confirme que ces profils et demandes sont exclusivement fictifs.</label>'+
 '<p>Vérifie le code de l’appareil avant d’approuver. Aucune autorisation automatique.</p>'+
 '<div id="toutes-pending-requests"></div><button id="toutes-requests-refresh" class="ghost-btn" type="button">Actualiser les demandes</button></section>';
 host.prepend(panel);
 const $=id=>panel.querySelector('#'+id);
 const msg=(s,bad=false)=>{$('toutes-auth-feedback').textContent=s;$('toutes-auth-feedback').classList.toggle('is-error',bad)};
 const make=(tag,s,cls='')=>{const e=document.createElement(tag);e.textContent=s;if(cls)e.className=cls;return e};
 const route=(teacher)=>{const u=new URL('./hub.html',location.href);u.searchParams.set('toutes','1');u.searchParams.set('class',testClass);u.searchParams.set('name','Toutes');if(teacher)u.searchParams.set('joueur','prof');else u.searchParams.delete('joueur');return u.href};
 const normalized=x=>String(x||'').normalize('NFC').toLocaleLowerCase('fr').replace(/[.\s]+/g,'');
 const parts=x=>String(x||'').trim().match(/^([\p{L}][\p{L} '-]{0,39})[.\s]+([\p{L}])$/u);
 let people=[],requests=[],busy=false;
 async function teacherCall(action,data={}){
   const sb=await teacherClient();const {data:{session}}=await sb.auth.getSession();
   if(!session?.access_token||session.user?.is_anonymous)throw Error('Connecte-toi d’abord comme professeur.');
   const r=await fetch(baseUrl+'/functions/v1/connect-api',{method:'POST',cache:'no-store',
     headers:{apikey:publicKey,authorization:'Bearer '+session.access_token,'content-type':'application/json'},
     body:JSON.stringify({action,classId:testClass,...data})});
   const result=await r.json().catch(()=>({}));if(!r.ok||!result.ok)throw Error(result.error||'Accès refusé.');
   return result;
 }
 function drawProfiles(){
   const sel=$('toutes-student-select');sel.replaceChildren();
   const sorted=people.slice().sort((a,b)=>String(a.display_name).localeCompare(String(b.display_name),'fr'));
   for(const student of sorted){
     const option=new Option(student.display_name,student.id);
     option.disabled=!parts(student.display_name)||people.filter(p=>normalized(p.display_name)===normalized(student.display_name)).length!==1;
     sel.add(option);
   }
   const first=[...sel.options].find(o=>!o.disabled);
   if(first)sel.value=first.value;else sel.add(new Option('Aucun profil disponible',''));
   sel.disabled=!first;$('toutes-connect-student').disabled=!first;
   const updateStudentButton=()=>{$('toutes-connect-student').textContent='Se connecter avec '+(sel.selectedOptions[0]?.textContent||'ce profil')};
   sel.onchange=updateStudentButton;updateStudentButton();
   $('toutes-student-picker').hidden=!isTeacherMode;
   $('toutes-connect-student').hidden=!isTeacherMode;
   $('toutes-switch').hidden=isTeacherMode;
   $('toutes-switch').disabled=false;$('toutes-requests-open').disabled=false;
   $('toutes-requests-open').hidden=!isTeacherMode;
   $('toutes-switch').textContent='Se connecter avec Monsieur T';
   $('toutes-auth-current').textContent=isTeacherMode?'👨‍🏫 Monsieur T':'👧 Session élève TEST';
 }
 function drawRequests(){
   const list=$('toutes-pending-requests');list.replaceChildren();
   $('toutes-requests-open').textContent='Demandes d’accès'+(requests.length?' ('+requests.length+')':'');
   if(!requests.length){list.append(make('p','Aucune demande en attente.'));return}
   for(const request of requests){
     const card=make('article','','toutes-request');
     const name=String(request.first_name||'')+'.'+String(request.last_initial||'');
     card.append(make('strong',name),make('p','Code à vérifier sur l’appareil : '+String(request.verify_code||'—')));
     const matches=people.filter(p=>normalized(p.display_name)===normalized(name));
     let select=null;
     if(matches.length){
       select=document.createElement('select');select.setAttribute('aria-label','Fiche fictive pour '+name);
       if(matches.length>1)select.add(new Option('Choisir la fiche',''));
       for(const p of matches)select.add(new Option('Associer à '+p.display_name,p.id));
       select.add(new Option('Créer une autre fiche fictive','__new__'));
       card.append(select);
     }
     const actions=make('div','','toutes-request-actions');
     for(const approve of [true,false]){
       const button=make('button',approve?'Accepter la connexion':'Refuser','ghost-btn');
       button.type='button';button.disabled=!$('toutes-fictive-confirm').checked;button.dataset.needsConsent='1';
       button.onclick=async()=>{
         if(busy)return;
         if(!$('toutes-fictive-confirm').checked)return msg('Confirme les profils fictifs.',true);
         const match=select?.value;
         if(approve&&matches.length&&!match)return msg('Choisis une fiche fictive.',true);
         if(approve&&match==='__new__'&&!confirm('Une fiche identique existe. Créer une autre fiche fictive ?'))return;
         if(!confirm((approve?'Accepter':'Refuser')+' cette demande de '+name+' après vérification du code ?'))return;
         busy=true;button.disabled=true;
         try{
           await teacherCall('teacher-review-join',{requestId:request.id,approve,
             ...(approve&&match&&match!=='__new__'?{existingStudentId:match}:{})});
           await refresh();msg(approve?'Connexion de test approuvée.':'Demande refusée.');
         }catch(e){msg(e.message||'Erreur.',true)}finally{busy=false;button.disabled=false}
       };
       actions.append(button);
     }
     card.append(actions);list.append(card);
   }
 }
 async function refresh(){
   const data=await teacherCall('teacher-dashboard');
   if(!(data.classes||[]).some(c=>c.id===testClass))throw Error('Le professeur n’est pas autorisé pour TEST.');
   people=Array.isArray(data.students)?data.students:[];
   requests=Array.isArray(data.requests)?data.requests:[];
   drawProfiles();drawRequests();
 }
 $('toutes-fictive-confirm').onchange=()=>{for(const b of panel.querySelectorAll('[data-needs-consent]'))b.disabled=!$('toutes-fictive-confirm').checked};
 $('toutes-switch').onclick=()=>location.assign(route(!isTeacherMode));
 $('toutes-connect-student').onclick=()=>{
   const student=people.find(p=>p.id===$('toutes-student-select').value);
   if(!student)return msg('Choisis un profil fictif.',true);
   const p=parts(student.display_name);
   if(!p||people.filter(s=>normalized(s.display_name)===normalized(student.display_name)).length!==1)return msg('Fiche ambiguë. Utilise le Laboratoire.',true);
   const u=new URL('./index.html',location.href);
   u.searchParams.set('class',testClass);u.searchParams.set('name','Classe démo - TEST');u.searchParams.set('lab','1');
   u.searchParams.set('testFirst',p[1].trim());u.searchParams.set('testInitial',p[2].toUpperCase());
   u.searchParams.set('toutesReturn','1');location.assign(u.href);
 };
 $('toutes-requests-open').onclick=()=>{const open=$('toutes-request-panel').hidden;$('toutes-request-panel').hidden=!open;$('toutes-requests-open').setAttribute('aria-expanded',String(open))};
 $('toutes-requests-refresh').onclick=async()=>{if(busy)return;busy=true;try{await refresh();msg('Demandes actualisées.')}catch(e){msg(e.message||'Erreur.',true)}finally{busy=false}};
 try{
   await refresh();
   if(!isTeacherMode){
     const sb=await studentClient();const {data:{session}}=await sb.auth.getSession();
     if(session?.user?.is_anonymous){
       const r=await fetch(baseUrl+'/functions/v1/connect-api',{method:'POST',
         headers:{apikey:publicKey,authorization:'Bearer '+session.access_token,'content-type':'application/json'},
         body:JSON.stringify({action:'student-me',classId:testClass})});
       const d=await r.json().catch(()=>({}));
       if(r.ok&&d.ok&&d.status==='approved'&&d.classId===testClass)$('toutes-auth-current').textContent='👧 '+d.displayName+' · TEST';
     }
   }
 }catch(e){
   panel.classList.add('toutes-auth-blocked');$('toutes-auth-current').textContent='Accès professeur nécessaire';
   $('toutes-switch').hidden=false;$('toutes-student-picker').hidden=true;$('toutes-connect-student').hidden=true;
   $('toutes-switch').disabled=false;$('toutes-switch').textContent='Ouvrir la connexion professeur';
   $('toutes-switch').onclick=()=>location.assign('./index.html?portail=prof');
   msg('Authentification spéciale indisponible : '+(e.message||'Compte professeur requis.'),true);
 }
}
