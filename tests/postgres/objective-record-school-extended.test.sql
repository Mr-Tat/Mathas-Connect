-- Run only on the disposable Postgres16 GitHub Actions fixture.
-- These IDs are synthetic; no real pupil or existing school results.
CREATE OR REPLACE FUNCTION public.test_school_extended_answers(
 p_questions jsonb,p_count integer,p_wrong integer[]
) RETURNS jsonb LANGUAGE plpgsql AS $test$
DECLARE
 v_arr jsonb:='[]'::jsonb;v_q jsonb;v_a jsonb;v_c jsonb;
 v_terms jsonb;v_sum numeric;v_partial numeric;v_pow numeric;
 v_digit text;v_carry text;v_width integer;v_i integer;v_j integer;v_k integer;
BEGIN
 FOR v_i IN 0..p_count-1 LOOP
  v_q:=p_questions->v_i;v_terms:=v_q->'addends';
  v_width:=(v_q->>'width')::integer;v_sum:=0;
  FOR v_k IN 0..jsonb_array_length(v_terms)-1 LOOP
   v_sum:=v_sum+(v_terms->>v_k)::numeric;
  END LOOP;
  v_a:='[]'::jsonb;
  FOR v_j IN 0..length(v_sum::text)-1 LOOP
   v_digit:=mod(trunc(v_sum/power(10::numeric,v_j)),10)::text;
   IF v_j=0 AND v_i+1=ANY(p_wrong) THEN
    v_digit:=CASE WHEN v_digit='0' THEN '1' ELSE '0' END;
   END IF;
   v_a:=v_a||to_jsonb(v_digit);
  END LOOP;
  v_c:=jsonb_build_array('');
  FOR v_j IN 1..v_width-1 LOOP
   v_pow:=power(10::numeric,v_j);v_partial:=0;
   FOR v_k IN 0..jsonb_array_length(v_terms)-1 LOOP
    v_partial:=v_partial+mod((v_terms->>v_k)::numeric,v_pow);
   END LOOP;
   v_carry:=trunc(v_partial/v_pow)::text;
   v_c:=v_c||to_jsonb(CASE WHEN v_carry='0' THEN '' ELSE v_carry END);
  END LOOP;
  v_arr:=v_arr||jsonb_build_array(jsonb_build_object(
   'id',v_q->>'id','digits',v_a,'carries',v_c));
 END LOOP;
 RETURN v_arr;
END $test$;

DO $school_ext$
DECLARE
 v_student constant uuid:='11111111-1111-4111-8111-111111111111';
 v_class constant uuid:='8fe170fa-9e8f-4e80-885a-b0ba68026f64';
 v_other constant uuid:='71f5f4a5-3f25-4ec7-ac29-c33d2e6b395e';
 v_test constant uuid:='4bf3400d-a315-4ea4-a2f3-afaca24dc9b9';
 v_app text;v_mode text;v_level integer;v_bad integer[];v_count integer;
 v_issued jsonb;v_issued_again jsonb;v_ack jsonb;v_again jsonb;v_ans jsonb;
 v_session uuid;v_variants integer:=0;v_old_count integer;v_after_count integer;
BEGIN
 IF has_table_privilege('anon','public.connect_objective_record_school_extended_sessions','SELECT')
  OR has_table_privilege('authenticated','public.connect_objective_record_school_extended_sessions','SELECT')
  OR has_function_privilege('anon','public.connect_objective_record_school_issue_extended_v1(uuid,uuid,text,text,integer)','EXECUTE')
  OR has_function_privilege('authenticated','public.connect_objective_record_school_issue_extended_v1(uuid,uuid,text,text,integer)','EXECUTE')
  OR has_function_privilege('anon','public.connect_objective_record_school_finish_extended_v1(uuid,uuid,text,uuid,jsonb)','EXECUTE')
  OR has_function_privilege('authenticated','public.connect_objective_record_school_record_extended_v1(uuid,uuid,text,uuid,bigint,bigint,text,integer,integer,integer,text)','EXECUTE')
 THEN RAISE EXCEPTION 'school_extended_proof_web_roles_can_award';END IF;

 FOR v_app IN SELECT unnest(ARRAY['addition-ecrite-simple','addition-ecrite-multiple']) LOOP
  FOR v_mode IN SELECT unnest(ARRAY['sudden','three-lives','hard-sudden','hard-three-lives']) LOOP
   FOR v_level IN 1..3 LOOP
    v_issued:=public.connect_objective_record_school_issue_extended_v1(
     v_student,v_class,v_app,v_mode,v_level);
    v_issued_again:=public.connect_objective_record_school_issue_extended_v1(
     v_student,v_class,v_app,v_mode,v_level);
    IF v_issued->>'ok'<>'true'
     OR (v_issued->>'sessionId') IS DISTINCT FROM (v_issued_again->>'sessionId')
     OR (v_issued->>'limit')::integer<>120
     OR jsonb_array_length(v_issued->'questions')<>120
     OR v_issued->>'mode'<>v_mode
     OR (v_issued->>'width')::integer<3
    THEN RAISE EXCEPTION 'extended_issue_contract % % %',v_app,v_mode,v_level;END IF;
    v_count:=CASE WHEN v_mode LIKE '%three-lives' THEN 3 ELSE 1 END;
    v_bad:=CASE WHEN v_count=3 THEN ARRAY[1,2,3] ELSE ARRAY[1] END;
    v_ans:=public.test_school_extended_answers(v_issued->'questions',v_count,v_bad);
    v_session:=(v_issued->>'sessionId')::uuid;
    v_ack:=public.connect_objective_record_school_finish_extended_v1(
      v_student,v_class,v_app,v_session,v_ans);
    v_again:=public.connect_objective_record_school_finish_extended_v1(
      v_student,v_class,v_app,v_session,v_ans);
    IF v_ack->>'ok'<>'true' OR v_ack->>'proofVerified'<>'true'
     OR v_ack->>'mode' IS DISTINCT FROM v_mode
     OR (v_ack->>'verifiedScore')::integer<>0
     OR (v_ack->>'attempted')::integer<>v_count
     OR v_again->>'duplicate'<>'true' OR (v_again#>>'{xp,delta}')::integer<>0
    THEN RAISE EXCEPTION 'extended_finish_contract % % % : %',v_app,v_mode,v_level,v_ack;END IF;
    v_variants:=v_variants+1;
   END LOOP;
  END LOOP;
 END LOOP;
 IF v_variants<>24 THEN RAISE EXCEPTION 'extended_24_variants_incomplete';END IF;
 IF (SELECT count(*) FROM public.connect_objective_record_school_extended_sessions)<>24
 THEN RAISE EXCEPTION 'extended_sessions_missing';END IF;
 IF (SELECT count(*) FROM public.connect_objective_record_school_receipts)<>34
 THEN RAISE EXCEPTION 'extended_receipts_missing';END IF;

 -- CLASS TEST and class spoofing are rejected by SQL, not only by Edge.
 BEGIN
  PERFORM public.connect_objective_record_school_issue_extended_v1(v_student,v_test,
   'addition-ecrite-simple','sudden',1);
  RAISE EXCEPTION 'test_class_was_accepted';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM<>'school_class_not_allowed' THEN RAISE;END IF;
 END;
 BEGIN
  PERFORM public.connect_objective_record_school_issue_extended_v1(v_student,v_other,
   'addition-ecrite-multiple','three-lives',1);
  RAISE EXCEPTION 'school_class_spoofed';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM<>'not_school_subject' THEN RAISE;END IF;
 END;
 -- An early termination cannot claim a perfect long-run score.
 v_issued:=public.connect_objective_record_school_issue_extended_v1(v_student,v_class,
   'addition-ecrite-simple','three-lives',1);
 v_session:=(v_issued->>'sessionId')::uuid;
 v_ans:=public.test_school_extended_answers(v_issued->'questions',1,ARRAY[1]);
 BEGIN
  PERFORM public.connect_objective_record_school_finish_extended_v1(
    v_student,v_class,'addition-ecrite-simple',v_session,v_ans);
  RAISE EXCEPTION 'premature_three_lives_finish';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM<>'proof_incomplete_game' THEN RAISE;END IF;
 END;
 v_ans:=public.test_school_extended_answers(v_issued->'questions',3,ARRAY[1,2,3]);
 v_ack:=public.connect_objective_record_school_finish_extended_v1(
   v_student,v_class,'addition-ecrite-simple',v_session,v_ans);
 IF (v_ack->>'verifiedScore')::integer<>0 THEN RAISE EXCEPTION 'invalid_3_lives_grade';END IF;
 v_ans:=public.test_school_extended_answers(v_issued->'questions',4,ARRAY[1,2,3]);
 BEGIN
  PERFORM public.connect_objective_record_school_finish_extended_v1(
    v_student,v_class,'addition-ecrite-simple',v_session,v_ans);
  RAISE EXCEPTION 'replay_collision_was_accepted';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM<>'proof_replay_collision' THEN RAISE;END IF;
 END;
 -- A later first wrong after five valid calculations must award the normal
 -- sudden milestone exactly once, not the browser-declared score.
 v_issued:=public.connect_objective_record_school_issue_extended_v1(v_student,v_class,
   'addition-ecrite-multiple','sudden',1);
 v_ans:=public.test_school_extended_answers(v_issued->'questions',6,ARRAY[6]);
 v_ack:=public.connect_objective_record_school_finish_extended_v1(v_student,v_class,
   'addition-ecrite-multiple',(v_issued->>'sessionId')::uuid,v_ans);
 IF (v_ack->>'verifiedScore')::integer<>5 OR (v_ack#>>'{state,sudden,0}')::integer<5
 THEN RAISE EXCEPTION 'sudden_threshold_not_awarded';END IF;
 -- HARD reaches its existing 3 and 7 XP milestones through certified math.
 v_issued:=public.connect_objective_record_school_issue_extended_v1(v_student,v_class,
   'addition-ecrite-simple','hard-three-lives',2);
 v_ans:=public.test_school_extended_answers(v_issued->'questions',10,ARRAY[8,9,10]);
 v_ack:=public.connect_objective_record_school_finish_extended_v1(v_student,v_class,
   'addition-ecrite-simple',(v_issued->>'sessionId')::uuid,v_ans);
 IF (v_ack->>'verifiedScore')::integer<>7 OR (v_ack#>>'{state,hard,1}')::integer<7
  OR (v_ack#>>'{state,hardThree,1}')::integer<7
 THEN RAISE EXCEPTION 'hard_3lives_threshold_not_awarded';END IF;
 -- The trophy is distinct and requires 25 consecutive correct sudden results.
 v_issued:=public.connect_objective_record_school_issue_extended_v1(v_student,v_class,
   'addition-ecrite-simple','sudden',1);
 v_ans:=public.test_school_extended_answers(v_issued->'questions',26,ARRAY[26]);
 v_ack:=public.connect_objective_record_school_finish_extended_v1(v_student,v_class,
   'addition-ecrite-simple',(v_issued->>'sessionId')::uuid,v_ans);
 IF (v_ack->>'verifiedScore')::integer<>25
  OR (v_ack#>>'{state,rewards,sudden,0}')::boolean IS DISTINCT FROM true
 THEN RAISE EXCEPTION 'sudden_trophy_25_absent';END IF;
 RAISE NOTICE 'school_extended: % variants + wrong termination/identity/replay/XP/trophy PASS',v_variants;
END $school_ext$;
