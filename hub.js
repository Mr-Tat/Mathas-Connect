import {avatarCategories,avatarGlyph,avatarColors,avatarColor} from './avatar-catalog.js';
import { classId, classLabel, loginUrl } from './connect-context.js';
import {rememberRecentProfile,rememberRecentAvatar} from './recent-profiles.js?v=20261027avatars2';

const url = 'https://awmhpfofacaglewammxt.supabase.co';
const key = 'sb_publishable_oI2Pyl3kXzmLkK-CBnw9Nw_66a4fZgM';
const playingAsTeacher=new URLSearchParams(location.search).get('joueur')==='prof';
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

function card(app) {
  const node = $('appTemplate').content.firstElementChild.cloneNode(true);
  const target = new URL(app.launch_url, location.href);
  // Le HUB fournit la classe au jeu Connect ; les autorisations restent vérifiées côté serveur.
  if (classId && target.origin === location.origin) target.searchParams.set('class', classId);
   if (playingAsTeacher && ['addition-ecrite-simple','multiplication-ecrite-simple','soustraction-ecrite-simple','addition-ecrite-multiple','melange-calculs-ecrits'].includes(app.app_key)) target.searchParams.set('joueur','prof');
  node.href = target.href;
  node.target = '_blank';
  node.rel = 'noopener noreferrer';
  node.querySelector('.app-name').textContent = app.title;
  node.querySelector('.app-initial').textContent = app.title.charAt(0).toUpperCase();
  node.querySelector('.app-scores').textContent =
    ['addition-ecrite-simple','multiplication-ecrite-simple','soustraction-ecrite-simple','addition-ecrite-multiple','melange-calculs-ecrits'].includes(app.app_key)
      ? 'Classique : local · Connecté : compte élève'
      : 'Jeu actuel · scores locaux';
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

function section(kind, title, description, apps) {
  const node = $('levelTemplate').content.firstElementChild.cloneNode(true);
  node.querySelector('.level-title').textContent = title;
  node.querySelector('.level-description').textContent = description;
  node.querySelector('.level-count').textContent = apps.length + ' app' + (apps.length > 1 ? 's' : '');
  node.querySelector('.level-apps').replaceChildren(...apps.map(card));
  const toggle = node.querySelector('.level-toggle');
  if (['objectif', 'calculs_ecrits', 'outil'].includes(kind)) {
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
    if(classId===LAB_CLASS){
      // Le HUB de test ne se replie JAMAIS sur Observation en cas de panne.
      const response=await fetch(url+'/functions/v1/connect-lab-catalog?class='+encodeURIComponent(LAB_CLASS),{cache:'no-store'});
      if(!response.ok)throw Error('test_catalog_unavailable');
      const data=await response.json();
      if(!data.ok||!Array.isArray(data.apps))throw Error('test_catalog_unavailable');
      apps=data.apps;
    } else {
    // Petit fichier statique sur GitHub Pages : zéro appel Supabase pour jouer librement.
    const response = await fetch('./hub-catalog.json', { cache: 'no-cache' });
    if (!response.ok) throw Error('catalog');
    const { apps: fallbackApps } = await response.json();
    if (!Array.isArray(fallbackApps)) throw Error('catalog');
    // Jeu nouvellement intégré : jamais visible via le secours statique avant activation du preset serveur.
    apps=fallbackApps.filter(a=>a.app_key!=='soustraction-ecrite-simple');
    // Une lecture globale courte, mise en cache côté navigateur. Le catalogue statique reste le secours.
    try{
      const cacheKey='mathas.connect.global-catalog.v1';
      const classPresets={'8fe170fa-9e8f-4e80-885a-b0ba68026f64':'observation','71f5f4a5-3f25-4ec7-ac29-c33d2e6b395e':'phase1','1b021ed9-4846-4203-9c7b-4b5fa8d7adab':'phase2','a9195199-0a28-4e86-99ce-47b36dd6e646':'2eco'};
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
    apps=apps.filter(a=>a.enabled!==false).sort((a,b)=>(a.display_order||0)-(b.display_order||0));
    const featured = apps.filter(a => a.featured);
    $('dailyCount').textContent = featured.length + ' app' + (featured.length === 1 ? '' : 's');
    $('dailyApps').replaceChildren(...(featured.length ? featured.map(card) : [
      Object.assign(document.createElement('p'), { className: 'empty-state', textContent: 'Pas de sélection pour le moment.' })
    ]));
    $('dailyApps').classList.toggle('empty-grid', featured.length === 0);
    $('levels').replaceChildren(...levels.map(([id, title, desc]) =>
      section(id, title, desc, apps.filter(a => a.hub_section === id))
    ));
  } catch {
    $('dailyApps').textContent = classId===LAB_CLASS?'Catalogue du laboratoire indisponible. Aucune application affichée.':'Le catalogue est momentanément indisponible.';
  }
}

let activeProfile=null,avatarChoice={kind:'animal',value:'fox',color:'ocean'};
function paintAvatar(node,avatar){
 const v=avatar||avatarChoice;
 node.textContent=avatarGlyph(v);
 node.style.background=avatarColor(v.color);
}
function openAvatarEditor(){
 const dialog=$('avatar-dialog');dialog.hidden=false;
 const choices=$('avatar-choices');choices.replaceChildren();
 let tabs=$('hub-avatar-tabs');if(!tabs){tabs=document.createElement('div');tabs.id='hub-avatar-tabs';tabs.className='avatar-tabs';choices.before(tabs)}tabs.replaceChildren();
 for(const category of avatarCategories){
  const tab=document.createElement('button');tab.type='button';tab.textContent=category.label;tab.className=avatarChoice.kind===category.kind?'selected':'';
  tab.onclick=()=>{avatarChoice.kind=category.kind;avatarChoice.value=Object.keys(category.icons)[0];openAvatarEditor()};tabs.append(tab)
 }
 for(const [value,emoji] of Object.entries(avatarCategories.find(x=>x.kind===avatarChoice.kind)?.icons||{})){
  const b=document.createElement('button');b.type='button';b.textContent=emoji;b.title=value;b.setAttribute('aria-label','Avatar : '+value);
  b.className=avatarChoice.value===value?'selected':'';
  b.onclick=()=>{avatarChoice.value=value;openAvatarEditor()};choices.append(b)
 }
 const colors=$('avatar-colors');colors.replaceChildren();
 for(const [name,hex] of Object.entries(avatarColors)){
  const b=document.createElement('button');b.type='button';b.style.background=hex;b.setAttribute('aria-label','Couleur '+name);b.title=name;b.className=avatarChoice.color===name?'selected':'';
  b.onclick=()=>{avatarChoice.color=name;openAvatarEditor()};colors.append(b);
 }
}
$('avatar-cancel').onclick=()=>$('avatar-dialog').hidden=true;
$('edit-avatar').onclick=()=>{if(!activeProfile)return;avatarChoice={...activeProfile.avatar};openAvatarEditor()};
$('avatar-save').onclick=async()=>{
 const button=$('avatar-save');button.disabled=true;
 try{
  const sb=await getSupabase();
  const {data:{session}}=await sb.auth.getSession();
  if(!session?.user)throw Error('Connecte-toi à ton profil');
  const response=await fetch(url+'/functions/v1/connect-api',{method:'POST',
   headers:{apikey:key,authorization:'Bearer '+session.access_token,'content-type':'application/json'},
   body:JSON.stringify({action:'student-avatar',...avatarChoice})});
  const data=await response.json();
  if(!response.ok||!data.ok)throw Error(data.error||'Enregistrement impossible');
  activeProfile={...activeProfile,avatar:data.avatar};
  drawIdentity(activeProfile);$('avatar-dialog').hidden=true;
 }catch(e){$('avatar-feedback').textContent=e.message||'Erreur';}finally{button.disabled=false}
};

// Groupement visuel uniquement : aucun effet sur les comptes et les XP.
const progressGroup=document.createElement('div');
progressGroup.id='identity-progress';
const main=$('identity-box').querySelector('.identity-main');
for(const id of ['identity-xp','identity-action','identity-extra'])progressGroup.append($ (id));
main.append(progressGroup);
function drawIdentity(profile) {
  const authorized = profile?.status === 'approved' && profile?.classId === classId;
  activeProfile=authorized?profile:null;
  if(authorized && classId && profile.classId===classId){
    rememberRecentProfile(classId,profile.displayName);
    rememberRecentAvatar(classId,profile.displayName,profile.avatar);
  }
  $('identity-box').className=authorized?'identity-connected':'identity-classic';
  $('identity-title').textContent = authorized ? String(profile.displayName||'Élève').replace(/\.\s*(?=[\p{L}]$)/u,' ') : 'Mode Classique';
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
  if(authorized){
    $('identity-level-number').textContent=String(profile.xp?.active?profile.xp.level:'—');
    $('identity-xp').textContent=profile.xp?.active?profile.xp.total+' XP Connect':'XP Connect : …';
  }
  const avatar=$('identity-avatar');avatar.hidden=!authorized;
  if(authorized)paintAvatar(avatar,profile.avatar);
  $('edit-avatar').hidden=!authorized;
  $('classLabel').textContent = classId ? classLabel : 'Jeux';
  const action = $('identity-action');
  action.textContent = authorized ? '⚙ Mon profil' : 'Se connecter';
  // Le lien fonctionne nativement, sans attendre Supabase et même si le script échoue.
  if (authorized) action.removeAttribute('href');
  else action.setAttribute('href', classId ? loginUrl() : './connexion.html');
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
async function showIdentity() {
  drawIdentity(null);
  if (!classId || (!playingAsTeacher&&inFreeMode())) return;
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
      // Une seule requête authentifiée pour identité + XP ; plus d'aller-retour supplémentaire.
      drawIdentity(profile);
    }
    // Aucun accès reconnu au seul motif de connaître le lien de classe.
  } catch { /* Toujours laisser le HUB et les jeux accessibles en mode libre. */ }
}

showCatalog();
showIdentity();
