import {avatarCategories,avatarGlyph,avatarColors,avatarColor} from './avatar-catalog.js';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.95.0';
import { classId, classLabel, loginUrl } from './connect-context.js';
import {rememberRecentProfile} from './recent-profiles.js';

const url = 'https://awmhpfofacaglewammxt.supabase.co';
const key = 'sb_publishable_oI2Pyl3kXzmLkK-CBnw9Nw_66a4fZgM';
const sb = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
});
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
  node.href = target.href;
  node.target = '_blank';
  node.rel = 'noopener noreferrer';
  node.querySelector('.app-name').textContent = app.title;
  node.querySelector('.app-initial').textContent = app.title.charAt(0).toUpperCase();
  node.querySelector('.app-scores').textContent =
    app.app_key === 'addition-ecrite-simple'
      ? 'Classique : local · Connecté : compte élève'
      : 'Jeu actuel · scores locaux';
  if (app.image_url && !app.image_url.includes('jftzuslpelgzbdrftszw')) {
    const img = document.createElement('img');
    img.src = app.image_url; img.alt = ''; img.loading = 'lazy';
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
    // Petit fichier statique sur GitHub Pages : zéro appel Supabase pour jouer librement.
    const response = await fetch('./hub-catalog.json', { cache: 'no-cache' });
    if (!response.ok) throw Error('catalog');
    const { apps } = await response.json();
    if (!Array.isArray(apps)) throw Error('catalog');
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
    $('dailyApps').textContent = 'Le catalogue est momentanément indisponible.';
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

// Le HUB général n'a pas de classe : éviter une redirection circulaire vers lui-même.
function openStudentLogin() {
  if (classId) { location.href = loginUrl(); return; }
  let dialog = document.getElementById('choose-connect-class');
  if (!dialog) {
    dialog = document.createElement('dialog');
    dialog.id = 'choose-connect-class';
    dialog.setAttribute('aria-label', 'Choisir sa classe pour se connecter');
    dialog.style.cssText = 'box-sizing:border-box;width:min(400px,94vw);max-height:85vh;overflow:auto;border:1px solid #6395be;border-radius:17px;padding:24px;background:#142b42;color:#f2f7fc;box-shadow:0 25px 85px #0009';
    const heading = document.createElement('h2');
    heading.textContent = 'Dans quelle classe es-tu ?';
    heading.style.cssText = 'margin:0 0 8px;font-size:21px';
    const explanation = document.createElement('p');
    explanation.textContent = 'Choisis ta classe pour demander l’accès à ton compte.';
    explanation.style.cssText = 'margin:0 0 16px;color:#c7d9e9;font-size:14px';
    const list = document.createElement('div');
    list.style.cssText = 'display:grid;gap:9px';
    for (const [name,id] of [
      ['Observation','8fe170fa-9e8f-4e80-885a-b0ba68026f64'],
      ['Phase 1','71f5f4a5-3f25-4ec7-ac29-c33d2e6b395e'],
      ['Phase 2','1b021ed9-4846-4203-9c7b-4b5fa8d7adab'],
      ['2 ECO','a9195199-0a28-4e86-99ce-47b36dd6e646']
    ]) {
      const button = document.createElement('button');
      button.type = 'button'; button.textContent = name;
      button.style.cssText = 'width:100%;min-height:45px;border:1px solid #759bbb;border-radius:9px;background:#245782;color:white;font-weight:750;cursor:pointer';
      button.onclick = () => { location.href = loginUrl(id,name); };
      list.append(button);
    }
    const close = document.createElement('button');
    close.type = 'button'; close.textContent = 'Annuler';
    close.style.cssText = 'margin-top:14px;padding:10px;background:transparent;border:1px solid #759bbb;color:#d5e6f3;border-radius:8px;cursor:pointer';
    close.onclick = () => dialog.close();
    dialog.append(heading,explanation,list,close);
    document.body.append(dialog);
  }
  if (!dialog.open) dialog.showModal();
}

function drawIdentity(profile) {
  const authorized = profile?.status === 'approved';
  activeProfile=authorized?profile:null;
  if(authorized && classId && !profile.teacherPlayer && profile.classId===classId)
    rememberRecentProfile(classId,profile.displayName);
  $('identity-box').className=authorized?'identity-connected':'identity-classic';
  $('identity-title').textContent = authorized ? 'Bienvenue '+profile.displayName+' !' : 'Mode Classique';
  const oldBar=$('connect-xp-bar');if(oldBar)oldBar.remove();
  if(authorized&&profile.xp?.active){
    const level=profile.xp.level,total=profile.xp.total,from=level<=7?(level-1)*50:300+(level-7)*100,to=profile.xp.next;
    const detail=document.createElement('div');detail.id='connect-xp-bar';detail.title='XP Connect : '+total+' / '+to+' pour atteindre le prochain niveau';
    detail.style.cssText='width:min(235px,100%);margin-top:5px;display:grid;gap:3px';
    const rail=document.createElement('div');rail.style.cssText='height:7px;background:rgba(135,174,191,.25);overflow:hidden;border-radius:20px';
    const fill=document.createElement('div');fill.style.cssText='height:100%;background:#c99b2c;border-radius:20px;width:'+Math.max(0,Math.min(100,100*(total-from)/(to-from)))+'%';rail.append(fill);
    const label=document.createElement('small');label.style.cssText='font-size:10px;opacity:.78';label.textContent='Niveau '+(level+1)+' à '+to+' XP';
    detail.append(rail,label);
    $('identity-level').after(detail);
  }
  $('identity-class').hidden=true;
  $('identity-level').hidden=!authorized;
  $('identity-xp').hidden=!authorized;
  if(authorized){
    $('identity-level-number').textContent=String(profile.xp?.active?profile.xp.level:1);
    $('identity-xp').textContent=(profile.xp?.active?profile.xp.total:0)+' XP Connect';
  }
  const avatar=$('identity-avatar');avatar.hidden=!authorized;
  if(authorized)paintAvatar(avatar,profile.avatar);
  $('edit-avatar').hidden=!authorized;
  $('classLabel').textContent = classId ? classLabel : 'Jeux';
  $('identity-action').textContent = authorized ? 'Modifier' : 'Se connecter';
  $('identity-extra').hidden = true;
  $('identity-action').onclick = () => {
    if (authorized) $('identity-extra').hidden = !$('identity-extra').hidden;
    else {
      sb.auth.getSession()
        .then(({data:{session}}) => {
          if (session?.user && classId) { setFree(false); showIdentity(); }
          else openStudentLogin();
        })
        .catch(() => openStudentLogin());
    }
  };
}

$('mode-toggle').onclick = async () => {
  if(!confirm('Se déconnecter de Math’as Connect sur cet appareil ? Les XP et les résultats restent sauvegardés. Pour revenir, le professeur devra autoriser une nouvelle connexion.'))return;
  const button=$('mode-toggle');button.disabled=true;
  try{
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
  if (!classId || inFreeMode()) return;
  try {
    const { data: { session } } = await sb.auth.getSession();
    if (!session?.user) return;
    const response = await fetch(url + '/functions/v1/connect-api', {
      method: 'POST',
      headers: { apikey: key, authorization: 'Bearer ' + session.access_token, 'content-type': 'application/json' },
      body: JSON.stringify({ action: session.user.is_anonymous ? 'student-me' : 'teacher-player', classId })
    });
    if (!response.ok) return;
    const profile = await response.json();
    if (profile.ok && profile.status === 'approved' && (profile.classId === classId || profile.teacherPlayer)) {
      try {const x=await fetch(url+'/functions/v1/connect-api',{method:'POST',headers:{apikey:key,authorization:'Bearer '+session.access_token,'content-type':'application/json'},body:JSON.stringify({action:'player-xp',classId})}).then(r=>r.json());if(x.ok)profile.xp=x.xp;}catch{}
      drawIdentity(profile);
    }
    // Aucun accès reconnu au seul motif de connaître le lien de classe.
  } catch { /* Toujours laisser le HUB et les jeux accessibles en mode libre. */ }
}

showCatalog();
showIdentity();
