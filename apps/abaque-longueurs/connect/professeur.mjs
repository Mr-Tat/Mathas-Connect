const BASE='https://awmhpfofacaglewammxt.supabase.co',KEY='sb_publishable_oI2Pyl3kXzmLkK-CBnw9Nw_66a4fZgM';
const PILOT='4bf3400d-a315-4ea4-a2f3-afaca24dc9b9';
const $=id=>document.getElementById(id);
const CLASS=new URLSearchParams(location.search).get('class')?.toLowerCase()||PILOT;
const validClass=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
if(CLASS!==PILOT){$('return').href='../../index.html?portail=prof';$('return').textContent='← Espace professeur';$('class-scope').textContent='Résultats de la classe sélectionnée, après vérification de vos droits.';$('consent-label').textContent=' Afficher les résultats de cette classe.';document.querySelector('th').textContent='Élève';}
let client=null,busy=false,viewEpoch=0;
const show=message=>{$('status').textContent=message};
async function call(action,fields={}){
 if(!$('fictive-confirm').checked)throw Error(CLASS===PILOT?'Confirme d’abord que ces profils sont fictifs.':'Confirme d’abord l’affichage des résultats.');
 if(!validClass.test(CLASS))throw Error('Classe invalide.');
 if(!client){const {createClient}=await import('https://esm.sh/@supabase/supabase-js@2.95.0');client=createClient(BASE,KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,storageKey:'mathas-connect-professor-auth-v1'}});}
 const session=(await client.auth.getSession()).data?.session;
 if(!session?.access_token||session.user?.is_anonymous!==false)throw Error('Connecte-toi à l’espace professeur.');
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
 try{
  const response=await fetch(BASE+'/functions/v1/connect-abaque',{method:'POST',signal:controller.signal,headers:{apikey:KEY,authorization:'Bearer '+session.access_token,'content-type':'application/json'},
   body:JSON.stringify({action,appKey:'abaque-longueurs',classId:CLASS,...fields})});
  const value=await response.json().catch(()=>null);
  if(!response.ok||!value?.ok)throw Error(value?.error||'Résultats indisponibles.');
  if(value.authSubject!==session.user.id||value.classId!==CLASS)throw Error('La session a changé.');
  return value;
 }finally{clearTimeout(timer);}
}
async function refresh(){
 $('results').replaceChildren();
 const requestEpoch=viewEpoch;
 const data=await call('teacher-summary');
 if(requestEpoch!==viewEpoch||!$('fictive-confirm').checked)return;
 if(!Array.isArray(data.students))throw Error('Résultats indisponibles.');
 for(const student of data.students){
  const result=student.result,native=result.state||{},row=document.createElement('tr');row.dataset.studentId=student.studentId;
  const cell=text=>{const td=document.createElement('td');td.textContent=text;row.append(td);return td};
  cell(student.displayName);cell((native.stage1?.passes?.length||0)+'/2 · meilleur '+(native.stage1?.best||0)+'/12');
  cell((native.stage2?.passes?.length||0)+'/2 · meilleur '+(native.stage2?.best||0)+'/8');
  cell('1 page : '+(native.modeScores?.one||0)+'/4\n3 pages : '+(native.modeScores?.three||0)+'/12\n5 pages : '+(native.modeScores?.five||0)+'/20');
  cell('Meilleur : '+(native.scoreRecords?.allBest||0)+' pts\n3 vies : '+(native.recordsByMode?.lives||0)+' pts\nMort subite : '+(native.recordsByMode?.sudden||0)+' pts\nSérie : '+(native.suddenBest||0));
  cell(result.xp.appXp+' / 160');
  cell([['Parcours',''],['Mort subite','sudden-']].map(([label,prefix])=>label+' : '+[['bronze','bronze'],['silver','argent'],['gold','or']].map(([key,name])=>result.trophies.includes('abaque:'+prefix+key)?name:'—').join(' · ')).join('\n'));
  const action=cell(''),button=document.createElement('button');button.type='button';button.textContent='Remettre à zéro';action.append(button);
  button.onclick=()=>run(async()=>{
   if(!confirm('Remettre à zéro le seul parcours Abaque de '+(CLASS===PILOT?'ce profil fictif':'cet élève')+' ? XP historiques et trophées conservés.'))return;
   await call('teacher-reset',{studentId:student.studentId,resetEpoch:result.resetEpoch,repeatXp:false});
   await refresh();show('Parcours Abaque réinitialisé. XP historiques et trophées conservés.');
  });
  $('results').append(row);
 }
 show(data.students.length+(CLASS===PILOT?' profils fictifs affichés.':' élèves affichés.')+' Actualisation manuelle uniquement.');
}
async function run(action){if(busy)return;busy=true;$('load').disabled=true;for(const button of $('results').querySelectorAll('button'))button.disabled=true;
 try{await action();}catch(error){show(error.message);}finally{busy=false;$('load').disabled=false;for(const button of $('results').querySelectorAll('button'))button.disabled=false;}}
$('load').onclick=()=>run(refresh);
$('fictive-confirm').onchange=()=>{viewEpoch++;if(!$('fictive-confirm').checked){$('results').replaceChildren();show('Résultats masqués.');}};
window.addEventListener('pagehide',()=>$('results').replaceChildren());
