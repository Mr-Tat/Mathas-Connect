import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../apps/addition-plusieurs/index.html',import.meta.url),'utf8');
test('XP animation is driven by acknowledged positive delta only',()=>{
 assert.match(html,/status==='saved'&&reply\?\.xp/);
 assert.match(html,/reply\.xp\.delta>0\)animateXp/);
 assert.match(html,/particle\.animate\(/);
 assert.match(html,/move\.finished\.catch\(\(\)=>\{\}\)\.finally\(\(\)=>particle\.remove\(\)\)/);
 assert.doesNotMatch(html,/if\s*\([^)]*matchMedia\(/);
});
test('laboratory launch is opt-in and no live Edge request in browser wrapper',()=>{
 assert.match(html,/get\('simulation'\)==='1'/);
 assert.match(html,/if\(writeReady&&!connected\)throw new Error/);
 assert.doesNotMatch(html,/https:\/\/[^'"]+supabase/);
});
