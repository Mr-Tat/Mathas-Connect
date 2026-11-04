-- The dedicated school multiplication CLASSIC proof is additive and never modifies an Addition function.
-- TEST subject is allowed for controlled, rollback-only acceptance tests.

-- Only callable by a validated arithmetic proof. Never expose this RPC to pupils.
-- Real-school private transaction, called solely by server-grader, NEVER by a browser.
-- Browser/native scores are excluded. Database also enforces school enrollment.
-- The INSERT/UPDATE trigger connect_trophy_capture_v1 inserts permanent cups.
CREATE OR REPLACE FUNCTION public.connect_objective_record_school_mul_record_classic_v1(
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
 IF (p_class IS NULL OR (public.connect_objective_record_school_class_allowed_v1(p_class) IS DISTINCT FROM true AND p_class <> '4bf3400d-a315-4ea4-a2f3-afaca24dc9b9'::uuid))
  OR p_app IS DISTINCT FROM 'multiplication-ecrite-simple'
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
REVOKE ALL ON FUNCTION public.connect_objective_record_school_mul_record_classic_v1(
 uuid,uuid,text,uuid,bigint,bigint,text,integer,integer,integer)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.connect_objective_record_school_mul_record_classic_v1(
 uuid,uuid,text,uuid,bigint,bigint,text,integer,integer,integer)
 TO service_role;


-- Auth-bound, private, server-issued calculations. No pupil can choose an operand.
CREATE OR REPLACE FUNCTION public.connect_objective_record_school_mul_issue_classic_v1(
 p_student uuid,p_class uuid,p_level integer,p_total integer,p_multipliers integer[]
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $issue$
DECLARE
 v_app constant text:='multiplication-ecrite-simple';
 v_rev bigint;v_epoch bigint;v_existing record;v_locked integer[];
 v_q jsonb:='[]'::jsonb;v_a integer;v_m integer;v_i integer;
 v_width integer;v_len integer;v_base integer;
 v_id uuid;v_expires timestamptz;
BEGIN
 IF p_student IS NULL OR p_class IS NULL OR
    (p_class <> '4bf3400d-a315-4ea4-a2f3-afaca24dc9b9'::uuid
      AND public.connect_objective_record_school_class_allowed_v1(p_class) IS DISTINCT FROM true)
 THEN RAISE EXCEPTION 'school_class_not_allowed';END IF;
 IF p_level NOT IN (1,2,3) OR p_total NOT IN (4,10,20)
  OR p_level IS NULL OR p_total IS NULL OR p_multipliers IS NULL
  OR cardinality(p_multipliers) NOT BETWEEN 1 AND 8
  OR (SELECT count(DISTINCT n) FROM unnest(p_multipliers) n)<>cardinality(p_multipliers)
  OR EXISTS(SELECT 1 FROM unnest(p_multipliers) n WHERE n NOT BETWEEN 2 AND 9)
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
 WHERE class_id=p_class AND scope_key IN (p_student::text,'class')
 ORDER BY CASE WHEN scope_key=p_student::text THEN 0 ELSE 1 END LIMIT 1;
 IF v_locked IS NOT NULL AND NOT(p_multipliers <@ v_locked)
 THEN RAISE EXCEPTION 'multipliers_not_allowed';END IF;
 SELECT coalesce(revision,0),coalesce(reset_epoch,0) INTO v_rev,v_epoch
 FROM public.connect_states WHERE student_id=p_student AND app_key=v_app;
 v_rev:=coalesce(v_rev,0);v_epoch:=coalesce(v_epoch,0);
 SELECT * INTO v_existing FROM public.connect_objective_record_school_proof_sessions
 WHERE student_id=p_student AND class_id=p_class AND app_key=v_app
  AND expected_revision=v_rev AND reset_epoch=v_epoch AND level=p_level AND total=p_total
  AND consumed_at IS NULL AND expires_at>now()
  AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(questions) q
    WHERE (q->>'m')::integer <> ALL(p_multipliers))
 ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
 IF FOUND THEN RETURN jsonb_build_object('ok',true,'sessionId',v_existing.session_id,
    'revision',v_rev,'resetEpoch',v_epoch,'level',p_level,'total',p_total,
    'questions',v_existing.questions,'expiresAt',v_existing.expires_at,'reused',true);
 END IF;
 v_width:=CASE p_level WHEN 1 THEN 3 WHEN 2 THEN 5 ELSE 7 END;
 FOR v_i IN 1..p_total LOOP
  v_len:=v_width-CASE WHEN random()<0.15 THEN 1 ELSE 0 END;
  v_base:=power(10::numeric,v_len-1)::integer;
  v_a:=v_base+floor(random()*9*v_base)::integer;
  v_m:=p_multipliers[1+floor(random()*cardinality(p_multipliers))::integer];
  v_q:=v_q||jsonb_build_array(jsonb_build_object(
    'id','q'||v_i,'op','mul','a',v_a::text,'m',v_m,'width',v_len));
 END LOOP;
 INSERT INTO public.connect_objective_record_school_proof_sessions(
 student_id,class_id,app_key,expected_revision,reset_epoch,level,total,questions,expires_at)
 VALUES(p_student,p_class,v_app,v_rev,v_epoch,p_level,p_total,v_q,now()+interval '90 minutes')
 RETURNING session_id,expires_at INTO v_id,v_expires;
 RETURN jsonb_build_object('ok',true,'sessionId',v_id,'revision',v_rev,
  'resetEpoch',v_epoch,'level',p_level,'total',p_total,
  'questions',v_q,'expiresAt',v_expires,'reused',false);
END $issue$;
REVOKE ALL ON FUNCTION public.connect_objective_record_school_mul_issue_classic_v1(uuid,uuid,integer,integer,integer[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.connect_objective_record_school_mul_issue_classic_v1(uuid,uuid,integer,integer,integer[]) TO service_role;


-- Recompute *every* first attempt, including carries 0..8, independently.
CREATE OR REPLACE FUNCTION public.connect_objective_record_school_mul_finish_classic_v1(
 p_student uuid,p_class uuid,p_session uuid,p_answers jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $finish$
DECLARE
 v_app constant text:='multiplication-ecrite-simple';
 v_s public.connect_objective_record_school_proof_sessions%ROWTYPE;
 v_q jsonb;v_answer jsonb;v_digits jsonb;v_carries jsonb;
 v_i integer;v_j integer;v_a numeric;v_m integer;v_width integer;
 v_product numeric;v_expected text;v_actual text;
 v_correct boolean;v_score integer:=0;v_hash text;v_ack jsonb;
BEGIN
 IF p_student IS NULL OR p_class IS NULL OR p_session IS NULL
  OR (p_class <> '4bf3400d-a315-4ea4-a2f3-afaca24dc9b9'::uuid
      AND public.connect_objective_record_school_class_allowed_v1(p_class) IS DISTINCT FROM true)
  OR jsonb_typeof(p_answers) IS DISTINCT FROM 'array'
  OR jsonb_array_length(p_answers) NOT IN (4,10,20)
 THEN RAISE EXCEPTION 'invalid_proof_answers';END IF;
 PERFORM 1 FROM public.connect_students WHERE id=p_student AND archived_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'inactive_student';END IF;
 SELECT * INTO v_s FROM public.connect_objective_record_school_proof_sessions
 WHERE session_id=p_session AND student_id=p_student AND class_id=p_class AND app_key=v_app
 FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'proof_not_found';END IF;
 IF v_s.total<>jsonb_array_length(p_answers) OR v_s.level NOT IN (1,2,3)
  OR jsonb_array_length(v_s.questions)<>v_s.total
 THEN RAISE EXCEPTION 'invalid_proof_answers';END IF;
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
 FOR v_i IN 0..v_s.total-1 LOOP
  v_q:=v_s.questions->v_i;v_answer:=p_answers->v_i;
  IF jsonb_typeof(v_answer) IS DISTINCT FROM 'object'
   OR (SELECT count(*) FROM jsonb_object_keys(v_answer))<>3
   OR NOT(v_answer ? 'id' AND v_answer ? 'digits' AND v_answer ? 'carries')
   OR v_answer->>'id' IS DISTINCT FROM v_q->>'id'
   OR jsonb_typeof(v_answer->'digits') IS DISTINCT FROM 'array'
   OR jsonb_typeof(v_answer->'carries') IS DISTINCT FROM 'array'
   OR v_q->>'op' IS DISTINCT FROM 'mul'
   OR (v_q->>'a') !~ '^[1-9][0-9]{1,6}$'
   OR (v_q->>'m') !~ '^[2-9]$'
  THEN RAISE EXCEPTION 'invalid_proof_answers';END IF;
  v_a:=(v_q->>'a')::numeric;v_m:=(v_q->>'m')::integer;
  v_width:=length(v_q->>'a');
  IF v_q->>'width' IS DISTINCT FROM v_width::text
   OR v_width NOT BETWEEN (CASE v_s.level WHEN 1 THEN 2 WHEN 2 THEN 4 ELSE 6 END)
                   AND (CASE v_s.level WHEN 1 THEN 3 WHEN 2 THEN 5 ELSE 7 END)
  THEN RAISE EXCEPTION 'invalid_proof_answers';END IF;
  v_product:=v_a*v_m;v_digits:=v_answer->'digits';v_carries:=v_answer->'carries';
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
  IF v_correct THEN v_score:=v_score+1;END IF;
 END LOOP;
 v_ack:=public.connect_objective_record_school_mul_record_classic_v1(
   p_student,p_class,v_app,p_session,v_s.expected_revision,v_s.reset_epoch,
   'classic',v_s.level,v_score,v_s.total);
 UPDATE public.connect_objective_record_school_proof_sessions
 SET consumed_at=now(),answers_hash=v_hash,
 result=v_ack||jsonb_build_object('proofVerified',true,'verifiedScore',v_score)
 WHERE session_id=p_session;
 RETURN v_ack||jsonb_build_object('proofVerified',true,'verifiedScore',v_score);
END $finish$;
REVOKE ALL ON FUNCTION public.connect_objective_record_school_mul_finish_classic_v1(uuid,uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.connect_objective_record_school_mul_finish_classic_v1(uuid,uuid,uuid,jsonb) TO service_role;
