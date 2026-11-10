import test from 'node:test';
import assert from 'node:assert/strict';
import {CLOSE_GRACE_MS,HEARTBEAT_TIMEOUT_MS,guidedSessionLive,mayRenewGuidedHost} from '../supabase/functions/connect-guided-multiplication/lease.mjs';
const now=Date.parse('2026-11-10T13:00:00Z');
const row={active:true,host_seen_at:new Date(now-12000).toISOString(),updated_at:new Date(now-12000).toISOString(),close_requested_at:null,
 teacher_id:'teacher',session_id:'session',host_client_id:'tab',host_page_id:'page-1'};
test('un changement d’onglet ne ferme pas une classe vivante',()=>{
 assert.equal(guidedSessionLive(row,now),true);
 assert.equal(guidedSessionLive({...row,close_requested_at:null},now+40000),true);
});
test('fermeture de page : délai de reprise de 15 secondes',()=>{
 assert.equal(CLOSE_GRACE_MS,15000);
 const closing={...row,close_requested_at:new Date(now).toISOString()};
 assert.equal(guidedSessionLive(closing,now+14999),true);
 assert.equal(guidedSessionLive(closing,now+15000),false);
 assert.equal(guidedSessionLive({...closing,close_requested_at:null,host_seen_at:new Date(now+10000).toISOString()},now+15000),true);
});
test('onglet disparu sans signal : expiration de présence, et ne touche pas aux lignes élèves',()=>{
 const silent={...row,host_seen_at:new Date(now-HEARTBEAT_TIMEOUT_MS).toISOString()};
 assert.equal(guidedSessionLive(silent,now),false);
 assert.equal(guidedSessionLive({...row,active:false},now),false);
});
test('seul le même professeur, la même séance ET le même onglet peut prolonger la présence',()=>{
 assert.equal(mayRenewGuidedHost(row,{teacherId:'teacher',sessionId:'session',hostId:'tab',pageId:'page-1'}),true);
 for(const changed of [{teacherId:'élève'}, {sessionId:'autre'}, {hostId:'autre'},{pageId:'old-page'}])
  assert.equal(mayRenewGuidedHost(row,{teacherId:'teacher',sessionId:'session',hostId:'tab',pageId:'page-1',...changed}),false);
});
