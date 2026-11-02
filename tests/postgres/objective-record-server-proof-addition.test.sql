-- Disposable PG16 fixture: prove issue -> transcript verification -> official XP
-- and native carry correctness, never trust a client supplied score.
CREATE FUNCTION public.test_valid_add_answers(p_questions jsonb)
 RETURNS jsonb LANGUAGE plpgsql AS $test$
DECLARE a jsonb:='[]'::jsonb;q jsonb;i integer;j integer;
 n integer;x integer;y integer;digits jsonb;carries jsonb;carry text;
BEGIN
 FOR i IN 0..jsonb_array_length(p_questions)-1 LOOP
  q:=p_questions->i;x:=(q->>'a')::integer;y:=(q->>'b')::integer;n:=x+y;
  digits:='[]'::jsonb;carries:=jsonb_build_array('');
  FOR j IN 0..length(n::text)-1 LOOP
   digits:=digits||to_jsonb(((n/(10^j)::integer)%10)::text);
  END LOOP;
  FOR j IN 1..2 LOOP
   carry:=CASE WHEN (x%(10^j)::integer)+(y%(10^j)::integer)>=(10^j)::integer
    THEN '1' ELSE '' END;
   carries:=carries||to_jsonb(carry);
  END LOOP;
  a:=a||jsonb_build_array(jsonb_build_object('id',q->>'id','digits',digits,'carries',carries));
 END LOOP;
 RETURN a;
END $test$;

DO $spec$
DECLARE
 st uuid:='88888888-8888-4888-8888-888888888884';
 outsider uuid:='99999999-9999-4999-8999-999999999999';
 testclass uuid:='4bf3400d-a315-4ea4-a2f3-afaca24dc9b9';
 issued jsonb;again jsonb;result jsonb;repeat jsonb;
 newissued jsonb;bad jsonb;before_xp integer;after_xp integer;
 sid uuid;retry_sid uuid;correct jsonb;tampered jsonb;tmp jsonb;i integer;
BEGIN
 INSERT INTO public.connect_students(id) VALUES(st);
 INSERT INTO public.connect_enrollments(student_id,class_id) VALUES(st,testclass);
 BEGIN
  PERFORM public.connect_objective_record_test_issue_add_v1(outsider,testclass);
  RAISE EXCEPTION 'foreign_class_issued';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM<>'not_test_subject' THEN RAISE;END IF;
 END;
 BEGIN
  PERFORM public.connect_objective_record_test_issue_add_v1(st,gen_random_uuid());
  RAISE EXCEPTION 'foreign_class_accepted';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM<>'proof_test_only' THEN RAISE;END IF;
 END;

 issued:=public.connect_objective_record_test_issue_add_v1(st,testclass);
 sid:=(issued->>'sessionId')::uuid;
 IF issued->>'ok'<>'true' OR jsonb_array_length(issued->'questions')<>4
  OR issued->>'reused'<>'false'
 THEN RAISE EXCEPTION 'issue_invalid %',issued;END IF;
 FOR i IN 0..3 LOOP
  IF (issued#>>ARRAY['questions',i::text,'a'])::integer NOT BETWEEN 100 AND 999
   OR (issued#>>ARRAY['questions',i::text,'b'])::integer NOT BETWEEN 100 AND 999
  THEN RAISE EXCEPTION 'bad_question_range';END IF;
 END LOOP;
 again:=public.connect_objective_record_test_issue_add_v1(st,testclass);
 IF again->>'sessionId' IS DISTINCT FROM issued->>'sessionId'
  OR again->>'reused'<>'true' THEN RAISE EXCEPTION 'issued_parallel_session';END IF;
 correct:=public.test_valid_add_answers(issued->'questions');
 SELECT coalesce(xp_credited,0) INTO before_xp FROM public.connect_xp_credits
  WHERE student_id=st AND app_key='addition-ecrite-simple';
 before_xp:=coalesce(before_xp,0);
 result:=public.connect_objective_record_test_finish_add_v1(st,testclass,sid,correct);
 IF result->>'ok'<>'true' OR result->>'proofVerified'<>'true'
  OR (result->>'verifiedScore')::integer<>4
  OR result#>>'{state,rewards,mastery,4,0}'<>'true'
  OR (result#>>'{xp,delta}')::integer<>22
 THEN RAISE EXCEPTION 'server_grading_and_award_failed %',result;END IF;
 SELECT xp_credited INTO after_xp FROM public.connect_xp_credits
  WHERE student_id=st AND app_key='addition-ecrite-simple';
 IF after_xp-before_xp<>22 THEN RAISE EXCEPTION 'official_xp_missing';END IF;
 repeat:=public.connect_objective_record_test_finish_add_v1(st,testclass,sid,correct);
 IF repeat->>'duplicate'<>'true' OR (repeat#>>'{xp,delta}')::integer<>0
 THEN RAISE EXCEPTION 'replay_credited';END IF;
 tampered:=jsonb_set(correct,'{0,digits,0}','"0"'::jsonb,false);
 BEGIN
  PERFORM public.connect_objective_record_test_finish_add_v1(st,testclass,sid,tampered);
  RAISE EXCEPTION 'proof_replay_accepted_altered_transcript';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM<>'proof_replay_collision' THEN RAISE;END IF;
 END;

 newissued:=public.connect_objective_record_test_issue_add_v1(st,testclass);
 retry_sid:=(newissued->>'sessionId')::uuid;
 IF retry_sid=sid OR (newissued->>'revision')::bigint<>1
 THEN RAISE EXCEPTION 'new_session_wrong_revision';END IF;
 correct:=public.test_valid_add_answers(newissued->'questions');
 -- A wrong carry field MUST fail one question even if all final digits are correct.
 tampered:=jsonb_set(correct,'{0,carries,1}',CASE WHEN correct#>>'{0,carries,1}'='1'
 THEN '""'::jsonb ELSE '"1"'::jsonb END,false);
 result:=public.connect_objective_record_test_finish_add_v1(st,testclass,retry_sid,tampered);
 IF (result->>'verifiedScore')::integer<>3 OR
    (result#>>'{xp,delta}')::integer<>0
 THEN RAISE EXCEPTION 'carry_ignored_or_bad_credit %',result;END IF;
 -- After an XP-only game, the total credited remains capped at the milestone.
 SELECT xp_credited INTO after_xp FROM public.connect_xp_credits
  WHERE student_id=st AND app_key='addition-ecrite-simple';
 IF after_xp<>22 THEN RAISE EXCEPTION 'xp_cap_not_preserved';END IF;

 newissued:=public.connect_objective_record_test_issue_add_v1(st,testclass);
 sid:=(newissued->>'sessionId')::uuid;
 correct:=public.test_valid_add_answers(newissued->'questions');
 UPDATE public.connect_states SET reset_epoch=reset_epoch+1,revision=revision+1
  WHERE student_id=st AND app_key='addition-ecrite-simple';
 BEGIN
  PERFORM public.connect_objective_record_test_finish_add_v1(st,testclass,sid,correct);
  RAISE EXCEPTION 'stale_reset_awarded';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM<>'stale_reset_epoch' THEN RAISE;END IF;
 END;
 IF (SELECT consumed_at FROM public.connect_objective_record_test_proof_sessions
  WHERE session_id=sid) IS NOT NULL THEN RAISE EXCEPTION 'stale_session_consumed';END IF;
 DELETE FROM public.connect_objective_record_test_proof_sessions WHERE session_id=sid;
 newissued:=public.connect_objective_record_test_issue_add_v1(st,testclass);
 sid:=(newissued->>'sessionId')::uuid;
 UPDATE public.connect_objective_record_test_proof_sessions
 SET expires_at=now()-interval '1 minute' WHERE session_id=sid;
 BEGIN
  PERFORM public.connect_objective_record_test_finish_add_v1(
   st,testclass,sid,public.test_valid_add_answers(newissued->'questions'));
  RAISE EXCEPTION 'expired_awarded';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM<>'proof_expired' THEN RAISE;END IF;
 END;
END $spec$;
