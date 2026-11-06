import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {objectiveRecordLabPreviews} from '../objective-record-lab-previews.mjs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('six démos Pages distinctes, sans app_key ni attribut d’XP Connect',()=>{
  assert.equal(objectiveRecordLabPreviews.length,6);
  assert.equal(new Set(objectiveRecordLabPreviews.map(p=>p.id)).size,6);
  assert.equal(new Set(objectiveRecordLabPreviews.map(p=>p.url)).size,6);
  const expected=new Map([
    ['abaque-longueurs','/Mathas-Connect/apps/GRAN-abaque-m-1/'],
    ['addition-simple','/CE-Addition-simple/essai-mode-score-3-vies.html'],
    ['addition-multiple','/addition-ecrite-multiple/essai-objectif-record-3-vies.html'],
    ['soustraction','/soustraction-ecrite/essai-objectif-record-3-vies.html'],
    ['multiplication','/Multiplication-simple/essai-objectif-record-3-vies.html'],
    ['melange','/Melange-calculs-ecrits-1/essai-objectif-record-3-vies.html'],
  ]);
  const expectedTitles=new Map([
    ['abaque-longueurs','Abaque des longueurs'],
    ['addition-simple','Addition simple'],
    ['addition-multiple','Addition multiple'],
    ['soustraction','Soustraction écrite'],
    ['multiplication','Multiplication simple'],
    ['melange','Mélange de calculs écrits'],
  ]);
  for(const preview of objectiveRecordLabPreviews){
    assert.deepEqual(Object.keys(preview).sort(),['id','title','url']);
    const url=new URL(preview.url);
    assert.equal(url.protocol,'https:');
    assert.equal(url.hostname,'mr-tat.github.io');
    assert.equal(url.pathname,expected.get(preview.id));
    assert.equal(preview.title,expectedTitles.get(preview.id));
  }
  assert.equal(expected.size,objectiveRecordLabPreviews.length);
});

test('les démonstrations archivées ne sont plus affichées dans les HUB',()=>{
 const hub=read('hub.js'),home=read('hub.html'),catalogue=read('hub-catalog.json');
 assert.doesNotMatch(hub,/labPreviewSection|objectiveRecordLabPreviews|previewCard/);
 assert.doesNotMatch(hub,/node\.dataset\.labPreview/);
 assert.match(hub,/startsWith\('lab-record-'\)/);
 assert.doesNotMatch(home,/essai-objectif-record|essai-mode-score-3-vies/);
 assert.doesNotMatch(catalogue,/essai-objectif-record|essai-mode-score-3-vies/);
});

test('le Laboratoire ne propose plus de liens vers les anciennes versions',()=>{
 const lab=read('laboratoire.js'),html=read('laboratoire.html');
 assert.doesNotMatch(lab,/objectiveRecordLabPreviews|renderObjectiveRecordPreviews/);
 assert.doesNotMatch(html,/id="record-previews"|Tester la démo/);
 assert.match(html,/id="lab" hidden/);
 assert.match(html,/Ouvrir Tests dans le HUB Toutes/);
});

test('le guide explique l’essai sans XP, puis le pilote Connect authentifié',()=>{
  const guide=read('docs/integrations/README.md');
  assert.match(guide,/court sas de recette authentifiée du même candidat/);
  assert.match(guide,/Démonstration visuelle ou de moteur, isolée/);
  assert.match(guide,/Pilote authentifié Connect/);
  assert.match(guide,/les URL GitHub Pages|Les URL GitHub Pages/);
  assert.match(guide,/classe TEST/);
});

test('Edge TEST ne réinjecte plus de démonstrations et ne modifie pas les classes',()=>{
 const edge=read('supabase/functions/connect-lab-catalog/index.ts'),hub=read('hub.js');
 assert.match(edge,/if\(query\.get\('class'\)!==TEST_CLASS\)return fail\('invalid_test_class',403\)/);
 assert.match(edge,/return respond\(\{ok:true,apps:await catalogue\(false\)\}\)/);
 assert.doesNotMatch(edge,/objectiveRecordDemoCards|app_key:'lab-record-'/);
 assert.match(edge,/\.from\('connect_hub_preset_entries'\)\.select\(/);
 assert.doesNotMatch(edge,/\.from\('connect_hub_preset_entries'\)\.(?:update|upsert|insert|delete)\(/);
 assert.doesNotMatch(edge,/\.from\('connect_xp_credits'\)/);
 assert.match(hub,/startsWith\('lab-record-'\)/);
});

test('le LAB et le HUB TEST ouvrent la multiplication V7 certifiée; les autres jeux gardent leur lanceur commun',()=>{
 const hub=read('hub.js'),lab=read('laboratoire.js');
 const release=read('apps/objective-record/release-routing.mjs');
 const home=read('hub.html'),catalog=read('hub-catalog.json');
 assert.match(hub,/testMultiplication=classId===LAB_CLASS&&app\.app_key==='multiplication-ecrite-simple'/);
 assert.match(hub,/testSlug=classId===LAB_CLASS&&!testMultiplication\?recordSlugByApp\[app\.app_key\]:null/);
 assert.match(hub,/testMultiplication\?'\.\/apps\/multiplication-simple\/'/);
 assert.match(hub,/if\(testMultiplication && target\.origin===location\.origin\)target\.searchParams\.set\('requireConnect','1'\)/);
 assert.match(hub,/if\(testSlug&&!allMode\)node\.dataset\.labSchool=testSlug/);
 assert.match(hub,/SCHOOL_RECORD_LAUNCHER\+'\?app='\+encodeURIComponent\(testSlug\)/);
 assert.doesNotMatch(hub,/essais\/objectif-record-pilote\.html/);
 assert.match(lab,/testSlug=recordSlugByApp\[app\.app_key\]/);
 assert.match(lab,/const href=app\.app_key==='multiplication-ecrite-simple'\?'\.\/apps\/multiplication-simple\/'/);
 assert.match(lab,/testSlug\?SCHOOL_RECORD_LAUNCHER\+'\?app='/);
 assert.match(lab,/if\(app\.app_key==='multiplication-ecrite-simple'\)url\.searchParams\.set\('requireConnect','1'\)/);
 assert.match(lab,/labCatalog\('set',\{appKey:app\.app_key,visible:wanted\}\)/);
 assert.match(lab,/student\.href=linkFor\(app\)/);
 assert.match(lab,/const href=linkFor\(app,true\)/);
 assert.doesNotMatch(lab,/Hôte élève · XP officiels \(lecture seule\)/);
 assert.doesNotMatch(lab,/candidateTeacher/);
 for(const slug of ['addition-simple','addition-multiple','soustraction','multiplication','melange'])
   assert.ok(release.includes("'"+slug+"'"),slug+' shared mapping');
 assert.doesNotMatch(catalog,/objectif-record-pilote/);
 assert.doesNotMatch(home,/objectif-record-pilote/);
});
