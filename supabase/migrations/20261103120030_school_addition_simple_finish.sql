-- Grade every first-attempt digit and carry on the server; atomic official XP only.
CREATE OR REPLACE FUNCTION public.connect_objective_record_school_finish_add_v1(
 p_student uuid,p_class uuid,p_session uuid,p_answers jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $finish$
DECLARE
 v_class constant uuid:=p_class;
 v_app constant text:='addition-ecrite-simple';
 v_session public.connect_objective_record_school_proof_sessions%ROWTYPE;
 v_answer jsonb;v_q jsonb;v_i integer;v_j integer;
 v_a integer;v_b integer;v_expected integer;v_len integer;
 v_correct boolean;v_score integer:=0;v_expected_digit text;v_expected_carry text;
 v_actual text;v_carries jsonb;v_digits jsonb;v_width integer;
 v_hash text;v_ack jsonb;
BEGIN
 IF p_student IS NULL OR (p_class IS NULL OR public.connect_objective_record_school_class_allowed_v1(p_class) IS DISTINCT FROM true) OR p_session IS NULL
  OR jsonb_typeof(p_answers) IS DISTINCT FROM 'array'
  OR jsonb_array_length(p_answers) NOT IN (4,10,20) THEN RAISE EXCEPTION 'invalid_proof_answers';END IF;
 -- Lock the student BEFORE the challenge row, just like the issue RPC
 -- and the official XP transaction. This prevents a start/finish deadlock.
 PERFORM 1 FROM public.connect_students WHERE id=p_student AND archived_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'inactive_student';END IF;
 SELECT * INTO v_session FROM public.connect_objective_record_school_proof_sessions
  WHERE session_id=p_session AND student_id=p_student AND class_id=v_class AND app_key=v_app FOR UPDATE;
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
   AND e.class_id=v_class AND e.left_at IS NULL
 ) AND NOT EXISTS(
  SELECT 1 FROM public.connect_teacher_players tp
  JOIN public.connect_class_permissions cp ON cp.teacher_id=tp.teacher_id
  WHERE tp.student_id=p_student AND cp.class_id=v_class AND cp.can_manage=true
 ) THEN RAISE EXCEPTION 'not_school_subject';END IF;
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
 v_ack:=public.connect_objective_record_school_fixed_v1(p_student,v_class,v_app,
   p_session,v_session.expected_revision,v_session.reset_epoch,'classic',v_session.level,v_score,v_session.total);
 UPDATE public.connect_objective_record_school_proof_sessions
 SET consumed_at=now(),answers_hash=v_hash,
  result=v_ack||jsonb_build_object('proofVerified',true,'verifiedScore',v_score)
 WHERE session_id=p_session;
 RETURN v_ack||jsonb_build_object('proofVerified',true,'verifiedScore',v_score);
END $finish$;
REVOKE ALL ON FUNCTION public.connect_objective_record_school_finish_add_v1(uuid,uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.connect_objective_record_school_finish_add_v1(uuid,uuid,uuid,jsonb) TO service_role;
