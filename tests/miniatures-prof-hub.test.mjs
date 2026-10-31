import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

const path = p => new URL('../'+p, import.meta.url);
for (const [app,sha256] of [
  ['soustraction-ecrite-simple','2e78286a1e2726502e30efd7eabe3643a16d5dc4ff4cfdcc8b36c55495df0b16'],
  ['melange-calculs-ecrits','0308d57fc27b5b5360e260240af9019969804702d978267ba797843cb32c0c10'],
]) {
  test('miniature HUB approuvée : '+app,()=>{
    const file=readFileSync(path('assets/miniatures/'+app+'.webp'));
    assert.equal(file.toString('ascii',0,4),'RIFF','conteneur WebP');
    assert.equal(file.toString('ascii',8,12),'WEBP','type WebP');
    assert.equal(createHash('sha256').update(file).digest('hex'),sha256,'octets exacts du fichier optimisé');
  });
}
test('cache des deux miniatures seulement, sans modification des catalogues',()=>{
 const hub=readFileSync(path('hub.js'),'utf8');
 const html=readFileSync(path('hub.html'),'utf8');
 const catalog=JSON.parse(readFileSync(path('hub-catalog.json'),'utf8'));
 assert.match(hub,/\['soustraction-ecrite-simple','melange-calculs-ecrits'\]\.includes\(app\.app_key\)/);
 assert.match(hub,/thumbUrl\.searchParams\.set\('v','20261031-miniatures-prof'\)/);
 assert.match(html,/hub\.js\?v=20261031-miniatures-prof/);
 assert.equal(catalog.apps.find(a=>a.app_key==='soustraction-ecrite-simple')?.image_url,
   './assets/miniatures/soustraction-ecrite-simple.webp');
});
