import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

// Release-invisible contract. This remains mandatory until the teacher
// explicitly approves enabling Addition multiple in the four HUB spaces.
const file=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const key='addition-ecrite-multiple';
test('no Addition multiple link is discoverable from the four current HUB catalogs',()=>{
 const staticCatalog=JSON.parse(file('hub-catalog.json'));
 assert.ok(Array.isArray(staticCatalog.apps));
 assert.equal(staticCatalog.apps.some(app=>app.app_key===key),false);
 const hub=file('hub.html');
 assert.equal(hub.includes('/apps/addition-plusieurs/'),false);
 const serverCatalog=file('supabase/functions/connect-catalog/index.ts');
 assert.match(serverCatalog,/\.eq\('visible',true\)/);
 assert.match(serverCatalog,/\.filter\(row=>row\.connect_apps\?\.enabled\)/);
 for(const slug of ['observation','phase1','phase2','2eco'])
  assert.ok(serverCatalog.includes(slug),'HUB missing from Edge filter: '+slug);
});
test('three independent release switches stay closed in committed code',()=>{
 const pilot=file('apps/addition-plusieurs/connect-pilot.mjs');
 const edge=file('supabase/functions/connect-results/index.ts');
 const teacher=file('app.js');
 assert.match(pilot,/export const CONNECT_WRITE_READY=false;/);
 assert.match(edge,/const ADD_MULTI_SERVER_READY=false;/);
 assert.match(teacher,/const ADD_MULTI_TEACHER_READY=false;/);
 assert.match(edge,/if\(!ADD_MULTI_SERVER_READY\)return deny\('integration_not_ready',403\)/);
 assert.match(edge,/if\(!row\?\.enabled\)return deny\('app_disabled',403\)/);
});
test('staged SQL must fail closed on pre-existing live catalog configuration',()=>{
 const sql=file('supabase/migrations/20261029_addition_multiple_catalog_stage.sql');
 assert.match(sql,/addition_multiple_preexisting_publication/);
 assert.match(sql,/enabled IS DISTINCT FROM false/);
 assert.match(sql,/visible IS DISTINCT FROM false/);
 assert.match(sql,/featured IS DISTINCT FROM false/);
 assert.match(sql,/false,'calculs_ecrits',false,40/);
 assert.match(sql,/40,false,false/);
 for(const slug of ['observation','phase1','phase2','2eco'])
  assert.ok(sql.includes("'"+slug+"'"));
 assert.doesNotMatch(sql,/\b(?:DELETE|TRUNCATE|DROP|UPDATE)\s+(?:FROM|TABLE|public\.)/i);
});
