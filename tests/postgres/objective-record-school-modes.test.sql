-- Disposable PostgreSQL 16 fixture only. All identities are fake.
-- Validate every combination, 16-digit HARD math, grading, trophy, replay,
-- exhausted hearts, class isolation, and role-private protection.
CREATE OR REPLACE FUNCTION public.test_school_mode_answers(
 p_questions jsonb,p_app text,p_mode text,p_level integer,p_limit integer DEFAULT 64
) RETURNS jsonb LANGUAGE plpgsql AS $func$
DECLARE
 v_a jsonb:='[]'::jsonb;v_q jsonb;v_terms jsonb;v_sum numeric;
 v_i integer;v_j integer;v_k integer;v_width integer;v_carry numeric;
 v_partial numeric;v_pow numeric;v_digits jsonb;v_carries jsonb;
BEGIN
 v_width:=CASE WHEN p_mode LIKE 'hard-%' THEN
   CASE WHEN p_app='addition-ecrite-simple' THEN
    CASE p_level WHEN 1 THEN 10 WHEN 2 THEN 12 ELSE 16 END
   ELSE CASE p_level WHEN 1 THEN 9 WHEN 2 THEN 12 ELSE 14 END END
  ELSE CASE WHEN p_app='addition-ecrite-simple' THEN
     CASE p_level WHEN 1 THEN 3 WHEN 2 THEN 5 ELSE 7 END
   ELSE p_level+4 END END;
 FOR v_i IN 0..p_limit-1 LOOP
  v_q:=p_questions->v_i;v_terms:=v_q->'addends';v_sum:=0;
  FOR v_k IN 0..jsonb_array_length(v_terms)-1 LOOP
   v_sum:=v_sum+(v_terms->>v_k)::numeric;
  END LOOP;
  v_digits:='[]'::jsonb;
  FOR v_j IN 0..length(v_sum::text)-1 LOOP
   v_digits:=v_digits||to_jsonb(substr(reverse(v_sum::text),v_j+1,1));
  END LOOP;
  v_carries:=jsonb_build_array('');
  FOR v_j IN 1..v_width-1 LOOP
   v_pow:=power(10::numeric,v_j);v_partial:=0;
   FOR v_k IN 0..jsonb_array_length(v_terms)-1 LOOP
    v_partial:=v_partial+mod((v_terms->>v_k)::numeric,v_pow);
   END LOOP;
   v_carry:=trunc(v_partial/v_pow);
   v_carries:=v_carries||to_jsonb(CASE WHEN v_carry=0 THEN '' ELSE v_carry::text END);
  END LOOP;
  v_a:=v_a||jsonb_build_array(jsonb_build_object(
   'id',v_q->>'id','digits',v_digits,'carries',v_carries));
 END LOOP;
 RETURN v_a;
END $func$;

DO $test$
DECLARE
 student uuid:='11111111-1111-4111-8111-111111111111';
 class_id uuid:='8fe170fa-9e8f-4e80-885a-b0ba68026f64';
 wrong_class uuid:='71f5f4a5-3f25-4ec7-ac29-c33d2e6b395e';
 app text;mode text;lvl integer;limit_n integer;counted integer:=0;
 issued jsonb;first_ack jsonb;replay_ack jsonb;all_answers jsonb;
 answers jsonb;wrong jsonb;id uuid;i integer;
BEGIN
 FOR app IN SELECT unnest(ARRAY['addition-ecrite-simple','addition-ecrite-multiple']) LOOP
  FOR mode IN SELECT unnest(ARRAY['three-lives','sudden','hard-three-lives','hard-sudden']) LOOP
   FOR lvl IN 1..3 LOOP
    issued:=public.connect_objective_record_school_issue_mode_v1(student,class_id,app,mode,lvl);
    IF issued->>'ok'<>'true' OR jsonb_array_length(issued->'questions')<>64
      OR issued->>'mode'<>mode OR (issued->>'level')::int<>lvl
    THEN RAISE EXCEPTION 'bad_mode_issue % % %',app,mode,lvl;END IF;
    id:=(issued->>'sessionId')::uuid;
    IF (public.connect_objective_record_school_issue_mode_v1(student,class_id,app,mode,lvl)->>'sessionId')::uuid<>id
    THEN RAISE EXCEPTION 'issued_same_mode_session_twice'; END IF;
    all_answers:=public.test_school_mode_answers(issued->'questions',app,mode,lvl,64);
    limit_n:=CASE WHEN mode LIKE '%three-lives' THEN 3 ELSE 1 END;
    answers:=all_answers;
    FOR i IN 0..limit_n-1 LOOP
     answers:=jsonb_set(answers,ARRAY[i::text,'digits','0'],
      to_jsonb(CASE WHEN answers#>>ARRAY[i::text,'digits','0']='0' THEN '1' ELSE '0' END),false);
    END LOOP;
    SELECT coalesce(jsonb_agg(value ORDER BY ord),'[]'::jsonb) INTO answers
     FROM jsonb_array_elements(answers) WITH ORDINALITY t(value,ord)
     WHERE ord<=limit_n;
    first_ack:=public.connect_objective_record_school_finish_mode_v1(student,class_id,id,answers);
    replay_ack:=public.connect_objective_record_school_finish_mode_v1(student,class_id,id,answers);
    IF first_ack->>'ok'<>'true' OR first_ack->>'proofVerified'<>'true'
     OR (first_ack->>'verifiedScore')::int<>0
     OR (first_ack->>'mistakes')::int<>limit_n
     OR replay_ack->>'duplicate'<>'true'
     OR (replay_ack#>>'{xp,delta}')::int<>0
    THEN RAISE EXCEPTION 'mode_mismatch % % % ack=%',app,mode,lvl,first_ack;END IF;
    counted:=counted+1;
   END LOOP;
  END LOOP;
 END LOOP;
 IF counted<>24 THEN RAISE EXCEPTION 'missing_mode_matrix'; END IF;
 -- A separate session after each committed result can win 25 HARD successes
 -- and earn permanent score trophies but no numeric browser score can.
 issued:=public.connect_objective_record_school_issue_mode_v1(student,class_id,
  'addition-ecrite-multiple','hard-sudden',2);
 id:=(issued->>'sessionId')::uuid;
 answers:=public.test_school_mode_answers(issued->'questions',
  'addition-ecrite-multiple','hard-sudden',2,26);
 answers:=jsonb_set(answers,'{25,digits,0}',
  to_jsonb(CASE WHEN answers#>>'{25,digits,0}'='0' THEN '1' ELSE '0' END),false);
 first_ack:=public.connect_objective_record_school_finish_mode_v1(student,class_id,id,answers);
 IF (first_ack->>'verifiedScore')::int<>25
  OR first_ack#>>'{state,rewards,hardAwards,bronze,1}'<>'true'
  OR first_ack#>>'{state,rewards,hardAwards,silver,1}'<>'true'
  OR first_ack#>>'{state,rewards,hardAwards,gold,1}'<>'true'
 THEN RAISE EXCEPTION 'hard_trophy_mismatch: %',first_ack;END IF;
 IF (SELECT count(*) FROM public.connect_objective_record_school_mode_sessions)<>25
 THEN RAISE EXCEPTION 'lost_mode_sessions'; END IF;
 IF (SELECT count(*) FROM public.connect_objective_record_school_receipts
    WHERE app_key in ('addition-ecrite-simple','addition-ecrite-multiple'))<>25
 THEN RAISE EXCEPTION 'mode_receipt_count_mismatch';END IF;
 -- Strict process ownership: no classroom leak and no untrusted SQL access.
 BEGIN
  PERFORM public.connect_objective_record_school_issue_mode_v1(student,wrong_class,
   'addition-ecrite-simple','sudden',1);
  RAISE EXCEPTION 'cross_class_access_allowed';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'not_school_subject' THEN RAISE;END IF;END;
 IF has_table_privilege('anon','public.connect_objective_record_school_mode_sessions','SELECT')
  OR has_function_privilege('anon',
   'public.connect_objective_record_school_finish_mode_v1(uuid,uuid,uuid,jsonb)','EXECUTE')
  OR has_function_privilege('authenticated',
   'public.connect_objective_record_school_issue_mode_v1(uuid,uuid,text,text,integer)','EXECUTE')
 THEN RAISE EXCEPTION 'untrusted_can_issue_or_grade_mode';END IF;
 RAISE NOTICE '24 verified modes + long HARD + replay + trophy + school isolation PASS';
END $test$;
