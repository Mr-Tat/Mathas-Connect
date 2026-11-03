-- Exhaustive disposable-only suite, never call with a real pupil UUID.
CREATE OR REPLACE FUNCTION public.test_advanced_answers(p_questions jsonb,p_count integer,p_misses integer)
RETURNS jsonb LANGUAGE plpgsql AS $t$
DECLARE
 v_output jsonb:='[]'::jsonb;
 v_q jsonb;v_terms jsonb;v_digits jsonb;v_carries jsonb;
 v_sum numeric;v_num numeric;v_partial numeric;v_factor numeric;
 v_width int;v_len int;v_i int;v_j int;v_k int;v_carry int;v_digit text;
BEGIN
 FOR v_i IN 0..p_count-1 LOOP
  v_q:=p_questions->v_i;v_terms:=v_q->'addends';
  SELECT sum(value::numeric),max(length(value)) INTO v_sum,v_width
   FROM jsonb_array_elements_text(v_terms) q(value);
  v_len:=length(v_sum::text);
  v_digits:='[]'::jsonb;v_carries:=jsonb_build_array('');
  FOR v_j IN 0..v_len-1 LOOP
   v_digit:=(mod(trunc(v_sum/power(10::numeric,v_j)),10))::integer::text;
   IF v_i>=p_count-p_misses AND v_j=0
   THEN v_digit:=CASE WHEN v_digit='0' THEN '1' ELSE '0' END;
   END IF;
   v_digits:=v_digits||to_jsonb(v_digit);
  END LOOP;
  FOR v_j IN 1..v_width-1 LOOP
   v_factor:=power(10::numeric,v_j);v_partial:=0;
   FOR v_k IN 0..jsonb_array_length(v_terms)-1 LOOP
    v_num:=(v_terms->>v_k)::numeric;
    v_partial:=v_partial+mod(v_num,v_factor);
   END LOOP;
   v_carry:=trunc(v_partial/v_factor)::integer;
   v_carries:=v_carries||to_jsonb(CASE WHEN v_carry=0 THEN '' ELSE v_carry::text END);
  END LOOP;
  v_output:=v_output||jsonb_build_array(jsonb_build_object(
   'id',v_q->>'id','digits',v_digits,'carries',v_carries));
 END LOOP;
 RETURN v_output;
END $t$;

DO $checks$
DECLARE
 v_student uuid:='11111111-1111-4111-8111-111111111111';
 v_school uuid:='8fe170fa-9e8f-4e80-885a-b0ba68026f64';
 v_other uuid:='71f5f4a5-3f25-4ec7-ac29-c33d2e6b395e';
 v_pilot uuid:='4bf3400d-a315-4ea4-a2f3-afaca24dc9b9';
 v_app text;v_mode text;v_level int;v_misses int;v_length int;
 v_issued jsonb;v_ack jsonb;v_replay jsonb;v_wrong jsonb;v_answers jsonb;
 v_session uuid;v_count int:=0;v_changed int;
BEGIN
 FOR v_app IN SELECT unnest(ARRAY['addition-ecrite-simple','addition-ecrite-multiple']) LOOP
  FOR v_level IN 1..3 LOOP
   FOR v_mode IN SELECT unnest(ARRAY['three-lives','sudden','hard-three-lives','hard-sudden']) LOOP
    v_misses:=CASE WHEN v_mode IN('three-lives','hard-three-lives') THEN 3 ELSE 1 END;
    v_length:=CASE WHEN v_misses=3 THEN 4 ELSE 2 END;
    v_issued:=public.connect_objective_record_advanced_issue_v1(
       v_student,v_school,v_app,v_mode,v_level);
    IF v_issued->>'ok'<>'true' OR v_issued->>'mode'<>v_mode
     OR jsonb_array_length(v_issued->'questions')<>64
    THEN RAISE EXCEPTION 'invalid_advanced_issue % % %',v_app,v_mode,v_level;END IF;
    v_session:=(v_issued->>'sessionId')::uuid;
    -- No self-termination before the required final error.
    v_wrong:=public.test_advanced_answers(v_issued->'questions',2,0);
    BEGIN
     PERFORM public.connect_objective_record_advanced_finish_v1(v_student,v_school,v_session,v_wrong);
     RAISE EXCEPTION 'accepted_early_stop';
    EXCEPTION WHEN OTHERS THEN
     IF SQLERRM<>'advanced_stop_rule_broken' THEN RAISE;END IF;
    END;
    v_answers:=public.test_advanced_answers(v_issued->'questions',v_length,v_misses);
    v_ack:=public.connect_objective_record_advanced_finish_v1(v_student,v_school,v_session,v_answers);
    IF v_ack->>'ok'<>'true' OR v_ack->>'proofVerified'<>'true'
      OR (v_ack->>'verifiedScore')::integer<>v_length-v_misses
      OR (v_ack->>'verifiedErrors')::integer<>v_misses
      OR (v_ack->>'questionsChecked')::integer<>v_length
    THEN RAISE EXCEPTION 'wrong_advanced_grade % % %: %',v_app,v_mode,v_level,v_ack;END IF;
    v_replay:=public.connect_objective_record_advanced_finish_v1(v_student,v_school,v_session,v_answers);
    IF v_replay->>'duplicate'<>'true' OR (v_replay#>>'{xp,delta}')::integer<>0
    THEN RAISE EXCEPTION 'replay_gives_xp';END IF;
    v_count:=v_count+1;
   END LOOP;
  END LOOP;
 END LOOP;
 IF v_count<>24 THEN RAISE EXCEPTION 'missing_modes';END IF;
 -- Reusing an outstanding session returns exactly the same question set;
 -- starting a DIFFERENT mode while one is in progress must fail closed.
 v_issued:=public.connect_objective_record_advanced_issue_v1(
   v_student,v_school,'addition-ecrite-simple','three-lives',1);
 v_replay:=public.connect_objective_record_advanced_issue_v1(
   v_student,v_school,'addition-ecrite-simple','three-lives',1);
 IF v_replay->>'sessionId'<>v_issued->>'sessionId'
 OR v_replay->'questions'<>v_issued->'questions'
 THEN RAISE EXCEPTION 'session_not_reused';END IF;
 BEGIN
  PERFORM public.connect_objective_record_advanced_issue_v1(
   v_student,v_school,'addition-ecrite-simple','sudden',1);
  RAISE EXCEPTION 'parallel_challenge_allowed';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM<>'another_advanced_session_pending' THEN RAISE;END IF;
 END;
 v_session:=(v_issued->>'sessionId')::uuid;
 -- A complete 64 correct-answer run may legitimately reach the fixed cap.
 v_answers:=public.test_advanced_answers(v_issued->'questions',64,0);
 v_ack:=public.connect_objective_record_advanced_finish_v1(v_student,v_school,v_session,v_answers);
 IF (v_ack->>'verifiedScore')::integer<>64 THEN RAISE EXCEPTION 'cap_not_credited';END IF;
 IF (SELECT count(*) FROM public.connect_objective_record_advanced_sessions)<>25
 THEN RAISE EXCEPTION 'sessions_lost';END IF;
 -- Strict SQL server boundary, including class and web roles.
 BEGIN
  PERFORM public.connect_objective_record_advanced_issue_v1(
   v_student,v_pilot,'addition-ecrite-simple','sudden',1);
  RAISE EXCEPTION 'test_opened';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM<>'invalid_advanced_config' THEN RAISE;END IF;
 END;
 BEGIN
  PERFORM public.connect_objective_record_advanced_issue_v1(
   v_student,v_other,'addition-ecrite-simple','sudden',1);
  RAISE EXCEPTION 'cross_class_opened';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM<>'not_school_subject' THEN RAISE;END IF;
 END;
 IF has_function_privilege('anon','public.connect_objective_record_advanced_issue_v1(uuid,uuid,text,text,integer)','EXECUTE')
  OR has_function_privilege('authenticated','public.connect_objective_record_advanced_finish_v1(uuid,uuid,uuid,jsonb)','EXECUTE')
  OR has_function_privilege('anon','public.connect_objective_record_advanced_award_v1(uuid,uuid,text,uuid,bigint,bigint,text,integer,integer,integer)','EXECUTE')
  OR has_table_privilege('anon','public.connect_objective_record_advanced_sessions','SELECT')
 THEN RAISE EXCEPTION 'browser_can_forge_awards';END IF;
 RAISE NOTICE 'All 24 advanced addition mode variants, arithmetic, stop conditions, replay, RLS and cap PASS';
END $checks$;
