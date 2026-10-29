\set ON_ERROR_STOP on
BEGIN;
DO $t$
DECLARE student uuid:='123e4567-e89b-42d3-a456-426614174000';app text:='addition-ecrite-multiple';a jsonb;b jsonb;
BEGIN
 a:=public.addmulti_test_record(student,app,'123e4567-e89b-42d3-a456-426614174001',0,0,'classic',1,4,4);
 RAISE NOTICE 'first result % state %',a,(SELECT state_data FROM public.addmulti_test_states WHERE student_id=student AND app_key=app);
 IF (a->>'delta')::int<>22 OR (a->>'revision')::int<>1 THEN RAISE EXCEPTION 'first_credit';END IF;
 b:=public.addmulti_test_record(student,app,'123e4567-e89b-42d3-a456-426614174001',0,0,'classic',1,4,4);
 IF (b->>'duplicate')::boolean IS DISTINCT FROM true THEN RAISE EXCEPTION 'duplicate';END IF;
 a:=public.addmulti_test_record(student,app,'123e4567-e89b-42d3-a456-426614174002',1,0,'classic',1,8,10);
 IF (a->>'delta')::int<>30 OR (a->>'appXp')::int<>52 THEN RAISE EXCEPTION 'second_credit';END IF;
 BEGIN
 PERFORM public.addmulti_test_record(student,app,'123e4567-e89b-42d3-a456-426614174003',1,0,'classic',1,20,20);
 RAISE EXCEPTION 'stale_revision_accepted';
 EXCEPTION WHEN raise_exception THEN
 IF SQLERRM='stale_revision_accepted' THEN RAISE;END IF;
 END;
 BEGIN
 PERFORM public.addmulti_test_record(student,app,'123e4567-e89b-42d3-a456-426614174004',2,1,'classic',1,20,20);
 RAISE EXCEPTION 'stale_epoch_accepted';
 EXCEPTION WHEN raise_exception THEN
 IF SQLERRM='stale_epoch_accepted' THEN RAISE;END IF;
 END;
 IF (SELECT count(*) FROM public.addmulti_test_events WHERE student_id=student AND app_key=app)<>2 THEN RAISE EXCEPTION 'phantom_event';END IF;
 IF (SELECT xp FROM public.addmulti_test_credits WHERE student_id=student AND app_key=app)<>52 THEN RAISE EXCEPTION 'xp_changed_on_rejection';END IF;
END $t$;
ROLLBACK;
