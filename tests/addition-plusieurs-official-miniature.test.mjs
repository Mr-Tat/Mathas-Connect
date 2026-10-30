import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

test('miniature Addition multiple officielle: vrai WebP léger correspondant à l’image validée',()=>{
 const path=new URL('../assets/miniatures/addition-ecrite-multiple.webp',import.meta.url);
 const bytes=readFileSync(path);
 assert.equal(bytes.subarray(0,4).toString(),'RIFF');
 assert.equal(bytes.subarray(8,12).toString(),'WEBP');
 assert.ok(bytes.length>5000 && bytes.length<20000,'compression pour les petits PC et le réseau scolaire');
 const gitSha=createHash('sha1').update(Buffer.from('blob '+bytes.length+'\\0'.replace('\\0','\u0000'))).update(bytes).digest('hex');
 assert.equal(gitSha,'e79bb8423d9768e2c32884fb72a3fc23fc60294c',
  'image officielle transmise pour Addition de plusieurs nombres');
});
test('la page professeur et le HUB utilisent le fichier officiel, sans dévoiler la carte dans les HUB',()=>{
 const teacher=readFileSync(new URL('../app.js',import.meta.url),'utf8');
 const hub=readFileSync(new URL('../hub.js',import.meta.url),'utf8');
 const fallback=readFileSync(new URL('../hub-catalog.json',import.meta.url),'utf8');
 assert.match(teacher,/addition-ecrite-multiple\\.webp\\?v=20261030-officiel/);
 assert.match(hub,/a\\.image_url/);
 assert.doesNotMatch(fallback,/"app_key":\\s*"addition-ecrite-multiple"/);
});
