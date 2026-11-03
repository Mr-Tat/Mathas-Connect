-- Server alone grades every FIRST submitted digit/carry, then validates
-- the exact stop rule (one mistake or three lost lives), before awarding XP.
CREATE OR REPLACE FUNCTION public.connect_objective_record_advanced_finish_v1(
 p_student uuid,p_class uuid,p_app text,p_session uuid,p_answers jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $finish$
DECLARE
 v_session public.connect_objective_record_advanced_sessions%ROWTYPE;
 v_answer jsonb;v_question jsonb;v_terms jsonb;
 v_digits jsonb;v_carries jsonb;
 v_i int;v_j int;v_k int;v_answer_count int;v_term_count int;v_width int;v_expected_len int;
 v_score int:=0;v_errors int:=0;v_max_errors int;
 v_sum numeric;v_n numeric;v_partial numeric;v_factor numeric;v_carry int;
 v_expected_digit text;v_expected_carry text;v_raw text;
 v_correct boolean;v_hard boolean;v_hash text;v_ack jsonb;
BEGIN
 IF p_student IS NULL OR p_class IS NULL OR p_app NOT IN('addition-ecrite-simple','addition-ecrite-multiple')
 OR public.connect_objective_record_school_class_allowed_v1(p_class) IS DISTINCT FROM true
 OR p_session IS NULL OR jsonb_typeof(p_answers) IS DISTINCT FROM 'array'
 THEN RAISE EXCEPTION 'invalid_advanced_proof';END IF;
 v_answer_count:=jsonb_array_length(p_answers);
 IF v_answer_count NOT BETWEEN 1 AND 64 THEN RAISE EXCEPTION 'invalid_advanced_proof';END IF;
 -- Lock order matches issue and XP sync: pupil first, session, then app state.
 PERFORM 1 FROM public.connect_students WHERE id=p_student AND archived_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'inactive_student';END IF;
 SELECT * INTO v_session FROM public.connect_objective_record_advanced_sessions
 WHERE session_id=p_session AND student_id=p_student AND class_id=p_class AND app_key=p_app FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'proof_not_found';END IF;
 IF v_answer_count>v_session.question_limit
 OR v_session.mode NOT IN('three-lives','sudden','hard-three-lives','hard-sudden')
 OR v_session.app_key NOT IN('addition-ecrite-simple','addition-ecrite-multiple')
 OR jsonb_array_length(v_session.questions)<>v_session.question_limit
 THEN RAISE EXCEPTION 'invalid_advanced_proof';END IF;
 v_hash:=pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_answers::text,'UTF8')),'hex');
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
 v_hard:=v_session.mode LIKE 'hard-%';
 v_width:=CASE
  WHEN NOT v_hard AND v_session.app_key='addition-ecrite-simple'
   THEN CASE v_session.level WHEN 1 THEN 3 WHEN 2 THEN 5 ELSE 7 END
  WHEN NOT v_hard THEN 4+v_session.level
  WHEN v_session.app_key='addition-ecrite-simple'
   THEN CASE v_session.level WHEN 1 THEN 10 WHEN 2 THEN 12 ELSE 16 END
  ELSE CASE v_session.level WHEN 1 THEN 9 WHEN 2 THEN 12 ELSE 14 END END;
 v_max_errors:=CASE WHEN v_session.mode IN('three-lives','hard-three-lives') THEN 3 ELSE 1 END;
 FOR v_i IN 0..v_answer_count-1 LOOP
  v_answer:=p_answers->v_i;v_question:=v_session.questions->v_i;
  IF jsonb_typeof(v_answer) IS DISTINCT FROM 'object'
    OR (SELECT count(*) FROM jsonb_object_keys(v_answer))<>3
    OR NOT(v_answer ? 'id' AND v_answer ? 'digits' AND v_answer ? 'carries')
    OR v_answer->>'id' IS DISTINCT FROM v_question->>'id'
    OR jsonb_typeof(v_answer->'digits') IS DISTINCT FROM 'array'
    OR jsonb_typeof(v_answer->'carries') IS DISTINCT FROM 'array'
    OR jsonb_typeof(v_question->'addends') IS DISTINCT FROM 'array'
  THEN RAISE EXCEPTION 'invalid_advanced_proof';END IF;
  v_terms:=v_question->'addends';v_term_count:=jsonb_array_length(v_terms);
  IF (v_session.app_key='addition-ecrite-simple' AND v_term_count<>2)
    OR (v_session.app_key='addition-ecrite-multiple' AND (v_term_count<3 OR v_term_count>7))
  THEN RAISE EXCEPTION 'invalid_advanced_proof';END IF;
  v_sum:=0;
  FOR v_k IN 0..v_term_count-1 LOOP
   IF jsonb_typeof(v_terms->v_k) IS DISTINCT FROM 'string'
    OR (v_terms->>v_k) !~ '^[1-9][0-9]{0,15}$'
   THEN RAISE EXCEPTION 'invalid_advanced_proof';END IF;
   v_n:=(v_terms->>v_k)::numeric;
   IF v_n>=power(10::numeric,v_width) THEN RAISE EXCEPTION 'invalid_advanced_proof';END IF;
   v_sum:=v_sum+v_n;
  END LOOP;
  v_expected_len:=length(v_sum::text);
  v_digits:=v_answer->'digits';v_carries:=v_answer->'carries';
  IF jsonb_array_length(v_digits)<>v_expected_len
    OR jsonb_array_length(v_carries)<>v_width THEN RAISE EXCEPTION 'invalid_advanced_proof';END IF;
  v_correct:=true;
  FOR v_j IN 0..v_expected_len-1 LOOP
   IF jsonb_typeof(v_digits->v_j) IS DISTINCT FROM 'string'
    OR (v_digits->>v_j) !~ '^[0-9]?$'
   THEN RAISE EXCEPTION 'invalid_advanced_proof';END IF;
   v_expected_digit:=(mod(trunc(v_sum/power(10::numeric,v_j)),10))::integer::text;
   IF (v_digits->>v_j) IS DISTINCT FROM v_expected_digit THEN v_correct:=false;END IF;
  END LOOP;
  IF jsonb_typeof(v_carries->0) IS DISTINCT FROM 'string'
   OR (v_carries->>0) NOT IN('','0') THEN RAISE EXCEPTION 'invalid_advanced_proof';END IF;
  FOR v_j IN 1..v_width-1 LOOP
   v_raw:=v_carries->>v_j;
   IF jsonb_typeof(v_carries->v_j) IS DISTINCT FROM 'string'
    OR v_raw !~ '^[0-6]?$' THEN RAISE EXCEPTION 'invalid_advanced_proof';END IF;
   v_factor:=power(10::numeric,v_j);v_partial:=0;
   FOR v_k IN 0..v_term_count-1 LOOP
    v_partial:=v_partial+mod((v_terms->>v_k)::numeric,v_factor);
   END LOOP;
   v_carry:=trunc(v_partial/v_factor)::integer;
   v_expected_carry:=CASE WHEN v_carry=0 THEN '' ELSE v_carry::text END;
   IF v_expected_carry='' AND v_raw='0' THEN v_raw:='';END IF;
   IF v_raw IS DISTINCT FROM v_expected_carry THEN v_correct:=false;END IF;
  END LOOP;
  IF v_correct THEN v_score:=v_score+1;
  ELSE
   v_errors:=v_errors+1;
   IF v_errors>v_max_errors OR (v_errors=v_max_errors AND v_i<v_answer_count-1)
    THEN RAISE EXCEPTION 'advanced_stop_rule_broken';END IF;
  END IF;
 END LOOP;
 -- A score may finish early only because its last submission lost the final
 -- life; reaching the fixed 64-question capacity is the other terminal case.
 IF v_answer_count<v_session.question_limit AND v_errors<>v_max_errors
 THEN RAISE EXCEPTION 'advanced_stop_rule_broken';END IF;
 v_ack:=public.connect_objective_record_advanced_award_v1(
  p_student,p_class,v_session.app_key,p_session,
  v_session.expected_revision,v_session.reset_epoch,v_session.mode,
  v_session.level,v_score,NULL);
 UPDATE public.connect_objective_record_advanced_sessions SET
  consumed_at=now(),answers_hash=v_hash,
  result=v_ack||jsonb_build_object('proofVerified',true,
   'verifiedScore',v_score,'verifiedErrors',v_errors,'questionsChecked',v_answer_count,
   'mode',v_session.mode)
 WHERE session_id=p_session;
 RETURN v_ack||jsonb_build_object('proofVerified',true,
  'verifiedScore',v_score,'verifiedErrors',v_errors,'questionsChecked',v_answer_count,
  'mode',v_session.mode);
END $finish$;
REVOKE ALL ON FUNCTION public.connect_objective_record_advanced_finish_v1(uuid,uuid,text,uuid,jsonb)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.connect_objective_record_advanced_finish_v1(uuid,uuid,text,uuid,jsonb)
 TO service_role;
