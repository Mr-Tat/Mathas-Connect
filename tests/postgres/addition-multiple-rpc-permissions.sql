\set ON_ERROR_STOP on
DO $test$
DECLARE sig text;
BEGIN
 FOREACH sig IN ARRAY ARRAY[
  'public.connect_parcours_restart_class(uuid,uuid,text,boolean)',
  'public.connect_parcours_restart_one(uuid,uuid,uuid,text,boolean)',
  'public.connect_xp_read_v2(uuid,text,boolean)',
  'public.connect_xp_sync_v2(uuid,text,boolean)'
 ] LOOP
  IF has_function_privilege('anon',sig,'EXECUTE')
    OR has_function_privilege('authenticated',sig,'EXECUTE')
  THEN RAISE EXCEPTION 'public_executable_privileged_rpc: %',sig;END IF;
  IF NOT has_function_privilege('service_role',sig,'EXECUTE')
  THEN RAISE EXCEPTION 'edge_service_role_missing_rpc: %',sig;END IF;
 END LOOP;
END $test$;
