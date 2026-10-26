import {avatarCategories,avatarGlyph,avatarColors,avatarColor} from './avatar-catalog.js';
const cls=new URLSearchParams(location.search).get('class');
const key='mathas.connect.avatar-pending:'+cls;
let picked={kind:'animal',value:'fox',color:'ocean'};
try{const stored=JSON.parse(localStorage.getItem(key)||'null');if(stored&&['animal','letter'].includes(stored.kind)&&avatarColors[stored.color])picked=stored}catch{}
const $=id=>document.getElementById(id);
function draw(){
 const grid=$('join-avatar-choices'),palette=$('join-avatar-colors');
 if(!grid||!palette)return;grid.replaceChildren();palette.replaceChildren();
 let tabs=document.getElementById('join-avatar-tabs');if(!tabs){tabs=document.createElement('div');tabs.id='join-avatar-tabs';tabs.className='avatar-tabs';grid.before(tabs)}tabs.replaceChildren();
 for(const category of avatarCategories){const tab=document.createElement('button');tab.type='button';tab.textContent=category.label;tab.className=picked.kind===category.kind?'selected':'';tab.onclick=()=>{picked.kind=category.kind;picked.value=Object.keys(category.icons)[0];draw()};tabs.append(tab)}
 for(const [value,glyph] of Object.entries(avatarCategories.find(x=>x.kind===picked.kind)?.icons||{})){
  const kind=picked.kind,b=document.createElement('button');
  b.type='button';b.textContent=glyph;b.title=value;b.className=picked.kind===kind&&picked.value===value?'selected':'';
  b.onclick=()=>{picked.kind=kind;picked.value=value;draw()};grid.append(b);
 }
 for(const [color,hex] of Object.entries(avatarColors)){
  const b=document.createElement('button');b.type='button';b.style.backgroundColor=hex;
  b.setAttribute('aria-label',color);b.className=picked.color===color?'selected':'';
  b.onclick=()=>{picked.color=color;draw()};palette.append(b);
 }
 $('join-avatar-preview').style.backgroundColor=avatarColor(picked.color);
 $('join-avatar-preview').textContent=avatarGlyph(picked);
 try{localStorage.setItem(key,JSON.stringify(picked))}catch{}
}
draw();
$('join-form')?.addEventListener('submit',()=>{try{localStorage.setItem(key,JSON.stringify(picked))}catch{}},true);
export function pendingAvatarKey(){return key}
