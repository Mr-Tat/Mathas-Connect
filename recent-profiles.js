// Historique léger et local au navigateur : jamais une preuve d'identité.
const keyFor = classId => 'mathas.connect.recent-profiles.v1:' + classId;
const format = /^([\p{L}][\p{L} '-]{0,39})\.([\p{L}])$/u;
export function listRecentProfiles(classId) {
  if (!classId) return [];
  try {
    const values = JSON.parse(localStorage.getItem(keyFor(classId)) || '[]');
    return Array.isArray(values)
      ? values.filter(v => typeof v === 'string' && format.test(v)).slice(0, 8)
      : [];
  } catch { return []; }
}
export function rememberRecentProfile(classId, displayName) {
  if (!classId) return;
  const found = format.exec(String(displayName || '').trim());
  if (!found) return;
  const name = found[1].trim() + '.' + found[2].toUpperCase();
  const previous = listRecentProfiles(classId).filter(
    v => v.toLocaleLowerCase('fr') !== name.toLocaleLowerCase('fr')
  );
  try { localStorage.setItem(keyFor(classId), JSON.stringify([name, ...previous].slice(0, 8))); }
  catch { /* Stockage désactivé : simple formulaire habituel. */ }
}
