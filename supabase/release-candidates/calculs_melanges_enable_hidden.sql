-- Controlled pilot activation only AFTER schema/Edge/Pages release checks.
-- Enables direct approved Connect sessions; the four HUB cards remain hidden.
-- Does not change results, XP, reset epochs, other applications or presets.
BEGIN;
DO $preflight$
DECLARE f record; t regclass; expected regprocedure; keys text[]; amounts integer[];
BEGIN
 IF (SELECT count(*) FROM public.connect_apps WHERE app_key='melange-calculs-ecrits'
   AND NOT featured AND launch_url='https://mr-tat.github.io/Mathas-Connect/apps/calculs-melanges/'
   AND image_url='https://mr-tat.github.io/Mathas-Connect/assets/miniatures/melange-calculs-ecrits.webp')<>1
 THEN RAISE EXCEPTION 'mixed_catalogue_not_installed';END IF;
 IF (SELECT array_agg(preset_slug ORDER BY preset_slug) FROM public.connect_hub_preset_entries WHERE app_key='melange-calculs-ecrits')
   IS DISTINCT FROM ARRAY['2eco','observation','phase1','phase2']::text[]
 OR EXISTS(SELECT 1 FROM public.connect_hub_preset_entries WHERE app_key='melange-calculs-ecrits' AND (visible IS DISTINCT FROM false OR featured IS DISTINCT FROM false))
 THEN RAISE EXCEPTION 'mixed_hub_must_be_hidden';END IF;
 SELECT array_agg(award_key ORDER BY award_key),array_agg(points ORDER BY award_key) INTO keys,amounts
 FROM public.connect_xp_award_rules WHERE app_key='melange-calculs-ecrits';
 IF keys IS DISTINCT FROM ARRAY['classic:10:bonus','classic:10:pass','classic:20:bonus','classic:20:pass','classic:4:perfect','hard:3','hard:7','sudden:10','sudden:5']::text[]
 OR amounts IS DISTINCT FROM ARRAY[8,38,13,63,28,12,12,12,12]
 OR EXISTS(SELECT 1 FROM public.connect_xp_award_rules WHERE app_key='melange-calculs-ecrits' AND ruleset_version<>2)
 THEN RAISE EXCEPTION 'mixed_xp_rules_drift';END IF;
 IF (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname LIKE 'connect_mixed_%')<>5
 THEN RAISE EXCEPTION 'mixed_rpc_not_installed';END IF;
 FOREACH expected IN ARRAY ARRAY[
  to_regprocedure('public.connect_mixed_restart_class_v1(uuid,uuid,text,boolean)'),
  to_regprocedure('public.connect_mixed_restart_one_v1(uuid,uuid,uuid,text,boolean)'),
  to_regprocedure('public.connect_mixed_xp_read_v1(uuid,text,boolean)'),
  to_regprocedure('public.connect_mixed_xp_sync_v1(uuid,text,boolean)'),
  to_regprocedure('public.connect_mixed_record_v1(uuid,uuid,bigint,bigint,text,integer,integer,integer,jsonb,jsonb,jsonb,jsonb,boolean,boolean)')
 ] LOOP
  IF expected IS NULL THEN RAISE EXCEPTION 'mixed_rpc_signature_drift';END IF;
 END LOOP;
 FOR f IN SELECT p.* FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname LIKE 'connect_mixed_%' LOOP
  IF NOT f.prosecdef OR NOT coalesce(f.proconfig @> ARRAY['search_path=public, pg_temp'],false)
   OR has_function_privilege('anon',f.oid,'EXECUTE') OR has_function_privilege('authenticated',f.oid,'EXECUTE')
   OR NOT has_function_privilege('service_role',f.oid,'EXECUTE')
   OR EXISTS(SELECT 1 FROM aclexplode(coalesce(f.proacl,acldefault('f',f.proowner))) a WHERE a.grantee=0 AND a.privilege_type='EXECUTE')
  THEN RAISE EXCEPTION 'mixed_unsafe_rpc';END IF;
 END LOOP;
 FOREACH t IN ARRAY ARRAY[to_regclass('public.connect_mixed_receipts'),to_regclass('public.connect_mixed_multiplier_locks')] LOOP
  IF t IS NULL OR NOT EXISTS(SELECT 1 FROM pg_class WHERE oid=t AND relrowsecurity)
   OR has_table_privilege('anon',t,'SELECT,INSERT,UPDATE,DELETE') OR has_table_privilege('authenticated',t,'SELECT,INSERT,UPDATE,DELETE')
   OR NOT has_table_privilege('service_role',t,'SELECT') OR NOT has_table_privilege('service_role',t,'INSERT')
   OR NOT has_table_privilege('service_role',t,'UPDATE') OR NOT has_table_privilege('service_role',t,'DELETE')
   OR EXISTS(SELECT 1 FROM pg_class c,aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a WHERE c.oid=t AND a.grantee=0)
  THEN RAISE EXCEPTION 'mixed_unsafe_table';END IF;
 END LOOP;
END $preflight$;
UPDATE public.connect_apps SET enabled=true WHERE app_key='melange-calculs-ecrits';
COMMIT;
