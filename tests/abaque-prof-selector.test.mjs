import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const ui=read('index.html');
const js=read('app.js');
const css=read('style.css');

function selectApp(appKey,scope='class'){
 const elements={
  'auth-app':{value:appKey},
  'auth-scope':{value:scope},
  'auth-description':{textContent:''},
  'auth-calculation-settings':{hidden:false},
  'auth-progression-settings':{hidden:true},
  'auth-restart':{disabled:true},
  'abaque-class-gates':{hidden:true},
  'abaque-restart-settings':{hidden:true},
  'auth-scope-wrap':{hidden:false},
  'auth-student-wrap':{hidden:true}
 };
 const from=js.indexOf('function authSwitchView(){');
 const to=js.indexOf('async function loadAuthorizations(',from);
 assert.ok(from>0&&to>from,'La fonction de sélection est isolable');
 const result=runInNewContext('const $=id=>elements[id]; const authTableApps=new Set([\'multiplication-ecrite-simple\',\'melange-calculs-ecrits\']); const authRestartApps=new Set([\'addition-ecrite-simple\',\'addition-ecrite-multiple\',\'multiplication-ecrite-simple\',\'soustraction-ecrite-simple\',\'melange-calculs-ecrits\']);\n'+js.slice(from,to)+'\nauthSwitchView();',{elements});
 return {isAbaque:result,elements};
}

test('Abaque apparaît dans le même menu que les deux autres applications',()=>{
 const selector=ui.match(/<select id="auth-app">([\s\S]*?)<\/select>/)?.[1];
 assert.ok(selector,'Sélecteur d’application');
 for(const [key,name] of [
  ['multiplication-ecrite-simple','Multiplication écrite'],
  ['melange-calculs-ecrits','Calculs écrits mélangés'],
  ['abaque-longueurs','Abaque des longueurs']
 ])assert.ok(selector.includes('<option value="'+key+'">'+name+'</option>'),name);
 assert.equal((ui.match(/id="auth-class"/g)||[]).length,1,'Un seul menu de classe');
 assert.doesNotMatch(ui,/id="abaque-class-gates-class"/,'Ne pas recréer un second menu de classe');
 assert.match(js,/const abaqueModeClass=\$\('auth-class'\)/);
});

test('Abaque : quatre modes exclusifs, sans réglages de multiplication ni profil élève',()=>{
 const abaque=selectApp('abaque-longueurs','student');
 assert.equal(abaque.isAbaque,true);
 assert.equal(abaque.elements['abaque-class-gates'].hidden,false);
 assert.equal(abaque.elements['abaque-restart-settings'].hidden,false);
 assert.equal(abaque.elements['auth-calculation-settings'].hidden,true);
 assert.equal(abaque.elements['auth-scope-wrap'].hidden,true);
 assert.equal(abaque.elements['auth-student-wrap'].hidden,true);
 assert.match(abaque.elements['auth-description'].textContent,/mode de déblocage/);
 const panel=ui.match(/<section class="authorization-options" id="abaque-class-gates"([\s\S]*?)<\/section>/)?.[1];
 assert.ok(panel);
 assert.equal((panel.match(/type="radio"/g)||[]).length,4,'Quatre modes exclusifs');
 for(const mode of ['stage1_only','through_2','all_open','mastery_80'])assert.match(panel,new RegExp('name="abaque-unlock-mode" value="'+mode+'"'));
 assert.match(panel,/id="abaque-class-gates-status" role="status"/);
});

test('Multiplication et Mélange gardent les réglages et le choix élève existants',()=>{
 for(const key of ['multiplication-ecrite-simple','melange-calculs-ecrits']){
  const {isAbaque,elements}=selectApp(key,'student');
  assert.equal(isAbaque,false);
  assert.equal(elements['abaque-class-gates'].hidden,true);
  assert.equal(elements['abaque-restart-settings'].hidden,true);
  assert.equal(elements['auth-calculation-settings'].hidden,false);
  assert.equal(elements['auth-scope-wrap'].hidden,false);
  assert.equal(elements['auth-student-wrap'].hidden,false);
 }
});

test('Changer de classe recharge les droits du bon jeu sans requête de multiplication pour Abaque',()=>{
 const from=js.indexOf('async function loadAuthorizations('),to=js.indexOf("$('auth-class').onchange=",from);
 assert.ok(from>=0&&to>from);
 const loader=js.slice(from,to);
 assert.match(loader,/if\(authSwitchView\(\)\)\{void abaqueModeLoad\(\);return false;\}/);
 assert.ok(loader.indexOf('if(authSwitchView())')<loader.indexOf("teacher-multipliers-get"));
 assert.match(js,/\$\('auth-class'\)\.onchange=\(\)=>void loadAuthorizations\(\)/);
 assert.match(js,/\$\('auth-app'\)\.onchange=\(\)=>void loadAuthorizations\(\)/);
 assert.match(js,/if\(selected==='authorizations'\)void loadAuthorizations\(\)/);
 assert.match(js,/abaqueModeRequest\('teacher-mode-get',classId\)/);
 assert.match(js,/abaqueModeRequest\('teacher-mode-set',classId,\{mode\}\)/);
 assert.match(js,/if\(sequence!==abaqueModeSequence\|\|abaqueModeClass.value!==classId/);
 assert.doesNotMatch(js,/abaqueModeClass.onchange=/,'Pas deux chargements sur changement de classe');
});

test('Masquage CSS et versionnement empêchent les anciens panneaux de rester visibles',()=>{
 for(const id of ['auth-calculation-settings','abaque-class-gates','auth-scope-wrap']){
  assert.ok(css.includes('#'+id+'[hidden]'));
 }
 assert.match(ui,/style\.css\?v=20261126-abaque-progression-v2/);
 assert.match(ui,/app\.js\?v=20261126-abaque-progression-v2/);
});

test('Les cinq applications de calcul ont un contrôle de nouvelle progression indépendant des résultats',()=>{for(const key of ['addition-ecrite-simple','addition-ecrite-multiple','soustraction-ecrite-simple','multiplication-ecrite-simple','melange-calculs-ecrits']){const {elements}=selectApp(key,'student');assert.equal(elements['auth-progression-settings'].hidden,false);assert.equal(elements['auth-restart'].disabled,true);assert.equal(elements['auth-calculation-settings'].hidden,!['multiplication-ecrite-simple','melange-calculs-ecrits'].includes(key));}assert.match(js,/repeatXp:xp.checked,appKey,classId/);assert.match(js,/className:\$\('auth-class'\).selectedOptions/);assert.match(js,/\$\('results-class-restart'\).hidden=true/);assert.match(css,/#auth-progression-settings\[hidden\]/);});

test('Nouvelle progression Abaque : sélection indépendante des droits de classe, confirmation et roster figé',()=>{
 assert.match(ui,/id="abaque-restart-settings" hidden/);assert.match(ui,/id="abaque-restart-open"/);
 assert.match(js,/abaqueTeacherRequest\('teacher-summary',classId\)/);assert.match(js,/\['Activité 3 uniquement','activity3'\]/);assert.match(js,/\['Application entière','all'\]/);
 assert.match(js,/check.value.trim\(\)!==name/);assert.match(js,/confirmed:true,scope:selectedScope,part:selectedPart,students:targets.map/);
 assert.match(js,/result.count!==targets.length\|\|result.part!==selectedPart/);assert.match(js,/seq!==authLoadSequence/);
 assert.match(css,/#abaque-restart-settings\[hidden\]/);
});
