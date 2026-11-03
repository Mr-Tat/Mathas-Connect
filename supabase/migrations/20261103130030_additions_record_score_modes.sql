-- Server-verified result recorder for variable-length challenges. Never callable
-- by anon/authenticated. This routine deliberately does NOT accept browser XP.
CREATE OR REPLACE FUNCTION public.connect_objective_record_school_mode_record_v1(
 p_student uuid,p_class uuid,p_app text,p_event uuid,p_revision bigint,
 p_epoch bigint,p_mode text,p_level integer,p_score integer
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $record$
DECLARE
 v_current public.connect_states%ROWTYPE;v_state jsonb;v_ids jsonb;
 v_recent jsonb;v_event jsonb;v_xp jsonb;v_rewards jsonb;
 v_hash text;v_oldhash text;v_when timestamptz:=now();
 v_idx text;v_path text;v_previous integer;v_points integer;
 v_day text;v_best_today integer;v_key text;
BEGIN
 IF p_student IS NULL OR p_class IS NULL OR
  public.connect_objective_record_school_class_allowed_v1(p_class) IS DISTINCT FROM true
  OR p_app NOT IN ('addition-ecrite-simple','addition-ecrite-multiple')
  OR p_event IS NULL OR p_revision IS NULL OR p_revision<0
  OR p_epoch IS NULL OR p_epoch<0
  OR p_mode NOT IN ('three-lives','sudden','hard-three-lives','hard-sudden')
  OR p_level NOT BETWEEN 1 AND 3 OR p_score NOT BETWEEN 0 AND 64
  OR p_app IS NULL OR p_mode IS NULL OR p_level IS NULL OR p_score IS NULL
 THEN RAISE EXCEPTION 'invalid_result'; END IF;
 PERFORM 1 FROM public.connect_students WHERE id=p_student AND archived_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'inactive_student';END IF;
 IF NOT EXISTS(
  SELECT 1 FROM public.connect_enrollments e WHERE e.student_id=p_student
    AND e.class_id=p_class AND e.left_at IS NULL
 ) AND NOT EXISTS(
  SELECT 1 FROM public.connect_teacher_players tp JOIN public.connect_class_permissions cp
   ON cp.teacher_id=tp.teacher_id AND cp.class_id=p_class AND cp.can_manage=true
   WHERE tp.student_id=p_student
 ) THEN RAISE EXCEPTION 'not_school_subject';END IF;
 v_hash:=pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
   jsonb_build_object('class',p_class,'app',p_app,'mode',p_mode,
   'level',p_level,'score',p_score,'epoch',p_epoch)::text,'UTF8')),'hex');
 SELECT event_hash INTO v_oldhash FROM public.connect_objective_record_school_receipts
  WHERE student_id=p_student AND app_key=p_app AND event_id=p_event;
 IF FOUND THEN
  IF v_oldhash<>v_hash THEN RAISE EXCEPTION 'event_collision';END IF;
  SELECT * INTO v_current FROM public.connect_states
   WHERE student_id=p_student AND app_key=p_app FOR UPDATE;
  v_xp:=public.connect_xp_read_v2(p_student,p_app,false);
  RETURN jsonb_build_object('ok',true,'duplicate',true,'revision',coalesce(v_current.revision,0),
   'resetEpoch',coalesce(v_current.reset_epoch,0),
   'state',coalesce(v_current.state_data,'{}'::jsonb),
   'xp',v_xp||jsonb_build_object('delta',0));
 END IF;
 INSERT INTO public.connect_states(student_id,app_key,schema_version,revision,reset_epoch,state_data)
  VALUES(p_student,p_app,1,0,0,'{}'::jsonb) ON CONFLICT DO NOTHING;
 SELECT * INTO STRICT v_current FROM public.connect_states
  WHERE student_id=p_student AND app_key=p_app FOR UPDATE;
 IF v_current.revision<>p_revision THEN RAISE EXCEPTION 'revision_conflict';END IF;
 IF v_current.reset_epoch<>p_epoch THEN RAISE EXCEPTION 'stale_reset_epoch';END IF;
 v_state:=coalesce(v_current.state_data,'{}'::jsonb);
 v_idx:=(p_level-1)::text;
 v_path:=CASE p_mode WHEN 'three-lives' THEN 'threeLives'
   WHEN 'sudden' THEN 'sudden'
   WHEN 'hard-three-lives' THEN 'hardThreeLives'
   ELSE 'hard' END;
 IF jsonb_typeof(v_state->v_path) IS DISTINCT FROM 'array'
 THEN v_state:=jsonb_set(v_state,ARRAY[v_path],'[0,0,0]'::jsonb,true);END IF;
 v_previous:=coalesce((v_state#>>ARRAY[v_path,v_idx])::integer,0);
 v_state:=jsonb_set(v_state,ARRAY[v_path,v_idx],to_jsonb(greatest(v_previous,p_score)),true);
 v_points:=round(p_score*
  CASE WHEN p_mode LIKE 'hard-%' THEN 3.375*power(1.2::numeric,p_level-1)
       ELSE power(1.5::numeric,p_level-1) END
  *CASE WHEN p_mode IN ('sudden','hard-sudden') THEN 2 ELSE 1 END)::integer;
 v_rewards:=coalesce(public.connect_trophy_rewards_v1(p_student,p_app),
  '{"version":3,"mastery":{"4":[false,false,false],"10":[false,false,false],"20":[false,false,false]},
    "sudden":[false,false,false],"hardAwards":{"bronze":[false,false,false],
    "silver":[false,false,false],"gold":[false,false,false]},
    "scoreOne":{"bronze":false,"silver":false,"gold":false},"unlockedGold":false}'::jsonb);
 IF p_mode='sudden' AND p_score>=25 THEN
  v_rewards:=jsonb_set(v_rewards,ARRAY['sudden',v_idx],'true'::jsonb,false);
 END IF;
 IF p_mode='hard-sudden' THEN
  IF p_score>=3 THEN v_rewards:=jsonb_set(v_rewards,ARRAY['hardAwards','bronze',v_idx],'true'::jsonb,false);END IF;
  IF p_score>=5 THEN v_rewards:=jsonb_set(v_rewards,ARRAY['hardAwards','silver',v_idx],'true'::jsonb,false);END IF;
  IF p_score>=10 THEN v_rewards:=jsonb_set(v_rewards,ARRAY['hardAwards','gold',v_idx],'true'::jsonb,false);END IF;
 END IF;
 IF v_points>=200 THEN v_rewards:=jsonb_set(v_rewards,'{scoreOne,bronze}','true'::jsonb,false);END IF;
 IF v_points>=400 THEN v_rewards:=jsonb_set(v_rewards,'{scoreOne,silver}','true'::jsonb,false);END IF;
 IF v_points>=600 THEN v_rewards:=jsonb_set(v_rewards,'{scoreOne,gold}','true'::jsonb,false);END IF;
 -- Trophy registry owns permanence. Never clear existing unlocks.
 v_state:=jsonb_set(v_state,'{rewards}',v_rewards,true);
 v_ids:=jsonb_build_array(p_event::text)||
  CASE WHEN jsonb_typeof(v_state->'ids')='array' THEN v_state->'ids' ELSE '[]'::jsonb END;
 SELECT coalesce(jsonb_agg(e.value ORDER BY e.ord),'[]'::jsonb) INTO v_ids
  FROM jsonb_array_elements(v_ids) WITH ORDINALITY e(value,ord) WHERE e.ord<=50;
 v_state:=jsonb_set(v_state,'{ids}',v_ids,true);
 v_event:=jsonb_build_object('eventId',p_event::text,'mode',p_mode,
  'level',p_level,'score',p_score,'total',null,'points',v_points,
  'at',to_char(v_when AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
 v_recent:=jsonb_build_array(v_event)||
  CASE WHEN jsonb_typeof(v_state->'recent')='array' THEN v_state->'recent' ELSE '[]'::jsonb END;
 SELECT coalesce(jsonb_agg(e.value ORDER BY e.ord),'[]'::jsonb) INTO v_recent
  FROM jsonb_array_elements(v_recent) WITH ORDINALITY e(value,ord) WHERE e.ord<=3;
 v_state:=jsonb_set(v_state,'{recent}',v_recent,true);
 v_state:=jsonb_set(v_state,'{bestPoints}',to_jsonb(
  greatest(coalesce((v_state->>'bestPoints')::integer,0),v_points)),true);
 v_day:=(v_when AT TIME ZONE 'Europe/Brussels')::date::text;
 v_best_today:=CASE WHEN v_state#>>'{todayBest,day}'=v_day
  THEN coalesce((v_state#>>'{todayBest,points}')::integer,0) ELSE 0 END;
 v_state:=jsonb_set(v_state,'{todayBest}',jsonb_build_object(
  'day',v_day,'points',greatest(v_best_today,v_points)),true);
 INSERT INTO public.connect_objective_record_school_receipts(
  student_id,app_key,event_id,event_hash) VALUES(p_student,p_app,p_event,v_hash);
 UPDATE public.connect_states SET state_data=v_state,revision=v_current.revision+1,
  updated_at=v_when WHERE student_id=p_student AND app_key=p_app;
 v_xp:=public.connect_xp_sync_v2(p_student,p_app,false);
 RETURN jsonb_build_object('ok',true,'duplicate',false,
  'revision',v_current.revision+1,'resetEpoch',v_current.reset_epoch,
  'state',v_state,'xp',v_xp);
END $record$;
REVOKE ALL ON FUNCTION public.connect_objective_record_school_mode_record_v1(
 uuid,uuid,text,uuid,bigint,bigint,text,integer,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.connect_objective_record_school_mode_record_v1(
 uuid,uuid,text,uuid,bigint,bigint,text,integer,integer) TO service_role;
