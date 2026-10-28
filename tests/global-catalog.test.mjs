import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const teacher=read('../app.js'),hub=read('../hub.js'),html=read('../index.html');
const result=read('../supabase/functions/connect-results/index.ts');
const catalog=read('../supabase/functions/connect-catalog/index.ts');
test('GLOBAL table exposes visibility, daily, section and order',()=>{
 for(const name of ['Visible','Du jour','Section','Ordre'])assert.ok(html.includes(name));
 assert.match(teacher,/teacher-catalog-global-save/);
 assert.match(teacher,/teacher-catalog-global-get/);
});
test('only authorized managing teacher may modify catalog',()=>{
 assert.match(result,/if\(!await managed\(\)\)return deny\('forbidden',403\)/);
 assert.match(result,/teacher-catalog-global-save/);
 assert.match(result,/\.update\(\{enabled:item\.enabled/);
});
test('public catalog is read-only and separate from protected results',()=>{
 assert.match(catalog,/request\.method!=='GET'/);
 assert.match(catalog,/\.eq\('enabled',true\)/);
 assert.doesNotMatch(catalog,/\.update\(|\.upsert\(|\.insert\(/);
 assert.match(hub,/functions\/v1\/connect-catalog/);
});
test('hub uses session cache and static fallback without SDK',()=>{
 assert.match(hub,/sessionStorage\.getItem\(cacheKey\)/);
 assert.match(hub,/const \{ apps: fallbackApps \}/);
 assert.match(hub,/controller\.abort\(\),1600/);
});
test('teacher browser JavaScript module parses',()=>{execFileSync(process.execPath,['--check','--input-type=module'],{input:teacher})});
