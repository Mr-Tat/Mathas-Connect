-- Advanced award: invoked ONLY by a server-grading SQL function, never directly by Edge or browser.
-- Only callable by a validated arithmetic proof. Never expose this RPC to pupils.
-- Real-school private transaction, called solely by server-grader, NEVER by a browser.
-- Browser/native scores are excluded. Database also enforces school enrollment.
-- The INSERT/UPDATE trigger connect_trophy_capture_v1 inserts permanent cups.
CREATE OR REPLACE FUNCTION public.connect_objective_record_advanced_award_v1(
 p_student uuid,p_class uuid,p_app text,p_event uuid,p_expected_revision bigint,
 p_reset_epoch bigint,p_mode text,p_level integer,p_score integer,p_total integer
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $record$
DECLARE
 v_class constant uuid:=p_class;
 v_current public.connect_states%ROWTYPE;
 v_state jsonb;v_ids jsonb;v_recent jsonb;v_event jsonb;
 v_hash text;v_existing text;v_when timestamptz:=now();v_i int;
 v_previous int;v_points int;v_xp jsonb;v_day text;v_best_today int;v_rewards jsonb;v_track text;
BEGIN
 IF (p_class IS NULL OR public.connect_objective_record_school_class_allowed_v1(p_class) IS DISTINCT FROM true)
  OR p_app NOT IN ('addition-ecrite-simple','addition-ecrite-multiple')
  OR p_student IS NULL OR p_event IS NULL
  OR p_expected_revision IS NULL OR p_expected_revision<0
  OR p_reset_epoch IS NULL OR p_reset_epoch<0
  OR p_mode NOT IN ('three-lives','sudden','hard-three-lives','hard-sudden') OR p_level NOT BETWEEN 1 AND 3
  OR p_score IS NULL OR p_score NOT BETWEEN 0 AND 1000
  OR p_total IS NOT NULL
 THEN RAISE EXCEPTION 'invalid_result';END IF;
 PERFORM 1 FROM public.connect_students WHERE id=p_student AND archived_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'inactive_student';END IF;
 -- Defence in depth: every advanced award is class-bound, and the teacher
 -- may only use their separately authorized personal player profile.
 IF NOT EXISTS(
   SELECT 1 FROM public.connect_enrollments e
   WHERE e.student_id=p_student AND e.class_id=v_class AND e.left_at IS NULL
 ) AND NOT EXISTS(
   SELECT 1 FROM public.connect_teacher_players tp
   JOIN public.connect_class_permissions cp ON cp.teacher_id=tp.teacher_id
   WHERE tp.student_id=p_student AND cp.class_id=v_class AND cp.can_manage=true
 ) THEN RAISE EXCEPTION 'not_school_subject';END IF;
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
 FOR v_track IN SELECT unnest(ARRAY['threeLives','sudden','hardThreeLives','hard']) LOOP
  IF jsonb_typeof(v_state->v_track) IS DISTINCT FROM 'array' THEN
   v_state:=jsonb_set(v_state,ARRAY[v_track],'[null,null,null]'::jsonb,true);
  END IF;
 END LOOP;
 v_track:=CASE p_mode
  WHEN 'three-lives' THEN 'threeLives'
  WHEN 'sudden' THEN 'sudden'
  WHEN 'hard-three-lives' THEN 'hardThreeLives'
  WHEN 'hard-sudden' THEN 'hard' END;
 v_previous:=coalesce((v_state#>>ARRAY[v_track,v_i::text])::integer,0);
 v_state:=jsonb_set(v_state,ARRAY[v_track,v_i::text],
    to_jsonb(greatest(v_previous,p_score)),true);
 v_points:=round(
  p_score*
  CASE WHEN p_mode LIKE 'hard-%'
    THEN 3.375::numeric*power(1.2::numeric,p_level-1)
    ELSE power(1.5::numeric,p_level-1) END*
  CASE WHEN p_mode IN ('sudden','hard-sudden') THEN 2 ELSE 1 END
 )::integer;
 -- Import ALL trophies previously captured by the permanent registry (survives reset).
 -- No client-sent trophy fields or localStorage state can grant these awards.
 v_rewards:=coalesce(public.connect_trophy_rewards_v1(p_student,p_app),
 '{"version":3,"mastery":{"4":[false,false,false],"10":[false,false,false],"20":[false,false,false]},
 "sudden":[false,false,false],"hardAwards":{"bronze":[false,false,false],
 "silver":[false,false,false],"gold":[false,false,false]},
 "scoreOne":{"bronze":false,"silver":false,"gold":false},
 "unlockedGold":false}'::jsonb);
 IF p_mode='sudden' AND p_score>=25 THEN
  v_rewards:=jsonb_set(v_rewards,ARRAY['sudden',v_i::text],'true'::jsonb,false);
 END IF;
 IF p_mode='hard-sudden' THEN
  IF p_score>=3 THEN v_rewards:=jsonb_set(v_rewards,ARRAY['hardAwards','bronze',v_i::text],'true'::jsonb,false);END IF;
  IF p_score>=5 THEN v_rewards:=jsonb_set(v_rewards,ARRAY['hardAwards','silver',v_i::text],'true'::jsonb,false);END IF;
  IF p_score>=10 THEN v_rewards:=jsonb_set(v_rewards,ARRAY['hardAwards','gold',v_i::text],'true'::jsonb,false);END IF;
 END IF;
 -- Score-only trophies are derived from verified score, never the browser.
 IF v_points>=200 THEN v_rewards:=jsonb_set(v_rewards,'{scoreOne,bronze}','true'::jsonb,false);END IF;
 IF v_points>=400 THEN v_rewards:=jsonb_set(v_rewards,'{scoreOne,silver}','true'::jsonb,false);END IF;
 IF v_points>=600 THEN v_rewards:=jsonb_set(v_rewards,'{scoreOne,gold}','true'::jsonb,false);END IF;
 -- Hard milestones and cups require the correct server-verified stop condition.
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
 -- Lower-stage XP from 3 lives and HARD 3 lives shares the fixed 474 XP schedule.
 -- A harder sudden-death record also earns the earlier stage automatically.
 -- Never add new award rules or credits beyond the existing nine stage rules.
 IF p_mode='three-lives' AND p_score>=5 THEN
  INSERT INTO public.connect_xp_milestones(student_id,app_key,milestone_key,evidence)
  VALUES(p_student,p_app,'sudden:'||p_level||':5',
    jsonb_build_object('source','advanced_proof','mode',p_mode,'eventId',p_event,'score',p_score))
  ON CONFLICT DO NOTHING;
 ELSIF p_mode='hard-three-lives' AND p_score>=3 THEN
  INSERT INTO public.connect_xp_milestones(student_id,app_key,milestone_key,evidence)
  VALUES(p_student,p_app,'hard:'||p_level||':3',
    jsonb_build_object('source','advanced_proof','mode',p_mode,'eventId',p_event,'score',p_score))
  ON CONFLICT DO NOTHING;
 END IF;
 v_xp:=public.connect_xp_sync_v2(p_student,p_app,false);
 RETURN jsonb_build_object('ok',true,'duplicate',false,'revision',v_current.revision+1,
  'resetEpoch',v_current.reset_epoch,'state',v_state,'xp',v_xp);
END $record$;

-- Newly defined SCHOOL function has no inherited privileges: explicitly revoke
-- the PostgreSQL default PUBLIC EXECUTE and grant only the trusted Edge service.
REVOKE ALL ON FUNCTION public.connect_objective_record_advanced_award_v1(
 uuid,uuid,text,uuid,bigint,bigint,text,integer,integer,integer)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.connect_objective_record_advanced_award_v1(
 uuid,uuid,text,uuid,bigint,bigint,text,integer,integer,integer)
 TO service_role;
