// Récompenses de personnalisation du HUB. La validation d'accès reste
// exclusivement côté connect-api : ce module pilote seulement l'affichage.
export const PROFILE_REWARDS=Object.freeze([
 {level:3,key:'animal',icon:'🐾',label:'Choisir un animal'},
 {level:6,key:'color',icon:'🎨',label:'Choisir une couleur de fond'},
 {level:10,key:'alias',icon:'✏️',label:'Choisir un pseudo'},
 {level:15,key:'object',icon:'⚽',label:'Choisir un objet'},
 {level:20,key:'smiley',icon:'😀',label:'Choisir un smiley'}
]);
export const AVATAR_LEVELS=Object.freeze({letter:1,animal:3,object:15,smiley:20});
export function officialInitial(displayName){
 const initial=String(displayName||'').trim().charAt(0).toLocaleUpperCase('fr');
 return /^\p{Lu}$/u.test(initial)?initial:'E';
}
export function unlockedProfileLevel(profile){
 const current=Number(profile?.xp?.level);
 const highest=Number(profile?.unlockLevel);
 return Math.max(1,Number.isSafeInteger(current)?current:1,Number.isSafeInteger(highest)?highest:1);
}
export function avatarKindUnlocked(kind,level){
 return Number(level)>=AVATAR_LEVELS[kind];
}
export function colorUnlocked(level){return Number(level)>=6}
export function aliasUnlocked(level){return Number(level)>=10}
