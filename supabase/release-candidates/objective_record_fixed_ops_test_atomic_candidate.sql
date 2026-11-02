-- TEST-only candidate. Runs on the official Connect tables; never deploy or
-- open to real classes before private arithmetic sessions and reviewed migration.
-- It avoids the legacy two-HTTP-call state/XP split for fixed-operation engines.
BEGIN;
CREATE TABLE IF NOT EXISTS public.connect_objective_record_test_receipts(
 student_id uuid NOT NULL REFERENCES public.connect_students(id),
 app_key text NOT NULL REFERENCES public.connect_apps(app_key),
 event_id uuid NOT NULL,
 event_hash text NOT NULL CHECK(length(event_hash)=64),
 recorded_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(student_id,app_key,event_id)
);
ALTER TABLE public.connect_objective_record_test_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.connect_objective_record_test_receipts FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.connect_objective_record_test_receipts TO service_role;

CREATE OR REPLACE FUNCTION public.connect_objective_record_test_fixed_v1(
 p_student uuid,p_class uuid,p_app text,p_event uuid,p_expected_revision bigint,
 p_reset_epoch bigint,p_mode text,p_level integer,p_score integer,p_total integer
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $record$
DECLARE
 v_test constant uuid:='4bf3400d-a315-4ea4-a2f3-afaca24dc9b9';
 v_current public.connect_states%ROWTYPE;
 v_state jsonb;v_ids jsonb;v_recent jsonb;v_event jsonb;
 v_hash text;v_existing text;v_when timestamptz:=now();v_i int;
 v_previous int;v_points int;v_xp jsonb;v_day text;v_best_today int;
BEGIN
 IF p_class IS DISTINCT FROM v_test OR p_app NOT IN
  ('addition-ecrite-simple','soustraction-ecrite-simple','multiplication-ecrite-simple')
  OR p_student IS NULL OR p_event IS NULL
  OR p_expected_revision IS NULL OR p_expected_revision<0
  OR p_reset_epoch IS NULL OR p_reset_epoch<0
  OR p_mode NOT IN ('classic','sudden') OR p_level NOT BETWEEN 1 AND 3
  OR p_score IS NULL OR p_score NOT BETWEEN 0 AND 1000
  OR (p_mode='classic' AND (p_total NOT IN (4,10,20) OR p_total IS NULL OR p_score>p_total))
  OR (p_mode='sudden' AND p_total IS NOT NULL)
 THEN RAISE EXCEPTION 'invalid_result';END IF;
 PERFORM 1 FROM public.connect_students WHERE id=p_student AND archived_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'inactive_student';END IF;
 -- Defence in depth: even service_role cannot submit a TEST-class award for
 -- a real-class pupil. Monsieur T is accepted only if the teacher is actually
 -- authorized in TEST and the pupil id is that teacher's explicit player.
 IF NOT EXISTS(
   SELECT 1 FROM public.connect_enrollments e
   WHERE e.student_id=p_student AND e.class_id=v_test AND e.left_at IS NULL
 ) AND NOT EXISTS(
   SELECT 1 FROM public.connect_teacher_players tp
   JOIN public.connect_class_permissions cp ON cp.teacher_id=tp.teacher_id
   WHERE tp.student_id=p_student AND cp.class_id=v_test AND cp.can_manage=true
 ) THEN RAISE EXCEPTION 'not_test_subject';END IF;
 v_hash:=pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
 jsonb_build_object('app',p_app,'class',p_class,'mode',p_mode,'level',p_level,
   'score',p_score,'total',p_total,'epoch',p_reset_epoch)::text,'UTF8')),'hex');
 SELECT event_hash INTO v_existing FROM public.connect_objective_record_test_receipts
  WHERE student_id=p_student AND app_key=p_app AND event_id=p_event;
 IF FOUND THEN
  IF v_existing<>v_hash THEN RAISE EXCEPTION 'event_collision';END IF;
  SELECT * INTO v_current FROM public.connect_states
   WHERE student_id=p_student AND app_key=p_app FOR UPDATE;
  v_xp:=public.connect_xp_read_v2(p_student,p_app,false);
  RETURN jsonb_build_object('ok',true,'duplicate',true,
   'revision',coalesce(v_current.revision,0),'resetEpoch',coalesce(v_current.reset_epoch,0),
   'state',coalesce(v_current.state_data,'{}'::jsonb),
   'xp',v_xp||jsonb_build_object('delta',0));
 END IF;
 INSERT INTO public.connect_states(student_id,app_key,schema_version,revision,reset_epoch,state_data)
 VALUES(p_student,p_app,1,0,0,'{}'::jsonb) ON CONFLICT DO NOTHING;
 SELECT * INTO STRICT v_current FROM public.connect_states
  WHERE student_id=p_student AND app_key=p_app FOR UPDATE;
 IF v_current.reset_epoch<>p_reset_epoch THEN RAISE EXCEPTION 'stale_reset_epoch';END IF;
 IF v_current.revision<>p_expected_revision THEN RAISE EXCEPTION 'revision_conflict';END IF;
 v_state:=coalesce(v_current.state_data,'{}'::jsonb);
 IF jsonb_typeof(v_state->'classic') IS DISTINCT FROM 'array'
 THEN v_state:=jsonb_set(v_state,'{classic}','[{}, {}, {}]'::jsonb,true);END IF;
 IF jsonb_typeof(v_state->'sudden') IS DISTINCT FROM 'array'
 THEN v_state:=jsonb_set(v_state,'{sudden}','[null,null,null]'::jsonb,true);END IF;
 IF jsonb_typeof(v_state->'progress') IS DISTINCT FROM 'object'
 THEN v_state:=jsonb_set(v_state,'{progress}','{}'::jsonb,true);END IF;
 v_i:=p_level-1;
 IF p_mode='classic' THEN
  v_previous:=coalesce((v_state#>>ARRAY['classic',v_i::text,p_total::text])::int,0);
  v_state:=jsonb_set(v_state,ARRAY['classic',v_i::text,p_total::text],
   to_jsonb(greatest(v_previous,p_score)),true);
  IF p_total>=10 AND p_score*5>=p_total*4 THEN
   v_state:=jsonb_set(v_state,ARRAY['progress','sudden'||p_level],to_jsonb(true),true);
   IF p_level=1 THEN v_state:=jsonb_set(v_state,'{progress,level2}',to_jsonb(true),true);END IF;
   IF p_level=2 THEN v_state:=jsonb_set(v_state,'{progress,level3}',to_jsonb(true),true);END IF;
  END IF;
  IF p_total>=10 AND p_score=p_total THEN
   v_state:=jsonb_set(v_state,ARRAY['progress','perfect'||p_level],to_jsonb(true),true);
  END IF;
  IF (v_state#>>'{progress,perfect1}')::boolean IS TRUE
   AND (v_state#>>'{progress,perfect2}')::boolean IS TRUE
   AND (v_state#>>'{progress,perfect3}')::boolean IS TRUE
  THEN v_state:=jsonb_set(v_state,'{progress,hard}',to_jsonb(true),true);END IF;
 ELSE
  v_previous:=coalesce((v_state#>>ARRAY['sudden',v_i::text])::int,0);
  v_state:=jsonb_set(v_state,ARRAY['sudden',v_i::text],
   to_jsonb(greatest(v_previous,p_score)),true);
 END IF;
 v_points:=round(p_score*power(1.5::numeric,p_level-1)*
   CASE p_mode WHEN 'sudden' THEN 2 ELSE
     CASE p_total WHEN 4 THEN 4 WHEN 10 THEN 3 ELSE 2 END END)::int;
 v_ids:=jsonb_build_array(p_event::text)||
  CASE WHEN jsonb_typeof(v_state->'ids')='array' THEN v_state->'ids' ELSE '[]'::jsonb END;
 SELECT coalesce(jsonb_agg(e.value ORDER BY e.ord),'[]'::jsonb) INTO v_ids
  FROM jsonb_array_elements(v_ids) WITH ORDINALITY AS e(value,ord) WHERE e.ord<=50;
 v_state:=jsonb_set(v_state,'{ids}',v_ids,true);
 v_event:=jsonb_build_object('eventId',p_event::text,'mode',p_mode,'level',p_level,
  'score',p_score,'total',p_total,'points',v_points,
  'at',to_char(v_when AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
 v_recent:=jsonb_build_array(v_event)||
  CASE WHEN jsonb_typeof(v_state->'recent')='array' THEN v_state->'recent' ELSE '[]'::jsonb END;
 SELECT coalesce(jsonb_agg(e.value ORDER BY e.ord),'[]'::jsonb) INTO v_recent
  FROM jsonb_array_elements(v_recent) WITH ORDINALITY AS e(value,ord) WHERE e.ord<=3;
 v_state:=jsonb_set(v_state,'{recent}',v_recent,true);
 v_state:=jsonb_set(v_state,'{bestPoints}',
  to_jsonb(greatest(coalesce((v_state->>'bestPoints')::int,0),v_points)),true);
 v_day:=(v_when AT TIME ZONE 'Europe/Brussels')::date::text;
 v_best_today:=CASE WHEN v_state#>>'{todayBest,day}'=v_day
  THEN coalesce((v_state#>>'{todayBest,points}')::int,0) ELSE 0 END;
 v_state:=jsonb_set(v_state,'{todayBest}',
  jsonb_build_object('day',v_day,'points',greatest(v_best_today,v_points)),true);
 INSERT INTO public.connect_objective_record_test_receipts(student_id,app_key,event_id,event_hash)
  VALUES(p_student,p_app,p_event,v_hash);
 UPDATE public.connect_states SET state_data=v_state,revision=v_current.revision+1,
  updated_at=v_when WHERE student_id=p_student AND app_key=p_app;
 -- One PostgreSQL transaction owns the receipt, state revision and official XP.
 v_xp:=public.connect_xp_sync_v2(p_student,p_app,false);
 RETURN jsonb_build_object('ok',true,'duplicate',false,'revision',v_current.revision+1,
  'resetEpoch',v_current.reset_epoch,'state',v_state,'xp',v_xp);
END $record$;
REVOKE ALL ON FUNCTION public.connect_objective_record_test_fixed_v1(
 uuid,uuid,text,uuid,bigint,bigint,text,integer,integer,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.connect_objective_record_test_fixed_v1(
 uuid,uuid,text,uuid,bigint,bigint,text,integer,integer,integer) TO service_role;
COMMIT;
