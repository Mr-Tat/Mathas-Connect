// Avant le niveau 3, l'avatar de l'élève est son initiale officielle.
// L'accueil d'inscription ne doit pas conserver ni renvoyer un ancien
// choix animal/couleur fait avant que les récompenses soient déployées.
import {avatarGlyph,avatarColor} from './avatar-catalog.js';
import {officialInitial} from './profile-rewards.mjs';
const cls=new URLSearchParams(location.search).get('class');
const key='mathas.connect.avatar-pending:'+cls;
const preview=document.getElementById('join-avatar-preview');
let picked={kind:'letter',value:'E',color:'transparent'};
function render(){
 if(!preview)return;
 preview.textContent=avatarGlyph(picked);
 preview.style.background=avatarColor(picked.color);
 preview.classList.toggle('avatar-transparent',picked.color==='transparent');
}
export function beginJoinAvatar(name){
 picked={kind:'letter',value:officialInitial(name),color:'transparent'};
 clearJoinAvatarDraft();
 render();
}
export function useApprovedAvatar(avatar){
 if(!avatar||typeof avatar!=='object')return;
 picked={kind:avatar.kind||'letter',value:avatar.value||picked.value,color:avatar.color||'transparent'};
 render();
}
// Ancien flux d'inscription : aucun choix avant le déblocage de niveau.
export function editedJoinAvatar(){return null}
export function clearJoinAvatarDraft(){try{localStorage.removeItem(key)}catch{}}
clearJoinAvatarDraft();
render();
