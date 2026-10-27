import {avatarCategories,avatarGlyph,avatarColors,avatarColor,avatarOlderAnimals} from './avatar-catalog.js';
import {loadRecentAvatar} from './recent-profiles.js?v=20261027avatars2';
const cls=new URLSearchParams(location.search).get('class');
const key='mathas.connect.avatar-pending:'+cls;
const initial={kind:'animal',value:'fox',color:'ocean'};
const $=id=>document.getElementById(id);
function validAvatar(value){
 if(!value||typeof value!=='object'||!Object.hasOwn(avatarColors,value.color))return false;
 if(value.kind==='animal'&&Object.hasOwn(avatarOlderAnimals,value.value))return true;
 return avatarCategories.some(category=>category.kind===value.kind&&Object.hasOwn(category.icons,value.value));
}
let picked={...initial},edited=false;
try{
 const saved=JSON.parse(localStorage.getItem(key)||'null');
 // Une ancienne sélection créée automatiquement n'est PAS un choix de l'élève.
 if(saved?.edited===true&&validAvatar(saved)){
  picked={kind:saved.kind,value:saved.value,color:saved.color};edited=true;
 }
}catch{}
function draw(){
 const grid=$('join-avatar-choices'),palette=$('join-avatar-colors');
 if(!grid||!palette)return;
 grid.replaceChildren();palette.replaceChildren();
 let tabs=$('join-avatar-tabs');
 if(!tabs){tabs=document.createElement('div');tabs.id='join-avatar-tabs';tabs.className='avatar-tabs';grid.before(tabs)}
 tabs.replaceChildren();
 function choose(kind,value,color){
  picked={kind,value,color};edited=true;
  try{localStorage.setItem(key,JSON.stringify({...picked,edited:true}))}catch{}
  draw();
 }
 for(const category of avatarCategories){
  const tab=document.createElement('button');
  tab.type='button';tab.textContent=category.label;tab.className=picked.kind===category.kind?'selected':'';
  tab.onclick=()=>choose(category.kind,Object.keys(category.icons)[0],picked.color);
  tabs.append(tab);
 }
 const entries=Object.entries(avatarCategories.find(x=>x.kind===picked.kind)?.icons||{});
 // Ancien avatar non proposé aujourd'hui : le montrer tout de même comme choix actif.
 if(picked.kind==='animal'&&Object.hasOwn(avatarOlderAnimals,picked.value))
  entries.unshift([picked.value,avatarOlderAnimals[picked.value]]);
 for(const [value,glyph] of entries){
  const b=document.createElement('button');
  b.type='button';b.textContent=glyph;b.title=value;b.setAttribute('aria-label','Avatar : '+value);
  b.className=picked.value===value?'selected':'';
  b.onclick=()=>choose(picked.kind,value,picked.color);
  grid.append(b);
 }
 for(const [color,hex] of Object.entries(avatarColors)){
  const b=document.createElement('button');
  b.type='button';b.style.backgroundColor=hex;b.setAttribute('aria-label','Couleur '+color);
  b.className=picked.color===color?'selected':'';
  b.onclick=()=>choose(picked.kind,picked.value,color);
  palette.append(b);
 }
 $('join-avatar-preview').style.backgroundColor=avatarColor(picked.color);
 $('join-avatar-preview').textContent=avatarGlyph(picked);
}
// En cliquant sur un profil déjà connu, préselectionner l'ancien avatar LOCAL.
// Sur un autre PC, l'avatar officiel sera récupéré APRÈS l'accord du professeur.
export function beginJoinAvatar(name){
 edited=false;
 const known=loadRecentAvatar(cls,name);
 picked=validAvatar(known)?{kind:known.kind,value:known.value,color:known.color}:{...initial};
 try{localStorage.removeItem(key)}catch{}
 draw();
}
export function useApprovedAvatar(avatar){
 if(!validAvatar(avatar))return;
 // Ne jamais remplacer une modification déjà faite par l'élève pendant l'attente.
 if(!edited){picked={kind:avatar.kind,value:avatar.value,color:avatar.color};draw()}
}
export function editedJoinAvatar(){return edited?{...picked}:null}
export function clearJoinAvatarDraft(){
 edited=false;
 try{localStorage.removeItem(key)}catch{}
}
draw();
