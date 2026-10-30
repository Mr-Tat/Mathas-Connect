-- Metadata and public catalogue only: never reads pupil identities, states or XP.
-- Also executable through Supabase Management's /database/query/read-only route.
WITH relations AS (
 SELECT c.oid,c.relname,c.relrowsecurity
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relkind IN ('r','p') AND c.relname LIKE 'connect\_%' ESCAPE '\'
), tables AS (
 SELECT r.relname,jsonb_build_object(
  'rls',r.relrowsecurity,
  'columns',(SELECT jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),
    'nullable',NOT a.attnotnull,'default',pg_get_expr(d.adbin,d.adrelid),'generated',a.attgenerated,'identity',a.attidentity) ORDER BY a.attnum)
   FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
   WHERE a.attrelid=r.oid AND a.attnum>0 AND NOT a.attisdropped),
  'uniqueKeys',coalesce((SELECT jsonb_agg(k.columns) FROM (
    SELECT (SELECT jsonb_agg(a.attname ORDER BY keys.ord) FROM unnest(i.indkey) WITH ORDINALITY keys(attnum,ord)
      JOIN pg_attribute a ON a.attrelid=r.oid AND a.attnum=keys.attnum WHERE keys.ord<=i.indnkeyatts) columns
    FROM pg_index i WHERE i.indrelid=r.oid AND i.indisunique AND i.indisvalid AND i.indpred IS NULL AND i.indexprs IS NULL
   ) k),'[]'::jsonb),
  'constraints',coalesce((SELECT jsonb_agg(pg_get_constraintdef(c.oid) ORDER BY c.conname) FROM pg_constraint c WHERE c.conrelid=r.oid),'[]'::jsonb),
  'anonAccess',has_table_privilege(to_regrole('anon'),r.oid,'SELECT,INSERT,UPDATE,DELETE'),
  'authenticatedAccess',has_table_privilege(to_regrole('authenticated'),r.oid,'SELECT,INSERT,UPDATE,DELETE'),
  'publicAccess',EXISTS(SELECT 1 FROM pg_class c,aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a WHERE c.oid=r.oid AND a.grantee=0),
  'serviceWrite',has_table_privilege(to_regrole('service_role'),r.oid,'SELECT') AND has_table_privilege(to_regrole('service_role'),r.oid,'INSERT')
    AND has_table_privilege(to_regrole('service_role'),r.oid,'UPDATE') AND has_table_privilege(to_regrole('service_role'),r.oid,'DELETE')
 ) details FROM relations r
), functions AS (
 SELECT p.proname,jsonb_build_object('name',p.proname,'arguments',oidvectortypes(p.proargtypes),
  'returns',format_type(p.prorettype,NULL),'definitionMd5',md5(pg_get_functiondef(p.oid)),
  'securityDefiner',p.prosecdef,'config',to_jsonb(coalesce(p.proconfig,ARRAY[]::text[])),
  'anonExecute',has_function_privilege(to_regrole('anon'),p.oid,'EXECUTE'),
  'authenticatedExecute',has_function_privilege(to_regrole('authenticated'),p.oid,'EXECUTE'),
  'serviceExecute',has_function_privilege(to_regrole('service_role'),p.oid,'EXECUTE'),
  'publicExecute',EXISTS(SELECT 1 FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE a.grantee=0 AND a.privilege_type='EXECUTE')
 ) details FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.prokind='f' AND p.proname LIKE 'connect\_%' ESCAPE '\'
)
SELECT jsonb_build_object(
 'format','mathas-mixed-schema-v1','serverVersion',current_setting('server_version'),
 'roles',(SELECT jsonb_agg(rolname ORDER BY rolname) FROM pg_roles WHERE rolname IN ('anon','authenticated','service_role')),
 'tables',coalesce((SELECT jsonb_object_agg(relname,details) FROM tables),'{}'::jsonb),
 'functions',coalesce((SELECT jsonb_agg(details ORDER BY proname,details->>'arguments') FROM functions),'[]'::jsonb),
 'triggers',coalesce((SELECT jsonb_agg(jsonb_build_object('table',r.relname,'name',t.tgname,'enabled',t.tgenabled,
   'definition',pg_get_triggerdef(t.oid),'functionDefinitionMd5',md5(pg_get_functiondef(t.tgfoid))) ORDER BY r.relname,t.tgname)
  FROM pg_trigger t JOIN relations r ON r.oid=t.tgrelid WHERE NOT t.tgisinternal),'[]'::jsonb),
 'eventTriggers',coalesce((SELECT jsonb_agg(jsonb_build_object('name',e.evtname,'event',e.evtevent,'enabled',e.evtenabled,
   'tags',e.evttags,'functionDefinitionMd5',md5(pg_get_functiondef(e.evtfoid))) ORDER BY e.evtname) FROM pg_event_trigger e),'[]'::jsonb),
 'catalogue',jsonb_build_object(
  'apps',(SELECT coalesce(jsonb_agg(jsonb_build_object('appKey',app_key,'enabled',enabled,'featured',featured,'launchUrl',launch_url,'imageUrl',image_url)),'[]'::jsonb) FROM public.connect_apps WHERE app_key='melange-calculs-ecrits'),
  'presets',(SELECT coalesce(jsonb_agg(jsonb_build_object('slug',preset_slug,'visible',visible,'featured',featured) ORDER BY preset_slug),'[]'::jsonb) FROM public.connect_hub_preset_entries WHERE app_key='melange-calculs-ecrits'),
  'rules',(SELECT coalesce(jsonb_agg(jsonb_build_object('key',award_key,'points',points) ORDER BY award_key),'[]'::jsonb) FROM public.connect_xp_award_rules WHERE app_key='melange-calculs-ecrits')
 )
) audit;
