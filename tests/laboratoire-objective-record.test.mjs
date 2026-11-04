import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {objectiveRecordLabPreviews} from '../objective-record-lab-previews.mjs';
import {legacyEdgePreviews} from './fixtures/laboratoire-edge-previews.mjs';

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

test('les essais n’apparaissent que dans le HUB de la classe TEST',()=>{
  const hub=read('hub.js'),home=read('hub.html'),catalogue=read('hub-catalog.json');
  assert.match(hub,/import \{objectiveRecordLabPreviews\} from '\.\/objective-record-lab-previews\.mjs'/);
  assert.match(hub,/const LAB_CLASS='4bf3400d-a315-4ea4-a2f3-afaca24dc9b9'/);
  assert.match(hub,/if\(classId===LAB_CLASS\)groups\.unshift\(labPreviewSection\(\)\)/);
  assert.match(hub,/if\(classId===LAB_CLASS\)\$\('levels'\)\.replaceChildren\(labPreviewSection\(\)\)/);
  assert.match(hub,/if\(classId===LAB_CLASS\)\{/);
  assert.match(hub,/connect-lab-catalog/);
  assert.match(hub,/test_catalog_unavailable/);
  assert.match(hub,/Essai isolé · XP fictifs · aucun résultat Connect/);
  assert.match(hub,/node\.dataset\.labPreview = preview\.id/);
  assert.doesNotMatch(hub,/node\.dataset\.appKey\s*=\s*preview\.id/);
  assert.doesNotMatch(catalogue,/essai-objectif-record|essai-mode-score-3-vies/);
  assert.doesNotMatch(home,/essai-objectif-record|essai-mode-score-3-vies/);
});

test('le laboratoire professeur affiche les mêmes démos après contrôle et consentement',()=>{
  const lab=read('laboratoire.js'),html=read('laboratoire.html');
  assert.match(lab,/import \{objectiveRecordLabPreviews\} from '\.\/objective-record-lab-previews\.mjs'/);
  assert.match(lab,/const TEST_CLASS='4bf3400d-a315-4ea4-a2f3-afaca24dc9b9'/);
  assert.match(lab,/renderObjectiveRecordPreviews\(\);\s*await loadClass\(scoped\)/);
  assert.match(lab,/if\(!verified\|\|!consent\(\)\)\{/);
  assert.match(lab,/event\.preventDefault\(\)/);
  assert.match(lab,/open\.href=preview\.url/);
  assert.match(html,/id="record-previews"/);
  assert.match(html,/XP ni sauvegarde de résultat Connect/);
  assert.match(html,/id="lab" hidden/);
  assert.doesNotMatch(lab,/objectiveRecordLabPreviews[^;]*\.forEach\([^)]*rpc\(/);
});

test('le guide explique l’essai sans XP, puis le pilote Connect authentifié',()=>{
  const guide=read('docs/integrations/README.md');
  assert.match(guide,/Concevoir une seule version finale/);
  assert.match(guide,/Démonstration visuelle ou de moteur, isolée/);
  assert.match(guide,/Pilote authentifié Connect/);
  assert.match(guide,/les URL GitHub Pages|Les URL GitHub Pages/);
  assert.match(guide,/classe TEST/);
});

test('secours Edge limité au GET de la classe TEST, sans fausse activation Connect',()=>{
  const edge=read('supabase/functions/connect-lab-catalog/index.ts');
  const hub=read('hub.js');
  assert.match(edge,/if\(query\.get\('class'\)!==TEST_CLASS\)return fail\('invalid_test_class',403\)/);
  assert.match(edge,/apps:\[\.\.\.await catalogue\(false\),\.\.\.objectiveRecordDemoCards\]/);
  assert.match(edge,/if\(body\.action==='list'\)return respond\(\{ok:true,apps:await catalogue\(true\)\}\)/);
  assert.match(edge,/app_key:'lab-record-'\+id/);
  assert.match(edge,/enabled:true,\s*visible:true,\s*featured:false/);
  assert.match(edge,/Objectif record \(XP fictifs\)/);
  // Preserve the deployed Edge contract without requiring any new deployment.
  assert.equal(legacyEdgePreviews.length,5);
  for(const p of legacyEdgePreviews){
    assert.ok(edge.includes(p.url),p.id);
    assert.equal(objectiveRecordLabPreviews.find(preview=>preview.id===p.id)?.url,p.url);
  }
  assert.equal(edge.includes('https://mr-tat.github.io/Mathas-Connect/apps/GRAN-abaque-m-1/'),false,'Abaque reste une carte statique, pas une activation Edge');
  assert.match(hub,/apps=data\.apps\.filter\(app=>!labDemoKeys\.has\(app\.app_key\)\)/);
  assert.doesNotMatch(edge,/connect_hub_preset_entries/);
  assert.doesNotMatch(edge,/\.from\('connect_xp_credits'\)/);
});

test('les cinq cartes TEST ouvrent le lanceur scolaire commun; les autres classes gardent leurs URLs',()=>{
 const hub=read('hub.js'),lab=read('laboratoire.js');
 const release=read('apps/objective-record/release-routing.mjs');
 const home=read('hub.html'),catalog=read('hub-catalog.json');
 assert.match(hub,/testSlug=classId===LAB_CLASS\?recordSlugByApp\[app\.app_key\]:null/);
 assert.match(hub,/if\(testSlug\)node\.dataset\.labSchool=testSlug/);
 assert.match(hub,/SCHOOL_RECORD_LAUNCHER\+'\?app='\+encodeURIComponent\(testSlug\)/);
 assert.doesNotMatch(hub,/essais\/objectif-record-pilote\.html/);
 assert.match(lab,/testSlug=recordSlugByApp\[app\.app_key\]/);
 assert.match(lab,/const href=testSlug\?SCHOOL_RECORD_LAUNCHER\+'\?app='/);
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
