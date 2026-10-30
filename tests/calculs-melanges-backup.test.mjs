import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';

const source=readFileSync(new URL('../scripts/backup-weekly.mjs',import.meta.url),'utf8').replace(/^import .*;\n/,'');
async function run({installed=true,missing=null}={}){
 const requested=[],uploaded=[];
 const secret=Buffer.alloc(32,17);
 const fixture={connect_apps:installed?[{app_key:'melange-calculs-ecrits',enabled:false}]:[],
  connect_mixed_receipts:[{student_id:'fiction',event_id:'event',reset_epoch:0}],
  connect_mixed_multiplier_locks:[{class_id:'fiction',scope_key:'class',multipliers:[2,4]}]};
 const fetch=async(url,options={})=>{
  if(url.includes('/rest/v1/')){
   const table=new URL(url).pathname.split('/').pop();requested.push(table);
   return new Response(JSON.stringify(fixture[table]||[]),{status:table===missing?404:200});
  }
  if(options.method==='PUT'){uploaded.push(JSON.parse(options.body));return new Response('{}');}
  return new Response('{"private":true}');
 };
 const env={SUPABASE_PROJECT_URL:'https://fiction.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'sb_secret_FICTION',
  BACKUP_PRIVATE_REPO:'fiction/private',BACKUP_REPO_TOKEN:'FICTION',BACKUP_ENCRYPTION_KEY_BASE64:secret.toString('base64')};
 const context={crypto:webcrypto,Buffer,Uint8Array,TextEncoder,process:{env},URL,fetch,console:{log(){}},Error};
 let error=null;
 try{await vm.runInNewContext('(async()=>{'+source+'})()',context)}catch(e){error=e}
 let snapshot=null;
 if(uploaded.length){
  const wrapped=JSON.parse(Buffer.from(uploaded[0].content,'base64').toString());
  const key=await webcrypto.subtle.importKey('raw',secret,{name:'AES-GCM'},false,['decrypt']);
  const plain=await webcrypto.subtle.decrypt({name:'AES-GCM',iv:Buffer.from(wrapped.iv,'base64')},key,Buffer.from(wrapped.ciphertext,'base64'));
  snapshot=JSON.parse(Buffer.from(plain).toString());
 }
 return {requested,uploaded,snapshot,error};
}
test('encrypted emergency backup retains durable mixed receipts and independent multiplier locks',async()=>{
 const r=await run();assert.equal(r.error,null);assert.equal(Object.keys(r.snapshot.tables).length,27);
 assert.deepEqual(r.snapshot.tables.connect_mixed_receipts,[{student_id:'fiction',event_id:'event',reset_epoch:0}]);
 assert.deepEqual(r.snapshot.tables.connect_mixed_multiplier_locks[0].multipliers,[2,4]);
 assert.equal(r.uploaded[0].content.includes('student_id'),false);
});
test('uninstalled mixed application preserves the existing backup without new table requests',async()=>{
 const r=await run({installed:false});assert.equal(r.error,null);assert.equal(Object.keys(r.snapshot.tables).length,25);
 assert.equal(r.requested.some(name=>name.startsWith('connect_mixed_')),false);
});
test('installed mixed application cannot publish an incomplete backup if either new table is missing',async()=>{
 for(const missing of ['connect_mixed_receipts','connect_mixed_multiplier_locks']){
  const r=await run({missing});assert.match(r.error?.message||'',/HTTP 404/);assert.equal(r.uploaded.length,0);
 }
});
