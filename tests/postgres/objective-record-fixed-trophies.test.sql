-- Execute after the existing candidate/receipt/CAS tests on disposable PostgreSQL.
DO $spec$
DECLARE
 student uuid:='88888888-8888-4888-8888-888888888888';
 test_class uuid:='4bf3400d-a315-4ea4-a2f3-afaca24dc9b9';
 app text:='addition-ecrite-simple';
 v jsonb; n int; rev bigint;
BEGIN
 INSERT INTO public.connect_students(id) VALUES(student);
 INSERT INTO public.connect_enrollments(student_id,class_id) VALUES(student,test_class);
 v:=public.connect_objective_record_test_fixed_v1(student,test_class,app,
 '88888888-8888-4888-8888-888888888801',0,0,'classic',1,4,4);
 IF v->>'ok'<>'true' OR v#>>'{state,rewards,mastery,4,0}'<>'true'
 OR (SELECT count(*) FROM public.connect_trophy_achievements
     WHERE student_id=student AND app_key=app AND trophy_key='mastery:4:0')<>1
 THEN RAISE EXCEPTION 'mastery_not_permanent: %',v;END IF;
 SELECT count(*) INTO n FROM public.connect_trophy_achievements WHERE student_id=student;
 v:=public.connect_objective_record_test_fixed_v1(student,test_class,app,
 '88888888-8888-4888-8888-888888888801',0,0,'classic',1,4,4);
 IF v->>'duplicate'<>'true' OR (SELECT count(*) FROM public.connect_trophy_achievements
 WHERE student_id=student)<>n THEN RAISE EXCEPTION 'duplicate_trophy';END IF;

 v:=public.connect_objective_record_test_fixed_v1(student,test_class,app,
 '88888888-8888-4888-8888-888888888802',1,0,'classic',1,10,10);
 IF v#>>'{state,rewards,mastery,10,0}'<>'true' OR
 v#>>'{state,rewards,mastery,4,0}'<>'true' THEN RAISE EXCEPTION 'second_mastery_missing';END IF;

 -- Score 25 in Sudden death: earns a permanent sudden trophy.
 v:=public.connect_objective_record_test_fixed_v1(student,test_class,app,
 '88888888-8888-4888-8888-888888888803',2,0,'sudden',1,25,NULL);
 IF v#>>'{state,rewards,sudden,0}'<>'true' OR
 NOT EXISTS(SELECT 1 FROM public.connect_trophy_achievements
 WHERE student_id=student AND app_key=app AND trophy_key='sudden:0')
 THEN RAISE EXCEPTION 'sudden_trophy_missing';END IF;

 -- One single session scored 100 * 2 = 200 pts, so score cup bronze.
 v:=public.connect_objective_record_test_fixed_v1(student,test_class,app,
 '88888888-8888-4888-8888-888888888804',3,0,'sudden',1,100,NULL);
 IF v#>>'{state,rewards,scoreOne,bronze}'<>'true'
 OR v#>>'{state,rewards,scoreOne,silver}'<>'false'
 OR v#>>'{state,rewards,unlockedGold}'<>'false'
 THEN RAISE EXCEPTION 'score_cup_incorrect: %',v->'state'->'rewards';END IF;

 -- Teacher reset clears state but must NOT remove permanent achievements.
 UPDATE public.connect_states SET state_data='{}'::jsonb,revision=revision+1,
 reset_epoch=reset_epoch+1 WHERE student_id=student AND app_key=app;
 SELECT revision INTO rev FROM public.connect_states WHERE student_id=student AND app_key=app;
 v:=public.connect_objective_record_test_fixed_v1(student,test_class,app,
 '88888888-8888-4888-8888-888888888805',rev,1,'classic',1,1,4);
 IF v#>>'{state,rewards,mastery,4,0}'<>'true'
 OR v#>>'{state,rewards,mastery,10,0}'<>'true'
 OR v#>>'{state,rewards,sudden,0}'<>'true'
 OR v#>>'{state,rewards,scoreOne,bronze}'<>'true'
 THEN RAISE EXCEPTION 'permanent_cups_lost_after_reset: %',v->'state'->'rewards';END IF;
 -- No unsupported HARD cup can be fabricated from classic/sudden.
 IF v#>>'{state,rewards,hardAwards,bronze,0}'<>'false'
 THEN RAISE EXCEPTION 'hard_trophy_fabricated';END IF;
END $spec$;
