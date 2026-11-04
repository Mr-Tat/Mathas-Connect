import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {isNewCertifiedMultiplicationDailyBest as eligible} from '../apps/multiplication-simple/school-record-eligibility.mjs';

const eventId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const day='2026-11-04';
const receipt=(points=120,score=4,duplicate=false)=>({
 eventId,ack:{proofVerified:true,verifiedScore:score,duplicate,
 state:{todayBest:{day,points},recent:[{eventId,points,score,at:'2026-11-04T11:00:00Z'}]}}
});

test('only a fresh, positive and server-certified new daily best is offered',()=>{
 assert.equal(eligible(receipt(),{todayBest:{day,points:90}},day),true);
 assert.equal(eligible(receipt(),{todayBest:{day,points:120}},day),false);
 assert.equal(eligible(receipt(),{todayBest:{day,points:180}},day),false);
 assert.equal(eligible(receipt(0,0),{},day),false);
 assert.equal(eligible(receipt(),{todayBest:{day:'2026-11-03',points:999}},day),true);
});
test('duplicates, altered event receipts and stale days cannot produce an offer',()=>{
 assert.equal(eligible(receipt(120,4,true),{},day),false);
 const notVerified=receipt();notVerified.ack.proofVerified=false;
 assert.equal(eligible(notVerified,{},day),false);
 const stale=receipt();stale.ack.state.todayBest.day='2026-11-03';
 assert.equal(eligible(stale,{},day),false);
 const mismatch=receipt();mismatch.ack.state.recent[0].eventId='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
 assert.equal(eligible(mismatch,{},day),false);
 const tampered=receipt();tampered.ack.state.todayBest.points=121;
 assert.equal(eligible(tampered,{},day),false);
 assert.equal(eligible(null,{},day),false);
});
test('native launcher gates consent but never sends a score without yes',()=>{
 const launch=readFileSync(new URL('../apps/multiplication-simple/index.html',import.meta.url),'utf8');
 assert.match(launch,/receipt\.ack\?\.proofVerified===true/);
 assert.match(launch,/certifiedScoreView\?\.recorded\(receipt\.eventId\)/);
 const start=launch.indexOf('onVerified:receipt=>');
 const done=launch.indexOf('notify:text=>',start);
 const callback=launch.slice(start,done);
 assert.ok(callback.indexOf('receipt.ack?.proofVerified===true')<callback.indexOf('certifiedScoreView?.recorded('));
 assert.match(launch,/consent:\(\)=>certifiedConsent/);
 assert.doesNotMatch(callback,/student-share-score/);
});
