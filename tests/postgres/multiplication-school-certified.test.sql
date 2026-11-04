-- PostgreSQL 16 disposable only. DO NOT run against hosted Math'as Connect.
-- The engine's native 20 trophy visuals correspond to 19 flags + Platinum.
CREATE OR REPLACE FUNCTION public.test_school_mul_answers(p_questions jsonb,p_limit integer DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql AS $fn$
DECLARE
 output jsonb:='[]'::jsonb; q jsonb; v_a numeric;v_m int;
 v_product numeric;v_digits jsonb;v_carries jsonb;
 v_i int;v_j int;v_c numeric;v_count int;
BEGIN
 v_count:=least(coalesce(p_limit,jsonb_array_length(p_questions)),jsonb_array_length(p_questions));
 FOR v_i IN 0..v_count-1 LOOP
  q:=p_questions->v_i;v_a:=(q->>'a')::numeric;v_m:=(q->>'m')::int;
  v_product:=v_a*v_m;v_digits:='[]'::jsonb;v_carries:='[]'::jsonb;
  FOR v_j IN 0..length(v_product::text)-1 LOOP
   v_digits:=v_digits||to_jsonb(mod(trunc(v_product/power(10::numeric,v_j)),10)::text);
  END LOOP;
  FOR v_j IN 0..length(q->>'a')-1 LOOP
   v_c:=CASE WHEN v_j=0 THEN 0 ELSE trunc(mod(v_a,power(10::numeric,v_j))*v_m/power(10::numeric,v_j)) END;
   v_carries:=v_carries||to_jsonb(CASE WHEN v_c=0 THEN '' ELSE v_c::text END);
  END LOOP;
  output:=output||jsonb_build_array(jsonb_build_object('id',q->>'id','digits',v_digits,'carries',v_carries));
 END LOOP;
 RETURN output;
END $fn$;

DO $run$
DECLARE
 st constant uuid:='22222222-2222-4222-8222-222222222222';
 outside constant uuid:='99999999-9999-4999-8999-999999999999';
 test_class constant uuid:='4bf3400d-a315-4ea4-a2f3-afaca24dc9b9';
 school_class constant uuid:='8fe170fa-9e8f-4e80-885a-b0ba68026f64';
 fake_other constant uuid:='99999999-9999-4999-8999-999999999999';
 app constant text:='multiplication-ecrite-simple';
 q jsonb;ans jsonb;ack jsonb;dupe jsonb;wrong jsonb;cur jsonb;
 x uuid;n integer;lv integer;mode text;cnt integer:=0;
 denied boolean;old_count integer;
BEGIN
 -- Verify normal-school locks are actually server enforced.
 denied:=false;
 BEGIN
  PERFORM public.connect_objective_record_school_mul_issue_classic_v1(st,school_class,2,4,ARRAY[9]);
 EXCEPTION WHEN OTHERS THEN denied:=SQLERRM='school_mode_locked';END;
 IF NOT denied THEN RAISE EXCEPTION 'level_two_should_be_locked';END IF;
 denied:=false;
 BEGIN
  PERFORM public.connect_objective_record_school_mul_issue_extended_v1(st,school_class,'hard-sudden',1,ARRAY[2,3,4,5,6,7,8,9]);
 EXCEPTION WHEN OTHERS THEN denied:=SQLERRM='school_mode_locked';END;
 IF NOT denied THEN RAISE EXCEPTION 'hard_should_be_locked';END IF;
 denied:=false;
 BEGIN
  PERFORM public.connect_objective_record_school_mul_issue_classic_v1(outside,test_class,1,4,ARRAY[9]);
 EXCEPTION WHEN OTHERS THEN denied:=SQLERRM='not_school_subject';END;
 IF NOT denied THEN RAISE EXCEPTION 'outsider_should_be_denied';END IF;
 denied:=false;
 BEGIN
  PERFORM public.connect_objective_record_school_mul_issue_classic_v1(st,fake_other,1,4,ARRAY[9]);
 EXCEPTION WHEN OTHERS THEN denied:=SQLERRM='school_class_not_allowed';END;
 IF NOT denied THEN RAISE EXCEPTION 'foreign_class_should_be_denied';END IF;
 -- Authoritative CLASSIC proofs: 9 distinct level/series variants.
 FOREACH lv IN ARRAY ARRAY[1,2,3] LOOP
  FOREACH n IN ARRAY ARRAY[4,10,20] LOOP
   q:=public.connect_objective_record_school_mul_issue_classic_v1(st,test_class,lv,n,ARRAY[9]);
   IF q->>'ok'<>'true' OR jsonb_array_length(q->'questions')<>n
     THEN RAISE EXCEPTION 'classic_issue_bad % %',lv,n;END IF;
   ans:=public.test_school_mul_answers(q->'questions');
   ack:=public.connect_objective_record_school_mul_finish_classic_v1(
       st,test_class,(q->>'sessionId')::uuid,ans);
   IF (ack->>'verifiedScore')::int<>n OR ack->>'proofVerified'<>'true'
     OR ack->>'ok'<>'true' THEN
      RAISE EXCEPTION 'classic_grade_bad % % %',lv,n,ack;END IF;
   dupe:=public.connect_objective_record_school_mul_finish_classic_v1(
       st,test_class,(q->>'sessionId')::uuid,ans);
   IF dupe->>'duplicate'<>'true' OR (dupe#>>'{xp,delta}')::int<>0
    THEN RAISE EXCEPTION 'duplicate_would_grant_xp';END IF;
   cnt:=cnt+1;
  END LOOP;
 END LOOP;
 IF cnt<>9 THEN RAISE EXCEPTION 'classic_not_nine';END IF;
 SELECT state_data INTO cur FROM public.connect_states
  WHERE student_id=st AND app_key=app;
 IF cur#>>'{progress,hard}'<>'true' THEN RAISE EXCEPTION 'perfect_classics_did_not_unlock_hard';END IF;
 IF cur#>>'{rewards,unlockedGold}'='true' THEN RAISE EXCEPTION 'gold_too_early';END IF;

 -- Precise error in CARRY alone: 249x9 -> 2241 with 8,4 reports.
 q:=public.connect_objective_record_school_mul_issue_classic_v1(st,test_class,1,4,ARRAY[9]);
 x:=(q->>'sessionId')::uuid;
 UPDATE public.connect_objective_record_school_proof_sessions
 SET questions=(SELECT jsonb_agg(jsonb_build_object('id','q'||i,'op','mul','a','249','m',9,'width',3))
    FROM generate_series(1,4) AS i)
 WHERE session_id=x;
 SELECT questions INTO cur FROM public.connect_objective_record_school_proof_sessions WHERE session_id=x;
 ans:=public.test_school_mul_answers(cur);
 IF ans#>>'{0,carries,1}'<>'8' OR ans#>>'{0,carries,2}'<>'4'
 THEN RAISE EXCEPTION 'incorrect_249x9_fixture';END IF;
 wrong:=jsonb_set(ans,'{0,carries,1}','"7"'::jsonb);
 ack:=public.connect_objective_record_school_mul_finish_classic_v1(st,test_class,x,wrong);
 IF (ack->>'verifiedScore')::int<>3 THEN RAISE EXCEPTION 'wrong_carry_accepted';END IF;
 denied:=false;
 BEGIN
  PERFORM public.connect_objective_record_school_mul_finish_classic_v1(st,test_class,x,ans);
 EXCEPTION WHEN OTHERS THEN denied:=SQLERRM='proof_replay_collision';END;
 IF NOT denied THEN RAISE EXCEPTION 'replay_collision_not_rejected';END IF;

 -- 3 lives and sudden end only at the correct terminal event.
 FOREACH mode IN ARRAY ARRAY['three-lives','sudden','hard-three-lives','hard-sudden'] LOOP
  q:=public.connect_objective_record_school_mul_issue_extended_v1(
   st,test_class,mode,1,ARRAY[2,3,4,5,6,7,8,9]);
  IF q->>'ok'<>'true' OR jsonb_array_length(q->'questions')<>120
  THEN RAISE EXCEPTION 'extended_issue_bad %',mode;END IF;
  n:=CASE WHEN mode LIKE '%three-lives' THEN 3 ELSE 1 END;
  ans:=public.test_school_mul_answers(q->'questions',n);
  FOR lv IN 0..n-1 LOOP
   ans:=jsonb_set(ans,ARRAY[lv::text,'digits','0'],
     to_jsonb(CASE WHEN ans#>>ARRAY[lv::text,'digits','0']='9' THEN '8' ELSE '9' END));
  END LOOP;
  ack:=public.connect_objective_record_school_mul_finish_extended_v1(
    st,test_class,(q->>'sessionId')::uuid,ans);
  IF ack->>'proofVerified'<>'true' OR (ack->>'verifiedScore')::int<>0
   THEN RAISE EXCEPTION 'extended_terminal_invalid % %',mode,ack;END IF;
 END LOOP;
 -- Unlock HARD level 1 then 2 by 3 independently correct operations followed by one error.
 FOR lv IN 1..2 LOOP
  q:=public.connect_objective_record_school_mul_issue_extended_v1(
   st,test_class,'hard-sudden',lv,ARRAY[2,3,4,5,6,7,8,9]);
  ans:=public.test_school_mul_answers(q->'questions',4);
  ans:=jsonb_set(ans,'{3,digits,0}',
    to_jsonb(CASE WHEN ans#>>'{3,digits,0}'='9' THEN '8' ELSE '9' END));
  ack:=public.connect_objective_record_school_mul_finish_extended_v1(
   st,test_class,(q->>'sessionId')::uuid,ans);
  IF (ack->>'verifiedScore')::int<>3 THEN
   RAISE EXCEPTION 'hard_score_wrong %',lv;END IF;
  SELECT state_data INTO cur FROM public.connect_states WHERE student_id=st AND app_key=app;
  IF lv=1 AND cur#>>'{rewards,unlockedGold}'='true'
   THEN RAISE EXCEPTION 'full_unlock_early';END IF;
 END LOOP;
 IF cur#>>'{rewards,unlockedGold}'<>'true' THEN
  RAISE EXCEPTION 'school_19th_gold_never_issued';END IF;
 IF (SELECT count(*) FROM public.connect_trophy_achievements
  WHERE student_id=st AND app_key=app AND trophy_key='unlockedGold')<>1
 THEN RAISE EXCEPTION '19th_gold_not_permanent';END IF;
 -- Simulate an app-only reset on disposable records, preserving permanent cups.
 UPDATE public.connect_states SET reset_epoch=reset_epoch+1,
  state_data='{}'::jsonb WHERE student_id=st AND app_key=app;
 IF public.connect_trophy_rewards_v1(st,app)->>'unlockedGold'<>'true'
 THEN RAISE EXCEPTION 'trophy_disappeared_after_reset';END IF;
 IF (SELECT count(*) FROM public.connect_trophy_achievements
  WHERE student_id=st AND app_key=app AND trophy_key='unlockedGold')<>1
 THEN RAISE EXCEPTION 'duplicate_permanent_gold';END IF;
 -- Privileged grader cannot be called by browser roles.
 IF has_function_privilege('anon','public.connect_objective_record_school_mul_finish_extended_v1(uuid,uuid,uuid,jsonb)','EXECUTE')
  OR has_function_privilege('authenticated','public.connect_objective_record_school_mul_finish_extended_v1(uuid,uuid,uuid,jsonb)','EXECUTE')
 THEN RAISE EXCEPTION 'browser_can_grade';END IF;
 RAISE NOTICE 'PASS school multiplication classic 9 cases, proof, carry, replay, extended modes, permanent Gold';
END $run$;
