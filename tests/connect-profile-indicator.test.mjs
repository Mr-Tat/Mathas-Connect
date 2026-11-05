import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('Additions : le profil natif affiche le point vert puis le nom, sans le mot Connecté',()=>{
 const native=source('apps/objective-record/native-hub-link.js');
 const host=source('apps/objective-record/eleve.html');
 assert.match(native,/<span class="connect-presence" aria-hidden="true">●<\/span><strong class="connect-person">/);
 assert.match(native,/\.connect-presence\{color:#70e3ae!important/);
 assert.match(host,/<span id="connected-dot">●<\/span><strong id="connected-name">/);
 assert.match(host,/#connected-dot\{color:#79e3b2/);
 assert.doesNotMatch(native,/<span class="connect-presence"[^>]*>●<\/span>Connecté/);
});

for(const [app,slug] of [['Multiplication','multiplication'],['Soustraction','soustraction']]){
 test(app+' : identité = rond vert + nom, niveau et XP indépendants',()=>{
  const code=source('apps/'+slug+'-simple/index.html');
  const prefix=slug==='multiplication'?'multi':'sous';
  assert.match(code,new RegExp('\\.mathas-'+prefix+'-connect-identity::before\\{content:\\x27●\\x27;color:#70e3ae'));
  assert.match(code,/#ce-identity::before\{content:"●";color:#70e3ae/);
  assert.match(code,/statusLabel\.textContent=studentName\|\|'Compte élève';/);
  assert.match(code,new RegExp("getElementById\\('mathas-"+prefix+"-connect-identity'\\)\\.textContent="));
  assert.doesNotMatch(code,/statusLabel\.textContent='● Connecté/);
  assert.match(code,new RegExp("getElementById\\('mathas-"+prefix+"-connect-level'\\)"));
  assert.match(code,new RegExp("getElementById\\('mathas-"+prefix+"-connect-count'\\)"));
 });
}
