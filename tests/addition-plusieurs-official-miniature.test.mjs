import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

test('miniature officielle Addition multiple : WebP léger conforme à l’image transmise',()=>{
 const bytes=readFileSync(new URL('../assets/miniatures/addition-ecrite-multiple.webp',import.meta.url));
 assert.equal(bytes.subarray(0,4).toString(),'RIFF');
 assert.equal(bytes.subarray(8,12).toString(),'WEBP');
 assert.ok(bytes.length>30000&&bytes.length<50000,'WebP 768px optimisé, contrôlé en taille pour les PC de classe');
 const header=Buffer.from('blob '+bytes.length+String.fromCharCode(0));
 const gitSha=createHash('sha1').update(header).update(bytes).digest('hex');
 assert.equal(gitSha,'a8e8306c68185f90d1a7c03bda21dd38436e4c8f',
  'miniature optimisée actuelle : commit 1d4495674caa, empreinte Git vérifiée');
});

test('référence correcte dans la page professeur, sans dévoiler la carte dans le HUB statique',()=>{
 const teacher=readFileSync(new URL('../app.js',import.meta.url),'utf8');
 const hub=readFileSync(new URL('../hub.js',import.meta.url),'utf8');
 const fallback=readFileSync(new URL('../hub-catalog.json',import.meta.url),'utf8');
 assert.match(teacher,/addition-ecrite-multiple\.webp\?v=20261030-officiel/);
 assert.match(hub,/a\.image_url/);
 assert.doesNotMatch(fallback,/"app_key":\s*"addition-ecrite-multiple"/);
});
