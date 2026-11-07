// Badge d'avatar Math'as Connect : une seule interprétation du choix de profil
// dans les jeux. Ne lit jamais le stockage d'un autre élève et n'écrit aucun XP.
import {avatarGlyph,avatarColor} from '../../avatar-catalog.js';

const kinds=new Set(['letter','animal','object','smiley']);
export function initialsForAvatar(name){
 const first=Array.from(String(name||'').trim())[0]||'É';
 return /^\p{L}$/u.test(first)?first.toLocaleUpperCase('fr-BE'):'É';
}
export function avatarAppearance(avatar,name){
 const kind=kinds.has(avatar?.kind)?avatar.kind:'letter';
 const raw=String(avatar?.value??'');
 const value=kind==='letter'&&(!/^\p{Lu}$/u.test(raw)||raw.length>2)
  ?initialsForAvatar(name):kind==='letter'?raw:raw;
 const source=kind==='letter'?{kind,value}:{kind,value};
 const glyph=avatarGlyph(source);
 return {glyph,background:avatarColor(avatar?.color)};
}
export function paintConnectedAvatar(node,avatar,displayName){
 if(!node)return null;
 const appearance=avatarAppearance(avatar,displayName);
 node.classList.add('mathas-connect-avatar');
 node.setAttribute('aria-hidden','true');
 node.textContent=appearance.glyph;
 // All paints are validated against the fixed catalog; no arbitrary image URL.
 Object.assign(node.style,{
  display:'inline-grid',placeItems:'center',boxSizing:'border-box',
  width:'26px',height:'26px',minWidth:'26px',minHeight:'26px',
  flex:'0 0 26px',borderRadius:'50%',border:'1px solid rgba(164,205,228,.85)',
  backgroundColor:appearance.background,color:'#fff',
  font:'800 18px/1 system-ui,sans-serif',verticalAlign:'middle',
  textAlign:'center',boxShadow:'0 1px 4px rgba(0,0,0,.28)'
 });
 return node;
}
export function createConnectedAvatar(doc,avatar,displayName){
 return paintConnectedAvatar(doc.createElement('span'),avatar,displayName);
}
