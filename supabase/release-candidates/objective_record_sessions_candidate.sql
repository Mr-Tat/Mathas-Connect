-- RESEARCH ONLY, load AFTER objective_record_ledger_candidate.sql in disposable PG.
-- Never deploy this candidate or grant it to HTTP callers directly.
-- Issuance MUST occur in a trusted service after Supabase identity, approved
-- device/enrolment/teacher policy, per-app settings and expiry are verified.
BEGIN;
CREATE TABLE objective_record_candidate.issued_sessions(
 session_id uuid NOT NULL,
 student_id uuid NOT NULL,
 app_key text NOT NULL,
 reset_epoch bigint NOT NULL CHECK(reset_epoch>=0),
 level integer NOT NULL CHECK(level BETWEEN 1 AND 3),
 operations_key text NOT NULL,
 ruleset_version integer NOT NULL CHECK(ruleset_version>0),
 mode text NOT NULL CHECK(mode IN ('three-lives','sudden')),
 questions jsonb NOT NULL CHECK(jsonb_typeof(questions)='array'
   AND jsonb_array_length(questions) BETWEEN 1 AND 1000),
 issued_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL CHECK(expires_at>issued_at),
 consumed_at timestamptz,
 answers_sha256 text,
 PRIMARY KEY(session_id,student_id),
 CONSTRAINT session_authorization FOREIGN KEY(student_id,app_key)
  REFERENCES objective_record_candidate.authorizations(student_id,app_key),
 CHECK((consumed_at IS NULL AND answers_sha256 IS NULL)
    OR (consumed_at IS NOT NULL AND length(answers_sha256)=64))
);
REVOKE ALL ON objective_record_candidate.issued_sessions FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON objective_record_candidate.issued_sessions TO service_role;

-- Called only after the trusted Edge resolves p_student from the approved JWT.
-- The event id IS session id. The store replays numerical answers against
-- private issued questions and then uses the SAME transaction for credits.
-- Borrow/carry methods and cell-by-cell first try remain a separate blocker.
CREATE FUNCTION objective_record_candidate.finish_issued_session(
 p_student uuid,p_session uuid,p_answers jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $finish$
DECLARE sess record; q jsonb; a jsonb; op text; qid text;
 qa bigint; qb bigint; expected bigint; given numeric;
 i integer; number_answers integer; number_questions integer;
 correct_count integer:=0; errors integer:=0; error_limit integer;
 seen text[]:=ARRAY[]::text[]; digest text; credit jsonb;
BEGIN
 IF p_student IS NULL OR p_session IS NULL OR p_answers IS NULL
  OR jsonb_typeof(p_answers)<>'array'
  OR jsonb_array_length(p_answers) NOT BETWEEN 1 AND 1000
 THEN RAISE EXCEPTION 'invalid_answers'; END IF;
 SELECT * INTO sess FROM objective_record_candidate.issued_sessions
  WHERE student_id=p_student AND session_id=p_session FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'unknown_or_wrong_student_session'; END IF;
 digest:=pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_answers::text,'UTF8')),'hex');
 IF sess.consumed_at IS NOT NULL THEN
  IF sess.answers_sha256<>digest THEN RAISE EXCEPTION 'session_already_consumed';END IF;
  RETURN jsonb_build_object('ok',true,'duplicate',true,'xpDelta',0);
 END IF;
 IF sess.expires_at<=now() THEN RAISE EXCEPTION 'expired_session';END IF;
 number_answers:=jsonb_array_length(p_answers);
 number_questions:=jsonb_array_length(sess.questions);
 IF number_answers>number_questions THEN RAISE EXCEPTION 'too_many_answers';END IF;
 error_limit:=CASE WHEN sess.mode='three-lives' THEN 3 ELSE 1 END;
 FOR i IN 0..number_answers-1 LOOP
  q:=sess.questions->i;a:=p_answers->i;
  IF jsonb_typeof(q)<>'object' OR jsonb_typeof(a)<>'object'
   OR NOT(q ?& ARRAY['id','op','a','b'])
   OR NOT(a ?& ARRAY['questionId','value'])
   OR (q - 'id' - 'op' - 'a' - 'b')<>'{}'::jsonb
   OR (a - 'questionId' - 'value')<>'{}'::jsonb
   OR jsonb_typeof(q->'id')<>'string'
   OR jsonb_typeof(q->'op')<>'string'
   OR jsonb_typeof(q->'a')<>'number'
   OR jsonb_typeof(q->'b')<>'number'
   OR jsonb_typeof(a->'questionId')<>'string'
   OR jsonb_typeof(a->'value')<>'number'
  THEN RAISE EXCEPTION 'invalid_transcript_shape';END IF;
  qid:=q->>'id';op:=q->>'op';
  IF length(qid) NOT BETWEEN 1 AND 80 OR qid=ANY(seen)
   OR a->>'questionId'<>qid
   OR q->>'a' !~ '^(0|[1-9][0-9]{0,8})$'
   OR q->>'b' !~ '^(0|[1-9][0-9]{0,8})$'
   OR a->>'value' !~ '^(0|[1-9][0-9]{0,16})$'
   OR op NOT IN ('add','sub','mul')
  THEN RAISE EXCEPTION 'invalid_arithmetic_event';END IF;
  IF sess.app_key='melange-calculs-ecrits' THEN
   IF NOT op=ANY(string_to_array(sess.operations_key,','))
   THEN RAISE EXCEPTION 'operation_not_selected';END IF;
  ELSIF
   (sess.app_key IN ('addition-ecrite-simple','addition-ecrite-multiple') AND op<>'add')
   OR (sess.app_key='soustraction-ecrite-simple' AND op<>'sub')
   OR (sess.app_key='multiplication-ecrite-simple' AND op<>'mul')
   OR sess.operations_key<>'' OR sess.app_key NOT IN
    ('addition-ecrite-simple','addition-ecrite-multiple',
     'soustraction-ecrite-simple','multiplication-ecrite-simple')
  THEN RAISE EXCEPTION 'app_operation_mismatch';END IF;
  seen:=array_append(seen,qid);
  qa:=(q->>'a')::bigint;qb:=(q->>'b')::bigint;
  IF op='sub' AND qa<qb THEN RAISE EXCEPTION 'invalid_subtraction_question';END IF;
  expected:=CASE op WHEN 'add' THEN qa+qb WHEN 'sub' THEN qa-qb ELSE qa*qb END;
  given:=(a->>'value')::numeric;
  IF given>10000000000000000 THEN RAISE EXCEPTION 'out_of_bounds_answer';END IF;
  IF given=expected THEN correct_count:=correct_count+1;
  ELSE errors:=errors+1;END IF;
  IF errors>=error_limit AND i<>number_answers-1
  THEN RAISE EXCEPTION 'answers_after_game_over';END IF;
 END LOOP;
 IF errors<error_limit AND number_answers<>number_questions
 THEN RAISE EXCEPTION 'incomplete_game';END IF;
 credit:=objective_record_candidate.credit_verified_record(
  p_student,sess.app_key,sess.reset_epoch,sess.level,sess.operations_key,
  sess.ruleset_version,sess.mode,sess.session_id,correct_count,
  jsonb_build_object('sessionId',sess.session_id,'answersSha256',digest,
   'verifiedScore',correct_count,'verifiedErrors',errors,
   'completed',number_answers));
 UPDATE objective_record_candidate.issued_sessions
  SET consumed_at=now(),answers_sha256=digest WHERE session_id=p_session;
 RETURN credit||jsonb_build_object('verifiedScore',correct_count,
   'verifiedErrors',errors,'completed',number_answers,
   'endedBy',CASE WHEN errors=error_limit THEN 'mistake-limit' ELSE 'question-limit' END);
END $finish$;
REVOKE EXECUTE ON FUNCTION objective_record_candidate.finish_issued_session(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION objective_record_candidate.finish_issued_session(uuid,uuid,jsonb) TO service_role;
COMMIT;
