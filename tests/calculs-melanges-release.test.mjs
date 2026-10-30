import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {schemaQuery,normalizeAudit,validateAudit} from '../scripts/calculs-melanges-release.mjs';

const script=fileURLToPath(new URL('../scripts/calculs-melanges-release.mjs',import.meta.url));
const fixture={format:'mathas-mixed-schema-v1',tables:{},functions:[],roles:[],catalogue:{apps:[],rules:[],presets:[]}};
const localEnv={...process.env};
for(const key of Object.keys(localEnv))if(key.startsWith('SUPABASE_'))delete localEnv[key];
const run=args=>spawnSync(process.execPath,[script,...args],{encoding:'utf8',env:localEnv});
test('offline schema export runs without Supabase credentials and exports a READ ONLY transaction',()=>{
 const r=run(['schema-query']);assert.equal(r.status,0,r.stderr);assert.equal(r.stdout,schemaQuery());
 assert.match(r.stdout,/^BEGIN READ ONLY;\n/);assert.match(r.stdout,/\nROLLBACK;\n$/);
 assert.doesNotMatch(r.stdout,/\b(?:FROM|JOIN)\s+(?:public\.)?connect_(?:students|devices|states|xp_credits|xp_milestones|enrollments|parcours_history)\b/i);
 assert.match(r.stdout,/pg_trigger/);assert.match(r.stdout,/pg_event_trigger/);
});
test('connector report formats are accepted without claiming a hosted request ran here',()=>{
 for(const value of [fixture,{audit:fixture},[{audit:fixture}]])assert.deepEqual(normalizeAudit(value),fixture);
 const dir=mkdtempSync(path.join(tmpdir(),'mixed-report-test-'));
 try{
  const input=path.join(dir,'connector.json');writeFileSync(input,JSON.stringify([{audit:fixture}]));
  const r=run(['check-report',input]);assert.equal(r.status,1);
  const report=JSON.parse(r.stdout);assert.equal(report.hostedRequests,0);
  assert.equal(report.metadataProvenance,'supplied-json-not-independently-fetched');
  assert.ok(report.validation.issues.includes('missing_table:connect_states'));
 }finally{rmSync(dir,{recursive:true,force:true})}
});
test('offline export never overwrites a supplied report or demands a production secret',()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'mixed-export-test-'));
 try{
  const output=path.join(dir,'query.sql'),first=run(['schema-query','--output',output]);assert.equal(first.status,0,first.stderr);
  assert.equal(JSON.parse(first.stdout).executed,false);assert.equal(readFileSync(output,'utf8'),schemaQuery());
  const second=run(['schema-query','--output',output]);assert.equal(second.status,1);assert.equal(readFileSync(output,'utf8'),schemaQuery());
  const remote=run(['audit']);assert.equal(remote.status,1);assert.match(remote.stderr,/remote_audit_not_part_of_draft/);
  assert.doesNotMatch(remote.stderr,/SUPABASE_ACCESS_TOKEN|login|create.*token/i);
 }finally{rmSync(dir,{recursive:true,force:true})}
});
test('schema verifier rejects missing dependencies, invented report formats and namespace collisions',()=>{
 assert.equal(validateAudit(fixture).ok,false);assert.ok(validateAudit(fixture).issues.includes('missing_table:connect_states'));
 assert.deepEqual(validateAudit({format:'other'}).issues,['invalid_audit_format']);
 assert.throws(()=>normalizeAudit({format:'other'}),/unexpected_schema_response/);
 assert.throws(()=>validateAudit(fixture,'open-everywhere'),/invalid_stage/);
 const installed={...fixture,functions:[{name:'connect_mixed_unreviewed'}]};
 assert.ok(validateAudit(installed).issues.includes('mixed_namespace_exists'));
});
