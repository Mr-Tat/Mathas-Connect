import test from 'node:test';
import assert from 'node:assert/strict';
import {guidedSessionLive,mayRenewGuidedHost,CLOSE_GRACE_MS,HEARTBEAT_TIMEOUT_MS} from '../supabase/functions/connect-guided-written/lease.mjs';
import {writtenGuidedSchoolPreset,mayStartWrittenGuidedSchool,WRITTEN_GUIDED_TEST_CLASS} from '../supabase/functions/connect-guided-written/school-visibility.mjs';
const time=Date.parse('2026-11-12T14:00:00.000Z');
const iso=n=>new Date(n).toISOString();
const live={active:true,teacher_id:'teacher-1',session_id:'session-1',host_client_id:'tab-1',
 host_page_id:'page-1',host_seen_at:iso(time),updated_at:iso(time),close_requested_at:null};
test('La présence enseignant cesse après 10 minutes sans signal, pas par simple changement onglet',()=>{
 assert.equal(HEARTBEAT_TIMEOUT_MS,600_000);
 assert.equal(guidedSessionLive(live,time),true);
 assert.equal(guidedSessionLive(live,time+HEARTBEAT_TIMEOUT_MS-1),true);
 assert.equal(guidedSessionLive(live,time+HEARTBEAT_TIMEOUT_MS),false);
});
test('Après pagehide : recharge sous 15s, fermeture réelle après le délai',()=>{
 assert.equal(CLOSE_GRACE_MS,15_000);
 const closing={...live,close_requested_at:iso(time+2_000)};
 assert.equal(guidedSessionLive(closing,time+2_000+CLOSE_GRACE_MS-1),true);
 assert.equal(guidedSessionLive(closing,time+2_000+CLOSE_GRACE_MS),false);
 assert.equal(guidedSessionLive({...closing,close_requested_at:null},time+20_000),true);
});
test('Droits du professeur liés au compte, au bon onglet, à la bonne page et séance',()=>{
 const original={teacherId:'teacher-1',sessionId:'session-1',hostId:'tab-1',pageId:'page-1'};
 assert.equal(mayRenewGuidedHost(live,original),true);
 for(const key of Object.keys(original)){
  assert.equal(mayRenewGuidedHost(live,{...original,[key]:'other'}),false,key);
 }
 assert.equal(mayRenewGuidedHost({...live,active:false},original),false);
});
test('Classe TEST conservée ; les autres doivent avoir un preset visible autorisé',()=>{
 assert.equal(mayStartWrittenGuidedSchool(WRITTEN_GUIDED_TEST_CLASS,false),true);
 assert.equal(writtenGuidedSchoolPreset(WRITTEN_GUIDED_TEST_CLASS),null);
 assert.equal(mayStartWrittenGuidedSchool('f7d3f280-726e-4e61-86d2-13256aac1746',true),false);
 assert.equal(mayStartWrittenGuidedSchool('71f5f4a5-3f25-4ec7-ac29-c33d2e6b395e',false),false);
 assert.equal(mayStartWrittenGuidedSchool('71f5f4a5-3f25-4ec7-ac29-c33d2e6b395e',true),true);
});
