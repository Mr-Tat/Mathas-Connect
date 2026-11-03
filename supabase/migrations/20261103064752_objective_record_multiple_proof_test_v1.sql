-- Production-oriented server arithmetic proof: Addition multiple, TEST class only
-- No change to existing pupil data or the five school HUB launch routes.
-- Reuse private RLS proof-sessions table and native atomic XP record RPC.
CREATE OR REPLACE FUNCTION public.connect_objective_record_test_issue_multi_v1(
 p_student uuid,p_class uuid,p_level integer,p_total integer
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $issue$
DECLARE
 v_test constant uuid:='4bf3400d-a315-4ea4-a2f3-afaca24dc9b9';
 v_app constant text:='addition-ecrite-multiple';
 v_revision bigint;v_epoch bigint;v_existing record;
 v_questions jsonb:='[]'::jsonb;v_terms jsonb;
 v_width integer;v_term_count integer;v_len integer;v_min integer;v_n integer;
 v_i integer;v_j integer;v_id uuid;v_expiry timestamptz;
BEGIN
 IF p_class IS DISTINCT FROM v_test OR p_student IS NULL THEN RAISE EXCEPTION 'proof_test_only';END IF;
 IF p_level NOT IN (1,2,3) OR p_total NOT IN (4,10,20)
  OR p_level IS NULL OR p_total IS NULL THEN RAISE EXCEPTION 'invalid_proof_configuration';END IF;
 PERFORM 1 FROM public.connect_students WHERE id=p_student AND archived_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'inactive_student';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.connect_enrollments
     WHERE student_id=p_student AND class_id=v_test AND left_at IS NULL)
  AND NOT EXISTS(SELECT 1 FROM public.connect_teacher_players tp
     JOIN public.connect_class_permissions cp ON cp.teacher_id=tp.teacher_id
     WHERE tp.student_id=p_student AND cp.class_id=v_test AND cp.can_manage=true)
 THEN RAISE EXCEPTION 'not_test_subject';END IF;
 SELECT coalesce(revision,0),coalesce(reset_epoch,0) INTO v_revision,v_epoch
  FROM public.connect_states WHERE student_id=p_student AND app_key=v_app;
 v_revision:=coalesce(v_revision,0);v_epoch:=coalesce(v_epoch,0);
 SELECT * INTO v_existing FROM public.connect_objective_record_test_proof_sessions
  WHERE student_id=p_student AND class_id=v_test AND app_key=v_app
    AND consumed_at IS NULL AND expires_at>now()
    AND expected_revision=v_revision AND reset_epoch=v_epoch
    AND level=p_level AND total=p_total
  ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
 IF FOUND THEN
  RETURN jsonb_build_object('ok',true,'sessionId',v_existing.session_id,
   'questions',v_existing.questions,'revision',v_revision,'resetEpoch',v_epoch,
   'level',p_level,'total',p_total,'reused',true,'expiresAt',v_existing.expires_at);
 END IF;
 -- Native Addition multiple levels use widths 5/6/7, with 3..6 terms.
 v_width:=p_level+4;
 FOR v_i IN 1..p_total LOOP
  v_term_count:=p_level+2+floor(random()*2)::integer;
  v_terms:='[]'::jsonb;
  FOR v_j IN 1..v_term_count LOOP
   v_len:=v_width-CASE WHEN v_j>2 AND random()<.50 THEN 1 ELSE 0 END;
   v_min:=power(10::numeric,v_len-1)::integer;
   v_n:=v_min+floor(random()*9*v_min)::integer;
   v_terms:=v_terms||jsonb_build_array(v_n);
  END LOOP;
  v_questions:=v_questions||jsonb_build_array(
   jsonb_build_object('id','q'||v_i,'op','add','addends',v_terms));
 END LOOP;
 INSERT INTO public.connect_objective_record_test_proof_sessions(
  student_id,class_id,app_key,expected_revision,reset_epoch,level,total,questions,expires_at)
 VALUES(p_student,v_test,v_app,v_revision,v_epoch,p_level,p_total,v_questions,now()+interval '90 minutes')
 RETURNING session_id,expires_at INTO v_id,v_expiry;
 RETURN jsonb_build_object('ok',true,'sessionId',v_id,
  'questions',v_questions,'revision',v_revision,'resetEpoch',v_epoch,
  'level',p_level,'total',p_total,'reused',false,'expiresAt',v_expiry);
END $issue$;
REVOKE ALL ON FUNCTION public.connect_objective_record_test_issue_multi_v1(uuid,uuid,integer,integer)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.connect_objective_record_test_issue_multi_v1(uuid,uuid,integer,integer)
 TO service_role;

CREATE OR REPLACE FUNCTION public.connect_objective_record_test_finish_multi_v1(
 p_student uuid,p_class uuid,p_session uuid,p_answers jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $finish$
DECLARE
 v_test constant uuid:='4bf3400d-a315-4ea4-a2f3-afaca24dc9b9';
 v_app constant text:='addition-ecrite-multiple';
 v_session public.connect_objective_record_test_proof_sessions%ROWTYPE;
 v_answer jsonb;v_question jsonb;v_terms jsonb;
 v_digits jsonb;v_carries jsonb;v_i integer;v_j integer;v_k integer;
 v_width integer;v_len integer;v_term_count integer;
 v_sum integer;v_operand integer;v_partial integer;v_power integer;v_carry integer;
 v_actual text;v_expected_digit text;v_expected_carry text;
 v_correct boolean;v_score integer:=0;v_hash text;v_ack jsonb;v_rewards jsonb;
BEGIN
 IF p_student IS NULL OR p_class IS DISTINCT FROM v_test OR p_session IS NULL
  OR jsonb_typeof(p_answers) IS DISTINCT FROM 'array'
  OR jsonb_array_length(p_answers) NOT IN (4,10,20)
 THEN RAISE EXCEPTION 'invalid_proof_answers';END IF;
 -- Same lock order as issuer and native XP transaction.
 PERFORM 1 FROM public.connect_students WHERE id=p_student AND archived_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'inactive_student';END IF;
 SELECT * INTO v_session FROM public.connect_objective_record_test_proof_sessions
  WHERE session_id=p_session AND student_id=p_student AND class_id=v_test AND app_key=v_app
  FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'proof_not_found';END IF;
 IF v_session.level NOT IN (1,2,3) OR v_session.total NOT IN (4,10,20)
  OR jsonb_array_length(p_answers)<>v_session.total
 THEN RAISE EXCEPTION 'invalid_proof_answers';END IF;
 v_hash:=pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_answers::text,'UTF8')),'hex');
 IF v_session.consumed_at IS NOT NULL THEN
  IF v_session.answers_hash<>v_hash THEN RAISE EXCEPTION 'proof_replay_collision';END IF;
  RETURN v_session.result||jsonb_build_object('duplicate',true,
   'xp',v_session.result->'xp'||jsonb_build_object('delta',0));
 END IF;
 IF v_session.expires_at<=now() THEN RAISE EXCEPTION 'proof_expired';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.connect_enrollments
     WHERE student_id=p_student AND class_id=v_test AND left_at IS NULL)
  AND NOT EXISTS(SELECT 1 FROM public.connect_teacher_players tp
     JOIN public.connect_class_permissions cp ON cp.teacher_id=tp.teacher_id
     WHERE tp.student_id=p_student AND cp.class_id=v_test AND cp.can_manage=true)
 THEN RAISE EXCEPTION 'not_test_subject';END IF;
 v_width:=v_session.level+4;
 FOR v_i IN 0..v_session.total-1 LOOP
  v_question:=v_session.questions->v_i;v_answer:=p_answers->v_i;
  IF jsonb_typeof(v_answer) IS DISTINCT FROM 'object'
    OR (SELECT count(*) FROM jsonb_object_keys(v_answer))<>3
    OR NOT (v_answer ? 'id' AND v_answer ? 'digits' AND v_answer ? 'carries')
    OR v_answer->>'id' IS DISTINCT FROM v_question->>'id'
    OR jsonb_typeof(v_answer->'digits') IS DISTINCT FROM 'array'
    OR jsonb_typeof(v_answer->'carries') IS DISTINCT FROM 'array'
  THEN RAISE EXCEPTION 'invalid_proof_answers';END IF;
  v_terms:=v_question->'addends';v_term_count:=jsonb_array_length(v_terms);
  IF v_term_count<3 OR v_term_count>6 THEN RAISE EXCEPTION 'invalid_proof_answers';END IF;
  v_sum:=0;
  FOR v_k IN 0..v_term_count-1 LOOP
   v_operand:=(v_terms->>v_k)::integer;
   IF v_operand<1 OR v_operand>=power(10::numeric,v_width)::integer
   THEN RAISE EXCEPTION 'invalid_proof_answers';END IF;
   v_sum:=v_sum+v_operand;
  END LOOP;
  v_len:=length(v_sum::text);
  v_digits:=v_answer->'digits';v_carries:=v_answer->'carries';
  IF jsonb_array_length(v_digits)<>v_len OR jsonb_array_length(v_carries)<>v_width
  THEN RAISE EXCEPTION 'invalid_proof_answers';END IF;
  v_correct:=true;
  FOR v_j IN 0..v_len-1 LOOP
   IF jsonb_typeof(v_digits->v_j) IS DISTINCT FROM 'string' THEN RAISE EXCEPTION 'invalid_proof_answers';END IF;
   v_actual:=v_digits->>v_j;
   IF v_actual !~ '^[0-9]?$' THEN RAISE EXCEPTION 'invalid_proof_answers';END IF;
   v_expected_digit:=((v_sum/(10^v_j)::integer)%10)::text;
   IF v_actual IS DISTINCT FROM v_expected_digit THEN v_correct:=false;END IF;
  END LOOP;
  IF jsonb_typeof(v_carries->0) IS DISTINCT FROM 'string'
    OR (v_carries->>0) NOT IN ('','0') THEN RAISE EXCEPTION 'invalid_proof_answers';END IF;
  FOR v_j IN 1..v_width-1 LOOP
   IF jsonb_typeof(v_carries->v_j) IS DISTINCT FROM 'string' THEN RAISE EXCEPTION 'invalid_proof_answers';END IF;
   v_actual:=v_carries->>v_j;
   IF v_actual !~ '^[0-5]?$' THEN RAISE EXCEPTION 'invalid_proof_answers';END IF;
   v_power:=(10^v_j)::integer;
   v_partial:=0;
   FOR v_k IN 0..v_term_count-1 LOOP
    v_partial:=v_partial+((v_terms->>v_k)::integer % v_power);
   END LOOP;
   v_carry:=v_partial/v_power;
   v_expected_carry:=CASE WHEN v_carry=0 THEN '' ELSE v_carry::text END;
   IF v_expected_carry='' AND v_actual='0' THEN v_actual:='';END IF;
   IF v_actual IS DISTINCT FROM v_expected_carry THEN v_correct:=false;END IF;
  END LOOP;
  IF v_correct THEN v_score:=v_score+1;END IF;
 END LOOP;
 -- Import permanent trophies before merging the new server-proven mastery.
 -- A client cannot claim score cups or HARD trophies through this route.
 v_rewards:=coalesce(public.connect_trophy_rewards_v1(p_student,v_app),
  '{"version":3,"mastery":{"4":[false,false,false],"10":[false,false,false],"20":[false,false,false]},
    "sudden":[false,false,false],"hardAwards":{"bronze":[false,false,false],
    "silver":[false,false,false],"gold":[false,false,false]},
    "scoreOne":{"bronze":false,"silver":false,"gold":false},"unlockedGold":false}'::jsonb);
 IF v_score=v_session.total THEN
  v_rewards:=jsonb_set(v_rewards,
    ARRAY['mastery',v_session.total::text,(v_session.level-1)::text],'true'::jsonb,false);
 END IF;
 -- No client-chosen score or trophies. In this SAME transaction, the native
 -- recorder merges server-authorized awards, state, official XP and projection.
 v_ack:=public.connect_addition_multiple_record_v1(p_student,p_session,
  v_session.expected_revision,v_session.reset_epoch,'classic',v_session.level,
  v_score,v_session.total,v_rewards);
 UPDATE public.connect_objective_record_test_proof_sessions
 SET consumed_at=now(),answers_hash=v_hash,
  result=v_ack||jsonb_build_object('proofVerified',true,'verifiedScore',v_score)
 WHERE session_id=p_session;
 RETURN v_ack||jsonb_build_object('proofVerified',true,'verifiedScore',v_score);
END $finish$;
REVOKE ALL ON FUNCTION public.connect_objective_record_test_finish_multi_v1(uuid,uuid,uuid,jsonb)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.connect_objective_record_test_finish_multi_v1(uuid,uuid,uuid,jsonb)
 TO service_role;
