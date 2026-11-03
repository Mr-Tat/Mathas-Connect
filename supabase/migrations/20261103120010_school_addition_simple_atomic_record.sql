-- Only callable by a validated arithmetic proof. Never expose this RPC to pupils.
-- Real-school private transaction, called solely by server-grader, NEVER by a browser.
-- Browser/native scores are excluded. Database also enforces school enrollment.
-- The INSERT/UPDATE trigger connect_trophy_capture_v1 inserts permanent cups.
CREATE OR REPLACE FUNCTION public.connect_objective_record_school_fixed_v1(
 p_student uuid,p_class uuid,p_app text,p_event uuid,p_expected_revision bigint,
 p_reset_epoch bigint,p_mode text,p_level integer,p_score integer,p_total integer
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $record$
DECLARE
 v_class constant uuid:=p_class;
 v_current public.connect_states%ROWTYPE;
 v_state jsonb;v_ids jsonb;v_recent jsonb;v_event jsonb;
 v_hash text;v_existing text;v_when timestamptz:=now();v_i int;
 v_previous int;v_points int;v_xp jsonb;v_day text;v_best_today int;v_rewards jsonb;
BEGIN
 IF (p_class IS NULL OR public.connect_objective_record_school_class_allowed_v1(p_class) IS DISTINCT FROM true)
  OR p_app IS DISTINCT FROM 'addition-ecrite-simple'
  OR p_student IS NULL OR p_event IS NULL
  OR p_expected_revision IS NULL OR p_expected_revision<0
  OR p_reset_epoch IS NULL OR p_reset_epoch<0
  OR p_mode IS DISTINCT FROM 'classic' OR p_level NOT BETWEEN 1 AND 3
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
   WHERE e.student_id=p_student AND e.class_id=v_class AND e.left_at IS NULL
 ) AND NOT EXISTS(
   SELECT 1 FROM public.connect_teacher_players tp
   JOIN public.connect_class_permissions cp ON cp.teacher_id=tp.teacher_id
   WHERE tp.student_id=p_student AND cp.class_id=v_class AND cp.can_manage=true
 ) THEN RAISE EXCEPTION 'not_test_subject';END IF;
 v_hash:=pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
 jsonb_build_object('app',p_app,'class',p_class,'mode',p_mode,'level',p_level,
   'score',p_score,'total',p_total,'epoch',p_reset_epoch)::text,'UTF8')),'hex');
 SELECT event_hash INTO v_existing FROM public.connect_objective_record_school_receipts
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
 -- Import ALL trophies previously captured by the permanent registry (survives reset).
 -- No client-sent trophy fields or localStorage state can grant these awards.
 v_rewards:=coalesce(public.connect_trophy_rewards_v1(p_student,p_app),
 '{"version":3,"mastery":{"4":[false,false,false],"10":[false,false,false],"20":[false,false,false]},
 "sudden":[false,false,false],"hardAwards":{"bronze":[false,false,false],
 "silver":[false,false,false],"gold":[false,false,false]},
 "scoreOne":{"bronze":false,"silver":false,"gold":false},
 "unlockedGold":false}'::jsonb);
 IF p_mode='classic' AND p_score=p_total THEN
  v_rewards:=jsonb_set(v_rewards,ARRAY['mastery',p_total::text,v_i::text],'true'::jsonb,false);
 END IF;
 IF p_mode='sudden' AND p_score>=25 THEN
  v_rewards:=jsonb_set(v_rewards,ARRAY['sudden',v_i::text],'true'::jsonb,false);
 END IF;
 -- Single-session score cups. The 2x sudden score affects points only,
 -- never the XP awarded by connect_xp_sync_v2.
 IF v_points>=200 THEN v_rewards:=jsonb_set(v_rewards,'{scoreOne,bronze}','true'::jsonb,false);END IF;
 IF v_points>=400 THEN v_rewards:=jsonb_set(v_rewards,'{scoreOne,silver}','true'::jsonb,false);END IF;
 IF v_points>=600 THEN v_rewards:=jsonb_set(v_rewards,'{scoreOne,gold}','true'::jsonb,false);END IF;
 -- Hard trophies and unlockedGold are intentionally NOT awarded by these modes.
 v_state:=jsonb_set(v_state,'{rewards}',v_rewards,true);
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
 INSERT INTO public.connect_objective_record_school_receipts(student_id,app_key,event_id,event_hash)
  VALUES(p_student,p_app,p_event,v_hash);
 UPDATE public.connect_states SET state_data=v_state,revision=v_current.revision+1,
  updated_at=v_when WHERE student_id=p_student AND app_key=p_app;
 -- One PostgreSQL transaction owns the receipt, state revision and official XP.
 v_xp:=public.connect_xp_sync_v2(p_student,p_app,false);
 RETURN jsonb_build_object('ok',true,'duplicate',false,'revision',v_current.revision+1,
  'resetEpoch',v_current.reset_epoch,'state',v_state,'xp',v_xp);
END $record$;

-- Newly defined SCHOOL function has no inherited privileges: explicitly revoke
-- the PostgreSQL default PUBLIC EXECUTE and grant only the trusted Edge service.
REVOKE ALL ON FUNCTION public.connect_objective_record_school_fixed_v1(
 uuid,uuid,text,uuid,bigint,bigint,text,integer,integer,integer)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.connect_objective_record_school_fixed_v1(
 uuid,uuid,text,uuid,bigint,bigint,text,integer,integer,integer)
 TO service_role;
