import {avatarCategories,avatarGlyph,avatarColors,avatarColor} from './avatar-catalog.js';
import {PROFILE_REWARDS,AVATAR_LEVELS,officialInitial,unlockedProfileLevel,avatarKindUnlocked,colorUnlocked,aliasUnlocked} from './profile-rewards.mjs?v=20261104-levels-v2';
import {createProfileCelebrations} from './profile-celebration.mjs?v=20261104-levels-v2';
import { classId, classLabel, loginUrl } from './connect-context.js';
import {rememberRecentProfile,rememberRecentAvatar} from './recent-profiles.js?v=20261027avatars2';
import {objectiveRecordLabPreviews} from './objective-record-lab-previews.mjs';
import {schoolRecordLaunch,schoolAdditionsLaunch,SCHOOL_RECORD_APPS,SCHOOL_RECORD_LAUNCHER,SCHOOL_CLASS_IDS} from './apps/objective-record/release-routing.mjs';

const url = 'https://awmhpfofacaglewammxt.supabase.co';
const key = 'sb_publishable_oI2Pyl3kXzmLkK-CBnw9Nw_66a4fZgM';
const playingAsTeacher=new URLSearchParams(location.search).get('joueur')==='prof';
const allMode=new URLSearchParams(location.search).get('toutes')==='1';
const LAB_CLASS='4bf3400d-a315-4ea4-a2f3-afaca24dc9b9';
// Le catalogue et le mode libre ne chargent pas le SDK Supabase.
let supabasePromise;
function getSupabase(){
  if(!supabasePromise)supabasePromise=import('https://esm.sh/@supabase/supabase-js@2.95.0')
    .then(({createClient})=>createClient(url,key,{
      auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,
        ...(playingAsTeacher?{storageKey:'mathas-connect-professor-auth-v1'}:{})}
    })).catch(error=>{supabasePromise=null;throw error});
  return supabasePromise;
}
let teacherClientPromise;
function getTeacherSupabase(){
  if(playingAsTeacher)return getSupabase();
  if(!teacherClientPromise)teacherClientPromise=import('https://esm.sh/@supabase/supabase-js@2.95.0')
    .then(({createClient})=>createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true,
      detectSessionInUrl:false,storageKey:'mathas-connect-professor-auth-v1'}}))
    .catch(error=>{teacherClientPromise=null;throw error});
  return teacherClientPromise;
}
const $ = id => document.getElementById(id);
const FREE_KEY = 'mathas.connect.mode-libre.v1';
const inFreeMode = () => { try { return localStorage.getItem(FREE_KEY) === '1' } catch { return false } };
const setFree = enabled => { try { if (enabled) localStorage.setItem(FREE_KEY, '1'); else localStorage.removeItem(FREE_KEY) } catch {} };

const levels = [
  ['objectif', 'Objectif', 'Niveau visé'],
  ['calculs_ecrits', 'Calculs écrits', 'Calculs posés et techniques écrites'],
  ['depassement', 'Dépassement', 'Pour aller plus loin'],
  ['revision', 'Révision', 'Pour réviser'],
  ['outil', 'Outils', 'Pour t’aider'],
  ['jeux', 'Jeux', 'Pour jouer']
];

const connectedGameKeys=new Set(['abaque-longueurs','addition-ecrite-simple','multiplication-ecrite-simple','soustraction-ecrite-simple','addition-ecrite-multiple','melange-calculs-ecrits']);
const recordSlugByApp=SCHOOL_RECORD_APPS;
function progressFor(appKey){
  const p=activeProfile?.progress;
  return p&&Array.isArray(p.apps)?p.apps.find(a=>a.appKey===appKey):null;
}
function progressText(appKey){
  if(!connectedGameKeys.has(appKey))return 'Jeu actuel · scores locaux';
  if(!activeProfile)return 'Classique : local · Connecté : compte élève';
  const p=progressFor(appKey);
  if(!p)return 'Progression momentanément indisponible';
  const valid=n=>Number.isSafeInteger(n)&&n>=0;
  if(![p.xpEarned,p.xpMax,p.trophiesEarned,p.trophiesMax].every(valid))return 'Progression momentanément indisponible';
  return '⭐ '+p.xpEarned+' / '+p.xpMax+' XP\n🏆 '+p.trophiesEarned+' / '+p.trophiesMax;
}
function refreshCardProgress(){
  for(const node of document.querySelectorAll('.app-card[data-app-key]')){
    const label=node.querySelector('.app-scores');
    if(label)label.textContent=progressText(node.dataset.appKey);
  }
}
function card(app) {
  const node = $('appTemplate').content.firstElementChild.cloneNode(true);
  // En TEST, Multiplication utilise déjà son vrai moteur V7 certifié :
  // ne pas la renvoyer vers l'ancien hôte Objectif record des autres jeux.
  const testMultiplication=classId===LAB_CLASS&&app.app_key==='multiplication-ecrite-simple';
  const schoolMultiplication=SCHOOL_CLASS_IDS.includes(classId)&&app.app_key==='multiplication-ecrite-simple';
  const testSlug=classId===LAB_CLASS&&!testMultiplication?recordSlugByApp[app.app_key]:null;
  const target = new URL(testMultiplication?'./apps/multiplication-simple/':
    schoolMultiplication?'./apps/multiplication-simple/':
    testSlug?SCHOOL_RECORD_LAUNCHER+'?app='+encodeURIComponent(testSlug):
    schoolAdditionsLaunch({classId,appKey:app.app_key,legacyUrl:
      schoolRecordLaunch({classId,appKey:app.app_key,legacyUrl:app.launch_url})}),location.href);
  // Le HUB fournit la classe au jeu Connect ; les autorisations restent vérifiées côté serveur.
  if (classId && target.origin === location.origin) target.searchParams.set('class', classId);
  if(testMultiplication && target.origin===location.origin)target.searchParams.set('requireConnect','1');
  // En mode Connect scolaire, une carte officielle ne doit jamais ouvrir
  // silencieusement un 4/4 sans preuve et sans XP. Le mode Classique reste libre.
  if(schoolMultiplication && !inFreeMode() && target.origin===location.origin)
    target.searchParams.set('requireConnect','1');
   if (playingAsTeacher && !allMode && ['abaque-longueurs','addition-ecrite-simple','multiplication-ecrite-simple','soustraction-ecrite-simple','addition-ecrite-multiple','melange-calculs-ecrits'].includes(app.app_key)) target.searchParams.set('joueur','prof');
  node.href = target.href;
  if(testSlug)node.dataset.labSchool=testSlug;
  else node.dataset.appKey=app.app_key;
  node.target = '_blank';
  node.rel = 'noopener noreferrer';
  node.querySelector('.app-name').textContent = app.title + (allMode ? (app.published===true?' · Déjà publiée dans une classe':' · En test') : '');
  node.querySelector('.app-initial').textContent = app.title.charAt(0).toUpperCase();
  node.querySelector('.app-scores').textContent = testMultiplication?'🧪 TEST · vrais XP et trophées Connect (connexion obligatoire)':
    testSlug?(app.app_key==='addition-ecrite-multiple'?'🧪 TEST · XP Connect en Classique / Mort subite':'🧪 TEST · nouveaux modes XP en préparation'):progressText(app.app_key);
  if (app.image_url && !app.image_url.includes('jftzuslpelgzbdrftszw')) {
    const img = document.createElement('img');
    // Un numéro de version uniquement pour les deux miniatures approuvées évite
    // le cache de l'ancien visuel sans changer les URLs du catalogue Supabase.
    const thumbUrl = new URL(app.image_url, location.href);
    if (['soustraction-ecrite-simple','melange-calculs-ecrits'].includes(app.app_key)) {
      thumbUrl.searchParams.set('v','20261031-miniatures-prof');
    }
    img.src = thumbUrl.href; img.alt = ''; img.loading = 'lazy';
    node.querySelector('.app-thumb').replaceChildren(img);
  }
  return node;
}

// Les démos ne reçoivent pas d'app_key Connect : pas de progression ni d'XP simulé dans le HUB.
function previewCard(preview) {
  const node = $('appTemplate').content.firstElementChild.cloneNode(true);
  node.href = preview.url;
  node.target = '_blank';
  node.rel = 'noopener noreferrer';
  node.dataset.labPreview = preview.id;
  node.querySelector('.app-name').textContent = preview.title;
  node.querySelector('.app-initial').textContent = '🏆';
  node.querySelector('.app-scores').textContent = '🧪 Essai isolé · XP fictifs · aucun résultat Connect';
  return node;
}
function labPreviewSection() {
  return section('record_lab', '🏆 Objectif record — essais',
    'Versions expérimentales des jeux. Les XP affichés sont fictifs et les parties ne sont pas enregistrées sur Connect.',
    objectiveRecordLabPreviews, previewCard);
}

function section(kind, title, description, apps, makeCard=card) {
  const node = $('levelTemplate').content.firstElementChild.cloneNode(true);
  node.querySelector('.level-title').textContent = title;
  node.querySelector('.level-description').textContent = description;
  node.querySelector('.level-count').textContent = apps.length + ' app' + (apps.length > 1 ? 's' : '');
  node.querySelector('.level-apps').replaceChildren(...apps.map(makeCard));
  const toggle = node.querySelector('.level-toggle');
  if (['objectif', 'calculs_ecrits', 'outil', 'record_lab'].includes(kind)) {
    node.classList.remove('collapsed'); toggle.setAttribute('aria-expanded', 'true');
  }
  toggle.onclick = () => {
    const collapsed = node.classList.toggle('collapsed');
    toggle.setAttribute('aria-expanded', String(!collapsed));
  };
  return node;
}

async function showCatalog() {
  try {
    let apps=[];
    if(allMode){
      // Accès professeur vérifié côté serveur, sans secours catalogue élève.
      const sb=await getTeacherSupabase();
      const {data:{session}}=await sb.auth.getSession();
      if(!session?.access_token||session.user?.is_anonymous)throw Error('professor_session_required');
      const response=await fetch(url+'/functions/v1/connect-lab-catalog',{method:'POST',cache:'no-store',headers:{apikey:key,authorization:'Bearer '+session.access_token,'content-type':'application/json'},body:JSON.stringify({action:'all',classId:LAB_CLASS})});
      if(!response.ok)throw Error('all_catalog_unavailable');
      const data=await response.json();
      if(!data.ok||!Array.isArray(data.apps))throw Error('all_catalog_unavailable');
      apps=data.apps;
    }else if(classId===LAB_CLASS){
      // Le HUB de test ne se replie JAMAIS sur Observation en cas de panne.
      const response=await fetch(url+'/functions/v1/connect-lab-catalog?class='+encodeURIComponent(LAB_CLASS),{cache:'no-store'});
      if(!response.ok)throw Error('test_catalog_unavailable');
      const data=await response.json();
      if(!data.ok||!Array.isArray(data.apps))throw Error('test_catalog_unavailable');
      // Les anciennes versions du HUB voient les cinq raccourcis renvoyés par
      // l'Edge TEST. La nouvelle version utilise sa rubrique statique dédiée,
      // donc retire les doublons sans toucher aux applications officielles.
      const labDemoKeys=new Set(objectiveRecordLabPreviews.map(p=>'lab-record-'+p.id));
      apps=data.apps.filter(app=>!labDemoKeys.has(app.app_key));
    } else {
    // Petit fichier statique sur GitHub Pages : zéro appel Supabase pour jouer librement.
    const response = await fetch('./hub-catalog.json', { cache: 'no-cache' });
    if (!response.ok) throw Error('catalog');
    const { apps: fallbackApps } = await response.json();
    if (!Array.isArray(fallbackApps)) throw Error('catalog');
    // Secours statique public : Soustraction est désormais publiée au même titre que les autres jeux.
    // Les permissions et l'accès Connect restent vérifiés côté serveur.
    apps=fallbackApps;
    // Une lecture globale courte, mise en cache côté navigateur. Le catalogue statique reste le secours.
    try{
      const cacheKey='mathas.connect.global-catalog.v2';
      const classPresets={'8fe170fa-9e8f-4e80-885a-b0ba68026f64':'observation','71f5f4a5-3f25-4ec7-ac29-c33d2e6b395e':'phase1','1b021ed9-4846-4203-9c7b-4b5fa8d7adab':'phase2','0d8ba828-59cc-468b-a4b8-7b2a1af10b88':'phase2b','a9195199-0a28-4e86-99ce-47b36dd6e646':'2eco'};
      const selectedSpace=classPresets[classId]||new URLSearchParams(location.search).get('space')||'observation';
      const scopedKey=cacheKey+':'+selectedSpace;
      const cached=JSON.parse(sessionStorage.getItem(scopedKey)||'null');
      if(cached&&Date.now()-cached.at<60000&&Array.isArray(cached.apps))apps=cached.apps;
      else{
        const controller=new AbortController();
        const timeout=setTimeout(()=>controller.abort(),1600);
        try{
          const r=await fetch(url+'/functions/v1/connect-catalog?space='+encodeURIComponent(selectedSpace),{signal:controller.signal,cache:'default'});
          if(r.ok){const data=await r.json();if(data.ok&&Array.isArray(data.apps)){
            const images=new Map(fallbackApps.map(a=>[a.app_key,a.image_url]));
            apps=data.apps.map(a=>({...a,image_url:a.image_url||images.get(a.app_key)}));
            sessionStorage.setItem(scopedKey,JSON.stringify({at:Date.now(),apps}));
          }}
        }finally{clearTimeout(timeout)}
      }
    }catch{ /* Le HUB reste utilisable avec le catalogue statique. */ }
    }
    apps=apps.filter(a=>a.enabled!==false).sort((a,b)=>((allMode?a.all_order:a.display_order)||0)-((allMode?b.all_order:b.display_order)||0));
    const featured = allMode?[]:apps.filter(a => a.featured);
    $('dailyCount').textContent = featured.length + ' app' + (featured.length === 1 ? '' : 's');
    $('dailyApps').replaceChildren(...(featured.length ? featured.map(card) : [
      Object.assign(document.createElement('p'), { className: 'empty-state', textContent: 'Pas de sélection pour le moment.' })
    ]));
    $('dailyApps').classList.toggle('empty-grid', featured.length === 0);
    const ordinary=allMode?apps.filter(a=>!a.in_test):apps;
    const groups=levels.filter(([id])=>!allMode||ordinary.some(a=>a.hub_section===id)).map(([id, title, desc]) =>
      section(id, title, desc, ordinary.filter(a => a.hub_section === id))
    );
    if(allMode){
      document.body.classList.add('hub-toutes');
      const trials=apps.filter(a=>a.in_test);
      groups.unshift(section('tests','🧪 Tests','Applications présentes dans le circuit d’essai, y compris celles déjà publiées dans certaines classes. Connect réel avec profils fictifs TEST.',trials));
      groups[0].classList.remove('collapsed');groups[0].querySelector('.level-toggle').setAttribute('aria-expanded','true');
      $('classLabel').textContent='Toutes les applications · TEST';
      document.querySelector('.daily-section')?.setAttribute('hidden','');
    }else if(classId===LAB_CLASS)groups.unshift(labPreviewSection());

    $('levels').replaceChildren(...groups);
  } catch {
    $('dailyApps').textContent = allMode?'Catalogue professeur indisponible. Vérifie ta connexion.':classId===LAB_CLASS?'Catalogue Connect du laboratoire indisponible. Aucun jeu Connect affiché.':'Le catalogue est momentanément indisponible.';
    // Même si l'Edge du catalogue tombe, seuls les essais statiques sans compte restent disponibles.
    if(allMode)$('levels').replaceChildren();
    else if(classId===LAB_CLASS)$('levels').replaceChildren(labPreviewSection());

  }
}

let activeProfile=null,avatarChoice={kind:'letter',value:'E',color:'transparent'};
function paintAvatar(node,avatar){
 const v=avatar||avatarChoice;
 node.textContent=avatarGlyph(v);
 node.style.background=avatarColor(v.color);
 node.classList.toggle('avatar-transparent',v.color==='transparent');
}
function profileLevel(){
 return playingAsTeacher?25:unlockedProfileLevel(activeProfile);
}
function profileError(code){
 const errors={
  reward_locked:'Cette récompense n’est pas encore débloquée.',
  initial_only:'Tu peux seulement utiliser la première lettre de ton prénom.',
  pseudo_invalide:'Choisis 3 à 18 caractères : lettres, chiffres, espaces, tirets ou _.',
  pseudo_deja_utilise:'Ce pseudo est déjà pris. Essaie-en un autre.',
  input_invalid:'Ce choix n’est pas reconnu.'
 };
 return errors[code]||code||'Enregistrement impossible';
}
async function saveProfileChange(action,payload){
 const sb=await getSupabase();
 const {data:{session}}=await sb.auth.getSession();
 if(!session?.user)throw Error('Connecte-toi à ton profil');
 const response=await fetch(url+'/functions/v1/connect-api',{method:'POST',
  headers:{apikey:key,authorization:'Bearer '+session.access_token,'content-type':'application/json'},
  body:JSON.stringify({action,...payload})});
 const data=await response.json();
 if(!response.ok||!data.ok)throw Error(profileError(data.error));
 return data;
}
function openAvatarEditor(){
 if(!activeProfile)return;
 const level=profileLevel(),initial=officialInitial(activeProfile.displayName);
 const dialog=$('avatar-dialog');dialog.hidden=false;
 $('avatar-dialog-title').textContent='Mes récompenses de profil';
 $('avatar-dialog-help').textContent='Plus tu gagnes de niveaux Connect, plus tu peux personnaliser ton profil.';
 const progress=$('profile-rewards');progress.replaceChildren();
 for(const reward of PROFILE_REWARDS){
  const item=document.createElement('span');
  const unlocked=level>=reward.level;
  item.className='profile-reward-chip'+(unlocked?' unlocked':' locked');
  item.textContent=(unlocked?'✓ ':'🔒 ')+reward.icon+' Niv. '+reward.level+' · '+reward.label;
  progress.append(item);
 }
 const choices=$('avatar-choices');choices.replaceChildren();
 let tabs=$('hub-avatar-tabs');
 if(!tabs){tabs=document.createElement('div');tabs.id='hub-avatar-tabs';tabs.className='avatar-tabs';choices.before(tabs)}
 tabs.replaceChildren();
 const categories=[
  {kind:'letter',label:'🔤 Mon initiale',icons:{[initial]:initial}},
  ...avatarCategories.filter(cat=>cat.kind!=='letter').sort((a,b)=>AVATAR_LEVELS[a.kind]-AVATAR_LEVELS[b.kind])
 ];
 // Un choix récemment débloqué n'autorise jamais les autres catégories :
 // le serveur vérifie également les XP avant chaque sauvegarde.
 if(!avatarKindUnlocked(avatarChoice.kind,level))
  avatarChoice={...avatarChoice,kind:'letter',value:initial};
 if(avatarChoice.kind==='letter')avatarChoice.value=initial;
 if(!colorUnlocked(level))avatarChoice.color='transparent';
 for(const category of categories){
  const unlocked=playingAsTeacher||avatarKindUnlocked(category.kind,level);
  const need=category.kind==='letter'?1:category.kind==='animal'?5:category.kind==='object'?25:15;
  const tab=document.createElement('button');tab.type='button';
  tab.textContent=category.label+(unlocked?'':' · Niv. '+need+' 🔒');
  tab.disabled=!unlocked;tab.title=unlocked?category.label:'Se débloque au niveau '+need;
  tab.className=avatarChoice.kind===category.kind?'selected':'';
  tab.onclick=()=>{
   avatarChoice.kind=category.kind;
   avatarChoice.value=Object.keys(category.icons)[0];
   openAvatarEditor()
  };
  tabs.append(tab);
 }
 const category=categories.find(cat=>cat.kind===avatarChoice.kind);
 for(const [value,emoji] of Object.entries(category?.icons||{})){
  const button=document.createElement('button');button.type='button';
  button.textContent=emoji;button.title=value;button.setAttribute('aria-label','Avatar : '+value);
  button.className=avatarChoice.value===value?'selected':'';
  button.onclick=()=>{avatarChoice.value=value;openAvatarEditor()};
  choices.append(button);
 }
 const palette=$('avatar-colors');palette.replaceChildren();
 const colorInfo=$('avatar-color-note');
 colorInfo.textContent=colorUnlocked(level)||playingAsTeacher
  ?'Choisis un fond coloré ou transparent.'
  :'🔒 Les couleurs de fond se débloquent au niveau 10. Pour le moment, ton avatar est transparent.';
 for(const [name,hex] of Object.entries(avatarColors)){
  const button=document.createElement('button');button.type='button';
  button.className=avatarChoice.color===name?'selected':'';
  button.title=name==='transparent'?'Sans fond':'Couleur '+name;
  button.setAttribute('aria-label',name==='transparent'?'Fond transparent':'Couleur '+name);
  button.style.background=hex==='transparent'?'repeating-conic-gradient(#e4e8ec 0% 25%,#8395a5 0% 50%) 50% / 12px 12px':hex;
  button.disabled=name!=='transparent'&&!colorUnlocked(level)&&!playingAsTeacher;
  button.onclick=()=>{avatarChoice.color=name;openAvatarEditor()};
  palette.append(button);
 }
 paintAvatar($('avatar-preview'),avatarChoice);
 const aliasPanel=$('profile-alias-panel');
 const mayAlias=aliasUnlocked(level)&&!playingAsTeacher;
 aliasPanel.hidden=!mayAlias;
 $('profile-alias-locked').hidden=mayAlias;
 $('profile-alias-locked').textContent='🔒 Le choix du pseudo se débloque au niveau 20.';
 if(mayAlias){
  const current=String(activeProfile.publicAlias||'');
  $('profile-alias-input').value=current===activeProfile.displayName?'':current;
 }
 $('avatar-feedback').textContent='';
 $('avatar-save').disabled=!playingAsTeacher&&level<5;
 $('avatar-save').textContent=level<5&&!playingAsTeacher?'Débloqué au niveau 5':'Enregistrer l’avatar';
}
$('avatar-cancel').onclick=()=>$('avatar-dialog').hidden=true;
$('edit-avatar').onclick=()=>{
 if(!activeProfile)return;
 avatarChoice={...activeProfile.avatar};
 openAvatarEditor()
};
$('avatar-save').onclick=async()=>{
 const button=$('avatar-save');button.disabled=true;
 try{
  const data=await saveProfileChange('student-avatar',avatarChoice);
  activeProfile={...activeProfile,avatar:data.avatar};
  drawIdentity(activeProfile);
  $('avatar-dialog').hidden=true;
 }catch(e){$('avatar-feedback').textContent=e.message||'Erreur';}
 finally{button.disabled=false}
};
$('profile-alias-save').onclick=async()=>{
 if(!activeProfile||!aliasUnlocked(profileLevel()))return;
 const button=$('profile-alias-save');button.disabled=true;
 try{
  const candidate=$('profile-alias-input').value.trim();
  const data=await saveProfileChange('student-profile-alias',{alias:candidate||null});
  activeProfile={...activeProfile,publicAlias:data.publicAlias};
  drawIdentity(activeProfile);
  $('avatar-feedback').textContent='Pseudo enregistré !';
 }catch(e){$('avatar-feedback').textContent=e.message||'Erreur';}
 finally{button.disabled=false}
};

// La célébration arrive UNIQUEMENT au retour sur le HUB, jamais dans les jeux.
// L'enregistrement côté serveur intervient seulement après un clic de l'élève.
const profileCelebrations=createProfileCelebrations({
 documentRef:document,
 enabled:!playingAsTeacher,
 acknowledge:level=>saveProfileChange('student-reward-celebrate',{classId,level}),
 onPersonalize:()=>{
  if(!activeProfile)return;
  avatarChoice={...activeProfile.avatar};
  openAvatarEditor();
 }
});

// Groupement visuel uniquement : aucun effet sur les comptes et les XP.
const progressGroup=document.createElement('div');
progressGroup.id='identity-progress';
const main=$('identity-box').querySelector('.identity-main');
for(const id of ['identity-xp','identity-action','identity-extra'])progressGroup.append($ (id));
main.append(progressGroup);
function drawIdentity(profile) {
  const authorized = profile?.status === 'approved' && profile?.classId === classId;
  activeProfile=authorized?profile:null;
  if(!authorized)profileCelebrations.reset();
  // Ne montrer le nom Connect dans les HUB qu'après approbation du compte pour cette classe.
  $('hub-connect-suffix').hidden=!authorized;
  refreshCardProgress();
  if(authorized && classId && profile.classId===classId){
    rememberRecentProfile(classId,profile.displayName);
    rememberRecentAvatar(classId,profile.displayName,profile.avatar);
  }
  $('identity-box').className=authorized?'identity-connected':'identity-classic';
  const shownName=authorized&&!playingAsTeacher&&aliasUnlocked(unlockedProfileLevel(profile))&&profile.publicAlias&&profile.publicAlias!==profile.displayName
    ?profile.publicAlias:profile?.displayName;
  $('identity-title').textContent=authorized?String(shownName||'Élève').replace(/\.\s*(?=[\p{L}]$)/u,' '):'Mode Classique';
  const oldBar=$('connect-xp-bar');if(oldBar)oldBar.remove();
  if(authorized&&profile.xp?.active){
    const level=profile.xp.level,total=profile.xp.total,from=level<=7?(level-1)*50:300+(level-7)*100,to=profile.xp.next;
    const detail=document.createElement('div');detail.id='connect-xp-bar';detail.title='XP Connect : '+total+' / '+to+' pour atteindre le prochain niveau';
    detail.style.cssText='width:100%;display:grid;gap:5px';
    const rail=document.createElement('div');rail.style.cssText='height:7px;background:rgba(135,174,191,.25);overflow:hidden;border-radius:20px';
    const fill=document.createElement('div');fill.style.cssText='height:100%;background:#c99b2c;border-radius:20px;width:'+Math.max(0,Math.min(100,100*(total-from)/(to-from)))+'%';rail.append(fill);
    const label=document.createElement('small');label.style.cssText='font-size:10px;opacity:.78';label.textContent='Niveau '+(level+1)+' à '+to+' XP';
    detail.append(rail,label);
    $('identity-xp').after(detail);
  }
  $('identity-class').hidden=true;
  $('identity-level').hidden=!authorized;
  $('identity-xp').hidden=!authorized;
  $('identity-trophies').hidden=!authorized;
  $('identity-trophies').textContent=authorized?'🏆 '+(Number.isSafeInteger(profile.progress?.totalTrophies)?profile.progress.totalTrophies:'—')+' trophées':'';
  if(authorized){
    $('identity-level-number').textContent=String(profile.xp?.active?profile.xp.level:'—');
    $('identity-xp').textContent=profile.xp?.active?profile.xp.total+' XP Connect':'XP Connect : …';
  }
  const avatar=$('identity-avatar');avatar.hidden=!authorized;
  if(authorized)paintAvatar(avatar,profile.avatar);
  $('edit-avatar').hidden=!authorized;
  $('edit-avatar').textContent='🏅 Mes récompenses de profil';
  $('classLabel').textContent = allMode?'Toutes les applications · TEST':classId ? classLabel : 'Jeux';
  const action = $('identity-action');
  action.textContent = authorized ? '⚙ Mon profil' : 'Se connecter';
  // Le lien fonctionne nativement, sans attendre Supabase et même si le script échoue.
  if (authorized) action.removeAttribute('href');
  else action.setAttribute('href', allMode?loginUrl(LAB_CLASS,'Classe démo - TEST'):(classId ? loginUrl() : './connexion.html'));
  $('identity-extra').hidden = true;
  $('mode-toggle').textContent=playingAsTeacher?'Retour à l’espace professeur':'Se déconnecter';
  action.onclick = event => {
    if (!authorized) return; // Navigation native vers la connexion.
    event.preventDefault();
    $('identity-extra').hidden = !$('identity-extra').hidden;
  };
}

$('mode-toggle').onclick = async () => {
   if(playingAsTeacher){location.href='./index.html?portail=prof';return;}
  if(!confirm('Se déconnecter de Math’as Connect sur cet appareil ? Les XP et les résultats restent sauvegardés. Pour revenir, le professeur devra autoriser une nouvelle connexion.'))return;
  const button=$('mode-toggle');button.disabled=true;
  try{
    const sb=await getSupabase();
  const {data:{session}}=await sb.auth.getSession();
    if(session?.user?.is_anonymous){
      const response=await fetch(url+'/functions/v1/connect-api',{method:'POST',headers:{
        apikey:key,authorization:'Bearer '+session.access_token,'content-type':'application/json'
      },body:JSON.stringify({action:'student-release'})});
      if(!response.ok||(await response.json()).ok!==true)throw Error('Déconnexion impossible. Réessaie.');
    }
    const {error}=await sb.auth.signOut({scope:'local'});
    if(error)throw error;
    setFree(false);
    drawIdentity(null);
  }catch(e){alert(e.message||'Déconnexion impossible.');}
  finally{button.disabled=false;}
};
let lastIdentityRequestAt=0,refreshingIdentity=false;
async function showIdentity(refresh=false) {
  if(refresh&&(refreshingIdentity||Date.now()-lastIdentityRequestAt<2000))return;
  if(!refresh)drawIdentity(null);
  if (!classId || (!playingAsTeacher&&inFreeMode())) return;
  refreshingIdentity=true;lastIdentityRequestAt=Date.now();
  try {
    const sb=await getSupabase();
    const { data: { session } } = await sb.auth.getSession();
    if (!session?.user) return;
    const response = await fetch(url + '/functions/v1/connect-api', {
      method: 'POST',
      headers: { apikey: key, authorization: 'Bearer ' + session.access_token, 'content-type': 'application/json' },
      body: JSON.stringify({ action: session.user.is_anonymous ? 'student-me' : 'teacher-player', classId, includeXp:true })
    });
    if (!response.ok) return;
    const profile = await response.json();
    if (profile.ok && profile.status === 'approved' && (profile.classId === classId)) {
      // Une seule requête authentifiée pour identité + XP + progressions.
      drawIdentity(profile);
      profileCelebrations.receive(profile);
    }else if(refresh)drawIdentity(null);
    // Aucun accès reconnu au seul motif de connaître le lien de classe.
  } catch { /* Toujours laisser le HUB et les jeux accessibles en mode libre. */ }
  finally{refreshingIdentity=false;}
}

// Retour d'un onglet de jeu : un seul résumé à la demande, jamais de polling.
window.addEventListener('focus',()=>{if(activeProfile)void showIdentity(true)});
if(allMode)import('./hub-toutes-auth.mjs?v=20261105-v1')
 .then(({mountHubToutesAuth})=>mountHubToutesAuth({
   teacherClient:getTeacherSupabase, studentClient:getSupabase, isTeacherMode:playingAsTeacher,
   testClass:LAB_CLASS,baseUrl:url,publicKey:key
 })).catch(error=>console.error('Hub Toutes auth error',error));
showCatalog();
showIdentity();
