import test from 'node:test';
import assert from 'node:assert/strict';
import {SCHOOL_RECORD_ROLLOUT,schoolRecordLaunch} from '../apps/objective-record/release-routing.mjs';
test('school rollout closed',()=>{ assert.equal(SCHOOL_RECORD_ROLLOUT.enabled,false); assert.equal(schoolRecordLaunch({classId:'unknown',appKey:'addition-ecrite-simple',legacyUrl:'old'}),'old'); });
test('five apps remain legacy in all school classes until approvals',()=>{
 const ids=['8fe170fa-9e8f-4e80-885a-b0ba68026f64','71f5f4a5-3f25-4ec7-ac29-c33d2e6b395e','1b021ed9-4846-4203-9c7b-4b5fa8d7adab','0d8ba828-59cc-468b-a4b8-7b2a1af10b88','a9195199-0a28-4e86-99ce-47b36dd6e646'];
 const names=['addition-ecrite-simple','addition-ecrite-multiple','soustraction-ecrite-simple','multiplication-ecrite-simple','melange-calculs-ecrits'];
 for(const classId of ids)for(const appKey of names)assert.equal(schoolRecordLaunch({classId,appKey,legacyUrl:'old'}),'old');
});
test('LAB never uses school routing, even when gates are true',()=>{
 const all={enabled:true,atomicXpAndTrophiesVerified:true,hostedTestClassE2EVerified:true};
 for(const appKey of ['addition-ecrite-simple','addition-ecrite-multiple','soustraction-ecrite-simple','multiplication-ecrite-simple','melange-calculs-ecrits'])
  assert.equal(schoolRecordLaunch({classId:'4bf3400d-a315-4ea4-a2f3-afaca24dc9b9',appKey,legacyUrl:'old',rollout:all}),'old');
});
