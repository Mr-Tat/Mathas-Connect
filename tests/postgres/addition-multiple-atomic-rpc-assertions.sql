\set ON_ERROR_STOP on
-- Real candidate RPC on disposable production-shaped tables.
DO $privileges$
BEGIN
 IF has_function_privilege('anon','public.connect_addition_multiple_record_v1(uuid,uuid,bigint,bigint,text,integer,integer,integer,jsonb)','EXECUTE')
 OR has_function_privilege('authenticated','public.connect_addition_multiple_record_v1(uuid,uuid,bigint,bigint,text,integer,integer,integer,jsonb)','EXECUTE')
 OR NOT has_function_privilege('service_role','public.connect_addition_multiple_record_v1(uuid,uuid,bigint,bigint,text,integer,integer,integer,jsonb)','EXECUTE')
 THEN RAISE EXCEPTION 'atomic_rpc_not_service_role_only';END IF;
END $privileges$;

DO $scenario$
DECLARE
 a uuid:='66666666-6666-4666-8666-666666666666';
 b uuid:='77777777-7777-4777-8777-777777777777';
 ev1 uuid:='88888888-8888-4888-8888-888888888881';
 ev2 uuid:='88888888-8888-4888-8888-888888888882';
 ev3 uuid:='88888888-8888-4888-8888-888888888883';
 m text:='addition-ecrite-multiple';
 answer jsonb; rev bigint;
BEGIN
 INSERT INTO public.connect_students(id,display_name)VALUES(a,'Transaction A'),(b,'Transaction B');
 INSERT INTO public.connect_xp_credits(student_id,app_key,xp_credited)VALUES(a,'addition-ecrite-simple',22);
 answer:=public.connect_addition_multiple_record_v1(a,ev1,0,0,'classic',1,4,4,'{"version":3,"mastery":{"4":[true,false,false],"10":[false,false,false],"20":[false,false,false]},"sudden":[false,false,false],"hardAwards":{"bronze":[false,false,false],"silver":[false,false,false],"gold":[false,false,false]},"scoreOne":{"bronze":false,"silver":false,"gold":false},"unlockedGold":false}'::jsonb);
 IF (answer->>'revision')::int<>1 OR (answer->'xp'->>'delta')::int<>22
  OR (answer->'xp'->>'total')::int<>44
 THEN RAISE EXCEPTION 'atomic_first_credit: %',answer;END IF;
 IF (SELECT state_data#>>'{rewards,mastery,4,0}' FROM public.connect_states
    WHERE student_id=a AND app_key=m)<>'true'
 THEN RAISE EXCEPTION 'atomic_trophy_not_saved';END IF;
 SELECT revision INTO rev FROM public.connect_states WHERE student_id=a AND app_key=m;
 IF rev<>1 THEN RAISE EXCEPTION 'atomic_revision_missing';END IF;
 answer:=public.connect_addition_multiple_record_v1(a,ev1,0,0,'classic',1,4,4);
 IF (answer->>'duplicate')::boolean IS DISTINCT FROM true
  OR (answer->'xp'->>'delta')::int<>0 OR (answer->>'revision')::int<>1
 THEN RAISE EXCEPTION 'atomic_duplicate_credit: %',answer;END IF;
 -- Malformed trophy arrays must not advance revision or credit XP.
 BEGIN
  PERFORM public.connect_addition_multiple_record_v1(a,ev2,1,0,'classic',1,8,10,
    '{"version":3,"mastery":{"4":[true],"10":[false,false,false],"20":[false,false,false]},"sudden":[false,false,false],"hardAwards":{"bronze":[false,false,false],"silver":[false,false,false],"gold":[false,false,false]},"scoreOne":{"bronze":false,"silver":false,"gold":false},"unlockedGold":false}'::jsonb);
  RAISE EXCEPTION 'invalid_trophy_accepted';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM='invalid_trophy_accepted' OR SQLERRM<>'invalid_rewards' THEN RAISE;END IF;
 END;
 -- Missing trophy fields also fail closed; SQL NULL must not become an award.
 BEGIN
  PERFORM public.connect_addition_multiple_record_v1(a,ev2,1,0,'classic',1,8,10,
    '{"version":3,"mastery":{},"sudden":[false,false,false],"hardAwards":{"bronze":[false,false,false],"silver":[false,false,false],"gold":[false,false,false]},"scoreOne":{"bronze":false,"silver":false,"gold":false},"unlockedGold":false}'::jsonb);
  RAISE EXCEPTION 'missing_trophy_field_accepted';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM IS DISTINCT FROM 'invalid_rewards' THEN RAISE; END IF;
 END;
 -- If XP insert fails, all state mutations from that event roll back.
 CREATE OR REPLACE FUNCTION public.addmulti_fail_test_credit() RETURNS trigger
 LANGUAGE plpgsql AS $fail$
 BEGIN
   IF NEW.student_id='66666666-6666-4666-8666-666666666666'::uuid
      AND NEW.app_key='addition-ecrite-multiple'
   THEN RAISE EXCEPTION 'forced_xp_failure';END IF;
   RETURN NEW;
 END $fail$;
 CREATE TRIGGER addmulti_fail_test_credit_trigger
 BEFORE INSERT OR UPDATE ON public.connect_xp_credits
 FOR EACH ROW EXECUTE FUNCTION public.addmulti_fail_test_credit();
 BEGIN
  PERFORM public.connect_addition_multiple_record_v1(a,ev2,1,0,'classic',1,8,10);
  RAISE EXCEPTION 'atomic_failure_not_triggered';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM='atomic_failure_not_triggered' THEN RAISE; END IF;
  IF SQLERRM<>'forced_xp_failure' THEN RAISE;END IF;
 END;
 SELECT revision INTO rev FROM public.connect_states WHERE student_id=a AND app_key=m;
 IF rev<>1 OR (SELECT state_data #>> '{classic,0,10}' FROM public.connect_states WHERE student_id=a AND app_key=m) IS NOT NULL
 THEN RAISE EXCEPTION 'atomic_rollback_did_not_restore_state';END IF;
 DROP TRIGGER addmulti_fail_test_credit_trigger ON public.connect_xp_credits;
 DROP FUNCTION public.addmulti_fail_test_credit();
 answer:=public.connect_addition_multiple_record_v1(a,ev2,1,0,'classic',1,8,10,
 '{"version":3,"mastery":{"4":[false,false,false],"10":[false,false,false],"20":[false,false,false]},"sudden":[false,false,false],"hardAwards":{"bronze":[false,false,false],"silver":[false,false,false],"gold":[false,false,false]},"scoreOne":{"bronze":false,"silver":false,"gold":false},"unlockedGold":false}'::jsonb);
 IF (answer->>'revision')::int<>2 OR (answer->'xp'->>'delta')::int<>30
 OR (answer->'xp'->>'total')::int<>74 THEN
 RAISE EXCEPTION 'atomic_retry_credit: %',answer;END IF;
 -- Later false flags cannot remove an already acquired trophy.
 IF (SELECT state_data#>>'{rewards,mastery,4,0}' FROM public.connect_states
    WHERE student_id=a AND app_key=m)<>'true'
 THEN RAISE EXCEPTION 'previous_trophy_lost';END IF;
 answer:=public.connect_addition_multiple_record_v1(b,ev3,0,0,'classic',1,10,10);
 IF (answer->'xp'->>'appXp')::int<>36 THEN RAISE EXCEPTION 'second_student_independence: %',answer;END IF;
 IF (SELECT xp_credited FROM public.connect_xp_credits WHERE student_id=a AND app_key='addition-ecrite-simple')<>22
 THEN RAISE EXCEPTION 'existing_app_mutated';END IF;
 -- Stale reset and revision cannot create a phantom historical result.
 BEGIN
  PERFORM public.connect_addition_multiple_record_v1(a,'88888888-8888-4888-8888-888888888884',1,0,'classic',1,20,20);
  RAISE EXCEPTION 'stale_revision_accepted';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM='stale_revision_accepted' THEN RAISE;END IF;
  IF SQLERRM<>'revision_conflict' THEN RAISE;END IF;
 END;
 UPDATE public.connect_states SET reset_epoch=1,revision=revision+1,state_data='{}'::jsonb
 WHERE student_id=a AND app_key=m;
 BEGIN
  PERFORM public.connect_addition_multiple_record_v1(a,'88888888-8888-4888-8888-888888888885',3,0,'classic',1,4,4);
  RAISE EXCEPTION 'stale_epoch_accepted';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM='stale_epoch_accepted' THEN RAISE;END IF;
  IF SQLERRM<>'stale_reset_epoch' THEN RAISE;END IF;
 END;
 IF (SELECT revision FROM public.connect_states WHERE student_id=a AND app_key=m)<>3
 THEN RAISE EXCEPTION 'rejected_result_changed_revision';END IF;
 IF (SELECT count(*) FROM public.connect_xp_milestones WHERE student_id=a AND app_key=m)<>2
 THEN RAISE EXCEPTION 'wrong_milestone_count';END IF;
 RAISE NOTICE 'PASS actual atomic RPC: rollback on injected XP failure; retry +30 XP; duplicate zero; auth-scoped records; teacher state intact';
END $scenario$;
