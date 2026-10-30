// Offline draft/release checks. No network, hosted credentials or deployment.
import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root=fileURLToPath(new URL('../',import.meta.url));
export const projectRef='awmhpfofacaglewammxt';
export const appKey='melange-calculs-ecrits';
const read=file=>readFileSync(path.join(root,file),'utf8');
const sqlFile='supabase/release-candidates/calculs_melanges_schema_readonly.sql';
export const requiredSchema={
 connect_apps:'app_key:text title:text launch_url:text image_url:text enabled:boolean hub_section:text featured:boolean display_order:integer',
 connect_hub_preset_entries:'preset_slug:text app_key:text section:text display_order:integer visible:boolean featured:boolean',
 connect_xp_award_rules:'app_key:text award_key:text points:integer ruleset_version:integer',
 connect_students:'id:uuid archived_at:timestamp with time zone',
 connect_class_permissions:'class_id:uuid teacher_id:uuid can_manage:boolean',
 connect_enrollments:'student_id:uuid class_id:uuid left_at:timestamp with time zone',
 connect_devices:'auth_user_id:uuid student_id:uuid state:text',
 connect_teacher_players:'teacher_id:uuid student_id:uuid',
 connect_states:'student_id:uuid app_key:text schema_version:integer revision:bigint reset_epoch:bigint state_data:jsonb updated_at:timestamp with time zone',
 connect_xp_milestones:'student_id:uuid app_key:text milestone_key:text evidence:jsonb achieved_at:timestamp with time zone',
 connect_xp_credits:'student_id:uuid app_key:text xp_credited:integer evidence:jsonb ruleset_version:integer updated_at:timestamp with time zone',
 connect_level_profiles:'student_id:uuid highest_level_reached:integer level_ruleset_version:integer updated_at:timestamp with time zone',
 connect_parcours_current:'student_id:uuid app_key:text parcours_number:integer repeat_xp:boolean started_at:timestamp with time zone',
 connect_parcours_history:'student_id:uuid app_key:text parcours_number:integer class_id:uuid repeat_xp:boolean state_data:jsonb archived_xp:integer ended_at:timestamp with time zone',
 connect_parcours_xp_bonus:'student_id:uuid app_key:text parcours_number:integer milestone_key:text points:integer achieved_at:timestamp with time zone',
};
const mixedSchema={
 connect_mixed_receipts:'student_id:uuid event_id:uuid reset_epoch:bigint created_at:timestamp with time zone',
 connect_mixed_multiplier_locks:'class_id:uuid scope_key:text multipliers:integer[]',
};
// Split before each column name; retain spaces inside PostgreSQL type names.
const columns=spec=>spec.split(/ (?=[a-z_]+:)/).map(s=>s.split(':'));
const uniqueKeys={
 connect_apps:['app_key'],connect_hub_preset_entries:['preset_slug','app_key'],connect_xp_award_rules:['app_key','award_key'],
 connect_students:['id'],connect_states:['student_id','app_key'],connect_xp_milestones:['student_id','app_key','milestone_key'],
 connect_xp_credits:['student_id','app_key'],connect_level_profiles:['student_id'],connect_parcours_current:['student_id','app_key'],
 connect_parcours_history:['student_id','app_key','parcours_number'],connect_parcours_xp_bonus:['student_id','app_key','parcours_number','milestone_key'],
 connect_mixed_receipts:['student_id','event_id'],connect_mixed_multiplier_locks:['class_id','scope_key'],
};
const insertColumns={
 connect_apps:'app_key title launch_url image_url enabled hub_section featured display_order',
 connect_hub_preset_entries:'preset_slug app_key section display_order visible featured',connect_xp_award_rules:'app_key award_key points',
 connect_states:'student_id app_key schema_version revision reset_epoch state_data updated_at',
 connect_xp_milestones:'student_id app_key milestone_key evidence',connect_xp_credits:'student_id app_key xp_credited evidence ruleset_version updated_at',
 connect_level_profiles:'student_id highest_level_reached level_ruleset_version updated_at',connect_parcours_current:'student_id app_key parcours_number repeat_xp started_at',
 connect_parcours_history:'student_id app_key parcours_number class_id repeat_xp state_data archived_xp',
 connect_parcours_xp_bonus:'student_id app_key parcours_number milestone_key points',
};
const signatures={
 connect_mixed_restart_class_v1:'uuid, uuid, text, boolean',connect_mixed_restart_one_v1:'uuid, uuid, uuid, text, boolean',
 connect_mixed_xp_read_v1:'uuid, text, boolean',connect_mixed_xp_sync_v1:'uuid, text, boolean',
 connect_mixed_record_v1:'uuid, uuid, bigint, bigint, text, integer, integer, integer, jsonb, jsonb, jsonb, jsonb, boolean, boolean',
};
const rules={'classic:4:perfect':28,'classic:10:pass':38,'classic:10:bonus':8,'classic:20:pass':63,'classic:20:bonus':13,'sudden:5':12,'sudden:10':12,'hard:3':12,'hard:7':12};
const sameSet=(a,b)=>Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&[...a].sort().every((x,i)=>x===[...b].sort()[i]);
export function validateAudit(audit,stage='before-install'){
 if(!['before-install','installed-hidden','enabled-hidden'].includes(stage))throw Error('invalid_stage');
 const issues=[];
 if(audit?.format!=='mathas-mixed-schema-v1')return {ok:false,stage,issues:['invalid_audit_format']};
 const tables=audit.tables||{};
 for(const role of ['anon','authenticated','service_role'])if(!audit.roles?.includes(role))issues.push('missing_role:'+role);
 for(const [name,spec] of Object.entries({...requiredSchema,...(stage==='before-install'?{}:mixedSchema)})){
  const table=tables[name];if(!table){issues.push('missing_table:'+name);continue;}
  for(const [column,type] of columns(spec)){
   const actual=table.columns?.find(c=>c.name===column);
   if(!actual)issues.push('missing_column:'+name+'.'+column);
   else if(actual.type!==type)issues.push('column_type:'+name+'.'+column+':'+actual.type);
  }
  if(uniqueKeys[name]&&!table.uniqueKeys?.some(k=>sameSet(k,uniqueKeys[name])))issues.push('missing_unique_key:'+name);
  if(insertColumns[name])for(const c of table.columns||[]){
   if(c.nullable===false&&c.default==null&&!c.generated&&!c.identity&&!insertColumns[name].split(' ').includes(c.name))issues.push('insert_requires_value:'+name+'.'+c.name);
  }
 }
 const mixedFunctions=(audit.functions||[]).filter(f=>f.name.startsWith('connect_mixed_'));
 const catalogue=audit.catalogue||{};
 if(stage==='before-install'){
  if(mixedFunctions.length||Object.keys(tables).some(k=>k.startsWith('connect_mixed_'))||catalogue.apps?.length||catalogue.rules?.length||catalogue.presets?.length)issues.push('mixed_namespace_exists');
 }else{
  if(mixedFunctions.length!==5)issues.push('mixed_function_count');
  for(const [name,args] of Object.entries(signatures)){
   const f=mixedFunctions.find(f=>f.name===name&&f.arguments===args);
   if(!f){issues.push('missing_function:'+name);continue;}
   if(f.returns!=='jsonb'||f.securityDefiner!==true||!f.config?.includes('search_path=public, pg_temp')||f.anonExecute!==false||f.authenticatedExecute!==false||f.publicExecute!==false||f.serviceExecute!==true)issues.push('unsafe_function:'+name);
  }
  for(const name of ['connect_mixed_receipts','connect_mixed_multiplier_locks']){
   const t=tables[name];if(!t||t.rls!==true||t.anonAccess!==false||t.authenticatedAccess!==false||t.publicAccess!==false||t.serviceWrite!==true)issues.push('unsafe_private_table:'+name);
  }
  const app=catalogue.apps?.[0];
  if(catalogue.apps?.length!==1||app?.enabled!==(stage==='enabled-hidden')||app?.featured!==false||app?.launchUrl!=='https://mr-tat.github.io/Mathas-Connect/apps/calculs-melanges/'||app?.imageUrl!=='https://mr-tat.github.io/Mathas-Connect/assets/miniatures/melange-calculs-ecrits.webp')issues.push('unexpected_app_catalogue');
  if(!sameSet(catalogue.presets?.map(p=>p.slug),['observation','phase1','phase2','2eco'])||catalogue.presets?.some(p=>p.visible!==false||p.featured!==false))issues.push('hub_not_hidden');
  if(catalogue.rules?.length!==9||Object.entries(rules).some(([key,points])=>{const r=catalogue.rules?.find(r=>r.key===key);return r?.points!==points||r?.rulesetVersion!==2}))issues.push('xp_rules_drift');
 }
 return {ok:issues.length===0,stage,issues,scope:'schema_and_catalogue_only',requiresReview:['constraints_and_triggers','deployed_edge_source','hosted_auth_and_browser']};
}
export function normalizeAudit(raw){
 const value=raw?.audit??raw?.[0]?.audit??raw;
 if(value?.format!=='mathas-mixed-schema-v1')throw Error('unexpected_schema_response');
 return value;
}
export function schemaQuery(){
 // Can be run by the separately authorized connector. Exporting never executes
 // SQL. The same READ ONLY transaction is exercised in disposable PostgreSQL.
 return 'BEGIN READ ONLY;\n'+read(sqlFile).trim()+'\nROLLBACK;\n';
}
export function releasePlan(){
 const files=['app.js','apps/calculs-melanges/connect-pilot.mjs','supabase/functions/connect-results/index.ts',
  'apps/calculs-melanges/source-manifest.json',sqlFile,'supabase/release-candidates/calculs_melanges_locked_v1.sql',
  'supabase/release-candidates/calculs_melanges_connect_enable.patch',
  'supabase/release-candidates/calculs_melanges_enable_hidden.sql','supabase/release-candidates/calculs_melanges_disable_only.sql'];
 const flags=[['app.js','MIXED_TEACHER_READY'],['apps/calculs-melanges/connect-pilot.mjs','CONNECT_WRITE_READY'],['supabase/functions/connect-results/index.ts','MIXED_SERVER_READY']];
 const gates=Object.fromEntries(flags.map(([file,name])=>{const value=read(file).match(new RegExp('\\bconst '+name+'=(true|false);'))?.[1];if(!value)throw Error('missing_gate:'+name);return [name,value==='true'];}));
 const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
 return {format:'mathas-mixed-release-plan-v1',projectRef,appKey,head:git('rev-parse','HEAD'),dirty:!!git('status','--porcelain'),
  sourceCommit:JSON.parse(read('apps/calculs-melanges/source-manifest.json')).commit,gates,
  staticCatalogueContainsMixed:read('hub-catalog.json').includes(appKey),
  files:Object.fromEntries(files.map(file=>[file,createHash('sha256').update(readFileSync(path.join(root,file))).digest('hex')])),
  xpMax:594,xpPolicyVersion:2,fullRateSelectedOperations:3,restrictedRate:0.5,missingPointsCanBeCompleted:true,
  hostedStatus:'not-verified-in-this-session',hostedCredentialsRequired:false,commandPerformsProductionWrites:false};
}
async function main(args){
 const command=args.shift()||'plan';let stage='before-install',output=null,file=null;
 while(args.length){const a=args.shift();if(a==='--stage')stage=args.shift();else if(a==='--output')output=args.shift();else if(!file)file=a;else throw Error('unexpected_argument');}
 if(!['before-install','installed-hidden','enabled-hidden'].includes(stage))throw Error('invalid_stage');
 let result;
 if(command==='schema-query'){
  if(file)throw Error('unexpected_argument');
  if(output){writeFileSync(output,schemaQuery(),{flag:'wx',mode:0o600});console.log(JSON.stringify({output,executed:false}));}
  else process.stdout.write(schemaQuery());
  return;
 }
 if(command==='plan')result=releasePlan();
 else if(command==='check-report'){
  if(!file)throw Error('schema_report_path_required');
  const audit=normalizeAudit(JSON.parse(readFileSync(file,'utf8')));
  result={checkedAt:new Date().toISOString(),projectRef,metadataProvenance:'supplied-json-not-independently-fetched',hostedRequests:0,validation:validateAudit(audit,stage),audit};
  if(!result.validation.ok)process.exitCode=1;
 }else if(command==='audit')throw Error('remote_audit_not_part_of_draft: export schema-query and use check-report FILE; no hosted credentials are required.');
 else throw Error('usage: plan | schema-query [--output /tmp/query.sql] | check-report FILE [--stage before-install|installed-hidden|enabled-hidden] [--output /tmp/report.json]');
 const json=JSON.stringify(result,null,2)+'\n';
 if(output){writeFileSync(output,json,{flag:'wx',mode:0o600});console.log(JSON.stringify({output,validation:result.validation??null}));}
 else console.log(json);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main(process.argv.slice(2)).catch(e=>{console.error(e.message);process.exitCode=1});
