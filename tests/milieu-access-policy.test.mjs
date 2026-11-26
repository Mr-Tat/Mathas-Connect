import test from 'node:test';
import assert from 'node:assert/strict';
import {milieuAccess,PILOT_CLASS} from '../supabase/functions/connect-milieu/access-policy.mjs';
import {createMilieuHandler} from '../supabase/functions/connect-milieu/handler.mjs';
test('La moitié : pilote limité au projet officiel et classe TEST, fermeture explicite prioritaire',async()=>{
 const url='https://awmhpfofacaglewammxt.supabase.co';
 assert.equal(milieuAccess(url,undefined),'pilot');assert.equal(milieuAccess(url,'pilot'),'pilot');
 for(const value of ['closed','open','unknown',''])assert.equal(milieuAccess(url,value),'closed');
 for(const url of ['http://localhost:54321','https://other.supabase.co','https://awmhpfofacaglewammxt.supabase.co.evil.example','invalid'])assert.equal(milieuAccess(url,'pilot'),'closed');
 const handler=createMilieuHandler({access:'pilot',pilotClassId:PILOT_CLASS,auth:{auth:{getUser:()=>assert.fail('wrong class must not reach Auth')}},db:{rpc:()=>assert.fail('wrong class must not reach database')}});
 const r=await handler(new Request('https://local.test',{method:'POST',headers:{authorization:'Bearer test','content-type':'application/json'},body:JSON.stringify({appKey:'milieu-segment',classId:'71f5f4a5-3f25-4ec7-ac29-c33d2e6b395e',action:'load'})}));assert.equal(r.status,403);assert.equal((await r.json()).error,'app_class_not_open');
});
