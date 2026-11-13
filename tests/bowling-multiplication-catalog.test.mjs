import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const catalog=JSON.parse(read('../hub-catalog.json'));
const hub=read('../hub.js');
const html=read('../hub.html');
const sql=read('../supabase/release-candidates/20261113_bowling_multiplication_catalog.sql');
const key='bowling-multiplication';
const launch='https://www.gamingbee.com/games/multiplication-bowling/v2.0/index.html?lang=nl';
const miniature='https://raw.githubusercontent.com/Mr-Tat/Exterieurs/main/miniatures/bowling-multiplication.webp';

test('Bowling multiplication: lien externe unique, Jeux, miniature du dépôt Exterieurs, sans XP',()=>{
 const a=catalog.apps.filter(x=>x.app_key===key);
 assert.equal(a.length,1);
 assert.equal(a[0].title,'Bowling multiplication');
 assert.equal(a[0].launch_url,launch);
 assert.equal(a[0].image_url,miniature);
 assert.equal(a[0].hub_section,'jeux');
 assert.equal(a[0].featured,false);
 assert.equal(a[0].display_order,90);
 assert.match(hub,/if\(appKey==='bowling-multiplication'\)return '🎳 Jeu de multiplication · lien externe'/);
 assert.doesNotMatch(hub,/connectedGameKeys=new Set\(\[[^\]]*'bowling-multiplication'/s);
 assert.match(html,/hub\.js\?v=20261113-jeux-confirm-v1/);
});
test('Bowling multiplication: SQL idempotent dans cinq classes, Toutes et TEST',()=>{
 for(const slug of ['observation','phase1','phase2','phase2b','2eco'])
   assert.ok(sql.includes("'"+slug+"'"),'classe manquante: '+slug);
 for(const table of ['connect_apps','connect_hub_preset_entries','connect_hub_all_settings','connect_lab_hub_visibility'])
   assert.ok(sql.includes('public.'+table));
 assert.ok(sql.includes(launch));
 assert.ok(sql.includes(miniature));
 assert.match(sql,/ON CONFLICT \(app_key\) DO UPDATE SET/);
 assert.match(sql,/ON CONFLICT \(preset_slug,app_key\) DO UPDATE SET/);
 assert.match(sql,/VALUES \('bowling-multiplication',90,'published','jeux',now\(\)\)/);
 assert.match(sql,/VALUES \('bowling-multiplication',true,now\(\)\)/);
 assert.match(sql,/IF found_count <> 5 THEN/);
});
