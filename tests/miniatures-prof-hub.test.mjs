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
 assert.match(html,/hub\.js\?v=20261103-profile-rewards-v1/);
 assert.equal(catalog.apps.find(a=>a.app_key==='soustraction-ecrite-simple')?.image_url,
   './assets/miniatures/soustraction-ecrite-simple.webp');
});

test('le mot Connect des HUB attend un compte approuvé, sans masquer celui du portail professeur',()=>{
 const hub=readFileSync(path('hub.js'),'utf8');
 const html=readFileSync(path('hub.html'),'utf8');
 const css=readFileSync(path('hub-profile.css'),'utf8');
 const home=readFileSync(path('index.html'),'utf8');
 assert.match(html,/<img id="hub-connect-suffix" class="connect-wordmark-3d"[^>]*alt="Connect"[^>]*hidden>/);
 assert.match(hub,/const authorized = profile\?\.status === 'approved' && profile\?\.classId === classId;/);
 assert.match(hub,/activeProfile=authorized\?profile:null;\s*\/\/[^\n]*\n\s*\$\('hub-connect-suffix'\)\.hidden=!authorized;/);
 assert.match(css,/\.connect-brand img\.connect-wordmark-3d\[hidden\]\{display:none!important\}/);
 assert.match(html,/hub-profile\.css\?v=20261103-profile-rewards-v1/);
 assert.match(home,/<div class="teacher-logo-lockup">[^\n]*<img class="connect-wordmark-3d"[^>]*alt="Connect"/);
});

test('la signature Connect 3D est vectorielle, bleue devant et mauve-bleu sur les tranches',()=>{
 const svg=readFileSync(path('assets/brand/connect-wordmark-3d.svg'),'utf8');
 const home=readFileSync(path('index.html'),'utf8');
 const hub=readFileSync(path('hub.html'),'utf8');
 const css=readFileSync(path('style.css'),'utf8');
 assert.match(svg,/<svg[^>]*viewBox="0 8 232 54"/);
 assert.match(svg,/<path id="letters" d="M/);
 assert.match(svg,/fill="#0256B8"/);
 assert.match(svg,/#9B60DF/);
 assert.match(svg,/#66B9F6/);
 assert.match(svg,/translate\(1\.25 -2\.1\)/); // tranche visible vers le haut
 assert.match(svg,/translate\(\.75 -1\.2\)/);
 assert.doesNotMatch(svg,/translate\(1\.8 3\.0\)/); // ancien relief vu du dessous
 assert.doesNotMatch(svg,/<text\b|<script\b|@import/);
 assert.equal((home.match(/class="connect-wordmark-3d"/g)||[]).length,4);
 assert.equal((hub.match(/class="connect-wordmark-3d"/g)||[]).length,1);
 assert.equal((home.match(/connect-wordmark-3d\.svg\?v=20261102-vue-dessus-v2/g)||[]).length,4);
 assert.equal((hub.match(/connect-wordmark-3d\.svg\?v=20261102-vue-dessus-v2/g)||[]).length,1);
 assert.match(css,/\.teacher-logo-lockup img\.connect-wordmark-3d/);
 assert.match(css,/\.student-entry-brand img\.connect-wordmark-3d/);
 assert.match(home,/style\.css\?v=20261102-connect-3d-svg-v1/);
});
