import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {readHostedAudit,normalizeAudit,validateAudit} from '../scripts/calculs-melanges-release.mjs';

const fixture={format:'mathas-mixed-schema-v1',tables:{},functions:[],roles:[],catalogue:{apps:[],rules:[],presets:[]}};
test('hosted audit uses only the official read-only endpoint and keeps token out of process arguments',()=>{
 let captured;
 const audit=readHostedAudit({token:'FICTION_TOKEN',run:(cmd,args,options)=>{
  captured={cmd,args,options};return {status:0,stdout:JSON.stringify([{audit:fixture}])+'\n200'};
 }});
 assert.equal(audit.format,fixture.format);assert.equal(captured.cmd,'curl');assert.deepEqual(captured.args,['--config','-']);
 assert.equal(captured.args.join(' ').includes('FICTION_TOKEN'),false);
 assert.match(captured.options.input,/api\.supabase\.com\/v1\/projects\/awmhpfofacaglewammxt\/database\/query\/read-only/);
 assert.doesNotMatch(captured.options.input,/location|insecure|verbose|trace\s*=/);
 assert.ok(captured.options.timeout<=30000);
 const sql=readFileSync(new URL('../supabase/release-candidates/calculs_melanges_schema_readonly.sql',import.meta.url),'utf8');
 assert.doesNotMatch(sql,/\b(?:FROM|JOIN)\s+(?:public\.)?connect_(?:students|devices|states|xp_credits|xp_milestones|enrollments|parcours_history)\b/i);
});
test('audit never downgrades to writable SQL, echoes remote error bodies, or turns denied access into success',()=>{
 let calls=0;
 const run=()=>{calls++;return {status:0,stdout:'SECRET_OR_UNTRUSTED_ERROR\n401'}};
 assert.throws(()=>readHostedAudit({token:'FICTION',run}),/^Error: schema_http_401 : accès de gestion non validé\.$/);assert.equal(calls,1);
 assert.throws(()=>readHostedAudit({token:'FICTION',run:()=>({status:56,stderr:'SECRET'})}),/schema_network_error \(curl 56\)/);
 assert.throws(()=>readHostedAudit({token:'',run}),/SUPABASE_ACCESS_TOKEN manquant/);assert.equal(calls,1);
 assert.throws(()=>readHostedAudit({token:'FICTION',run:()=>({status:0,stdout:'not json\n200'})}),/unexpected_schema_response/);
});
test('schema verifier rejects missing dependencies, invented report formats and namespace collisions',()=>{
 assert.equal(validateAudit(fixture).ok,false);assert.ok(validateAudit(fixture).issues.includes('missing_table:connect_states'));
 assert.deepEqual(validateAudit({format:'other'}).issues,['invalid_audit_format']);
 assert.throws(()=>normalizeAudit({format:'other'}),/unexpected_schema_response/);
 assert.throws(()=>validateAudit(fixture,'open-everywhere'),/invalid_stage/);
 const installed={...fixture,functions:[{name:'connect_mixed_unreviewed'}]};
 assert.ok(validateAudit(installed).issues.includes('mixed_namespace_exists'));
});
