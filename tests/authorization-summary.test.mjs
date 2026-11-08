import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {summarizeSavedAuthorizations} from '../authorization-summary.mjs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const student='eleve-b',multipliers=[{scope_key:'class',multipliers:[5,2]}],aids=[{scope_key:'class',allowed:false}];
test('autorisation enregistrée pour la classe',()=>{
 assert.equal(summarizeSavedAuthorizations({multipliers,aids}),
  '2, 5 obligatoires · Tables interdites · Classe');
});
test('élève sans exception : les deux réglages viennent de la classe',()=>{
 assert.equal(summarizeSavedAuthorizations({multipliers,aids,studentId:student}),
  '2, 5 obligatoires · Tables interdites · Hérité de la classe');
});
test('sources indépendantes en cas de dérogation partielle',()=>{
 assert.equal(summarizeSavedAuthorizations({
  multipliers:[...multipliers,{scope_key:student,multipliers:[3,7]}],aids,studentId:student
 }), '3, 7 obligatoires · Tables interdites · Mult. élève / Tables classe');
 assert.equal(summarizeSavedAuthorizations({
  multipliers,aids:[...aids,{scope_key:student,allowed:true}],studentId:student
 }), '2, 5 obligatoires · Tables autorisées · Mult. classe / Tables élève');
});
test('élève avec exception complète et valeurs par défaut',()=>{
 assert.equal(summarizeSavedAuthorizations({
  multipliers:[...multipliers,{scope_key:student,multipliers:[8]}],
  aids:[...aids,{scope_key:student,allowed:true}],studentId:student
 }), '8 obligatoires · Tables autorisées · Propre à l’élève');
 assert.equal(summarizeSavedAuthorizations({studentId:student}),
  'Aucun multiplicateur imposé · Tables autorisées · Par défaut');
});
test('interface : ne résumer que la relecture serveur et masquer les erreurs',()=>{
 const html=read('index.html'),app=read('app.js'),css=read('style.css');
 assert.match(html,/id="auth-saved-summary"[^>]*aria-live="polite" hidden/);
 assert.match(app,/const confirmed=await loadAuthorizations/);
 assert.match(app,/authSettingsLoaded=true/);
 assert.match(app,/saved\.textContent='✓ Enregistré : '\+summarizeSavedAuthorizations/);
 assert.match(app,/authSettingsLoaded=false;\s*\$\('auth-saved-summary'\)\.hidden=true/);
 assert.match(css,/\.authorization-saved-summary\[hidden\]\{display:none!important\}/);
 assert.match(html,/app\.js\?v=20261109-auth-summary-v1/);
});
