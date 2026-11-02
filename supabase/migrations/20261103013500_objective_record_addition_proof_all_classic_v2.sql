-- TEST only: extend the private Addition simple certified transcript to all
-- Classique series 4/10/20 and all native levels 1/2/3 (3, 5, 7 digits).
-- The ordinary school HUB router is still disabled.
ALTER TABLE public.connect_objective_record_test_proof_sessions
 DROP CONSTRAINT IF EXISTS connect_objective_record_test_proof_sessions_level_check;
ALTER TABLE public.connect_objective_record_test_proof_sessions
 DROP CONSTRAINT IF EXISTS connect_objective_record_test_proof_sessions_total_check;
ALTER TABLE public.connect_objective_record_test_proof_sessions
 ADD CONSTRAINT connect_objective_record_test_proof_sessions_level_check
 CHECK(level IN (1,2,3));
ALTER TABLE public.connect_objective_record_test_proof_sessions
 ADD CONSTRAINT connect_objective_record_test_proof_sessions_total_check
 CHECK(total IN (4,10,20));

-- Legacy endpoint cannot mistake a pending extended challenge for a 4/L1 one.
CREATE OR REPLACE FUNCTION public.connect_objective_record_test_issue_add_v1(
 p_student uuid,p_class uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $issue$
DECLARE
 v_test constant uuid:='4bf3400d-a315-4ea4-a2f3-afaca24dc9b9';
 v_app constant text:='addition-ecrite-simple';
 v_revision bigint;v_epoch bigint;v_existing record;
 v_questions jsonb:='[]'::jsonb;v_a integer;v_b integer;v_i integer;
 v_id uuid;v_expiry timestamptz;
BEGIN
 IF p_class IS DISTINCT FROM v_test OR p_student IS NULL THEN RAISE EXCEPTION 'proof_test_only';END IF;
 PERFORM 1 FROM public.connect_students WHERE id=p_student AND archived_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'inactive_student';END IF;
 IF NOT EXISTS(
  SELECT 1 FROM public.connect_enrollments e WHERE e.student_id=p_student
   AND e.class_id=v_test AND e.left_at IS NULL
 ) AND NOT EXISTS(
  SELECT 1 FROM public.connect_teacher_players tp
  JOIN public.connect_class_permissions cp ON cp.teacher_id=tp.teacher_id
  WHERE tp.student_id=p_student AND cp.class_id=v_test AND cp.can_manage=true
 ) THEN RAISE EXCEPTION 'not_test_subject';END IF;
 SELECT coalesce(revision,0),coalesce(reset_epoch,0) INTO v_revision,v_epoch
  FROM public.connect_states WHERE student_id=p_student AND app_key=v_app;
 v_revision:=coalesce(v_revision,0);v_epoch:=coalesce(v_epoch,0);
 SELECT * INTO v_existing FROM public.connect_objective_record_test_proof_sessions
 WHERE student_id=p_student AND app_key=v_app AND consumed_at IS NULL
  AND expires_at>now() AND expected_revision=v_revision AND reset_epoch=v_epoch
  AND level=1 AND total=4
 ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
 IF FOUND THEN
  RETURN jsonb_build_object('ok',true,'sessionId',v_existing.session_id,
   'questions',v_existing.questions,'revision',v_revision,'resetEpoch',v_epoch,
   'level',1,'total',4,'reused',true,'expiresAt',v_existing.expires_at);
 END IF;
 FOR v_i IN 1..4 LOOP
  -- 3-digit additions, the same digit count as the native level-1 game.
  v_a:=100+floor(random()*900)::integer;
  v_b:=100+floor(random()*900)::integer;
  v_questions:=v_questions||jsonb_build_array(
    jsonb_build_object('id','q'||v_i,'op','add','a',v_a,'b',v_b));
 END LOOP;
 INSERT INTO public.connect_objective_record_test_proof_sessions(
  student_id,class_id,app_key,expected_revision,reset_epoch,level,total,questions)
 VALUES(p_student,v_test,v_app,v_revision,v_epoch,1,4,v_questions)
 RETURNING session_id,expires_at INTO v_id,v_expiry;
 RETURN jsonb_build_object('ok',true,'sessionId',v_id,
  'questions',v_questions,'revision',v_revision,'resetEpoch',v_epoch,
  'level',1,'total',4,'reused',false,'expiresAt',v_expiry);
END $issue$;
REVOKE ALL ON FUNCTION public.connect_objective_record_test_issue_add_v1(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.connect_objective_record_test_issue_add_v1(uuid,uuid) TO service_role;
-- Legacy grader rejects other level/total challenges even if guessed by UUID.
CREATE OR REPLACE FUNCTION public.connect_objective_record_test_finish_add_v1(
 p_student uuid,p_class uuid,p_session uuid,p_answers jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $finish$
DECLARE
 v_test constant uuid:='4bf3400d-a315-4ea4-a2f3-afaca24dc9b9';
 v_app constant text:='addition-ecrite-simple';
 v_session public.connect_objective_record_test_proof_sessions%ROWTYPE;
 v_answer jsonb;v_q jsonb;v_i integer;v_j integer;
 v_a integer;v_b integer;v_expected integer;v_len integer;
 v_correct boolean;v_score integer:=0;v_expected_digit text;v_expected_carry text;
 v_actual text;v_carries jsonb;v_digits jsonb;
 v_hash text;v_ack jsonb;
BEGIN
 IF p_student IS NULL OR p_class IS DISTINCT FROM v_test OR p_session IS NULL
  OR jsonb_typeof(p_answers) IS DISTINCT FROM 'array'
  OR jsonb_array_length(p_answers)<>4 THEN RAISE EXCEPTION 'invalid_proof_answers';END IF;
 -- Lock the student BEFORE the challenge row, just like the issue RPC
 -- and the official XP transaction. This prevents a start/finish deadlock.
 PERFORM 1 FROM public.connect_students WHERE id=p_student AND archived_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'inactive_student';END IF;
 SELECT * INTO v_session FROM public.connect_objective_record_test_proof_sessions
  WHERE session_id=p_session AND student_id=p_student AND class_id=v_test AND app_key=v_app FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'proof_not_found';END IF;
 IF v_session.level<>1 OR v_session.total<>4 THEN RAISE EXCEPTION 'invalid_proof_answers';END IF;
 v_hash:=pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_answers::text,'UTF8')),'hex');
 IF v_session.consumed_at IS NOT NULL THEN
  IF v_session.answers_hash<>v_hash THEN RAISE EXCEPTION 'proof_replay_collision';END IF;
  RETURN v_session.result||jsonb_build_object('duplicate',true,
   'xp',v_session.result->'xp'||jsonb_build_object('delta',0));
 END IF;
 IF v_session.expires_at<=now() THEN RAISE EXCEPTION 'proof_expired';END IF;
 IF NOT EXISTS(
  SELECT 1 FROM public.connect_enrollments e WHERE e.student_id=p_student
   AND e.class_id=v_test AND e.left_at IS NULL
 ) AND NOT EXISTS(
  SELECT 1 FROM public.connect_teacher_players tp
  JOIN public.connect_class_permissions cp ON cp.teacher_id=tp.teacher_id
  WHERE tp.student_id=p_student AND cp.class_id=v_test AND cp.can_manage=true
 ) THEN RAISE EXCEPTION 'not_test_subject';END IF;
 FOR v_i IN 0..3 LOOP
  v_q:=v_session.questions->v_i;
  v_answer:=p_answers->v_i;
  IF jsonb_typeof(v_answer) IS DISTINCT FROM 'object'
   OR (SELECT count(*) FROM jsonb_object_keys(v_answer))<>3
   OR NOT (v_answer ? 'id' AND v_answer ? 'digits' AND v_answer ? 'carries')
   OR v_answer->>'id' IS DISTINCT FROM v_q->>'id'
   OR jsonb_typeof(v_answer->'digits') IS DISTINCT FROM 'array'
   OR jsonb_typeof(v_answer->'carries') IS DISTINCT FROM 'array'
  THEN RAISE EXCEPTION 'invalid_proof_answers';END IF;
  v_a:=(v_q->>'a')::integer;v_b:=(v_q->>'b')::integer;
  v_expected:=v_a+v_b;v_len:=length(v_expected::text);
  v_digits:=v_answer->'digits';v_carries:=v_answer->'carries';
  IF jsonb_array_length(v_digits)<>v_len OR jsonb_array_length(v_carries)<>3
  THEN RAISE EXCEPTION 'invalid_proof_answers';END IF;
  v_correct:=true;
  FOR v_j IN 0..v_len-1 LOOP
   v_expected_digit:=((v_expected/(10^v_j)::integer)%10)::text;
   IF jsonb_typeof(v_digits->v_j) IS DISTINCT FROM 'string' THEN
    RAISE EXCEPTION 'invalid_proof_answers';END IF;
   v_actual:=v_digits->>v_j;
   IF v_actual !~ '^[0-9]?$' THEN RAISE EXCEPTION 'invalid_proof_answers';END IF;
   IF v_actual IS DISTINCT FROM v_expected_digit THEN v_correct:=false;END IF;
  END LOOP;
  IF jsonb_typeof(v_carries->0) IS DISTINCT FROM 'string'
   OR (v_carries->>0) NOT IN ('','0')
  THEN RAISE EXCEPTION 'invalid_proof_answers';END IF;
  FOR v_j IN 1..2 LOOP
   IF jsonb_typeof(v_carries->v_j) IS DISTINCT FROM 'string'
   THEN RAISE EXCEPTION 'invalid_proof_answers';END IF;
   v_actual:=v_carries->>v_j;
   IF v_actual NOT IN ('','0','1') THEN RAISE EXCEPTION 'invalid_proof_answers';END IF;
   v_expected_carry:=CASE WHEN
      ((v_a%(10^v_j)::integer)+(v_b%(10^v_j)::integer)) >= (10^v_j)::integer
      THEN '1' ELSE '' END;
   IF v_expected_carry='' AND v_actual='0' THEN v_actual:='';END IF;
   IF v_actual IS DISTINCT FROM v_expected_carry THEN v_correct:=false;END IF;
  END LOOP;
  IF v_correct THEN v_score:=v_score+1;END IF;
 END LOOP;
 -- The same transaction consumes a private session and credits ONLY its
 -- server-computed score using the existing official XP/state/trophy function.
 v_ack:=public.connect_objective_record_test_fixed_v1(p_student,v_test,v_app,
   p_session,v_session.expected_revision,v_session.reset_epoch,'classic',1,v_score,4);
 UPDATE public.connect_objective_record_test_proof_sessions
 SET consumed_at=now(),answers_hash=v_hash,
  result=v_ack||jsonb_build_object('proofVerified',true,'verifiedScore',v_score)
 WHERE session_id=p_session;
 RETURN v_ack||jsonb_build_object('proofVerified',true,'verifiedScore',v_score);
END $finish$;
REVOKE ALL ON FUNCTION public.connect_objective_record_test_finish_add_v1(uuid,uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.connect_objective_record_test_finish_add_v1(uuid,uuid,uuid,jsonb) TO service_role;

-- New read/issue RPC parameterizes native level and series length.
CREATE OR REPLACE FUNCTION public.connect_objective_record_test_issue_add_v2(
 p_student uuid,p_class uuid,p_level integer,p_total integer
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $issue$
DECLARE
 v_test constant uuid:='4bf3400d-a315-4ea4-a2f3-afaca24dc9b9';
 v_app constant text:='addition-ecrite-simple';
 v_revision bigint;v_epoch bigint;v_existing record;
 v_questions jsonb:='[]'::jsonb;v_a integer;v_b integer;v_i integer;
 v_digits integer;v_second integer;v_min integer;v_second_min integer;
 v_id uuid;v_expiry timestamptz;
BEGIN
 IF p_class IS DISTINCT FROM v_test OR p_student IS NULL THEN RAISE EXCEPTION 'proof_test_only';END IF;
 IF p_level NOT IN (1,2,3) OR p_total NOT IN (4,10,20) OR p_level IS NULL OR p_total IS NULL
 THEN RAISE EXCEPTION 'invalid_proof_configuration';END IF;
 PERFORM 1 FROM public.connect_students WHERE id=p_student AND archived_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'inactive_student';END IF;
 IF NOT EXISTS(
  SELECT 1 FROM public.connect_enrollments e WHERE e.student_id=p_student
   AND e.class_id=v_test AND e.left_at IS NULL
 ) AND NOT EXISTS(
  SELECT 1 FROM public.connect_teacher_players tp
  JOIN public.connect_class_permissions cp ON cp.teacher_id=tp.teacher_id
  WHERE tp.student_id=p_student AND cp.class_id=v_test AND cp.can_manage=true
 ) THEN RAISE EXCEPTION 'not_test_subject';END IF;
 SELECT coalesce(revision,0),coalesce(reset_epoch,0) INTO v_revision,v_epoch
  FROM public.connect_states WHERE student_id=p_student AND app_key=v_app;
 v_revision:=coalesce(v_revision,0);v_epoch:=coalesce(v_epoch,0);
 SELECT * INTO v_existing FROM public.connect_objective_record_test_proof_sessions
 WHERE student_id=p_student AND app_key=v_app AND consumed_at IS NULL
  AND expires_at>now() AND expected_revision=v_revision AND reset_epoch=v_epoch
  AND level=p_level AND total=p_total
 ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
 IF FOUND THEN
  RETURN jsonb_build_object('ok',true,'sessionId',v_existing.session_id,
   'questions',v_existing.questions,'revision',v_revision,'resetEpoch',v_epoch,
   'level',p_level,'total',p_total,'reused',true,'expiresAt',v_existing.expires_at);
 END IF;
 v_digits:=CASE p_level WHEN 1 THEN 3 WHEN 2 THEN 5 ELSE 7 END;
 v_min:=power(10::numeric,v_digits-1)::integer;
 FOR v_i IN 1..p_total LOOP
  -- Match the native level widths (3, 5, 7 digits). A second addend
  -- has one fewer digit in approximately 15% of questions.
  v_second:=CASE WHEN random()<.15 THEN v_digits-1 ELSE v_digits END;
  v_second_min:=power(10::numeric,v_second-1)::integer;
  v_a:=v_min+floor(random()*9*v_min)::integer;
  v_b:=v_second_min+floor(random()*9*v_second_min)::integer;
  v_questions:=v_questions||jsonb_build_array(
    jsonb_build_object('id','q'||v_i,'op','add','a',v_a,'b',v_b));
 END LOOP;
 INSERT INTO public.connect_objective_record_test_proof_sessions(
  student_id,class_id,app_key,expected_revision,reset_epoch,level,total,questions,expires_at)
 VALUES(p_student,v_test,v_app,v_revision,v_epoch,p_level,p_total,v_questions,now()+interval '90 minutes')
 RETURNING session_id,expires_at INTO v_id,v_expiry;
 RETURN jsonb_build_object('ok',true,'sessionId',v_id,
  'questions',v_questions,'revision',v_revision,'resetEpoch',v_epoch,
  'level',p_level,'total',p_total,'reused',false,'expiresAt',v_expiry);
END $issue$;
REVOKE ALL ON FUNCTION public.connect_objective_record_test_issue_add_v2(uuid,uuid,integer,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.connect_objective_record_test_issue_add_v2(uuid,uuid,integer,integer) TO service_role;

-- Server verifies all submitted digit columns and carry columns before award.
CREATE OR REPLACE FUNCTION public.connect_objective_record_test_finish_add_v2(
 p_student uuid,p_class uuid,p_session uuid,p_answers jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $finish$
DECLARE
 v_test constant uuid:='4bf3400d-a315-4ea4-a2f3-afaca24dc9b9';
 v_app constant text:='addition-ecrite-simple';
 v_session public.connect_objective_record_test_proof_sessions%ROWTYPE;
 v_answer jsonb;v_q jsonb;v_i integer;v_j integer;
 v_a integer;v_b integer;v_expected integer;v_len integer;
 v_correct boolean;v_score integer:=0;v_expected_digit text;v_expected_carry text;
 v_actual text;v_carries jsonb;v_digits jsonb;v_width integer;
 v_hash text;v_ack jsonb;
BEGIN
 IF p_student IS NULL OR p_class IS DISTINCT FROM v_test OR p_session IS NULL
  OR jsonb_typeof(p_answers) IS DISTINCT FROM 'array'
  OR jsonb_array_length(p_answers) NOT IN (4,10,20) THEN RAISE EXCEPTION 'invalid_proof_answers';END IF;
 -- Lock the student BEFORE the challenge row, just like the issue RPC
 -- and the official XP transaction. This prevents a start/finish deadlock.
 PERFORM 1 FROM public.connect_students WHERE id=p_student AND archived_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'inactive_student';END IF;
 SELECT * INTO v_session FROM public.connect_objective_record_test_proof_sessions
  WHERE session_id=p_session AND student_id=p_student AND class_id=v_test AND app_key=v_app FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'proof_not_found';END IF;
 IF v_session.level NOT IN (1,2,3) OR v_session.total NOT IN (4,10,20)
  OR jsonb_array_length(p_answers)<>v_session.total
 THEN RAISE EXCEPTION 'invalid_proof_answers';END IF;
 v_width:=CASE v_session.level WHEN 1 THEN 3 WHEN 2 THEN 5 ELSE 7 END;
 v_hash:=pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_answers::text,'UTF8')),'hex');
 IF v_session.consumed_at IS NOT NULL THEN
  IF v_session.answers_hash<>v_hash THEN RAISE EXCEPTION 'proof_replay_collision';END IF;
  RETURN v_session.result||jsonb_build_object('duplicate',true,
   'xp',v_session.result->'xp'||jsonb_build_object('delta',0));
 END IF;
 IF v_session.expires_at<=now() THEN RAISE EXCEPTION 'proof_expired';END IF;
 IF NOT EXISTS(
  SELECT 1 FROM public.connect_enrollments e WHERE e.student_id=p_student
   AND e.class_id=v_test AND e.left_at IS NULL
 ) AND NOT EXISTS(
  SELECT 1 FROM public.connect_teacher_players tp
  JOIN public.connect_class_permissions cp ON cp.teacher_id=tp.teacher_id
  WHERE tp.student_id=p_student AND cp.class_id=v_test AND cp.can_manage=true
 ) THEN RAISE EXCEPTION 'not_test_subject';END IF;
 FOR v_i IN 0..v_session.total-1 LOOP
  v_q:=v_session.questions->v_i;
  v_answer:=p_answers->v_i;
  IF jsonb_typeof(v_answer) IS DISTINCT FROM 'object'
   OR (SELECT count(*) FROM jsonb_object_keys(v_answer))<>3
   OR NOT (v_answer ? 'id' AND v_answer ? 'digits' AND v_answer ? 'carries')
   OR v_answer->>'id' IS DISTINCT FROM v_q->>'id'
   OR jsonb_typeof(v_answer->'digits') IS DISTINCT FROM 'array'
   OR jsonb_typeof(v_answer->'carries') IS DISTINCT FROM 'array'
  THEN RAISE EXCEPTION 'invalid_proof_answers';END IF;
  v_a:=(v_q->>'a')::integer;v_b:=(v_q->>'b')::integer;
  v_expected:=v_a+v_b;v_len:=length(v_expected::text);
  v_digits:=v_answer->'digits';v_carries:=v_answer->'carries';
  IF jsonb_array_length(v_digits)<>v_len OR jsonb_array_length(v_carries)<>v_width
  THEN RAISE EXCEPTION 'invalid_proof_answers';END IF;
  v_correct:=true;
  FOR v_j IN 0..v_len-1 LOOP
   v_expected_digit:=((v_expected/(10^v_j)::integer)%10)::text;
   IF jsonb_typeof(v_digits->v_j) IS DISTINCT FROM 'string' THEN
    RAISE EXCEPTION 'invalid_proof_answers';END IF;
   v_actual:=v_digits->>v_j;
   IF v_actual !~ '^[0-9]?$' THEN RAISE EXCEPTION 'invalid_proof_answers';END IF;
   IF v_actual IS DISTINCT FROM v_expected_digit THEN v_correct:=false;END IF;
  END LOOP;
  IF jsonb_typeof(v_carries->0) IS DISTINCT FROM 'string'
   OR (v_carries->>0) NOT IN ('','0')
  THEN RAISE EXCEPTION 'invalid_proof_answers';END IF;
  FOR v_j IN 1..v_width-1 LOOP
   IF jsonb_typeof(v_carries->v_j) IS DISTINCT FROM 'string'
   THEN RAISE EXCEPTION 'invalid_proof_answers';END IF;
   v_actual:=v_carries->>v_j;
   IF v_actual NOT IN ('','0','1') THEN RAISE EXCEPTION 'invalid_proof_answers';END IF;
   v_expected_carry:=CASE WHEN
      ((v_a%(10^v_j)::integer)+(v_b%(10^v_j)::integer)) >= (10^v_j)::integer
      THEN '1' ELSE '' END;
   IF v_expected_carry='' AND v_actual='0' THEN v_actual:='';END IF;
   IF v_actual IS DISTINCT FROM v_expected_carry THEN v_correct:=false;END IF;
  END LOOP;
  IF v_correct THEN v_score:=v_score+1;END IF;
 END LOOP;
 -- The same transaction consumes a private session and credits ONLY its
 -- server-computed score using the existing official XP/state/trophy function.
 v_ack:=public.connect_objective_record_test_fixed_v1(p_student,v_test,v_app,
   p_session,v_session.expected_revision,v_session.reset_epoch,'classic',v_session.level,v_score,v_session.total);
 UPDATE public.connect_objective_record_test_proof_sessions
 SET consumed_at=now(),answers_hash=v_hash,
  result=v_ack||jsonb_build_object('proofVerified',true,'verifiedScore',v_score)
 WHERE session_id=p_session;
 RETURN v_ack||jsonb_build_object('proofVerified',true,'verifiedScore',v_score);
END $finish$;
REVOKE ALL ON FUNCTION public.connect_objective_record_test_finish_add_v2(uuid,uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.connect_objective_record_test_finish_add_v2(uuid,uuid,uuid,jsonb) TO service_role;
