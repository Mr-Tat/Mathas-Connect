import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');

const apps=JSON.parse(read('../hub-catalog.json')).apps;
const hub=read('../hub.js');
const html=read('../hub.html');
const sql=read('../supabase/release-candidates/20261113_padlet_jeux_catalog.sql');
const padletUrl='https://padlet.com/julientatas1/jeux-math-6y4b0kwcj5444l83';
const thumb='https://raw.githubusercontent.com/Mr-Tat/Exterieurs/main/miniatures/padlet-jeux.webp';

test('Padlet jeux: unique external card in the Jeux section, no XP',()=>{
  const padlets=apps.filter(a=>a.app_key==='padlet-jeux');
  assert.equal(padlets.length,1);
  const app=padlets[0];
  assert.equal(app.title,'Padlet jeux');
  assert.equal(app.launch_url,padletUrl);
  assert.equal(app.image_url,thumb);
  assert.equal(app.hub_section,'jeux');
  assert.equal(app.featured,false);
  assert.equal(app.display_order,80);
  assert.match(hub,/if\(appKey==='padlet-jeux'\)return '🎲 Jeux en ligne · lien externe'/);
  assert.match(hub,/!officialThumbnail\.includes\('jftzuslpelgzbdrftszw'\)/);
  assert.doesNotMatch(hub,/approvedPadletImage|PADLET_JEUX_IMAGE_URL/);
  assert.doesNotMatch(hub,/connectedGameKeys=new Set\(\[[^\]]*'padlet-jeux'/s);
  assert.match(html,/hub\.js\?v=20261113-padlet-jeux-v1/);
});

test('Padlet jeux: idempotent insert in five school presets, Test and Toutes',()=>{
  for(const space of ['observation','phase1','phase2','phase2b','2eco'])
    assert.ok(sql.includes("'"+space+"'"),'missing school class '+space);
  for(const table of ['connect_apps','connect_hub_preset_entries','connect_hub_all_settings','connect_lab_hub_visibility'])
    assert.ok(sql.includes('public.'+table),'missing table '+table);
  assert.match(sql,/ON CONFLICT \(app_key\) DO UPDATE SET/);
  assert.match(sql,/ON CONFLICT \(preset_slug,app_key\) DO UPDATE SET/);
  assert.match(sql,/VALUES \('padlet-jeux',80,'published','jeux',now\(\)\)/);
  assert.match(sql,/VALUES \('padlet-jeux',true,now\(\)\)/);
  assert.match(sql,/IF found_count <> 5 THEN/);
});
