import test from 'node:test';
import assert from 'node:assert/strict';
import {SCHOOL_RECORD_ROLLOUT,schoolRecordLaunch} from '../apps/objective-record/release-routing.mjs';
test('school rollout closed',()=>{ assert.equal(SCHOOL_RECORD_ROLLOUT.enabled,false); assert.equal(schoolRecordLaunch({classId:'unknown',appKey:'addition-ecrite-simple',legacyUrl:'old'}),'old'); });
