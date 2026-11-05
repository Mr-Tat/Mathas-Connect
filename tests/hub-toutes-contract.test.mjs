import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('Toutes opens a distinct professor HUB',()=>{
 const index=read('index.html'),hub=read('hub.html'),js=read('hub.js');
 assert.match(index,/id="teacher-all" href="\.\/hub\.html\?toutes=1/);
 assert.match(hub,/q\.get\('toutes'\)==='1'/);
 assert.match(js,/const allMode=/);
 assert.match(js,/if\(allMode\)/);
});
test('Tests is first, and cards are not duplicated in ordinary sections',()=>{
 const hub=read('hub.js');
 assert.match(hub,/apps\.filter\(a=>!a\.in_test\)/);
 assert.match(hub,/groups\.unshift\(section\('tests'/);
 assert.match(hub,/classList\.remove\('collapsed'\)/);
});
test('catalogue Toutes requires authorized professor and has independent order',()=>{
 const edge=read('supabase/functions/connect-lab-catalog/index.ts');
 const verify=edge.indexOf("if(error||!user||user.is_anonymous)");
 const action=edge.indexOf("if(body.action==='all')");
 assert.ok(verify>=0&&action>verify);
 assert.match(edge,/\.eq\('can_manage',true\)/);
 assert.match(edge,/connect_hub_all_settings/);
 assert.match(edge,/all_order/);
});
test('the laboratory preserves demos but no longer displays another online catalog',()=>{
 const html=read('laboratoire.html');
 assert.match(html,/id="record-previews"/);
 assert.match(html,/id="apps"[^>]*hidden/);
 assert.match(html,/Ouvrir Tests dans le HUB Toutes/);
});
test('all-order storage is private and independent of school catalogues',()=>{
 const migration=read('supabase/migrations/20261105093000_connect_hub_toutes_settings.sql');
 assert.match(migration,/enable row level security/);
 assert.match(migration,/revoke all.*anon, authenticated/);
 assert.doesNotMatch(migration,/\bdelete\s+from\s+.*(?:connect_students|connect_xp)/i);
});
