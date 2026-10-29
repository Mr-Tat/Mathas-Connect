import test from 'node:test';import assert from 'node:assert/strict';import {CONNECT_WRITE_READY,buildConnectPilot} from '../apps/addition-plusieurs/connect-pilot.mjs';
test('Connect pilot remains impossible to activate before end-to-end validation',()=>{
 assert.equal(CONNECT_WRITE_READY,false);
 assert.throws(()=>buildConnectPilot({}),/connect_not_ready/);
});

test('pilot source archives stale queued results after teacher reset',async()=>{
 const {readFileSync}=await import('node:fs');
 const s=readFileSync(new URL('../apps/addition-plusieurs/connect-pilot.mjs',import.meta.url),'utf8');
 assert.match(s,/queued_epoch_mismatch/);
 assert.match(s,/queue\.quarantineEpoch\(epoch\)/);
 assert.match(s,/queue\.quarantineEpoch\(resetEpoch\)/);
 assert.match(s,/quarantined\(\)\{return queue\.archivedCount\(\)\}/);
});
