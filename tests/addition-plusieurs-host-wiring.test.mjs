import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../apps/addition-plusieurs/index.html',import.meta.url),'utf8');
const pilot=readFileSync(new URL('../apps/addition-plusieurs/connect-pilot.mjs',import.meta.url),'utf8');
test('host connection is gated before accessing credentials and loading state',()=>{
 assert.match(pilot,/CONNECT_WRITE_READY=false/);
 assert.match(html,/if\(writeReady\)\{/);
 assert.match(html,/createAuthenticatedHost\(\{classId,teacherPlayer,createClient\}\)/);
 assert.doesNotMatch(html,/window\.MathasConnectHost/);
 assert.match(html,/candidate\.initialize\(loaded\.revision,loaded\.resetEpoch\)/);
 assert.match(html,/if\(connected\)connected\.completed\(item\)/);
});
test('server acknowledgements drive XP animation, not submitted event',()=>{
 assert.match(html,/status==='saved'&&reply\?\.xp/);
 assert.match(html,/reply\.xp\.delta>0\)animateXp/);
});
