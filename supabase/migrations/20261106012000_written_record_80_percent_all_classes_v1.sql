-- Same Objectif record requirement in TEST and real classes:
-- an authenticated best of 8/10 or 16/20 in the SAME level.
-- Existing rewards and records are never changed.
CREATE OR REPLACE FUNCTION public.connect_written_record_80_gate_v1(
 p_student uuid,p_app text,p_level integer
) RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER
SET search_path TO '' AS $gate$
 SELECT coalesce((
  SELECT (
   CASE WHEN (state_data#>>ARRAY['classic',(p_level-1)::text,'10']) ~ '^[0-9]{1,2}$'
    THEN (state_data#>>ARRAY['classic',(p_level-1)::text,'10'])::integer ELSE -1 END >= 8
   OR CASE WHEN (state_data#>>ARRAY['classic',(p_level-1)::text,'20']) ~ '^[0-9]{1,2}$'
    THEN (state_data#>>ARRAY['classic',(p_level-1)::text,'20'])::integer ELSE -1 END >= 16
  )
  FROM public.connect_states WHERE student_id=p_student AND app_key=p_app
 ),false) AND p_level BETWEEN 1 AND 3
$gate$;
REVOKE ALL ON FUNCTION public.connect_written_record_80_gate_v1(uuid,text,integer) FROM PUBLIC,anon,authenticated;
DO $fix$
DECLARE
 v_name text;v_def text;v_marker text;v_guard text;v_app text;
BEGIN
 FOR v_name IN SELECT unnest(ARRAY[
 'connect_objective_record_school_issue_extended_v1',
 'connect_objective_record_school_mul_issue_extended_v1',
 'connect_objective_record_school_sub_issue_extended_v1']) LOOP
  SELECT pg_get_functiondef(p.oid) INTO STRICT v_def
   FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname=v_name;
  v_marker:=CASE WHEN v_name='connect_objective_record_school_issue_extended_v1'
    THEN 'SELECT * INTO v_previous' ELSE 'SELECT * INTO v_existing' END;
  IF (length(v_def)-length(replace(v_def,v_marker,'')))/length(v_marker)<>1 THEN
   RAISE EXCEPTION 'Guard installation marker missing in %',v_name;
  END IF;
  v_app:=CASE WHEN v_name='connect_objective_record_school_issue_extended_v1'
    THEN 'p_app' ELSE 'v_app' END;
  v_guard:=format('IF p_mode IN (''three-lives'',''sudden'')
  AND NOT public.connect_written_record_80_gate_v1(p_student,%s,p_level)
  THEN RAISE EXCEPTION ''school_mode_locked''; END IF;
  ',v_app);
  EXECUTE replace(v_def,v_marker,v_guard||v_marker);
 END LOOP;
END
$fix$;