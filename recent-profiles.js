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
