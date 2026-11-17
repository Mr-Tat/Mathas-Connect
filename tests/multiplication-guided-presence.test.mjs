import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
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

test('reprise explicite : même professeur seulement, verrou atomique et ancien onglet révoqué',()=>{
 const edge=readFileSync(new URL('../supabase/functions/connect-guided-multiplication/index.ts',import.meta.url),'utf8');
 const ui=readFileSync(new URL('../apps/multiplication-simple/collective-ui.mjs',import.meta.url),'utf8');
 assert.match(edge,/'takeover'/);
 const teacherCheck=edge.indexOf("if(!teacher)return fail('teacher_only',403)");
 const ownershipCheck=edge.indexOf("if(current.teacher_id!==user.id)");
 const takeover=edge.indexOf("if(b.action==='takeover')");
 const tabCheck=edge.indexOf("if(current.host_client_id&&");
 assert.ok(teacherCheck>0&&teacherCheck<ownershipCheck&&ownershipCheck<takeover&&takeover<tabCheck,
  'teacher rights and same-account check must precede transfer');
 assert.match(edge,/if\(b\.revision!==Number\(current\.revision\)\)return fail\('session_changed'/);
 assert.match(edge,/\.eq\('session_id',current\.session_id\)/);
 assert.match(edge,/\.eq\('host_client_id',current\.host_client_id\)/);
 assert.match(edge,/\.eq\('host_page_id',current\.host_page_id\)/);
 assert.match(edge,/if\(b\.action==='status'\|\|b\.action==='resume'\)/);
 assert.match(ui,/if\(teacher&&validSession\(current\)&&current\.hostOwned!==true\)/);
 assert.match(ui,/if\(!confirm\('Cette séance est contrôlée par un autre onglet professeur/);
 assert.match(ui,/call\('takeover',\{sessionId:current\.sessionId/);
 assert.match(ui,/await call\('status',\{hostId,pageId\}\)/);
});
