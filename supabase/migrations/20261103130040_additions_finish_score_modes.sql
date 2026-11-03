-- Complete score-mode proof: the server recalculates EVERY first-attempt
-- result digit and carry, and derives lost hearts, stopping point and XP.
-- A forged native score, trophy, event phase, or client-selected mode is ignored.
CREATE OR REPLACE FUNCTION public.connect_objective_record_school_finish_mode_v1(
 p_student uuid,p_class uuid,p_session uuid,p_answers jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $finish$
DECLARE
 v_s public.connect_objective_record_school_mode_sessions%ROWTYPE;
 v_a jsonb;v_q jsonb;v_terms jsonb;v_digits jsonb;v_carries jsonb;
 v_n integer;v_i integer;v_j integer;v_k integer;v_len integer;
 v_width integer;v_terms_count integer;v_max_wrong integer;
 v_operand numeric;v_sum numeric;v_partial numeric;v_pow numeric;
 v_expected text;v_actual text;v_correct boolean;v_wrong integer:=0;
 v_score integer:=0;v_terminal_at integer:=NULL;v_hash text;v_ack jsonb;
BEGIN
 IF p_student IS NULL OR p_class IS NULL OR p_session IS NULL
  OR public.connect_objective_record_school_class_allowed_v1(p_class) IS DISTINCT FROM true
  OR jsonb_typeof(p_answers) IS DISTINCT FROM 'array'
  OR jsonb_array_length(p_answers)<1 OR jsonb_array_length(p_answers)>64
 THEN RAISE EXCEPTION 'invalid_mode_answers';END IF;
 PERFORM 1 FROM public.connect_students WHERE id=p_student AND archived_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'inactive_student';END IF;
 SELECT * INTO v_s FROM public.connect_objective_record_school_mode_sessions
 WHERE session_id=p_session AND student_id=p_student AND class_id=p_class
  AND app_key IN ('addition-ecrite-simple','addition-ecrite-multiple') FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'proof_not_found';END IF;
 v_n:=jsonb_array_length(p_answers);
 v_hash:=pg_catalog.encode(pg_catalog.sha256(
  pg_catalog.convert_to(p_answers::text,'UTF8')),'hex');
 IF v_s.consumed_at IS NOT NULL THEN
  IF v_s.answers_hash IS DISTINCT FROM v_hash THEN RAISE EXCEPTION 'proof_replay_collision';END IF;
  RETURN v_s.result||jsonb_build_object('duplicate',true,
   'xp',v_s.result->'xp'||jsonb_build_object('delta',0));
 END IF;
 IF v_s.expires_at<=now() THEN RAISE EXCEPTION 'proof_expired';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.connect_enrollments WHERE student_id=p_student
   AND class_id=p_class AND left_at IS NULL)
  AND NOT EXISTS(SELECT 1 FROM public.connect_teacher_players tp
   JOIN public.connect_class_permissions cp ON cp.teacher_id=tp.teacher_id
    AND cp.class_id=p_class AND cp.can_manage=true WHERE tp.student_id=p_student)
 THEN RAISE EXCEPTION 'not_school_subject';END IF;
 v_width:=CASE WHEN v_s.mode LIKE 'hard-%' THEN
  CASE WHEN v_s.app_key='addition-ecrite-simple'
   THEN CASE v_s.level WHEN 1 THEN 10 WHEN 2 THEN 12 ELSE 16 END
   ELSE CASE v_s.level WHEN 1 THEN 9 WHEN 2 THEN 12 ELSE 14 END END
  ELSE CASE WHEN v_s.app_key='addition-ecrite-simple'
   THEN CASE v_s.level WHEN 1 THEN 3 WHEN 2 THEN 5 ELSE 7 END
   ELSE v_s.level+4 END END;
 v_max_wrong:=CASE WHEN v_s.mode IN ('sudden','hard-sudden') THEN 1 ELSE 3 END;
 FOR v_i IN 0..v_n-1 LOOP
  v_q:=v_s.questions->v_i;v_a:=p_answers->v_i;
  IF jsonb_typeof(v_a) IS DISTINCT FROM 'object'
   OR (select count(*) from jsonb_object_keys(v_a))<>3
   OR NOT (v_a ? 'id' AND v_a ? 'digits' AND v_a ? 'carries')
   OR v_a->>'id' IS DISTINCT FROM v_q->>'id'
   OR jsonb_typeof(v_a->'digits') IS DISTINCT FROM 'array'
   OR jsonb_typeof(v_a->'carries') IS DISTINCT FROM 'array'
  THEN RAISE EXCEPTION 'invalid_mode_answers';END IF;
  -- The native engine may have captured the second calculation of a pair
  -- before an earlier one exhausted the final heart. At most ONE such
  -- unused capture may trail the terminal mistake; it earns no score.
  IF v_terminal_at IS NOT NULL THEN CONTINUE;END IF;
  v_terms:=v_q->'addends';v_terms_count:=jsonb_array_length(v_terms);
  IF v_terms_count <2 OR v_terms_count>7 THEN RAISE EXCEPTION 'invalid_mode_answers';END IF;
  IF (v_s.app_key='addition-ecrite-simple' AND v_terms_count<>2)
   OR (v_s.app_key='addition-ecrite-multiple' AND v_s.mode LIKE 'hard-%'
       AND v_terms_count<>CASE v_s.level WHEN 3 THEN 7 ELSE 6 END)
  THEN RAISE EXCEPTION 'invalid_mode_answers';END IF;
  v_sum:=0;
  FOR v_k IN 0..v_terms_count-1 LOOP
   IF jsonb_typeof(v_terms->v_k) IS DISTINCT FROM 'string'
    OR (v_terms->>v_k) !~ '^[1-9][0-9]{0,15}$'
   THEN RAISE EXCEPTION 'invalid_mode_answers';END IF;
   v_operand:=(v_terms->>v_k)::numeric;
   IF v_operand>=power(10::numeric,v_width)
   THEN RAISE EXCEPTION 'invalid_mode_answers';END IF;
   v_sum:=v_sum+v_operand;
  END LOOP;
  v_len:=length(v_sum::text);
  v_digits:=v_a->'digits';v_carries:=v_a->'carries';
  IF jsonb_array_length(v_digits)<>v_len OR jsonb_array_length(v_carries)<>v_width
  THEN RAISE EXCEPTION 'invalid_mode_answers';END IF;
  v_correct:=true;
  FOR v_j IN 0..v_len-1 LOOP
   IF jsonb_typeof(v_digits->v_j) IS DISTINCT FROM 'string'
    OR (v_digits->>v_j) !~ '^[0-9]?$'
   THEN RAISE EXCEPTION 'invalid_mode_answers';END IF;
   v_expected:=substr(reverse(v_sum::text),v_j+1,1);
   IF v_digits->>v_j IS DISTINCT FROM v_expected THEN v_correct:=false;END IF;
  END LOOP;
  IF jsonb_typeof(v_carries->0) IS DISTINCT FROM 'string'
   OR (v_carries->>0) NOT IN ('','0')
  THEN RAISE EXCEPTION 'invalid_mode_answers';END IF;
  FOR v_j IN 1..v_width-1 LOOP
   v_actual:=v_carries->>v_j;
   IF jsonb_typeof(v_carries->v_j) IS DISTINCT FROM 'string'
    OR v_actual !~ '^[0-6]?$'
   THEN RAISE EXCEPTION 'invalid_mode_answers';END IF;
   v_pow:=power(10::numeric,v_j);v_partial:=0;
   FOR v_k IN 0..v_terms_count-1 LOOP
    v_partial:=v_partial+mod((v_terms->>v_k)::numeric,v_pow);
   END LOOP;
   v_expected:=trunc(v_partial/v_pow)::text;
   IF v_expected='0' THEN v_expected:='';END IF;
   IF v_expected='' AND v_actual='0' THEN v_actual:='';END IF;
   IF v_actual IS DISTINCT FROM v_expected THEN v_correct:=false;END IF;
  END LOOP;
  IF v_correct THEN v_score:=v_score+1;
  ELSE
   v_wrong:=v_wrong+1;
   IF v_wrong=v_max_wrong THEN v_terminal_at:=v_i; END IF;
  END IF;
 END LOOP;
 IF v_terminal_at IS NULL THEN
  IF v_n<>64 THEN RAISE EXCEPTION 'mode_not_finished';END IF;
 ELSE
  IF v_terminal_at NOT IN (v_n-1,v_n-2) THEN RAISE EXCEPTION 'mode_terminal_mismatch';END IF;
 END IF;
 -- The receipt, state revision, permanent cups and official XP are written
 -- together. Failed grading or a stale revision rolls back this entire call.
 v_ack:=public.connect_objective_record_school_mode_record_v1(
  p_student,p_class,v_s.app_key,p_session,v_s.expected_revision,
  v_s.reset_epoch,v_s.mode,v_s.level,v_score);
 UPDATE public.connect_objective_record_school_mode_sessions
 SET consumed_at=now(),answers_hash=v_hash,
  result=v_ack||jsonb_build_object('proofVerified',true,
   'verifiedScore',v_score,'mistakes',v_wrong,'mode',v_s.mode)
 WHERE session_id=p_session;
 RETURN v_ack||jsonb_build_object('proofVerified',true,
  'verifiedScore',v_score,'mistakes',v_wrong,'mode',v_s.mode);
END $finish$;
REVOKE ALL ON FUNCTION public.connect_objective_record_school_finish_mode_v1(
 uuid,uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.connect_objective_record_school_finish_mode_v1(
 uuid,uuid,uuid,jsonb) TO service_role;
