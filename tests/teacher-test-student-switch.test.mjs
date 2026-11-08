import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const html=read('index.html'),js=read('app.js'),css=read('style.css');

test('En-tête : Élève A précède Monsieur T et reste visuellement secondaire',()=>{
 const header=html.match(/<div class="teacher-header-actions">([\s\S]*?)<\/div>/)?.[1];
 assert.ok(header,'Groupe des connexions absent');
 assert.ok(header.indexOf('id="teacher-student-connect"')<header.indexOf('id="teacher-player-connect"'));
 assert.ok(header.indexOf('id="teacher-player-connect"')<header.indexOf('id="logout"'));
 assert.match(header,/Se connecter avec Élève A/);
 assert.match(css,/\.teacher-test-student-link\{[\s\S]*?min-height:36px/);
 assert.match(css,/\.teacher-test-student-link\[hidden\]\{display:none!important\}/);
 assert.match(css,/grid-column: 2;/);
});

test('Choix joueur : deux boutons sans joueur, sinon afficher l’autre profil',()=>{
 assert.match(js,/if\(btn\)btn.hidden=teacherPlayerActive/);
 assert.match(js,/if\(studentBtn\)studentBtn.hidden=testStudentASelected&&!teacherPlayerActive/);
 assert.match(js,/localStorage\.removeItem\(teacherPlayerKey\(owner\.id\)\)/);
 assert.match(js,/localStorage\.removeItem\(testStudentModeKey\(owner\.id\)\)/);
 assert.match(js,/teacherPlayerActive=true;testStudentASelected=false/);
});

test('Élève A : véritable session anonyme approuvée pour la classe TEST uniquement',()=>{
 assert.match(js,/function getTestStudentClient\(\)/);
 assert.match(js,/persistSession:true,autoRefreshToken:true,detectSessionInUrl:false/);
 assert.match(js,/if\(error\|\|!session\?\.access_token\|\|!session\.user\?\.is_anonymous\)return false/);
 assert.match(js,/action:'student-me',classId:labTestClass/);
 assert.match(js,/profile\.status==='approved'&&profile\.classId===labTestClass/);
 assert.match(js,/normalizedProfileName\(profile\.displayName\)==='elevea'/);
 assert.match(js,/testStudentADestination\(approved\)/);
 assert.match(js,/target\.searchParams\.set\('toutes','1'\)/);
 assert.match(js,/target\.searchParams\.set\('testFirst','Eleve'\)/);
 assert.match(js,/target\.searchParams\.set\('testInitial','A'\)/);
 assert.match(js,/target\.searchParams\.set\('toutesReturn','1'\)/);
 assert.doesNotMatch(js,/signInWithPassword\(\{email:'Eleve/);
 const syntax=spawnSync(process.execPath,['--check','--input-type=module'],{input:js,encoding:'utf8'});
 assert.equal(syntax.status,0,syntax.stderr);
});
