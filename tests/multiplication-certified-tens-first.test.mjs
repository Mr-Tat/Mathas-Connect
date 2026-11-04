import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const src=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const proof=src('apps/multiplication-simple/certified-classic.mjs');
const launcher=src('apps/multiplication-simple/index.html');

test('certified multiplication allows switching tens-first without restarting a challenge',()=>{
 assert.match(proof,/mathasMultiCertifiedTensFirst/);
 assert.match(proof,/tensInput\.addEventListener\('change'/);
 assert.match(proof,/run\.tensFirst=!!tensInput\.checked/);
 assert.match(proof,/onTensFirstChanged\(run\.tensFirst\)/);
 const handler=proof.slice(proof.indexOf("tensInput.addEventListener('change'"),proof.indexOf("verify.addEventListener('click'"));
 assert.doesNotMatch(handler,/render\(|board\.replaceChildren|run\.answers\s*=/,
  'Changing order must not re-render or destroy answers in progress');
 assert.match(handler,/if\(!live\(\)\|\|run\.finished\|\|sending\|\|starting\)/);
});

test('certified carry preference synchronizes back to native engine',()=>{
 assert.match(launcher,/onTensFirstChanged:enabled=>/);
 assert.match(launcher,/getElementById\('tensFirstToggle'\)/);
 assert.match(launcher,/home\.checked=!!enabled/);
 assert.match(launcher,/home\.dispatchEvent\(new iframe\.contentWindow\.Event\('change'/);
 assert.match(launcher,/applySchoolUi\(\)/);
});

test('certified UI module syntax remains valid',()=>{
 const result=spawnSync(process.execPath,['--check','apps/multiplication-simple/certified-classic.mjs'],{
  cwd:new URL('../',import.meta.url),encoding:'utf8'});
 assert.equal(result.status,0,result.stderr);
});

test('XP animation is triggered by a new, server-confirmed award only',()=>{
 const start=launcher.indexOf('onVerified:receipt=>');
 assert.ok(start>=0);
 const code=launcher.slice(start,launcher.indexOf('notify:text=>',start));
 assert.match(code,/receipt\.ack\?\.duplicate!==true/);
 assert.match(code,/Number\.isSafeInteger\(xp\?\.delta\)&&xp\.delta>0/);
 assert.match(code,/queueXpGain\(xp\)/);
 const proof=src('apps/multiplication-simple/certified-classic.mjs');
 assert.match(proof,/ack\?\.proofVerified!==true/);
 assert.match(proof,/onVerified\?\.\(\{eventId:ticket\.sessionId,ack\}\)/);
});
