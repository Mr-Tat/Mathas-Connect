-- PostgreSQL 16 disposable fixture ONLY. Never run this acceptance test on production.
-- A blank carry is native-legal; a wrong entered carry is not.
BEGIN;
INSERT INTO public.connect_classes(id) VALUES ('4bf3400d-a315-4ea4-a2f3-afaca24dc9b9')
 ON CONFLICT DO NOTHING;
DO $test$
DECLARE
 v_student constant uuid:='11111111-1111-4111-8111-111111111111';
 v_class constant uuid:='4bf3400d-a315-4ea4-a2f3-afaca24dc9b9';
 v_app constant text:='multiplication-ecrite-simple';
 v_session uuid;v_ack jsonb;v_ack2 jsonb;v_answers jsonb;
 v_questions jsonb;v_wrong jsonb;v_revision bigint;
BEGIN
 -- 249 x 9 = 2241. All four answer digits correct; all carries absent.
 SELECT jsonb_agg(jsonb_build_object(
  'id','q'||n,'op','mul','a','249','m',9,'width',3) ORDER BY n)
 INTO v_questions FROM generate_series(1,4) n;
 SELECT jsonb_agg(jsonb_build_object(
  'id','q'||n,'digits',jsonb_build_array('1','4','2','2'),
  'carries',jsonb_build_array('','','')) ORDER BY n)
 INTO v_answers FROM generate_series(1,4) n;
 INSERT INTO public.connect_objective_record_school_proof_sessions
 (student_id,class_id,app_key,expected_revision,reset_epoch,level,total,questions,expires_at)
 VALUES (v_student,v_class,v_app,0,0,1,4,v_questions,now()+interval '30 minutes')
 RETURNING session_id INTO v_session;
 v_ack:=public.connect_objective_record_school_mul_finish_classic_v1(
  v_student,v_class,v_session,v_answers);
 IF v_ack->>'proofVerified'<>'true' OR (v_ack->>'verifiedScore')::int<>4
 THEN RAISE EXCEPTION 'classic optional reports lost 4/4: %',v_ack;END IF;
 v_ack2:=public.connect_objective_record_school_mul_finish_classic_v1(
  v_student,v_class,v_session,v_answers);
 IF v_ack2->>'duplicate'<>'true' OR (v_ack2->'xp'->>'delta')::int<>0
 THEN RAISE EXCEPTION 'classic duplicate credited again: %',v_ack2;END IF;
 SELECT revision INTO v_revision FROM public.connect_states
 WHERE student_id=v_student AND app_key=v_app;
 -- One erroneous *written* carry loses exactly one correct operation.
 v_wrong:=jsonb_set(v_answers,'{0,carries,1}','"7"'::jsonb,false);
 INSERT INTO public.connect_objective_record_school_proof_sessions
 (student_id,class_id,app_key,expected_revision,reset_epoch,level,total,questions,expires_at)
 VALUES (v_student,v_class,v_app,v_revision,0,1,4,v_questions,now()+interval '30 minutes')
 RETURNING session_id INTO v_session;
 v_ack:=public.connect_objective_record_school_mul_finish_classic_v1(
  v_student,v_class,v_session,v_wrong);
 IF (v_ack->>'verifiedScore')::int<>3
 THEN RAISE EXCEPTION 'wrong entered classic carry not penalized: %',v_ack;END IF;
 -- New extended session: first result correct with omitted reports, second wrong
 -- written report ends Mort subite; the other 118 questions stay unanswered.
 SELECT revision INTO v_revision FROM public.connect_states
 WHERE student_id=v_student AND app_key=v_app;
 SELECT jsonb_agg(jsonb_build_object(
  'id','q'||n,'op','mul','a','249','m',9,'width',3) ORDER BY n)
 INTO v_questions FROM generate_series(1,120) n;
 INSERT INTO public.connect_objective_record_school_extended_sessions
 (student_id,class_id,app_key,mode,level,width,total,expected_revision,reset_epoch,questions,expires_at)
 VALUES (v_student,v_class,v_app,'sudden',1,3,120,v_revision,0,v_questions,now()+interval '30 minutes')
 RETURNING session_id INTO v_session;
 v_answers:=jsonb_build_array(
  jsonb_build_object('id','q1','digits',jsonb_build_array('1','4','2','2'),
   'carries',jsonb_build_array('','','')),
  jsonb_build_object('id','q2','digits',jsonb_build_array('1','4','2','2'),
   'carries',jsonb_build_array('','7','')));
 v_ack:=public.connect_objective_record_school_mul_finish_extended_v1(
  v_student,v_class,v_session,v_answers);
 IF v_ack->>'proofVerified'<>'true' OR (v_ack->>'verifiedScore')::int<>1
 THEN RAISE EXCEPTION 'extended optional/wrong report mismatch: %',v_ack;END IF;
 v_ack2:=public.connect_objective_record_school_mul_finish_extended_v1(
  v_student,v_class,v_session,v_answers);
 IF v_ack2->>'duplicate'<>'true' OR (v_ack2->'xp'->>'delta')::int<>0
 THEN RAISE EXCEPTION 'extended idempotence broken: %',v_ack2;END IF;
 RAISE NOTICE 'PASS: classic 4/4 optional report, wrong entered carry 3/4, sudden 1 then stop, both idempotent';
END $test$;
ROLLBACK;