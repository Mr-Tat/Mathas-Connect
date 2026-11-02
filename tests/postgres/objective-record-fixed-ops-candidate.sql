-- Executed ONLY after the candidate in disposable PG with stub official RPC.
DO $spec$
DECLARE r jsonb; rev bigint; sample_event uuid:='22222222-2222-4222-8222-222222222222';
 app text:='addition-ecrite-simple';student uuid:='11111111-1111-4111-8111-111111111111';
 class_id uuid:='4bf3400d-a315-4ea4-a2f3-afaca24dc9b9';n int;
BEGIN
 r:=public.connect_objective_record_test_fixed_v1(student,class_id,app,sample_event,0,0,'classic',1,4,4);
 IF (r->>'ok')<>'true' OR (r->>'revision')::int<>1
 OR (r#>>'{xp,appXp}')::int<>22 OR (r#>>'{xp,delta}')::int<>22
 THEN RAISE EXCEPTION 'first_record_failed: %',r;END IF;
 SELECT count(*) INTO n FROM public.connect_objective_record_test_receipts;
 IF n<>1 THEN RAISE EXCEPTION 'receipt_missing';END IF;
 r:=public.connect_objective_record_test_fixed_v1(student,class_id,app,sample_event,0,0,'classic',1,4,4);
 IF (r->>'duplicate')<>'true' OR (r#>>'{xp,delta}')::int<>0
 THEN RAISE EXCEPTION 'not_idempotent';END IF;
 SELECT revision INTO rev FROM public.connect_states WHERE student_id=student AND app_key=app;
 IF rev<>1 THEN RAISE EXCEPTION 'duplicate_advanced_revision';END IF;
 BEGIN
  PERFORM public.connect_objective_record_test_fixed_v1(student,class_id,app,sample_event,1,0,'classic',1,3,4);
  RAISE EXCEPTION 'unexpected_collision_success';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM<>'event_collision' THEN RAISE;END IF;
 END;
 BEGIN
  PERFORM public.connect_objective_record_test_fixed_v1(student,class_id,app,
   '33333333-3333-4333-8333-333333333333',0,0,'sudden',1,7,NULL);
  RAISE EXCEPTION 'unexpected_cas_success';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM<>'revision_conflict' THEN RAISE;END IF;
 END;
 BEGIN
  PERFORM public.connect_objective_record_test_fixed_v1(student,
   '8fe170fa-9e8f-4e80-885a-b0ba68026f64',app,
   '33333333-3333-4333-8333-333333333333',1,0,'sudden',1,7,NULL);
  RAISE EXCEPTION 'unexpected_real_class_success';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM<>'invalid_result' THEN RAISE;END IF;
 END;
 BEGIN
  PERFORM public.connect_objective_record_test_fixed_v1(student,class_id,
   'melange-calculs-ecrits','44444444-4444-4444-8444-444444444444',
   0,0,'classic',1,4,4);
  RAISE EXCEPTION 'unexpected_mixed_success';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM<>'invalid_result' THEN RAISE;END IF;
 END;
 -- Simulated failure in XP sync MUST roll back receipt/state in one transaction.
 BEGIN
  PERFORM public.connect_objective_record_test_fixed_v1(student,class_id,app,
   '55555555-5555-4555-8555-555555555555',1,0,'sudden',1,777,NULL);
  RAISE EXCEPTION 'unexpected_xp_error_success';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM<>'simulated_xp_failure' THEN RAISE;END IF;
 END;
 SELECT revision INTO rev FROM public.connect_states WHERE student_id=student AND app_key=app;
 IF rev<>1 OR EXISTS(SELECT 1 FROM public.connect_objective_record_test_receipts
 WHERE event_id='55555555-5555-4555-8555-555555555555')
 THEN RAISE EXCEPTION 'non_atomic_rollback';END IF;
 UPDATE public.connect_states SET reset_epoch=1 WHERE student_id=student AND app_key=app;
 BEGIN
  PERFORM public.connect_objective_record_test_fixed_v1(student,class_id,app,
   '66666666-6666-4666-8666-666666666666',1,0,'sudden',1,7,NULL);
  RAISE EXCEPTION 'unexpected_old_epoch_success';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM<>'stale_reset_epoch' THEN RAISE;END IF;
 END;
 -- A new, distinct event may run against the new epoch.
 r:=public.connect_objective_record_test_fixed_v1(student,class_id,app,
 '66666666-6666-4666-8666-666666666666',1,1,'sudden',1,7,NULL);
 IF (r->>'ok')<>'true' OR (r->>'revision')::int<>2
 THEN RAISE EXCEPTION 'new_epoch_record_failed';END IF;
 IF (SELECT count(*) FROM public.connect_objective_record_test_receipts)<>2
 THEN RAISE EXCEPTION 'receipt_counter_wrong';END IF;
END $spec$;
-- No browser role may execute the security-definer RPC or read the receipts.
DO $acl$
BEGIN
 IF has_function_privilege('anon','public.connect_objective_record_test_fixed_v1(uuid,uuid,text,uuid,bigint,bigint,text,integer,integer,integer)','EXECUTE')
 OR has_function_privilege('authenticated','public.connect_objective_record_test_fixed_v1(uuid,uuid,text,uuid,bigint,bigint,text,integer,integer,integer)','EXECUTE')
 OR has_table_privilege('anon','public.connect_objective_record_test_receipts','SELECT')
 OR has_table_privilege('authenticated','public.connect_objective_record_test_receipts','SELECT')
 THEN RAISE EXCEPTION 'web_role_has_private_award_access';END IF;
END $acl$;
