-- PostgreSQL 16, disposable integration test after v1 proof fixture.
CREATE OR REPLACE FUNCTION public.test_valid_add_answers_v2(p_questions jsonb,p_level int)
 RETURNS jsonb LANGUAGE plpgsql AS $test$
DECLARE
 ans jsonb:='[]'::jsonb; q jsonb; i integer;j integer;
 n integer;x integer;y integer;digits jsonb;carries jsonb;width int;
BEGIN
 width:=CASE p_level WHEN 1 THEN 3 WHEN 2 THEN 5 ELSE 7 END;
 FOR i IN 0..jsonb_array_length(p_questions)-1 LOOP
  q:=p_questions->i;x:=(q->>'a')::integer;y:=(q->>'b')::integer;n:=x+y;
  digits:='[]'::jsonb;carries:=jsonb_build_array('');
  FOR j IN 0..length(n::text)-1 LOOP
   digits:=digits||to_jsonb(((n/(10^j)::integer)%10)::text);
  END LOOP;
  FOR j IN 1..width-1 LOOP
   carries:=carries||to_jsonb(CASE WHEN
     (x%(10^j)::integer)+(y%(10^j)::integer)>=(10^j)::integer
    THEN '1' ELSE '' END);
  END LOOP;
  ans:=ans||jsonb_build_array(jsonb_build_object('id',q->>'id','digits',digits,'carries',carries));
 END LOOP;
 RETURN ans;
END $test$;

DO $spec$
DECLARE
 pupil uuid; testclass uuid:='4bf3400d-a315-4ea4-a2f3-afaca24dc9b9';
 v_level integer;v_total integer; v_width integer;
 issue jsonb;second jsonb;verified jsonb;replayed jsonb;
 answers jsonb;item jsonb;index integer;
 a integer;b integer;minn integer;
 before_xp int;after_xp int;
BEGIN
 FOR v_level IN 1..3 LOOP
  FOR v_total IN SELECT unnest(ARRAY[4,10,20]) LOOP
   pupil:=gen_random_uuid();
   INSERT INTO public.connect_students(id) VALUES(pupil);
   INSERT INTO public.connect_enrollments(student_id,class_id)
     VALUES(pupil,testclass);
   issue:=public.connect_objective_record_test_issue_add_v2(
     pupil,testclass,v_level,v_total);
   second:=public.connect_objective_record_test_issue_add_v2(
     pupil,testclass,v_level,v_total);
   IF issue->>'ok'<>'true' OR second->>'reused'<>'true'
     OR issue->>'sessionId' IS DISTINCT FROM second->>'sessionId'
     OR (issue->>'level')::int<>v_level OR (issue->>'total')::int<>v_total
     OR jsonb_array_length(issue->'questions')<>v_total
     OR (issue->>'expiresAt')::timestamptz<now()+interval '80 minutes'
    THEN RAISE EXCEPTION 'invalid_challenge: level % total %: %',v_level,v_total,issue;END IF;
   v_width:=CASE v_level WHEN 1 THEN 3 WHEN 2 THEN 5 ELSE 7 END;
   minn:=power(10::numeric,v_width-1)::integer;
   FOR index IN 0..v_total-1 LOOP
    item:=issue->'questions'->index;
    a:=(item->>'a')::integer;b:=(item->>'b')::integer;
    IF a<minn OR a>=10*minn OR b<minn/10 OR b>=10*minn
       OR item->>'id' IS DISTINCT FROM 'q'||(index+1)
    THEN RAISE EXCEPTION 'invalid_question_width: % % %',v_level,v_total,item;END IF;
   END LOOP;
   answers:=public.test_valid_add_answers_v2(issue->'questions',v_level);
   verified:=public.connect_objective_record_test_finish_add_v2(
     pupil,testclass,(issue->>'sessionId')::uuid,answers);
   IF verified->>'ok'<>'true' OR verified->>'proofVerified'<>'true'
      OR (verified->>'verifiedScore')::int<>v_total
      OR (verified#>>ARRAY['state','rewards','mastery',v_total::text,(v_level-1)::text])<>'true'
    THEN RAISE EXCEPTION 'no_official_award: level % count %: %',v_level,v_total,verified;END IF;
   IF NOT EXISTS(SELECT 1 FROM public.connect_trophy_achievements
       WHERE student_id=pupil AND app_key='addition-ecrite-simple'
       AND trophy_key='mastery:'||v_total||':'||(v_level-1))
    THEN RAISE EXCEPTION 'missing_permanent_trophy %/%',v_level,v_total;END IF;
   replayed:=public.connect_objective_record_test_finish_add_v2(
     pupil,testclass,(issue->>'sessionId')::uuid,answers);
   IF replayed->>'duplicate'<>'true' OR (replayed#>>'{xp,delta}')::int<>0
    THEN RAISE EXCEPTION 'duplicate_credited: level % count %',v_level,v_total;END IF;
   -- A score/level sent by the browser cannot modify the session nor award.
   IF (verified#>>ARRAY['state','recent','0','total'])::int IS DISTINCT FROM v_total
    THEN RAISE EXCEPTION 'wrong_total_recorded: % %',v_level,v_total;END IF;
  END LOOP;
 END LOOP;

 -- Wrong *carry* at level 3 scores 3/4 even if all results are correct.
 pupil:=gen_random_uuid();
 INSERT INTO public.connect_students(id) VALUES(pupil);
 INSERT INTO public.connect_enrollments(student_id,class_id) VALUES(pupil,testclass);
 issue:=public.connect_objective_record_test_issue_add_v2(pupil,testclass,3,4);
 answers:=public.test_valid_add_answers_v2(issue->'questions',3);
 answers:=jsonb_set(answers,'{0,carries,5}',CASE WHEN answers#>>'{0,carries,5}'='1'
    THEN '""'::jsonb ELSE '"1"'::jsonb END,false);
 verified:=public.connect_objective_record_test_finish_add_v2(
   pupil,testclass,(issue->>'sessionId')::uuid,answers);
 IF (verified->>'verifiedScore')::int<>3 THEN
  RAISE EXCEPTION 'high_column_carry_not_validated: %',verified;END IF;

 -- Incomplete answer array must fail before any credit.
 pupil:=gen_random_uuid();
 INSERT INTO public.connect_students(id) VALUES(pupil);
 INSERT INTO public.connect_enrollments(student_id,class_id) VALUES(pupil,testclass);
 issue:=public.connect_objective_record_test_issue_add_v2(pupil,testclass,2,20);
 answers:=public.test_valid_add_answers_v2(issue->'questions',2);
 BEGIN
  PERFORM public.connect_objective_record_test_finish_add_v2(
   pupil,testclass,(issue->>'sessionId')::uuid,answers-'19');
  RAISE EXCEPTION 'incomplete_accepted';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM<>'invalid_proof_answers' THEN RAISE;END IF;
 END;

 -- Legacy 4/L1 issuance must not reuse a pending 20/L2 challenge.
 second:=public.connect_objective_record_test_issue_add_v1(pupil,testclass);
 IF second->>'sessionId'=issue->>'sessionId'
    OR (second->>'total')::int<>4 OR (second->>'level')::int<>1
 THEN RAISE EXCEPTION 'legacy_endpoint_incorrectly_reused_v2';END IF;
 BEGIN
  PERFORM public.connect_objective_record_test_finish_add_v1(
    pupil,testclass,(issue->>'sessionId')::uuid,
    public.test_valid_add_answers_v2(issue->'questions',2));
  RAISE EXCEPTION 'legacy_endpoint_accepted_v2';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM<>'invalid_proof_answers' THEN RAISE;END IF;
 END;
END $spec$;
