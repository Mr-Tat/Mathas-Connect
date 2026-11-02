-- Disposable PG only. This test is run AFTER candidate ledger tests.
\set ON_ERROR_STOP on
INSERT INTO objective_record_candidate.authorizations
 (student_id,app_key,reset_epoch,ruleset_version,approved,repeat_xp)
VALUES ('55555555-5555-4555-8555-555555555555','melange-calculs-ecrits',7,3,true,false);

-- All data are invented; questions are pre-issued by a trusted fixture,
-- not received from the student browser.
INSERT INTO objective_record_candidate.issued_sessions
 (session_id,student_id,app_key,reset_epoch,level,operations_key,ruleset_version,mode,questions,expires_at)
SELECT ids.id,'55555555-5555-4555-8555-555555555555','melange-calculs-ecrits',
 7,2,'add,sub',3,ids.mode,
 (SELECT jsonb_agg(jsonb_build_object('id','q'||i,'op','add','a',i,'b',10) ORDER BY i)
   FROM generate_series(1,ids.length) q(i)),now()+interval '1 hour'
FROM (VALUES
 ('aaaaaaaa-1111-4111-8111-111111111111'::uuid,'sudden',12),
 ('bbbbbbbb-1111-4111-8111-111111111111'::uuid,'three-lives',6),
 ('cccccccc-1111-4111-8111-111111111111'::uuid,'three-lives',1),
 ('dddddddd-1111-4111-8111-111111111111'::uuid,'sudden',2)
) ids(id,mode,length);

DO $session_tests$
DECLARE answers jsonb; r jsonb; wrong jsonb; denied boolean:=false;
BEGIN
 SELECT jsonb_agg(jsonb_build_object('questionId','q'||i,'value',i+10) ORDER BY i)
 INTO answers FROM generate_series(1,12) q(i);
 r:=objective_record_candidate.finish_issued_session(
  '55555555-5555-4555-8555-555555555555',
  'aaaaaaaa-1111-4111-8111-111111111111',answers);
 IF (r->>'xpDelta')::integer<>21 OR (r->>'verifiedScore')::integer<>12
   OR (r->>'verifiedErrors')::integer<>0
 THEN RAISE EXCEPTION 'session_full_credit_wrong: %',r; END IF;
 -- Identical request twice returns one receipt and no further XP.
 r:=objective_record_candidate.finish_issued_session(
  '55555555-5555-4555-8555-555555555555',
  'aaaaaaaa-1111-4111-8111-111111111111',answers);
 IF (r->>'xpDelta')::integer<>0 OR (r->>'duplicate')::boolean IS DISTINCT FROM true
 THEN RAISE EXCEPTION 'session_replay_not_idempotent: %',r;END IF;
 IF (SELECT count(*) FROM objective_record_candidate.receipts
    WHERE student_id='55555555-5555-4555-8555-555555555555')<>1
 THEN RAISE EXCEPTION 'session_double_receipt';END IF;
 denied:=false;
 BEGIN
  PERFORM objective_record_candidate.finish_issued_session(
   '55555555-5555-4555-8555-555555555555',
   'aaaaaaaa-1111-4111-8111-111111111111',
   '[{"questionId":"q1","value":9999}]'::jsonb);
 EXCEPTION WHEN OTHERS THEN denied:=true;END;
 IF NOT denied THEN RAISE EXCEPTION 'session_changed_replay_accepted';END IF;
 denied:=false;
 BEGIN
  PERFORM objective_record_candidate.finish_issued_session(
   '66666666-6666-4666-8666-666666666666',
   'aaaaaaaa-1111-4111-8111-111111111111',answers);
 EXCEPTION WHEN OTHERS THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'cross_student_session_accepted';END IF;
 -- Three distinct wrong COMPLETE calculations, last exactly third error.
 wrong:='[{"questionId":"q1","value":999},{"questionId":"q2","value":12},'||
         '{"questionId":"q3","value":999},{"questionId":"q4","value":999}]';
 r:=objective_record_candidate.finish_issued_session(
  '55555555-5555-4555-8555-555555555555',
  'bbbbbbbb-1111-4111-8111-111111111111',wrong);
 IF (r->>'verifiedScore')::integer<>1 OR (r->>'verifiedErrors')::integer<>3
  OR (r->>'endedBy')<>'mistake-limit' OR (r->>'xpDelta')::integer<>0
 THEN RAISE EXCEPTION 'session_three_lives_wrong: %',r;END IF;
 -- Missing, invented, or incomplete input cannot consume its session.
 denied:=false;
 BEGIN
  PERFORM objective_record_candidate.finish_issued_session(
   '55555555-5555-4555-8555-555555555555',
   'cccccccc-1111-4111-8111-111111111111',
   '[{"questionId":"q1","value":11,"score":100}]'::jsonb);
 EXCEPTION WHEN OTHERS THEN denied:=true;END;
 IF NOT denied THEN RAISE EXCEPTION 'fake_score_accepted';END IF;
 IF (SELECT consumed_at FROM objective_record_candidate.issued_sessions
  WHERE session_id='cccccccc-1111-4111-8111-111111111111') IS NOT NULL
 THEN RAISE EXCEPTION 'invalid_answer_consumed_session';END IF;
 r:=objective_record_candidate.finish_issued_session(
  '55555555-5555-4555-8555-555555555555',
  'cccccccc-1111-4111-8111-111111111111',
  '[{"questionId":"q1","value":11}]'::jsonb);
 IF (r->>'verifiedScore')::integer<>1 THEN RAISE EXCEPTION 'recovery_after_invalid_input_failed';END IF;
 denied:=false;
 BEGIN
  PERFORM objective_record_candidate.finish_issued_session(
   '55555555-5555-4555-8555-555555555555',
   'dddddddd-1111-4111-8111-111111111111',
   '[{"questionId":"q1","value":11}]'::jsonb);
 EXCEPTION WHEN OTHERS THEN denied:=true;END;
 IF NOT denied THEN RAISE EXCEPTION 'partial_session_accepted';END IF;
END $session_tests$;

-- Session expiry and stale teacher reset deny stale submissions.
INSERT INTO objective_record_candidate.issued_sessions
 (session_id,student_id,app_key,reset_epoch,level,operations_key,ruleset_version,mode,questions,issued_at,expires_at)
VALUES('eeeeeeee-1111-4111-8111-111111111111',
 '55555555-5555-4555-8555-555555555555','melange-calculs-ecrits',
 7,2,'add,sub',3,'sudden',
 '[{"id":"q1","op":"add","a":1,"b":2}]'::jsonb,
 now()-interval '2 hours',now()-interval '1 hour');
DO $denied_sessions$
DECLARE refused boolean:=false;
BEGIN
 BEGIN
 PERFORM objective_record_candidate.finish_issued_session(
  '55555555-5555-4555-8555-555555555555',
  'eeeeeeee-1111-4111-8111-111111111111',
  '[{"questionId":"q1","value":3}]'::jsonb);
 EXCEPTION WHEN OTHERS THEN refused:=true;END;
 IF NOT refused THEN RAISE EXCEPTION 'expired_session_accepted';END IF;
END $denied_sessions$;

UPDATE objective_record_candidate.authorizations SET reset_epoch=8
WHERE student_id='55555555-5555-4555-8555-555555555555';
DO $stale_session$
DECLARE refused boolean:=false;
BEGIN
 BEGIN
 PERFORM objective_record_candidate.finish_issued_session(
  '55555555-5555-4555-8555-555555555555',
  'dddddddd-1111-4111-8111-111111111111',
  '[{"questionId":"q1","value":11},{"questionId":"q2","value":12}]'::jsonb);
 EXCEPTION WHEN OTHERS THEN refused:=true;END;
 IF NOT refused THEN RAISE EXCEPTION 'stale_epoch_session_accepted';END IF;
 IF EXISTS(SELECT 1 FROM objective_record_candidate.receipts
  WHERE event_id='dddddddd-1111-4111-8111-111111111111')
 THEN RAISE EXCEPTION 'stale_session_created_receipt';END IF;
END $stale_session$;
SELECT 'private_session_candidate_tests_passed' AS result;
