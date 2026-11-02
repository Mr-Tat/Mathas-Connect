import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {objectiveRecordLabPreviews} from '../objective-record-lab-previews.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const base='apps/GRAN-abaque-m-1/';
test('Abaque démo : source traçable intacte, pas de réseau/identité Connect ni stockage partagé',()=>{
 const manifest=JSON.parse(read(base+'source-manifest.json'));
 assert.equal(createHash('sha256').update(read(base+'game-original.html')).digest('hex'),manifest.sourceSha256);
 assert.equal(manifest.repositoryDisplayName,'GRAN-abaque-m-1');
 assert.match(manifest.sourceCommit,/^[a-f0-9]{40}$/);
 for(const [file,expected] of Object.entries(manifest.sourceFiles)){
  assert.equal(file.includes('..'),false);
  assert.match(file,/^(?:index\.html|abaque\.css|demo-controls\.mjs|xp-hints\.mjs|assets\/[\w./-]+)$/);
  if(manifest.connectEnabled&&['index.html','abaque.css'].includes(file))continue;
  const bytes=readFileSync(new URL('../'+base+file,import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),expected,file+' provient du commit autonome annoncé');
 }
 const html=read(base+'index.html');
 if(manifest.status==='candidate-connect-closed'){
  assert.equal(manifest.connectEnabled,true);
  assert.deepEqual(manifest.adapterFiles,['index.html','abaque.css','environment.js']);
  assert.match(html,/connect\/native-bridge\.js/);assert.match(html,/connect\/bootstrap\.mjs/);
 }else{assert.equal(manifest.status,'isolated-demo');assert.equal(manifest.connectEnabled,false);}

 assert.equal(/fetch\(|XMLHttpRequest|createClient|supabase\.co|sendBeacon|(?:src|href)=["']https?:/.test(html),false,'aucune API réseau ni ressource externe');
 assert.match(html,/mathas_connect_abaque_demo_progress_v1/);
 assert.match(read(base+'environment.js'),/laboratory:true/);
 assert.doesNotMatch(html,/Reste \d+ XP/);
 assert.match(html,/XP fictifs · aucun résultat Connect/);
 const demo=read(base+'demo-controls.mjs');
 assert.match(demo,/get\('connect'\)!=='1'/);
 assert.doesNotMatch(demo,/fetch\(|createClient|getSession|localStorage|sessionStorage|supabase\.co/,'les aperçus ne sont pas des connexions ni des sauvegardes');
 const preview=objectiveRecordLabPreviews.find(x=>x.id==='abaque-longueurs');
 assert.equal(preview.url,'https://mr-tat.github.io/Mathas-Connect/apps/GRAN-abaque-m-1/');
 assert.doesNotMatch(read('hub-catalog.json'),/abaque-longueurs/);
 for(const html of ['hub.html','index.html'])assert.doesNotMatch(read(html),/abaque-longueurs/);
});
