-- Metadata only. No student names, identities, states, scores or XP are read.
-- Execute through an authorized READ ONLY transaction before preparing install.
WITH relations AS (
 SELECT c.oid,c.relname,c.relowner,c.relacl,c.relrowsecurity
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relkind IN ('r','p') AND c.relname LIKE 'connect\_%' ESCAPE '\'
), tables AS (
 SELECT r.relname,jsonb_build_object(
  'rls',r.relrowsecurity,
  'columns',(SELECT jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),
    'nullable',NOT a.attnotnull,'default',pg_get_expr(d.adbin,d.adrelid),'generated',a.attgenerated,'identity',a.attidentity) ORDER BY a.attnum)
   FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
   WHERE a.attrelid=r.oid AND a.attnum>0 AND NOT a.attisdropped),
  'constraints',coalesce((SELECT jsonb_agg(pg_get_constraintdef(c.oid) ORDER BY c.conname) FROM pg_constraint c WHERE c.conrelid=r.oid),'[]'::jsonb),
  'indexes',coalesce((SELECT jsonb_agg(pg_get_indexdef(i.indexrelid) ORDER BY pg_get_indexdef(i.indexrelid)) FROM pg_index i WHERE i.indrelid=r.oid),'[]'::jsonb),
  'acl',to_jsonb(r.relacl)
 ) details FROM relations r
), routines AS (
 SELECT p.proname,oidvectortypes(p.proargtypes) arguments,jsonb_build_object(
  'name',p.proname,'arguments',oidvectortypes(p.proargtypes),'returns',format_type(p.prorettype,NULL),
  'definitionMd5',md5(pg_get_functiondef(p.oid)),'securityDefiner',p.prosecdef,'config',to_jsonb(p.proconfig),'acl',to_jsonb(p.proacl)
 ) details FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.prokind='f' AND p.proname LIKE 'connect\_%' ESCAPE '\'
), structure AS (
 SELECT jsonb_build_object(
  'format','mathas-abaque-schema-v1',
  'roles',(SELECT jsonb_agg(rolname ORDER BY rolname) FROM pg_roles WHERE rolname IN ('anon','authenticated','service_role')),
  'tables',coalesce((SELECT jsonb_object_agg(relname,details) FROM tables),'{}'::jsonb),
  'functions',coalesce((SELECT jsonb_agg(details ORDER BY proname,arguments) FROM routines),'[]'::jsonb),
  'triggers',coalesce((SELECT jsonb_agg(jsonb_build_object('table',r.relname,'name',t.tgname,'enabled',t.tgenabled,
    'definition',pg_get_triggerdef(t.oid),'functionMd5',md5(pg_get_functiondef(t.tgfoid))) ORDER BY r.relname,t.tgname)
   FROM pg_trigger t JOIN relations r ON r.oid=t.tgrelid WHERE NOT t.tgisinternal),'[]'::jsonb),
  'eventTriggers',coalesce((SELECT jsonb_agg(jsonb_build_object('name',evtname,'event',evtevent,'enabled',evtenabled,
    'tags',evttags,'functionMd5',md5(pg_get_functiondef(evtfoid))) ORDER BY evtname) FROM pg_event_trigger),'[]'::jsonb),
  'history',jsonb_build_object(
   'count',(SELECT count(*) FROM supabase_migrations.schema_migrations),
   'latest',(SELECT max(version) FROM supabase_migrations.schema_migrations),
   'columns',(SELECT jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),
     'nullable',NOT a.attnotnull,'default',pg_get_expr(d.adbin,d.adrelid),'generated',a.attgenerated,'identity',a.attidentity) ORDER BY a.attnum)
    FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
    WHERE a.attrelid='supabase_migrations.schema_migrations'::regclass AND a.attnum>0 AND NOT a.attisdropped),
   'constraints',(SELECT jsonb_agg(pg_get_constraintdef(oid) ORDER BY conname) FROM pg_constraint WHERE conrelid='supabase_migrations.schema_migrations'::regclass),
   'indexes',(SELECT jsonb_agg(pg_get_indexdef(indexrelid) ORDER BY indexrelid::regclass::text) FROM pg_index WHERE indrelid='supabase_migrations.schema_migrations'::regclass),
   'rls',(SELECT relrowsecurity FROM pg_class WHERE oid='supabase_migrations.schema_migrations'::regclass),
   'customTriggers',(SELECT count(*) FROM pg_trigger WHERE tgrelid='supabase_migrations.schema_migrations'::regclass AND NOT tgisinternal),
   'rules',(SELECT count(*) FROM pg_rewrite WHERE ev_class='supabase_migrations.schema_migrations'::regclass)
  )
 ) value
)
SELECT jsonb_build_object('fingerprint',md5(value::text),'structure',value) audit FROM structure;
