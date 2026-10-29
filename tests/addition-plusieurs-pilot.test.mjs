import test from 'node:test';import assert from 'node:assert/strict';import {CONNECT_WRITE_READY,buildConnectPilot} from '../apps/addition-plusieurs/connect-pilot.mjs';
test('Connect pilot remains impossible to activate before end-to-end validation',()=>{
 assert.equal(CONNECT_WRITE_READY,false);
 assert.throws(()=>buildConnectPilot({}),/connect_not_ready/);
});
