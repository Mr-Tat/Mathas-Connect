// Isolated professor actions; no pupil reset on viewing the page.
export function installMilieuProfessor({sb,url,key}){
 const $=id=>document.getElementById(id),panel=$('milieu-authorizations'),feedback=$('milieu-feedback');
 if(!panel)return;
 let busy=false,capClass=null;
 const cap=$('milieu-cap'),capSave=$('milieu-cap-save');
 const current=()=>$('auth-app').value==='milieu-segment';
 async function request(classId,action,extra={}){
  const {data:{session}}=await sb.auth.getSession();
  if(!session?.access_token||session.user?.is_anonymous!==false)throw Error('Connexion professeur requise.');
  const response=await fetch(url+'/functions/v1/connect-milieu',{method:'POST',cache:'no-store',headers:{apikey:key,authorization:'Bearer '+session.access_token,'content-type':'application/json'},body:JSON.stringify({appKey:'milieu-segment',classId,action,...extra})});
  const v=await response.json().catch(()=>null);
  if(!response.ok||v?.ok!==true||v.authSubject!==session.user.id||v.classId!==classId)throw Error(v?.error||'Réponse non confirmée.');
  return v;
 }
 function select(label,values){const wrap=document.createElement('label'),s=document.createElement('select');wrap.textContent=label;for(const [name,val] of values)s.add(new Option(name,val));wrap.append(s);return {wrap,s}}
 function describe(row){return ['even','odd','mix','gi1','gi2','decimal','g1','g2','g3'].map((id,i)=>['1','2','3','4.1','4.2','5','6.1','6.2','6.3'][i]+': '+(row.state.levels[id]?.map(r=>r.percent+' %').join(' · ')||'—')).join(' | ')}
 async function open(reset){
  if(busy||!current())return;const classId=$('auth-class').value,className=$('auth-class').selectedOptions[0]?.textContent||'Classe';
  if(!classId)return;busy=true;feedback.textContent='Chargement des résultats certifiés…';
  try{const roster=(await request(classId,'teacher-summary')).students;if(!current()||$('auth-class').value!==classId)return;if(!Array.isArray(roster))throw Error('Liste invalide.');if(!roster.length){feedback.textContent='Aucun élève approuvé pour La moitié.';return}
   if(!reset){const results=$('milieu-results');results.replaceChildren();for(const row of roster){const details=document.createElement('details'),name=document.createElement('summary'),p=document.createElement('p'),record=document.createElement('p');name.textContent=row.displayName+' · '+row.xp.appXp+' XP · '+row.trophies.length+'/12 trophées';p.textContent=describe(row);record.textContent='Score du jour : '+row.scoreRecords.dayBest+' · Record : '+row.scoreRecords.allBest;details.append(name,p,record);results.append(details)}results.hidden=false;feedback.textContent='✓ Résultats chargés.';return}
   const dialog=document.createElement('dialog');dialog.className='parcours-dialog';const form=document.createElement('form'),title=document.createElement('h2');title.textContent='Nouvelle progression · La moitié';
   const scope=select('Pour',[['Un élève','student'],['Toute la classe','class']]),student=select('Élève',roster.map(r=>[r.displayName,r.studentId])),part=select('Parcours',[['Application complète','all'],['Géométrie entière · activité 4','integerGeometry'],['Géométrie décimale · activité 6','decimalGeometry']]);
   const repeatLabel=document.createElement('label'),repeat=document.createElement('input');repeat.type='checkbox';repeatLabel.append(repeat,' Autoriser le recrédit des XP de ce parcours (sans double crédit)');
   const hint=document.createElement('p'),checkLabel=document.createElement('label'),checkText=document.createElement('span'),check=document.createElement('input');check.required=true;check.autocomplete='off';checkLabel.append(checkText,check);
   const message=document.createElement('p');message.setAttribute('role','alert');const actions=document.createElement('div');actions.className='button-row';
   const cancel=document.createElement('button'),go=document.createElement('button');cancel.type='button';cancel.textContent='Annuler';go.type='submit';go.textContent='Confirmer';go.className='danger';actions.append(cancel,go);
   const targets=()=>scope.s.value==='class'?roster:roster.filter(r=>r.studentId===student.s.value);
   const name=()=>scope.s.value==='class'?className:targets()[0]?.displayName||'';
   function paint(){student.wrap.hidden=scope.s.value==='class';check.value='';checkText.textContent='Pour confirmer, recopie exactement : '+name();hint.textContent=part.s.value==='all'?'Toutes les activités et défis recommencent.':part.s.value==='integerGeometry'?'Activité 4 et défis entiers recommencent ; les acquis décimaux sont conservés.':'Activité 6 et défis décimaux recommencent ; les autres acquis sont conservés.'}
   scope.s.onchange=student.s.onchange=part.s.onchange=paint;paint();
   form.append(title,scope.wrap,student.wrap,part.wrap,repeatLabel,hint,checkLabel,message,actions);dialog.append(form);document.body.append(dialog);
   let submitting=false;dialog.addEventListener('cancel',e=>{if(submitting)e.preventDefault()});dialog.addEventListener('close',()=>{dialog.remove();busy=false},{once:true});cancel.onclick=()=>dialog.close();
   form.onsubmit=async e=>{e.preventDefault();if(submitting||check.value.trim()!==name()||!targets().length){message.textContent='Nom de confirmation invalide.';return}if(!current()||$('auth-class').value!==classId){message.textContent='La classe a changé. Ferme puis recharge.';return}
    submitting=true;const chosen=targets().map(r=>({studentId:r.studentId,epoch:r.resetEpoch,revision:r.revision})),chosenPart=part.s.value,chosenScope=scope.s.value,repeatXp=repeat.checked;for(const n of [scope.s,student.s,part.s,repeat,check,cancel,go])n.disabled=true;message.textContent='Enregistrement…';
    try{const ack=await request(classId,'teacher-restart',{confirmed:true,scope:chosenScope,part:chosenPart,repeatXp,targets:chosen});if(ack.count!==chosen.length||ack.part!==chosenPart)throw Error('Accusé inattendu.');dialog.close();feedback.textContent='✓ Nouvelle progression enregistrée pour '+ack.count+' élève(s).';$('milieu-results').hidden=true}catch(e){message.textContent='Non confirmé : '+e.message+'. Recharge la liste avant de réessayer.';submitting=false;cancel.disabled=false}
   };
   dialog.showModal();check.focus();
  }catch(e){feedback.textContent='Indisponible : '+e.message}finally{if(!document.querySelector('dialog.parcours-dialog[open]'))busy=false}
 }
 async function changeCap(save){
  if(busy||!current())return;const cls=$('auth-class').value;
  if(!cls||save&&capClass!==cls)return;
  busy=true;cap.disabled=true;capSave.disabled=true;
  try{const result=await request(cls,save?'teacher-cap-set':'teacher-cap-get',save?{maxActivity:Number(cap.value)}:{});
   if(!current()||$('auth-class').value!==cls)return;
   if(!Number.isInteger(result.maxActivity)||result.maxActivity<1||result.maxActivity>6)throw Error('Réglage invalide.');
   capClass=cls;cap.value=String(result.maxActivity);cap.disabled=false;capSave.disabled=false;feedback.textContent=save?'✓ Réglage de classe enregistré.':'Réglage chargé.';
  }catch(e){feedback.textContent='Réglage non confirmé : '+e.message;capClass=null}finally{busy=false}
 }
 for(const id of ['auth-app','auth-class'])$(id).addEventListener('change',()=>{capClass=null;cap.disabled=true;capSave.disabled=true});
 $('milieu-cap-load').onclick=()=>void changeCap(false);capSave.onclick=()=>void changeCap(true);
 $('milieu-restart-open').onclick=()=>void open(true);$('milieu-results-open').onclick=()=>void open(false);
}
