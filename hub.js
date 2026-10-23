import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.95.0';
import { classId, classLabel, loginUrl } from './connect-context.js';

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

function drawIdentity(profile) {
  const authorized = profile?.status === 'approved';
  $('identity-title').textContent = authorized ? profile.displayName : 'Mode Classique';
  $('identity-class').textContent = classId ? classLabel : 'HUB de démonstration';
  $('classLabel').textContent = classId ? classLabel : 'Jeux';
  $('identity-action').textContent = authorized ? 'Modifier' : 'Se connecter';
  $('identity-extra').hidden = true;
  $('identity-action').onclick = () => {
    if (authorized) $('identity-extra').hidden = !$('identity-extra').hidden;
    else { setFree(false); location.href = loginUrl(); }
  };
}

function switchToFree() {
  setFree(true);
  drawIdentity(null);
}

$('mode-toggle').onclick = switchToFree;
$('rename-device').onclick = async () => {
 const label=prompt('Nom de cet appareil (par exemple : Chrome FOPA, Chrome Tatouille) :');
 if(label===null)return;
 const name=label.trim();
 if(!name||name.length>40){alert('Choisis un nom de 1 à 40 caractères.');return}
 try{
  const {data:{session}}=await sb.auth.getSession();
  if(!session?.user?.is_anonymous)throw Error('Profil élève non connecté');
  const response=await fetch(url+'/functions/v1/connect-api',{method:'POST',headers:{apikey:key,authorization:'Bearer '+session.access_token,'content-type':'application/json'},body:JSON.stringify({action:'student-device-label',label:name})});
  const out=await response.json();
  if(!response.ok||!out.ok)throw Error(out.error||'Enregistrement impossible');
  alert('Nom enregistré : '+name+'. Le professeur le verra après actualisation.');
 }catch(e){alert('Nom non enregistré : '+e.message)}
};

$('forget-device').onclick = async () => {
  if (!confirm('Retirer l’autorisation de cet ordinateur et oublier le profil ? Les résultats Connect resteront enregistrés. Il faudra une nouvelle autorisation du professeur pour revenir.')) return;
  const btn=$('forget-device');btn.disabled=true;
  try {
    const {data:{session}}=await sb.auth.getSession();
    if(!session?.user?.is_anonymous)throw Error('Session élève introuvable');
    const r=await fetch(url+'/functions/v1/connect-api',{method:'POST',
      headers:{apikey:key,authorization:'Bearer '+session.access_token,'content-type':'application/json'},
      body:JSON.stringify({action:'student-release'})});
    const data=await r.json();
    if(!r.ok||!data.ok||!data.released)throw Error('Révocation impossible');
    const {error}=await sb.auth.signOut({scope:'local'});
    if(error)throw error;
    switchToFree();
    alert('Appareil retiré de Connect. Les résultats sont conservés sur le compte élève.');
  }catch(e){alert('Attention : '+e.message+'. Si la révocation a été acceptée, ferme puis rouvre le HUB.');}
  finally{btn.disabled=false}
};

async function showIdentity() {
  drawIdentity(null);
  if (!classId || inFreeMode()) return;
  try {
    const { data: { session } } = await sb.auth.getSession();
    if (!session?.user?.is_anonymous) return;
    const response = await fetch(url + '/functions/v1/connect-api', {
      method: 'POST',
      headers: { apikey: key, authorization: 'Bearer ' + session.access_token, 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'student-me', classId })
    });
    if (!response.ok) return;
    const profile = await response.json();
    if (profile.ok && profile.status === 'approved' && profile.classId === classId) drawIdentity(profile);
    // Aucun accès reconnu au seul motif de connaître le lien de classe.
  } catch { /* Toujours laisser le HUB et les jeux accessibles en mode libre. */ }
}

showCatalog();
showIdentity();
