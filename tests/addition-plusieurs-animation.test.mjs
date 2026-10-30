import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../apps/addition-plusieurs/index.html',import.meta.url),'utf8');
test('XP animation is driven by acknowledged positive delta only',()=>{
 assert.match(html,/status==='saved'&&reply\?\.xp/);
 assert.match(html,/confirmXp\(reply\.xp\)/);
 assert.match(html,/delta>0\?animateXp\(delta\)/);
 assert.match(html,/getElementById\('xp-track'\)\.getBoundingClientRect\(\)/);
 assert.match(html,/particle\.animate\(/);
 assert.match(html,/move\.finished\.catch\(\(\)=>\{\}\)\.finally\(\(\)=>particle\.remove\(\)\)/);
 assert.doesNotMatch(html,/if\s*\([^)]*matchMedia\(/);
});
test('laboratory launch is opt-in and no live Edge request in browser wrapper',()=>{
 assert.match(html,/get\('simulation'\)==='1'/);
 assert.match(html,/if\(writeReady&&host&&!connected\)throw new Error/);
 assert.doesNotMatch(html,/awmhpfofacaglewammxt\.supabase\.co/);
 assert.match(html,/if\(writeReady&&classId&&!free\)/);
});
