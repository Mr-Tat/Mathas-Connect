\set ON_ERROR_STOP on
BEGIN;
DO $tests$
DECLARE
 a uuid:='123e4567-e89b-42d3-a456-426614174100';
 b uuid:='123e4567-e89b-42d3-a456-426614174200';
 app text:='addition-ecrite-multiple';
 result jsonb; n integer;
BEGIN
 -- Isolation by student: other student's credits cannot increase.
 result:=public.addmulti_test_record(a,app,'123e4567-e89b-42d3-a456-426614174101',0,0,'classic',1,4,4);
 IF (result->>'appXp')::int<>22 THEN RAISE EXCEPTION 'a_first'; END IF;
 result:=public.addmulti_test_record(b,app,'123e4567-e89b-42d3-a456-426614174201',0,0,'classic',1,4,4);
 IF (result->>'delta')::int<>22 THEN RAISE EXCEPTION 'b_first'; END IF;
 result:=public.addmulti_test_record(a,app,'123e4567-e89b-42d3-a456-426614174102',1,0,'classic',1,4,4);
 IF (result->>'delta')::int<>0 THEN RAISE EXCEPTION 'double_award'; END IF;
 -- Higher best results award only the newly reached milestone.
 result:=public.addmulti_test_record(a,app,'123e4567-e89b-42d3-a456-426614174103',2,0,'classic',1,10,10);
 IF (result->>'delta')::int<>36 OR (result->>'appXp')::int<>58 THEN RAISE EXCEPTION 'best_result_bonus'; END IF;
 result:=public.addmulti_test_record(a,app,'123e4567-e89b-42d3-a456-426614174104',3,0,'sudden',1,10,NULL);
 IF (result->>'delta')::int<>20 THEN RAISE EXCEPTION 'sudden_credit'; END IF;
 result:=public.addmulti_test_record(a,app,'123e4567-e89b-42d3-a456-426614174105',4,0,'hard',1,7,NULL);
 IF (result->>'delta')::int<>20 THEN RAISE EXCEPTION 'hard_credit'; END IF;
 result:=public.addmulti_test_record(a,app,'123e4567-e89b-42d3-a456-426614174106',5,0,'hard-challenge',1,5,5);
 IF (result->>'delta')::int<>0 OR (result->>'appXp')::int<>98 THEN RAISE EXCEPTION 'hard_challenge_not_xp'; END IF;
 IF (SELECT xp FROM public.addmulti_test_credits WHERE student_id=b AND app_key=app)<>22 THEN RAISE EXCEPTION 'cross_student_credit'; END IF;
 -- Explicitly wrong app key must never create rows.
 BEGIN
   PERFORM public.addmulti_test_record(a,'addition-ecrite-simple','123e4567-e89b-42d3-a456-426614174107',6,0,'classic',1,4,4);
   RAISE EXCEPTION 'cross_app_accepted';
 EXCEPTION WHEN raise_exception THEN
   IF SQLERRM='cross_app_accepted' THEN RAISE; END IF;
 END;
 SELECT count(*) INTO n FROM public.addmulti_test_states WHERE app_key<>'addition-ecrite-multiple';
 IF n<>0 THEN RAISE EXCEPTION 'cross_app_state'; END IF;
END $tests$;
ROLLBACK;
