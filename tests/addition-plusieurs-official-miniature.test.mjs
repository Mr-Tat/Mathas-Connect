import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

test('miniature officielle Addition multiple : WebP léger conforme à l’image transmise',()=>{
 const bytes=readFileSync(new URL('../assets/miniatures/addition-ecrite-multiple.webp',import.meta.url));
 assert.equal(bytes.subarray(0,4).toString(),'RIFF');
 assert.equal(bytes.subarray(8,12).toString(),'WEBP');
 assert.ok(bytes.length>5000&&bytes.length<20000,'miniature adaptée aux petits PC et au réseau scolaire');
 const header=Buffer.from('blob '+bytes.length+String.fromCharCode(0));
 const gitSha=createHash('sha1').update(header).update(bytes).digest('hex');
 assert.equal(gitSha,'e79bb8423d9768e2c32884fb72a3fc23fc60294c',
  'image officielle fournie pour Addition de plusieurs nombres');
});

test('référence correcte dans la page professeur, sans dévoiler la carte dans le HUB statique',()=>{
 const teacher=readFileSync(new URL('../app.js',import.meta.url),'utf8');
 const hub=readFileSync(new URL('../hub.js',import.meta.url),'utf8');
 const fallback=readFileSync(new URL('../hub-catalog.json',import.meta.url),'utf8');
 assert.match(teacher,/addition-ecrite-multiple\.webp\?v=20261030-officiel/);
 assert.match(hub,/a\.image_url/);
 assert.doesNotMatch(fallback,/"app_key":\s*"addition-ecrite-multiple"/);
});
