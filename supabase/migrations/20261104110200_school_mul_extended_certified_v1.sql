-- Isolated multiplication extended proof using shared private school session ledger.
-- No addition, projection UI, or existing trophy key is modified.

-- Authoritative XP, records, permanent trophies, projection event and
-- idempotent receipt for server-graded extended modes, one transaction.
-- The 474-XP curriculum remains unchanged: three-lives shares its
-- milestone *pool* with Mort subite; HARD three-lives with HARD Mort subite.
-- Separate best scores remain visible for each mode, never double-credit XP.
CREATE OR REPLACE FUNCTION public.connect_objective_record_school_mul_record_extended_v1(
 p_student uuid,p_class uuid,p_app text,p_event uuid,
 p_expected_revision bigint,p_reset_epoch bigint,
 p_mode text,p_level integer,p_score integer,p_attempted integer,p_hash text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $record$
DECLARE
 v_row public.connect_states%ROWTYPE;
 v_state jsonb;v_rewards jsonb;v_i text:=(p_level-1)::text;
 v_shared text;v_mode_key text;
 v_previous integer;v_points integer;v_xp jsonb;
 v_event jsonb;v_ids jsonb;v_recent jsonb;v_when timestamptz:=now();
 v_day text;v_best_today integer;
BEGIN
 IF p_student IS NULL OR p_class IS NULL OR p_event IS NULL
  OR (public.connect_objective_record_school_class_allowed_v1(p_class) IS DISTINCT FROM true AND p_class <> '4bf3400d-a315-4ea4-a2f3-afaca24dc9b9'::uuid)
  OR p_app IS DISTINCT FROM 'multiplication-ecrite-simple' OR p_app IS NULL
  OR p_mode NOT IN ('sudden','three-lives','hard-sudden','hard-three-lives') OR p_mode IS NULL
  OR p_level NOT BETWEEN 1 AND 3 OR p_level IS NULL
  OR p_score IS NULL OR p_score<0 OR p_score>120
  OR p_attempted IS NULL OR p_attempted NOT BETWEEN 1 AND 120 OR p_score>p_attempted
  OR p_expected_revision IS NULL OR p_expected_revision<0
  OR p_reset_epoch IS NULL OR p_reset_epoch<0
  OR p_hash IS NULL OR length(p_hash)<>64
 THEN RAISE EXCEPTION 'invalid_result';END IF;
 PERFORM 1 FROM public.connect_students WHERE id=p_student AND archived_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'inactive_student';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.connect_enrollments
     WHERE student_id=p_student AND class_id=p_class AND left_at IS NULL)
  AND NOT EXISTS(SELECT 1 FROM public.connect_teacher_players tp
     JOIN public.connect_class_permissions cp ON cp.teacher_id=tp.teacher_id
     WHERE tp.student_id=p_student AND cp.class_id=p_class AND cp.can_manage=true)
 THEN RAISE EXCEPTION 'not_school_subject';END IF;
 INSERT INTO public.connect_states(student_id,app_key,schema_version,revision,reset_epoch,state_data)
 VALUES(p_student,p_app,1,0,0,'{}'::jsonb) ON CONFLICT DO NOTHING;
 SELECT * INTO STRICT v_row FROM public.connect_states
 WHERE student_id=p_student AND app_key=p_app FOR UPDATE;
 IF v_row.reset_epoch<>p_reset_epoch THEN RAISE EXCEPTION 'stale_reset_epoch';END IF;
 IF EXISTS(SELECT 1 FROM public.connect_objective_record_school_receipts
    WHERE student_id=p_student AND app_key=p_app AND event_id=p_event)
 THEN RAISE EXCEPTION 'proof_replay_collision';END IF;
 IF v_row.revision<>p_expected_revision THEN RAISE EXCEPTION 'revision_conflict';END IF;
 v_state:=coalesce(v_row.state_data,'{}'::jsonb);
 IF jsonb_typeof(v_state->'sudden') IS DISTINCT FROM 'array'
 THEN v_state:=jsonb_set(v_state,'{sudden}','[0,0,0]'::jsonb,true);END IF;
 IF jsonb_typeof(v_state->'hard') IS DISTINCT FROM 'array'
 THEN v_state:=jsonb_set(v_state,'{hard}','[0,0,0]'::jsonb,true);END IF;
 IF jsonb_typeof(v_state->'threeLives') IS DISTINCT FROM 'array'
 THEN v_state:=jsonb_set(v_state,'{threeLives}','[0,0,0]'::jsonb,true);END IF;
 IF jsonb_typeof(v_state->'hardThree') IS DISTINCT FROM 'array'
 THEN v_state:=jsonb_set(v_state,'{hardThree}','[0,0,0]'::jsonb,true);END IF;
 v_shared:=CASE WHEN p_mode LIKE 'hard-%' THEN 'hard' ELSE 'sudden' END;
 v_mode_key:=CASE p_mode WHEN 'three-lives' THEN 'threeLives'
   WHEN 'hard-three-lives' THEN 'hardThree' ELSE v_shared END;
 v_previous:=coalesce((v_state#>>ARRAY[v_mode_key,v_i])::integer,0);
 v_state:=jsonb_set(v_state,ARRAY[v_mode_key,v_i],
   to_jsonb(greatest(v_previous,p_score)),true);
 -- Preserve best threshold evidence independently of the chosen mode.
 IF v_shared<>v_mode_key THEN
  v_previous:=coalesce((v_state#>>ARRAY[v_shared,v_i])::integer,0);
  v_state:=jsonb_set(v_state,ARRAY[v_shared,v_i],
    to_jsonb(greatest(v_previous,p_score)),true);
 END IF;
 v_points:=round(p_score * CASE WHEN p_mode LIKE 'hard-%'
    THEN 3.375::numeric*power(1.2::numeric,p_level-1)
    ELSE power(1.5::numeric,p_level-1) END
    * CASE WHEN p_mode IN ('sudden','hard-sudden') THEN 2 ELSE 1 END)::integer;
 -- Read the permanent ledger, not ephemeral local browser trophy claims.
 v_rewards:=coalesce(public.connect_trophy_rewards_v1(p_student,p_app),
  '{"version":3,"mastery":{"4":[false,false,false],"10":[false,false,false],"20":[false,false,false]},"sudden":[false,false,false],"hardAwards":{"bronze":[false,false,false],"silver":[false,false,false],"gold":[false,false,false]},"scoreOne":{"bronze":false,"silver":false,"gold":false},"unlockedGold":false}'::jsonb);
 IF p_mode='sudden' AND p_score>=25 THEN
  v_rewards:=jsonb_set(v_rewards,ARRAY['sudden',v_i],'true'::jsonb,false);
 END IF;
 IF p_mode='hard-sudden' THEN
  IF p_score>=3 THEN v_rewards:=jsonb_set(v_rewards,ARRAY['hardAwards','bronze',v_i],'true'::jsonb,false);END IF;
  IF p_score>=5 THEN v_rewards:=jsonb_set(v_rewards,ARRAY['hardAwards','silver',v_i],'true'::jsonb,false);END IF;
  IF p_score>=10 THEN v_rewards:=jsonb_set(v_rewards,ARRAY['hardAwards','gold',v_i],'true'::jsonb,false);END IF;
 END IF;
 IF v_points>=200 THEN v_rewards:=jsonb_set(v_rewards,'{scoreOne,bronze}','true'::jsonb,false);END IF;
 IF v_points>=400 THEN v_rewards:=jsonb_set(v_rewards,'{scoreOne,silver}','true'::jsonb,false);END IF;
 IF v_points>=600 THEN v_rewards:=jsonb_set(v_rewards,'{scoreOne,gold}','true'::jsonb,false);END IF;
 v_state:=jsonb_set(v_state,'{rewards}',v_rewards,true);
 v_ids:=jsonb_build_array(p_event::text)||
  CASE WHEN jsonb_typeof(v_state->'ids')='array' THEN v_state->'ids' ELSE '[]'::jsonb END;
 SELECT coalesce(jsonb_agg(value ORDER BY ord),'[]'::jsonb) INTO v_ids
 FROM jsonb_array_elements(v_ids) WITH ORDINALITY AS item(value,ord) WHERE ord<=50;
 v_state:=jsonb_set(v_state,'{ids}',v_ids,true);
 v_event:=jsonb_build_object('eventId',p_event::text,'mode',p_mode,'level',p_level,
  'score',p_score,'total',NULL,'points',v_points,
  'at',to_char(v_when AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
 v_recent:=jsonb_build_array(v_event)||
  CASE WHEN jsonb_typeof(v_state->'recent')='array' THEN v_state->'recent' ELSE '[]'::jsonb END;
 SELECT coalesce(jsonb_agg(value ORDER BY ord),'[]'::jsonb) INTO v_recent
 FROM jsonb_array_elements(v_recent) WITH ORDINALITY AS item(value,ord) WHERE ord<=3;
 v_state:=jsonb_set(v_state,'{recent}',v_recent,true);
 v_state:=jsonb_set(v_state,'{bestPoints}',
  to_jsonb(greatest(coalesce((v_state->>'bestPoints')::integer,0),v_points)),true);
 v_day:=(v_when AT TIME ZONE 'Europe/Brussels')::date::text;
 v_best_today:=CASE WHEN v_state#>>'{todayBest,day}'=v_day
 THEN coalesce((v_state#>>'{todayBest,points}')::integer,0) ELSE 0 END;
 v_state:=jsonb_set(v_state,'{todayBest}',
  jsonb_build_object('day',v_day,'points',greatest(v_best_today,v_points)),true);
 INSERT INTO public.connect_objective_record_school_receipts(student_id,app_key,event_id,event_hash)
 VALUES(p_student,p_app,p_event,p_hash);
 UPDATE public.connect_states SET state_data=v_state,revision=v_row.revision+1,
  updated_at=v_when WHERE student_id=p_student AND app_key=p_app;
 v_xp:=public.connect_xp_sync_v2(p_student,p_app,false);
 RETURN jsonb_build_object('ok',true,'duplicate',false,'proofVerified',true,
   'verifiedScore',p_score,'attempted',p_attempted,'mode',p_mode,
   'revision',v_row.revision+1,'resetEpoch',v_row.reset_epoch,
   'state',v_state,'xp',v_xp);
END $record$;
REVOKE ALL ON FUNCTION public.connect_objective_record_school_mul_record_extended_v1(
 uuid,uuid,text,uuid,bigint,bigint,text,integer,integer,integer,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.connect_objective_record_school_mul_record_extended_v1(
 uuid,uuid,text,uuid,bigint,bigint,text,integer,integer,integer,text)
 TO service_role;


-- Same private extended challenge table as Addition, segregated by app_key.
-- The teacher's required multiplication tables remain mandatory.
CREATE OR REPLACE FUNCTION public.connect_objective_record_school_mul_issue_extended_v1(
 p_student uuid,p_class uuid,p_mode text,p_level integer,p_multipliers integer[]
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $issue$
DECLARE
 v_app constant text:='multiplication-ecrite-simple';
 v_total constant integer:=120;
 v_rev bigint;v_epoch bigint;v_existing record;v_locked integer[];
 v_questions jsonb:='[]'::jsonb;v_a numeric;v_m integer;v_i integer;
 v_width integer;v_len integer;v_base numeric;
 v_id uuid;v_expires timestamptz;v_state jsonb;
BEGIN
 IF p_student IS NULL OR p_class IS NULL OR
    (p_class <> '4bf3400d-a315-4ea4-a2f3-afaca24dc9b9'::uuid
     AND public.connect_objective_record_school_class_allowed_v1(p_class) IS DISTINCT FROM true)
 THEN RAISE EXCEPTION 'school_class_not_allowed';END IF;
 IF p_mode NOT IN ('three-lives','sudden','hard-three-lives','hard-sudden')
  OR p_mode IS NULL OR p_level NOT IN (1,2,3) OR p_level IS NULL
  OR p_multipliers IS NULL OR cardinality(p_multipliers) NOT BETWEEN 1 AND 8
  OR (SELECT count(DISTINCT n) FROM unnest(p_multipliers) n)<>cardinality(p_multipliers)
  OR EXISTS(SELECT 1 FROM unnest(p_multipliers) n WHERE n NOT BETWEEN 2 AND 9)
  OR (p_mode LIKE 'hard-%' AND p_multipliers<>ARRAY[2,3,4,5,6,7,8,9])
 THEN RAISE EXCEPTION 'invalid_proof_configuration';END IF;
 PERFORM 1 FROM public.connect_students WHERE id=p_student AND archived_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'inactive_student';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.connect_enrollments e
   WHERE e.student_id=p_student AND e.class_id=p_class AND e.left_at IS NULL)
 AND NOT EXISTS(SELECT 1 FROM public.connect_teacher_players tp
   JOIN public.connect_class_permissions cp ON cp.teacher_id=tp.teacher_id
   WHERE tp.student_id=p_student AND cp.class_id=p_class AND cp.can_manage=true)
 THEN RAISE EXCEPTION 'not_school_subject';END IF;
 SELECT multipliers INTO v_locked FROM public.connect_multiplier_locks
 WHERE class_id=p_class AND scope_key IN(p_student::text,'class')
 ORDER BY CASE WHEN scope_key=p_student::text THEN 0 ELSE 1 END LIMIT 1;
 IF v_locked IS NOT NULL AND NOT(v_locked <@ p_multipliers)
 THEN RAISE EXCEPTION 'multipliers_not_allowed';END IF;
 SELECT coalesce(revision,0),coalesce(reset_epoch,0),state_data INTO v_rev,v_epoch,v_state
 FROM public.connect_states WHERE student_id=p_student AND app_key=v_app;
 v_rev:=coalesce(v_rev,0);v_epoch:=coalesce(v_epoch,0);v_state:=coalesce(v_state,'{}'::jsonb);
 -- Existing school modes stay locked until authentic Connect results unlock them.
 -- Keep the TEST class available for isolated certification scenarios.
 IF p_class <> '4bf3400d-a315-4ea4-a2f3-afaca24dc9b9'::uuid THEN
  IF p_mode LIKE 'hard-%' THEN
   IF (v_state#>>'{progress,hard}')::boolean IS DISTINCT FROM true
   THEN RAISE EXCEPTION 'school_mode_locked';END IF;
  ELSE
   IF (v_state#>>ARRAY['progress','sudden'||p_level])::boolean IS DISTINCT FROM true
   THEN RAISE EXCEPTION 'school_mode_locked';END IF;
  END IF;
 END IF;
 SELECT * INTO v_existing FROM public.connect_objective_record_school_extended_sessions
 WHERE student_id=p_student AND class_id=p_class AND app_key=v_app
  AND mode=p_mode AND level=p_level AND consumed_at IS NULL
  AND expected_revision=v_rev AND reset_epoch=v_epoch AND expires_at>now()
  AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(questions) q
    WHERE (q->>'m')::integer <> ALL(p_multipliers))
 ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
 IF FOUND THEN RETURN jsonb_build_object('ok',true,'sessionId',v_existing.session_id,
   'questions',v_existing.questions,'level',p_level,'width',v_existing.width,
   'mode',p_mode,'limit',v_total,'revision',v_rev,'resetEpoch',v_epoch,
   'expiresAt',v_existing.expires_at,'reused',true);
 END IF;
 v_width:=CASE WHEN p_mode LIKE 'hard-%' THEN
  CASE p_level WHEN 1 THEN 10 WHEN 2 THEN 12 ELSE 16 END
 ELSE CASE p_level WHEN 1 THEN 3 WHEN 2 THEN 5 ELSE 7 END END;
 FOR v_i IN 1..v_total LOOP
  v_len:=v_width-CASE WHEN random()<0.15 THEN 1 ELSE 0 END;
  v_base:=power(10::numeric,v_len-1);
  v_a:=v_base+floor(random()*9*v_base);
  v_m:=p_multipliers[1+floor(random()*cardinality(p_multipliers))::integer];
  v_questions:=v_questions||jsonb_build_array(jsonb_build_object(
    'id','q'||v_i,'op','mul','a',v_a::text,'m',v_m,'width',v_len));
 END LOOP;
 INSERT INTO public.connect_objective_record_school_extended_sessions(
 student_id,class_id,app_key,mode,level,width,total,expected_revision,
 reset_epoch,questions,expires_at)
 VALUES(p_student,p_class,v_app,p_mode,p_level,v_width,v_total,v_rev,
  v_epoch,v_questions,now()+interval '8 hours')
 RETURNING session_id,expires_at INTO v_id,v_expires;
 RETURN jsonb_build_object('ok',true,'sessionId',v_id,'questions',v_questions,
  'level',p_level,'width',v_width,'mode',p_mode,'limit',v_total,
  'revision',v_rev,'resetEpoch',v_epoch,'expiresAt',v_expires,'reused',false);
END $issue$;
REVOKE ALL ON FUNCTION public.connect_objective_record_school_mul_issue_extended_v1(uuid,uuid,text,integer,integer[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.connect_objective_record_school_mul_issue_extended_v1(uuid,uuid,text,integer,integer[]) TO service_role;


-- Numeric arithmetic handles 10/12/16-digit HARD multiplicands exactly.
-- The client never provides a score; incorrect first answers end sudden/3-vies.
CREATE OR REPLACE FUNCTION public.connect_objective_record_school_mul_finish_extended_v1(
 p_student uuid,p_class uuid,p_session uuid,p_answers jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $finish$
DECLARE
 v_app constant text:='multiplication-ecrite-simple';
 v_s public.connect_objective_record_school_extended_sessions%ROWTYPE;
 v_q jsonb;v_ans jsonb;v_digits jsonb;v_carries jsonb;
 v_i integer;v_j integer;v_a numeric;v_m integer;v_width integer;
 v_product numeric;v_expected text;v_actual text;
 v_correct boolean;v_score integer:=0;v_errors integer:=0;v_lives integer;
 v_count integer;v_hash text;v_ack jsonb;
BEGIN
 IF p_student IS NULL OR p_class IS NULL OR p_session IS NULL
  OR (p_class <> '4bf3400d-a315-4ea4-a2f3-afaca24dc9b9'::uuid
    AND public.connect_objective_record_school_class_allowed_v1(p_class) IS DISTINCT FROM true)
  OR jsonb_typeof(p_answers) IS DISTINCT FROM 'array'
  OR jsonb_array_length(p_answers) NOT BETWEEN 1 AND 120
 THEN RAISE EXCEPTION 'invalid_proof_answers';END IF;
 PERFORM 1 FROM public.connect_students WHERE id=p_student AND archived_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'inactive_student';END IF;
 SELECT * INTO v_s FROM public.connect_objective_record_school_extended_sessions
 WHERE session_id=p_session AND student_id=p_student AND class_id=p_class AND app_key=v_app FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'proof_not_found';END IF;
 v_count:=jsonb_array_length(p_answers);
 v_hash:=pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_answers::text,'UTF8')),'hex');
 IF v_s.consumed_at IS NOT NULL THEN
  IF v_s.answers_hash<>v_hash THEN RAISE EXCEPTION 'proof_replay_collision';END IF;
  RETURN v_s.result||jsonb_build_object('duplicate',true,
   'xp',v_s.result->'xp'||jsonb_build_object('delta',0));
 END IF;
 IF v_s.expires_at<=now() THEN RAISE EXCEPTION 'proof_expired';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.connect_enrollments e
   WHERE e.student_id=p_student AND e.class_id=p_class AND e.left_at IS NULL)
 AND NOT EXISTS(SELECT 1 FROM public.connect_teacher_players tp
   JOIN public.connect_class_permissions cp ON cp.teacher_id=tp.teacher_id
   WHERE tp.student_id=p_student AND cp.class_id=p_class AND cp.can_manage=true)
 THEN RAISE EXCEPTION 'not_school_subject';END IF;
 IF v_s.total<>120 OR jsonb_array_length(v_s.questions)<>120
  OR v_s.level NOT BETWEEN 1 AND 3 OR v_s.mode NOT IN ('sudden','three-lives','hard-sudden','hard-three-lives')
  OR v_s.width NOT IN (3,5,7,10,12,16)
 THEN RAISE EXCEPTION 'invalid_proof_configuration';END IF;
 v_lives:=CASE WHEN v_s.mode LIKE '%three-lives' THEN 3 ELSE 1 END;
 FOR v_i IN 0..v_count-1 LOOP
  IF v_errors>=v_lives THEN RAISE EXCEPTION 'proof_continued_after_end';END IF;
  v_q:=v_s.questions->v_i;v_ans:=p_answers->v_i;
  IF jsonb_typeof(v_ans) IS DISTINCT FROM 'object'
   OR (SELECT count(*) FROM jsonb_object_keys(v_ans))<>3
   OR NOT(v_ans ? 'id' AND v_ans ? 'digits' AND v_ans ? 'carries')
   OR v_ans->>'id' IS DISTINCT FROM v_q->>'id'
   OR jsonb_typeof(v_ans->'digits') IS DISTINCT FROM 'array'
   OR jsonb_typeof(v_ans->'carries') IS DISTINCT FROM 'array'
   OR v_q->>'op' IS DISTINCT FROM 'mul'
   OR (v_q->>'a') !~ '^[1-9][0-9]{1,15}$'
   OR (v_q->>'m') !~ '^[2-9]$'
  THEN RAISE EXCEPTION 'invalid_proof_answers';END IF;
  v_a:=(v_q->>'a')::numeric;v_m:=(v_q->>'m')::integer;
  v_width:=length(v_q->>'a');
  IF v_q->>'width' IS DISTINCT FROM v_width::text
   OR v_width NOT BETWEEN v_s.width-1 AND v_s.width
  THEN RAISE EXCEPTION 'invalid_proof_answers';END IF;
  v_product:=v_a*v_m;v_digits:=v_ans->'digits';v_carries:=v_ans->'carries';
  IF jsonb_array_length(v_digits)<>length(v_product::text)
   OR jsonb_array_length(v_carries)<>v_width
   OR jsonb_typeof(v_carries->0) IS DISTINCT FROM 'string'
   OR v_carries->>0 NOT IN ('','0')
  THEN RAISE EXCEPTION 'invalid_proof_answers';END IF;
  v_correct:=true;
  FOR v_j IN 0..jsonb_array_length(v_digits)-1 LOOP
   IF jsonb_typeof(v_digits->v_j) IS DISTINCT FROM 'string'
    OR (v_digits->>v_j) !~ '^[0-9]?$'
   THEN RAISE EXCEPTION 'invalid_proof_answers';END IF;
   v_expected:=mod(trunc(v_product/power(10::numeric,v_j)),10)::text;
   IF v_digits->>v_j IS DISTINCT FROM v_expected THEN v_correct:=false;END IF;
  END LOOP;
  FOR v_j IN 1..v_width-1 LOOP
   IF jsonb_typeof(v_carries->v_j) IS DISTINCT FROM 'string'
    OR (v_carries->>v_j) !~ '^[0-8]?$'
   THEN RAISE EXCEPTION 'invalid_proof_answers';END IF;
   v_expected:=trunc(mod(v_a,power(10::numeric,v_j))*v_m/power(10::numeric,v_j))::text;
   IF v_expected='0' THEN v_expected:='';END IF;
   v_actual:=v_carries->>v_j;
   IF v_actual='0' THEN v_actual:='';END IF;
   IF v_actual IS DISTINCT FROM v_expected THEN v_correct:=false;END IF;
  END LOOP;
  IF v_correct THEN v_score:=v_score+1;ELSE v_errors:=v_errors+1;END IF;
 END LOOP;
 IF v_count<120 AND v_errors<>v_lives
 THEN RAISE EXCEPTION 'proof_incomplete_game';END IF;
 v_ack:=public.connect_objective_record_school_mul_record_extended_v1(
  p_student,p_class,v_app,p_session,v_s.expected_revision,v_s.reset_epoch,
  v_s.mode,v_s.level,v_score,v_count,v_hash);
 UPDATE public.connect_objective_record_school_extended_sessions
 SET consumed_at=now(),answers_hash=v_hash,result=v_ack WHERE session_id=p_session;
 RETURN v_ack;
END $finish$;
REVOKE ALL ON FUNCTION public.connect_objective_record_school_mul_finish_extended_v1(uuid,uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.connect_objective_record_school_mul_finish_extended_v1(uuid,uuid,uuid,jsonb) TO service_role;
