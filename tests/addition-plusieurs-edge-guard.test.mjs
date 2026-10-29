import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const edge=readFileSync(new URL('../supabase/functions/connect-results/index.ts',import.meta.url),'utf8');
const migration=readFileSync(new URL('../supabase/migrations/20261029_addition_multiple_catalog_stage.sql',import.meta.url),'utf8');
test('new app explicitly isolated and gated by disabled catalog',()=>{
 assert.match(edge,/addMulti='addition-ecrite-multiple'/);
 assert.match(edge,/const ADD_MULTI_SERVER_READY=false/);
 assert.match(edge,/if\(!ADD_MULTI_SERVER_READY\)return deny\('integration_not_ready',403\)/);
 assert.match(edge,/selected===addMulti[\s\S]*?select\('enabled'\)[\s\S]*?app_disabled/);
 assert.match(edge,/selected===addMulti&&b.points!==0/);
 assert.match(edge,/const studentId=await identity\(\)/);
 assert.match(migration,/false,'calculs_ecrits',false,40/);
 assert.match(migration,/40,false,false/);
});
test('existing applications remain authorized and new XP routes share server readiness switch',()=>{
 assert.match(edge,/k===app\|\|k===mul\|\|k===sub\|\|k===lab\|\|k===addMulti/);
 assert.match(edge,/const xpAppAllowed=\(k:any\)=>k===app\|\|k===mul\|\|k===sub\|\|\(ADD_MULTI_SERVER_READY&&k===addMulti\)/);
 assert.match(edge,/if\(!xpAppAllowed\(appKey\)\)return null/);
 assert.match(edge,/if\(!xpAppAllowed\(b.appKey\)\)return deny\('forbidden',403\)/);
 assert.doesNotMatch(migration,/DELETE FROM|TRUNCATE|DROP TABLE|UPDATE public\.connect_states/i);
});
