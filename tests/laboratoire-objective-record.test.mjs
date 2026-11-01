import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {objectiveRecordLabPreviews} from '../objective-record-lab-previews.mjs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('cinq démos Pages distinctes, sans app_key ni attribut d’XP Connect',()=>{
  assert.equal(objectiveRecordLabPreviews.length,5);
  assert.equal(new Set(objectiveRecordLabPreviews.map(p=>p.id)).size,5);
  assert.equal(new Set(objectiveRecordLabPreviews.map(p=>p.url)).size,5);
  const expected=new Map([
    ['addition-simple','/CE-Addition-simple/essai-mode-score-3-vies.html'],
    ['addition-multiple','/addition-ecrite-multiple/essai-objectif-record-3-vies.html'],
    ['soustraction','/soustraction-ecrite/essai-objectif-record-3-vies.html'],
    ['multiplication','/Multiplication-simple/essai-objectif-record-3-vies.html'],
    ['melange','/Melange-calculs-ecrits-1/essai-objectif-record-3-vies.html'],
  ]);
  for(const preview of objectiveRecordLabPreviews){
    assert.deepEqual(Object.keys(preview).sort(),['id','title','url']);
    const url=new URL(preview.url);
    assert.equal(url.protocol,'https:');
    assert.equal(url.hostname,'mr-tat.github.io');
    assert.equal(url.pathname,expected.get(preview.id));
    assert.match(preview.title,/Objectif record/);
  }
  assert.equal(expected.size,objectiveRecordLabPreviews.length);
});

test('les cinq essais n’apparaissent que dans le HUB de la classe TEST',()=>{
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
  assert.match(guide,/Déployer d'abord dans le HUB du Laboratoire pour tester/);
  assert.match(guide,/Démonstration visuelle ou de moteur, isolée/);
  assert.match(guide,/Pilote authentifié Connect/);
  assert.match(guide,/les URL GitHub Pages|Les URL GitHub Pages/);
  assert.match(guide,/classe TEST/);
});
