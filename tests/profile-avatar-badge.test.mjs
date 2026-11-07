import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {avatarAppearance,paintConnectedAvatar} from '../apps/objective-record/profile-avatar-badge.mjs';

const src=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('le badge reprend exclusivement le catalogue officiel, couleur comprise',()=>{
 assert.deepEqual(avatarAppearance({kind:'animal',value:'fox',color:'ocean'},'Élève'),{glyph:'🦊',background:'#2563a5'});
 assert.deepEqual(avatarAppearance({kind:'smiley',value:'party',color:'rose'},'Élève'),{glyph:'🥳',background:'#ac4568'});
 assert.deepEqual(avatarAppearance({kind:'letter',value:'T',color:'transparent'},'Monsieur T'),{glyph:'T',background:'transparent'});
 assert.deepEqual(avatarAppearance(null,'Monsieur T'),{glyph:'M',background:'transparent'});
 assert.deepEqual(avatarAppearance({kind:'letter',value:'',color:'javascript:alert(1)'},'Camille'),{glyph:'C',background:'transparent'});
});
test('le rendu est uniquement un texte sûr, sans HTML ou URL fournie par le compte',()=>{
 const attrs=new Map(),classes=new Set();
 const el={style:{},classList:{add:x=>classes.add(x)},setAttribute:(k,v)=>attrs.set(k,v),textContent:''};
 paintConnectedAvatar(el,{kind:'object',value:'rocket',color:'sky'},'Noé');
 assert.equal(el.textContent,'🚀');
 assert.equal(el.style.backgroundColor,'#247cb5');
 assert.equal(el.style.width,'26px');
 assert.equal(attrs.get('aria-hidden'),'true');
 assert.ok(classes.has('mathas-connect-avatar'));
});
test('six jeux : aucune présence en mode libre, avatar provenant du profil Connect approuvé',()=>{
 const additions=src('apps/objective-record/eleve.mjs');
 assert.match(additions,/paintConnectedAvatar\(\$\('connected-avatar'\),profile\?\.avatar,profile\?\.displayName\)/);
 const native=src('apps/objective-record/native-hub-link.js');
 assert.ok(native.indexOf('connect-presence')<native.indexOf('connect-avatar'));
 assert.ok(native.includes("host.getElementById('connected-avatar')"));
 for(const p of ['apps/multiplication-simple/index.html','apps/soustraction-simple/index.html']){
  const c=src(p);
  assert.ok(c.includes('studentAvatar=profile.avatar??null'));
  assert.ok(c.includes('identity.append(identityAvatar,identityName)'));
  assert.ok(c.includes("paintConnectedAvatar(doc.querySelector("));
  assert.ok(c.includes("if(mode!=='connected')return;"));
 }
 const mix=src('apps/calculs-melanges/official-ui.mjs');
 assert.match(mix,/connected\?\[presence,face,connectedName,connectedMeta\]/);
 assert.match(src('apps/calculs-melanges/connect-host.mjs'),/profile:Object\.freeze\(\{displayName:/);
 const abaque=src('apps/GRAN-abaque-m-1/connect/bootstrap.mjs');
 assert.ok(abaque.includes("const action=params.get('joueur')==='prof'?'teacher-player':'student-me'"));
 assert.ok(abaque.includes("paintConnectedAvatar(face,chosenAvatar"));
 assert.ok(abaque.includes("profile.status!=='approved'"));
});
