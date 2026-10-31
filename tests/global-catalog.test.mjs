import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const teacher=read('../app.js'),hub=read('../hub.js'),html=read('../index.html');
const result=read('../supabase/functions/connect-results/index.ts');
const catalog=read('../supabase/functions/connect-catalog/index.ts');
test('GLOBAL table exposes visibility, daily, section and order',()=>{
 for(const name of ['Observation','Phase 1','Phase 2','2 ECO','Partout','Ordre'])assert.ok(html.includes(name));
 assert.match(teacher,/teacher-app-matrix-save/);
 assert.match(teacher,/teacher-app-matrix-get/);
});
test('only authorized managing teacher may modify catalog',()=>{
 assert.match(result,/if\(!await managed\(\)\)return deny\('forbidden',403\)/);
 assert.match(result,/teacher-app-matrix-save/);
 assert.match(result,/connect_hub_preset_entries/);
});
test('public catalog is read-only and separate from protected results',()=>{
 assert.match(catalog,/request\.method!=='GET'/);
 assert.match(catalog,/\.eq\('visible',true\)/);
 assert.doesNotMatch(catalog,/\.update\(|\.upsert\(|\.insert\(/);
 assert.match(hub,/functions\/v1\/connect-catalog/);
});
test('hub uses session cache and static fallback without SDK',()=>{
 assert.match(hub,/sessionStorage\.getItem\(scopedKey\)/);
 assert.match(hub,/const \{ apps: fallbackApps \}/);
 assert.match(hub,/controller\.abort\(\),1600/);
});
test('teacher browser JavaScript module parses',()=>{execFileSync(process.execPath,['--check','--input-type=module'],{input:teacher})});

test('five class columns, distinct Phase 2 scopes and separate caches',()=>{for(const name of ['Observation','Phase 1','Phase 2 A','Phase 2 B','2 ECO','Partout','Position'])assert.ok(html.includes(name));assert.match(hub,/classPresets\[classId\]/);assert.match(result,/teacher-app-matrix-save/);assert.match(result,/const slugs=\['observation','phase1','phase2','phase2b','2eco'\]/);assert.match(catalog,/phase2b/);assert.match(read('../connect-context.js'),/phase2b:/);});

test('Soustraction figure dans le secours statique, sans filtre HOLD ni cache ancien',()=>{
 const local=JSON.parse(read('../hub-catalog.json'));
 const apps=local.apps.filter(a=>a.app_key==='soustraction-ecrite-simple');
 assert.equal(apps.length,1);
 assert.equal(apps[0].hub_section,'calculs_ecrits');
 assert.match(hub,/apps=fallbackApps;/);
 assert.doesNotMatch(hub,/fallbackApps\.filter\(a=>a\.app_key!=='soustraction-ecrite-simple'\)/);
 assert.match(hub,/mathas\.connect\.global-catalog\.v2/);
 assert.match(read('../hub.html'),/hub\.js\?v=20261031-compteurs-courts-v1/);
});

test('trophées permanents du profil et XP du parcours par application',()=>{
 const page=read('../hub.html'),css=read('../hub-profile.css'),edge=read('../supabase/functions/connect-api/index.ts');
 const results=read('../supabase/functions/connect-results/index.ts');
 assert.match(page,/id="identity-trophies"/);
 assert.match(css,/#identity-trophies/);
 assert.match(page,/id="identity-achievements" class="identity-achievements"/);
 assert.match(css,/#identity-box\.identity-connected \.identity-achievements\{[^}]*flex-direction:column;align-items:center/);
 assert.match(css,/#identity-box\.identity-connected #identity-trophies\{[^}]*justify-content:center/);
 assert.match(page,/hub-profile\.css\?v=20261031-trophees-centres-v2/);
 assert.match(hub,/progressFor\(appKey\)/);
 assert.match(hub,/p\.xpMax\+' XP\\n🏆 '/);
 assert.doesNotMatch(hub,/XP du parcours\\n🏆|trophiesMax\+' trophées'/);
 assert.match(hub,/trophiesEarned/);
 assert.match(hub,/refreshCardProgress\(\)/);
 assert.match(edge,/connect_profile_progress_v1/);
 assert.match(results,/connect_trophy_rewards_v1/);
 assert.doesNotMatch(hub,/setInterval\(/);
});
