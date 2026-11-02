// Offline release preparation only: never opens a socket or applies SQL/Edge.
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const read=file=>readFileSync(path.join(root,file),'utf8');
export const version='20261102020000',name='connect_abaque_longueurs_closed_v1';
export const sqlFile='supabase/release-candidates/20261102_abaque_longueurs_v1.sql';
export const auditFile='supabase/release-candidates/abaque_schema_readonly.sql';
const quote=value=>"'"+String(value).replaceAll("'","''")+"'";
const sha=value=>createHash('sha256').update(value).digest('hex');
const required={
 connect_apps:'app_key:text title:text launch_url:text image_url:text enabled:boolean hub_section:text featured:boolean display_order:integer',
 connect_classes:'id:uuid',connect_students:'id:uuid display_name:text archived_at:timestamp with time zone',
 connect_devices:'auth_user_id:uuid student_id:uuid state:text',
 connect_class_permissions:'teacher_id:uuid class_id:uuid can_manage:boolean can_view_results:boolean',
 connect_enrollments:'student_id:uuid class_id:uuid left_at:timestamp with time zone',
 connect_teacher_players:'teacher_id:uuid student_id:uuid',
 connect_states:'student_id:uuid app_key:text schema_version:integer revision:bigint reset_epoch:bigint state_data:jsonb updated_at:timestamp with time zone',
 connect_xp_credits:'student_id:uuid app_key:text xp_credited:integer evidence:jsonb ruleset_version:integer updated_at:timestamp with time zone',
 connect_level_profiles:'student_id:uuid highest_level_reached:integer level_ruleset_version:integer updated_at:timestamp with time zone',
 connect_parcours_current:'student_id:uuid app_key:text parcours_number:integer repeat_xp:boolean started_at:timestamp with time zone',
 connect_parcours_history:'student_id:uuid app_key:text parcours_number:integer class_id:uuid repeat_xp:boolean state_data:jsonb archived_xp:integer',
 connect_lab_hub_visibility:'app_key:text visible:boolean',
 connect_trophy_achievements:'student_id:uuid app_key:text trophy_key:text',
};
export function normalizeAudit(raw){
 const audit=raw?.audit??raw?.[0]?.audit??raw;
 if(!/^[a-f0-9]{32}$/.test(audit?.fingerprint)||audit.structure?.format!=='mathas-abaque-schema-v1')throw Error('invalid_schema_audit');
 return audit;
}
export function validateAudit(raw){
 const audit=normalizeAudit(raw),s=audit.structure,issues=[];
 for(const role of ['anon','authenticated','service_role'])if(!s.roles?.includes(role))issues.push('missing_role:'+role);
 for(const [table,spec] of Object.entries(required)){
  for(const column of spec.split(/ (?=[a-z_]+:)/)){
   const [key,type]=column.split(':');
   if(s.tables?.[table]?.columns?.find(c=>c.name===key)?.type!==type)issues.push('missing_or_changed_column:'+table+'.'+key);
  }
 }
 if(Object.keys(s.tables||{}).some(t=>t.startsWith('connect_abaque_'))||s.functions?.some(f=>f.name.startsWith('connect_abaque_')))issues.push('abaque_namespace_exists');
 if(!s.functions?.some(f=>f.name==='connect_profile_progress_v1'&&f.arguments==='uuid'&&f.returns==='jsonb'))issues.push('profile_progress_missing');
 const history=s.history;
 if(!history||history.rls||history.customTriggers!==0||history.rules!==0||!Number.isSafeInteger(history.count)||history.count<0||history.latest&&history.latest>=version)issues.push('migration_history_requires_review');
 const columns=history?.columns||[];
 for(const [key,type] of [['version','text'],['name','text'],['statements','text[]']])if(columns.find(c=>c.name===key)?.type!==type)issues.push('history_column:'+key);
 for(const c of columns){
  if(c.generated||c.identity||(!['version','name','statements','idempotency_key'].includes(c.name)&&!c.nullable&&c.default==null))issues.push('unsupported_history_column:'+c.name);
  if(c.name==='idempotency_key'&&c.type!=='text')issues.push('unsupported_idempotency_type');
 }
 if(!history?.constraints?.includes('PRIMARY KEY (version)'))issues.push('history_primary_key_required');
 return {ok:issues.length===0,issues,fingerprint:audit.fingerprint,
  requiresReview:['constraints_indexes_and_triggers','live_Edge_versions','fictive_profile_allowlist','separate_production_authorization']};
}
export function buildInstall(raw){
 const audit=normalizeAudit(raw),check=validateAudit(audit);
 if(!check.ok)throw Error('schema_review_failed:'+check.issues.join(','));
 const source=read(sqlFile),body=source.replace(/^([\s\S]*?)\bBEGIN;\s*/,'').replace(/\s*COMMIT;\s*$/,'');
 if(!body.startsWith('SET LOCAL')||!body.endsWith('END $permissions$;'))throw Error('unexpected_source_envelope');
 const key='mathas-abaque-v1-'+sha(body).slice(0,16),withKey=audit.structure.history.columns.some(c=>c.name==='idempotency_key');
 const query=read(auditFile).trim().replace(/;$/,'');
 return `-- Generated offline; requires separate production authorization.\n-- Single raw SQL batch: do NOT use apply_migration or db push.\nBEGIN;\nSET LOCAL lock_timeout='5s';\nSET LOCAL statement_timeout='45s';\nLOCK TABLE supabase_migrations.schema_migrations IN SHARE ROW EXCLUSIVE MODE;\nDO $audit_guard$\nDECLARE observed jsonb;\nBEGIN\n SELECT result.audit INTO observed FROM (${query}) result;\n IF observed->>'fingerprint' IS DISTINCT FROM ${quote(audit.fingerprint)} THEN RAISE EXCEPTION 'abaque_schema_changed_reaudit_required';END IF;\n IF EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version=${quote(version)} OR name=${quote(name)}${withKey?' OR idempotency_key='+quote(key):''}) THEN RAISE EXCEPTION 'abaque_history_already_exists';END IF;\nEND $audit_guard$;\n${body}\nINSERT INTO supabase_migrations.schema_migrations(version,name,statements${withKey?',idempotency_key':''}) VALUES(${quote(version)},${quote(name)},ARRAY[${quote(body)}]::text[]${withKey?','+quote(key):''});\nDO $closed_postcheck$\nBEGIN\n IF NOT EXISTS(SELECT 1 FROM public.connect_apps WHERE app_key='abaque-longueurs' AND NOT enabled AND NOT featured)\n OR EXISTS(SELECT 1 FROM public.connect_lab_hub_visibility WHERE app_key='abaque-longueurs' AND visible)\n OR EXISTS(SELECT 1 FROM public.connect_hub_preset_entries WHERE app_key='abaque-longueurs')\n OR EXISTS(SELECT 1 FROM public.connect_abaque_classes WHERE enabled)\n OR EXISTS(SELECT 1 FROM public.connect_abaque_pilot_students)\n THEN RAISE EXCEPTION 'abaque_closed_postcheck_failed';END IF;\nEND $closed_postcheck$;\nCOMMIT;\n`;
}
export function buildPilotActivation(profiles){
 const pilot='4bf3400d-a315-4ea4-a2f3-afaca24dc9b9';
 const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
 if(profiles?.classId!==pilot||profiles.fictiveConfirmed!==true||!Array.isArray(profiles.studentIds)||profiles.studentIds.length<1||profiles.studentIds.length>100||!profiles.studentIds.every(id=>typeof id==='string'&&uuid.test(id)))throw Error('explicit_fictive_profiles_required');
 const ids=[...new Set(profiles.studentIds.map(id=>id.toLowerCase()))].sort();
 const list='ARRAY['+ids.map(quote).join(',')+']::uuid[]';
 return `-- Generated offline from explicitly confirmed fictitious IDs only.\n-- Requires separate production authorization; no school catalogue entry.\nBEGIN;\nSET LOCAL lock_timeout='5s';\nSET LOCAL statement_timeout='15s';\nDO $pilot_guard$\nBEGIN\n IF NOT EXISTS(SELECT 1 FROM public.connect_classes WHERE id=${quote(pilot)} AND name='Classe démo - TEST')\n OR NOT EXISTS(SELECT 1 FROM public.connect_abaque_classes WHERE class_id=${quote(pilot)} AND pilot_only)\n OR EXISTS(SELECT 1 FROM public.connect_abaque_classes WHERE class_id<>${quote(pilot)} AND enabled)\n OR EXISTS(SELECT 1 FROM public.connect_hub_preset_entries WHERE app_key='abaque-longueurs')\n OR EXISTS(SELECT 1 FROM public.connect_abaque_pilot_students WHERE NOT(student_id=ANY(${list})))\n THEN RAISE EXCEPTION 'abaque_pilot_scope_changed';END IF;\n IF (SELECT count(*) FROM public.connect_students s WHERE s.id=ANY(${list}) AND s.archived_at IS NULL AND EXISTS(SELECT 1 FROM public.connect_enrollments e WHERE e.student_id=s.id AND e.class_id=${quote(pilot)} AND e.left_at IS NULL))<>${ids.length}\n THEN RAISE EXCEPTION 'abaque_explicit_fictive_enrollments_required';END IF;\nEND $pilot_guard$;\nINSERT INTO public.connect_abaque_pilot_students(student_id) SELECT unnest(${list}) ON CONFLICT DO NOTHING;\nUPDATE public.connect_apps SET enabled=true,featured=false WHERE app_key='abaque-longueurs';\nUPDATE public.connect_abaque_classes SET enabled=true WHERE class_id=${quote(pilot)} AND pilot_only;\nUPDATE public.connect_lab_hub_visibility SET visible=true,updated_at=now() WHERE app_key='abaque-longueurs';\nCOMMIT;\n`;
}
export function releaseManifest(){
 const files=[sqlFile,auditFile,'supabase/release-candidates/abaque_disable_only.sql','supabase/functions/connect-abaque/index.ts','supabase/functions/connect-abaque/handler.mjs','supabase/functions/connect-api/index.ts',
  'hub.js','laboratoire.js',...['index.html','abaque.css','professeur.html','professeur.css','source-manifest.json'].map(x=>'apps/abaque-longueurs/'+x),
  ...['completion-contract.mjs','offline-queue.mjs','bootstrap.mjs','professeur.mjs','native-bridge.js'].map(x=>'apps/abaque-longueurs/connect/'+x)];
 return {appKey:'abaque-longueurs',projectRef:'awmhpfofacaglewammxt',migrationVersion:version,migrationName:name,xpMax:160,trophiesMax:3,defaultAccess:'closed',
  files:Object.fromEntries(files.map(file=>[file,sha(read(file))])),productionExecuted:false};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const [command='manifest',file,output]=process.argv.slice(2);
  if(command==='manifest')console.log(JSON.stringify(releaseManifest(),null,2));
  else if(command==='audit-sql')console.log('BEGIN READ ONLY;\n'+read(auditFile)+'\nROLLBACK;');
  else if(command==='validate'){
   const result=validateAudit(JSON.parse(readFileSync(file,'utf8')));console.log(JSON.stringify(result,null,2));if(!result.ok)process.exitCode=1;
  }else if(command==='prepare-install'||command==='prepare-pilot'){
   if(!output)throw Error('output_path_required');
   const input=JSON.parse(readFileSync(file,'utf8'));
   writeFileSync(output,command==='prepare-install'?buildInstall(input):buildPilotActivation(input),{flag:'wx',mode:0o600});
   console.log('Prepared SQL offline; no production command executed.');
  }else throw Error('unknown_command');
 }catch(error){console.error(error.message);process.exitCode=1;}
}
