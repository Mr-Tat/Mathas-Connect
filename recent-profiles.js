// Historique LOCAL par classe et navigateur. Il n'accorde aucun accès Connect.
// Les noms sont seulement des raccourcis : le professeur vérifie et approuve chaque nouvelle demande.
const storageKey = classId => 'mathas.connect.recent-profiles.v1:' + classId;
// Accepte les anciens profils avec un point ET la présentation Prénom I (espace).
const format = /^([\p{L}][\p{L} '-]{0,39})[.\s]+([\p{L}])$/u;
function canonicalName(value) {
  const match = format.exec(String(value || '').trim().normalize('NFC'));
  return match ? match[1].trim() + ' ' + match[2].toLocaleUpperCase('fr') : null;
}
export function listRecentProfiles(classId) {
  if (!classId) return [];
  try {
    const raw = JSON.parse(localStorage.getItem(storageKey(classId)) || '[]');
    if (!Array.isArray(raw)) return [];
    const seen = new Set(), out = [];
    for (const item of raw.slice(0, 20)) {
      const name = canonicalName(item);
      if (!name) continue;
      const id = name.toLocaleLowerCase('fr');
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(name);
      if (out.length === 8) break;
    }
    return out;
  } catch { return []; }
}
export function rememberRecentProfile(classId, displayName) {
  if (!classId) return;
  const name = canonicalName(displayName);
  if (!name) return;
  const previous = listRecentProfiles(classId).filter(
    item => item.toLocaleLowerCase('fr') !== name.toLocaleLowerCase('fr')
  );
  try { localStorage.setItem(storageKey(classId), JSON.stringify([name, ...previous].slice(0, 8))); }
  catch { /* Navigation privée ou stockage bloqué : l'inscription reste disponible. */ }
}

// Avatar mémorisé sur CET appareil, par classe et par nom. Ne donne aucun droit d'accès.
// La fiche officielle Supabase prend le relais une fois la reconnexion autorisée.
const avatarStorageKey=(classId,displayName)=>{
 const name=canonicalName(displayName);
 return classId&&name?'mathas.connect.avatar-known.v1:'+classId+':'+name.toLocaleLowerCase('fr'):null;
};
export function rememberRecentAvatar(classId,displayName,avatar){
 const key=avatarStorageKey(classId,displayName);
 if(!key||!avatar||typeof avatar.kind!=='string'||typeof avatar.value!=='string'||typeof avatar.color!=='string')return;
 try{localStorage.setItem(key,JSON.stringify({kind:avatar.kind,value:avatar.value,color:avatar.color}))}catch{}
}
export function loadRecentAvatar(classId,displayName){
 const key=avatarStorageKey(classId,displayName);
 if(!key)return null;
 try{
  const a=JSON.parse(localStorage.getItem(key)||'null');
  return a&&typeof a.kind==='string'&&typeof a.value==='string'&&typeof a.color==='string'?a:null;
 }catch{return null}
}
