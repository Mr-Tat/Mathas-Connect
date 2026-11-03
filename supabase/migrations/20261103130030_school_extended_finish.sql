-- Validate every written result digit and every incoming carry, including
-- 16-digit HARD additions. Accept only a mathematical end of game:
-- sudden: first wrong calculation; 3-vies: third wrong; or 120 answered.
CREATE OR REPLACE FUNCTION public.connect_objective_record_school_finish_extended_v1(
 p_student uuid,p_class uuid,p_app text,p_session uuid,p_answers jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $finish$
DECLARE
 v_session public.connect_objective_record_school_extended_sessions%ROWTYPE;
 v_ans jsonb;v_question jsonb;v_terms jsonb;
 v_digits jsonb;v_carries jsonb;
 v_i integer;v_j integer;v_k integer;v_count integer;
 v_lives integer;v_errors integer:=0;v_score integer:=0;v_sum numeric;
 v_partial numeric;v_pow numeric;v_expected text;v_actual text;
 v_term numeric;v_correct boolean;v_hash text;v_ack jsonb;
BEGIN
 IF p_student IS NULL OR p_class IS NULL OR p_app IS NULL OR p_session IS NULL
  OR public.connect_objective_record_school_class_allowed_v1(p_class) IS DISTINCT FROM true
  OR p_app NOT IN ('addition-ecrite-simple','addition-ecrite-multiple')
  OR jsonb_typeof(p_answers) IS DISTINCT FROM 'array'
  OR jsonb_array_length(p_answers) NOT BETWEEN 1 AND 120
 THEN RAISE EXCEPTION 'invalid_proof_answers';END IF;
 -- The same lock order is used by issuers, finishers and XP recorders.
 PERFORM 1 FROM public.connect_students WHERE id=p_student AND archived_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'inactive_student';END IF;
 SELECT * INTO v_session FROM public.connect_objective_record_school_extended_sessions
 WHERE session_id=p_session AND student_id=p_student
  AND class_id=p_class AND app_key=p_app FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'proof_not_found';END IF;
 v_count:=jsonb_array_length(p_answers);
 v_hash:=pg_catalog.encode(pg_catalog.sha256(
  pg_catalog.convert_to(p_answers::text,'UTF8')),'hex');
 IF v_session.consumed_at IS NOT NULL THEN
  IF v_session.answers_hash<>v_hash THEN RAISE EXCEPTION 'proof_replay_collision';END IF;
  RETURN v_session.result||jsonb_build_object('duplicate',true,
   'xp',v_session.result->'xp'||jsonb_build_object('delta',0));
 END IF;
 IF v_session.expires_at<=now() THEN RAISE EXCEPTION 'proof_expired';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.connect_enrollments
    WHERE student_id=p_student AND class_id=p_class AND left_at IS NULL)
  AND NOT EXISTS(SELECT 1 FROM public.connect_teacher_players tp
    JOIN public.connect_class_permissions cp ON cp.teacher_id=tp.teacher_id
    WHERE tp.student_id=p_student AND cp.class_id=p_class AND cp.can_manage=true)
 THEN RAISE EXCEPTION 'not_school_subject';END IF;
 IF jsonb_array_length(v_session.questions)<>v_session.total OR v_session.total<>120
 THEN RAISE EXCEPTION 'invalid_proof_configuration';END IF;
 v_lives:=CASE WHEN v_session.mode IN ('three-lives','hard-three-lives') THEN 3 ELSE 1 END;
 FOR v_i IN 0..v_count-1 LOOP
  IF v_errors>=v_lives THEN RAISE EXCEPTION 'proof_continued_after_end';END IF;
  v_ans:=p_answers->v_i;v_question:=v_session.questions->v_i;
  IF jsonb_typeof(v_ans) IS DISTINCT FROM 'object'
   OR (SELECT count(*) FROM jsonb_object_keys(v_ans))<>3
   OR NOT (v_ans ? 'id' AND v_ans ? 'digits' AND v_ans ? 'carries')
   OR v_ans->>'id' IS DISTINCT FROM v_question->>'id'
   OR jsonb_typeof(v_ans->'digits') IS DISTINCT FROM 'array'
   OR jsonb_typeof(v_ans->'carries') IS DISTINCT FROM 'array'
   OR v_question->>'width' IS DISTINCT FROM v_session.width::text
   OR v_question->>'op' IS DISTINCT FROM 'add'
   OR jsonb_typeof(v_question->'addends') IS DISTINCT FROM 'array'
  THEN RAISE EXCEPTION 'invalid_proof_answers';END IF;
  v_terms:=v_question->'addends';
  IF jsonb_array_length(v_terms) NOT BETWEEN 2 AND 7
  THEN RAISE EXCEPTION 'invalid_proof_answers';END IF;
  v_sum:=0;
  FOR v_k IN 0..jsonb_array_length(v_terms)-1 LOOP
   IF jsonb_typeof(v_terms->v_k) IS DISTINCT FROM 'string'
    OR (v_terms->>v_k) !~ '^[1-9][0-9]{0,15}$'
   THEN RAISE EXCEPTION 'invalid_proof_answers';END IF;
   v_term:=(v_terms->>v_k)::numeric;
   IF v_term>=power(10::numeric,v_session.width)
   THEN RAISE EXCEPTION 'invalid_proof_answers';END IF;
   v_sum:=v_sum+v_term;
  END LOOP;
  v_digits:=v_ans->'digits';v_carries:=v_ans->'carries';
  IF jsonb_array_length(v_digits)<>length(v_sum::text)
   OR jsonb_array_length(v_carries)<>v_session.width
   OR jsonb_typeof(v_carries->0) IS DISTINCT FROM 'string'
   OR (v_carries->>0) NOT IN ('','0')
  THEN RAISE EXCEPTION 'invalid_proof_answers';END IF;
  v_correct:=true;
  FOR v_j IN 0..jsonb_array_length(v_digits)-1 LOOP
   IF jsonb_typeof(v_digits->v_j) IS DISTINCT FROM 'string'
    OR (v_digits->>v_j) !~ '^[0-9]?$'
   THEN RAISE EXCEPTION 'invalid_proof_answers';END IF;
   v_expected:=mod(trunc(v_sum/power(10::numeric,v_j)),10)::text;
   IF v_digits->>v_j IS DISTINCT FROM v_expected THEN v_correct:=false;END IF;
  END LOOP;
  FOR v_j IN 1..v_session.width-1 LOOP
   IF jsonb_typeof(v_carries->v_j) IS DISTINCT FROM 'string'
    OR (v_carries->>v_j) !~ '^[0-7]?$'
   THEN RAISE EXCEPTION 'invalid_proof_answers';END IF;
   v_pow:=power(10::numeric,v_j);
   v_partial:=0;
   FOR v_k IN 0..jsonb_array_length(v_terms)-1 LOOP
    v_partial:=v_partial+mod((v_terms->>v_k)::numeric,v_pow);
   END LOOP;
   v_expected:=trunc(v_partial/v_pow)::text;
   IF v_expected='0' THEN v_expected:='';END IF;
   v_actual:=v_carries->>v_j;
   IF v_actual='0' THEN v_actual:='';END IF;
   IF v_actual IS DISTINCT FROM v_expected THEN v_correct:=false;END IF;
  END LOOP;
  IF v_correct THEN v_score:=v_score+1; ELSE v_errors:=v_errors+1; END IF;
 END LOOP;
 IF v_count<v_session.total AND v_errors<>v_lives
 THEN RAISE EXCEPTION 'proof_incomplete_game';END IF;
 v_ack:=public.connect_objective_record_school_record_extended_v1(
  p_student,p_class,p_app,p_session,v_session.expected_revision,v_session.reset_epoch,
  v_session.mode,v_session.level,v_score,v_count,v_hash);
 UPDATE public.connect_objective_record_school_extended_sessions
 SET consumed_at=now(),answers_hash=v_hash,result=v_ack
 WHERE session_id=p_session;
 RETURN v_ack;
END $finish$;
REVOKE ALL ON FUNCTION public.connect_objective_record_school_finish_extended_v1(uuid,uuid,text,uuid,jsonb)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.connect_objective_record_school_finish_extended_v1(uuid,uuid,text,uuid,jsonb)
 TO service_role;
