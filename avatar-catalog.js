// Catalogue partagé entre inscription, choix du profil et HUB. Aucun asset ni appel réseau.
export const avatarAnimals={
 fox:'🦊',cat:'🐱',dog:'🐶',panda:'🐼',frog:'🐸',lion:'🦁',penguin:'🐧',owl:'🦉',rabbit:'🐰',bear:'🐻',
 koala:'🐨',wolf:'🐺',tiger:'🐯',hedgehog:'🦔',squirrel:'🐿️',dolphin:'🐬',turtle:'🐢',parrot:'🦜',butterfly:'🦋',dragon:'🐲'
};
// Compatibilité des anciens avatars : affichables, mais plus proposés.
export const avatarOlderAnimals={
 monkey:'🐵',elephant:'🐘',giraffe:'🦒',zebra:'🦓',horse:'🐴',cow:'🐮',pig:'🐷',sheep:'🐑',
 deer:'🦌',otter:'🦦',whale:'🐳',octopus:'🐙',seal:'🦭',duck:'🦆',flamingo:'🦩',bee:'🐝'
};
export const avatarObjects={
 soccer:'⚽',basketball:'🏀',tennis:'🎾',volleyball:'🏐',bicycle:'🚲',airplane:'✈️',rocket:'🚀',
 car:'🚗',train:'🚂',skateboard:'🛹',guitar:'🎸',microphone:'🎤',headphones:'🎧',
 controller:'🎮',paint:'🎨',books:'📚',camera:'📷',star:'⭐',trophy:'🏆',music:'🎵'
};
export const avatarSmileys={
 smile:'😀',cool:'😎',starstruck:'🤩',grin:'😁',angel:'😇',party:'🥳',cowboy:'🤠',catface:'😺',
 heartcat:'😻',ghost:'👻',robot:'🤖',alien:'👾',laughing:'😄',happy:'😊',wink:'😉',hug:'🤗'
};
export const avatarColors={
 ocean:'#2563a5',sky:'#247cb5',indigo:'#5444b7',violet:'#8147bb',plum:'#963d86',rose:'#ac4568',
 coral:'#bc5948',sun:'#b47b27',amber:'#946122',mint:'#238c81',forest:'#297246',slate:'#4b657d'
};
export const avatarCategories=[
 {kind:'animal',label:'🐾 Animaux',icons:avatarAnimals},
 {kind:'object',label:'⚽ Objets',icons:avatarObjects},
 {kind:'smiley',label:'😀 Smileys',icons:avatarSmileys},
 {kind:'letter',label:'🔤 Lettres',icons:Object.fromEntries([...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'].map(x=>[x,x]))}
];
export function avatarGlyph(avatar){
 const v=String(avatar?.value??''),kind=avatar?.kind;
 const lookup={...avatarAnimals,...avatarOlderAnimals,...avatarObjects,...avatarSmileys};
 // Priorité aux identifiants connus même si une ancienne fiche a un type incohérent.
 if(kind==='letter'&&/^[A-Z]$/.test(v))return v;
 if(kind==='animal'||kind==='object'||kind==='smiley')return lookup[v]||'🙂';
 return lookup[v]||(/^[A-Z]$/.test(v)?v:'🙂');
}
export function avatarColor(value){return avatarColors[value]||avatarColors.ocean}
