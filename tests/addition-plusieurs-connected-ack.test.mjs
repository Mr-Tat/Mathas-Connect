import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const pilot=readFileSync(new URL('../apps/addition-plusieurs/connect-pilot.mjs',import.meta.url),'utf8');
const edge=readFileSync(new URL('../supabase/functions/connect-results/index.ts',import.meta.url),'utf8');
test('connected pilot delivers server acknowledgement to UI, never computes XP locally',()=>{
 assert.match(pilot,/onStatus\('saved',reply\)/);
 assert.match(pilot,/onAck:\(_,reply\)=>/);
 assert.match(pilot,/export const CONNECT_WRITE_READY=false/);
 assert.match(pilot,/points:0,classId/);
 assert.doesNotMatch(pilot,/milestones\(|xp-model/);
});
test('disabled game cannot write on Edge; response includes server XP when available',()=>{
 assert.match(edge,/if\(selected===addMulti\)[\s\S]*?app_disabled/);
 assert.match(edge,/selected===addMulti&&b\.points!==0/);
 assert.match(edge,/\.\.\.\(xp\?\{xp\}:\{\}/);
});
