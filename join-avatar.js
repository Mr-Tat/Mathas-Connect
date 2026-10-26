const animals={fox:'🦊',panda:'🐼',frog:'🐸',lion:'🦁',penguin:'🐧',owl:'🦉',cat:'🐱',dog:'🐶',rabbit:'🐰',bear:'🐻',koala:'🐨',wolf:'🐺',tiger:'🐯',monkey:'🐵',elephant:'🐘',giraffe:'🦒',zebra:'🦓',horse:'🐴',cow:'🐮',pig:'🐷',sheep:'🐑',deer:'🦌',hedgehog:'🦔',squirrel:'🐿️',otter:'🦦',dolphin:'🐬',whale:'🐳',octopus:'🐙',turtle:'🐢',seal:'🦭',duck:'🦆',parrot:'🦜',flamingo:'🦩',bee:'🐝',butterfly:'🦋',dragon:'🐲'};
const colors={ocean:'#2563a5',sky:'#247cb5',indigo:'#5444b7',violet:'#8147bb',plum:'#963d86',rose:'#ac4568',coral:'#bc5948',sun:'#b47b27',amber:'#946122',mint:'#238c81',forest:'#297246',slate:'#4b657d'};
const cls=new URLSearchParams(location.search).get('class');
const key='mathas.connect.avatar-pending:'+cls;
let picked={kind:'animal',value:'fox',color:'ocean'};
try{const stored=JSON.parse(localStorage.getItem(key)||'null');if(stored&&['animal','letter'].includes(stored.kind)&&colors[stored.color])picked=stored}catch{}
const $=id=>document.getElementById(id);
function draw(){
 const grid=$('join-avatar-choices'),palette=$('join-avatar-colors');
 if(!grid||!palette)return;grid.replaceChildren();palette.replaceChildren();
 for(const [value,glyph] of [...Object.entries(animals),...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(v=>[v,v])]){
  const kind=value.length===1?'letter':'animal',b=document.createElement('button');
  b.type='button';b.textContent=glyph;b.title=value;b.className=picked.kind===kind&&picked.value===value?'selected':'';
  b.onclick=()=>{picked.kind=kind;picked.value=value;draw()};grid.append(b);
 }
 for(const [color,hex] of Object.entries(colors)){
  const b=document.createElement('button');b.type='button';b.style.backgroundColor=hex;
  b.setAttribute('aria-label',color);b.className=picked.color===color?'selected':'';
  b.onclick=()=>{picked.color=color;draw()};palette.append(b);
 }
 $('join-avatar-preview').style.backgroundColor=colors[picked.color];
 $('join-avatar-preview').textContent=picked.kind==='animal'?animals[picked.value]:picked.value;
 try{localStorage.setItem(key,JSON.stringify(picked))}catch{}
}
draw();
$('join-form')?.addEventListener('submit',()=>{try{localStorage.setItem(key,JSON.stringify(picked))}catch{}},true);
export function pendingAvatarKey(){return key}
