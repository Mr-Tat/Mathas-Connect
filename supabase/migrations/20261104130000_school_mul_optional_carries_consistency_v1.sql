-- [LIVE verified 2026-11-04] The native engine treats omitted reports as optional;
-- a report written incorrectly still makes the first attempt wrong.
-- The prior CLASSIC/EXTENDED SQL falsely rejected omitted valid reports.
-- This migration changes only proof evaluation; no student state, XP, scores,
-- trophies, class visibility or projection layouts are altered.
BEGIN;
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
   -- Comme le moteur natif : report facultatif, mais report ERRONÉ pénalisé.
   IF v_actual<>'' THEN
    IF v_actual='0' THEN v_actual:='';END IF;
    IF v_actual IS DISTINCT FROM v_expected THEN v_correct:=false;END IF;
   END IF;
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
   -- Comme le moteur natif : report facultatif, mais report ERRONÉ pénalisé.
   IF v_actual<>'' THEN
    IF v_actual='0' THEN v_actual:='';END IF;
    IF v_actual IS DISTINCT FROM v_expected THEN v_correct:=false;END IF;
   END IF;
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
COMMIT;
