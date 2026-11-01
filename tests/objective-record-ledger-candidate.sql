-- Run ONLY against a disposable Postgres database.
\set ON_ERROR_STOP on
-- Each test account below is fictional. Never query a real connect_students row.
INSERT INTO objective_record_candidate.authorizations
(student_id,app_key,reset_epoch,ruleset_version,approved,repeat_xp)
VALUES
('11111111-1111-4111-8111-111111111111','melange-calculs-ecrits',7,3,true,false),
('22222222-2222-4222-8222-222222222222','melange-calculs-ecrits',7,3,false,false);

INSERT INTO objective_record_candidate.rules
 (app_key,ruleset_version,level,operations_key,milestone,full_xp)
SELECT 'melange-calculs-ecrits',3,lv.n,ops.op,m.milestone,
 CASE m.milestone
  WHEN 'classic:4' THEN 8+lv.n+length(ops.op)
  WHEN 'classic:10' THEN 24+lv.n+length(ops.op)
  WHEN 'classic:20' THEN 42+lv.n+length(ops.op)
  WHEN 'record:5' THEN 10
  ELSE 11 END
FROM (VALUES('add'),('sub'),('mul'),('add,sub'),('add,mul'),
 ('sub,mul'),('add,sub,mul')) ops(op)
CROSS JOIN (VALUES(1),(2),(3)) lv(n)
CROSS JOIN (VALUES('classic:4'),('classic:10'),('classic:20'),
 ('record:5'),('record:10')) m(milestone);

DO $$
DECLARE r jsonb; a jsonb; n integer; e boolean;
BEGIN
 -- Fail closed on missing approval, version, epoch, unknown exact subset/level.
 IF objective_record_candidate.read_projection(
  '22222222-2222-4222-8222-222222222222','melange-calculs-ecrits',7,2,'add,sub',3) IS NOT NULL
  THEN RAISE EXCEPTION 'unapproved_projection_exposed'; END IF;
 IF objective_record_candidate.read_projection(
  '11111111-1111-4111-8111-111111111111','melange-calculs-ecrits',6,2,'add,sub',3) IS NOT NULL
  THEN RAISE EXCEPTION 'stale_epoch_exposed'; END IF;
 IF objective_record_candidate.read_projection(
  '11111111-1111-4111-8111-111111111111','melange-calculs-ecrits',7,2,'add,sub',4) IS NOT NULL
  THEN RAISE EXCEPTION 'wrong_ruleset_exposed'; END IF;
 IF objective_record_candidate.read_projection(
  '11111111-1111-4111-8111-111111111111','melange-calculs-ecrits',7,2,'sub,add',3) IS NOT NULL
  THEN RAISE EXCEPTION 'uncanonical_subset_exposed'; END IF;
 FOR n IN 1..3 LOOP
  FOR a IN SELECT to_jsonb(ARRAY[op]::text[]) FROM
    (VALUES('add'),('sub'),('mul'),('add,sub'),('add,mul'),('sub,mul'),('add,sub,mul')) v(op)
  LOOP
   r:=objective_record_candidate.read_projection(
    '11111111-1111-4111-8111-111111111111','melange-calculs-ecrits',7,n,a->>0,3);
   IF r IS NULL OR (r->'remaining'->>'three-lives')::integer<>10
    OR (r->'remaining'->>'sudden')::integer<>21
    THEN RAISE EXCEPTION 'projection_missing_%_%',n,a; END IF;
  END LOOP;
 END LOOP;
 -- Identical number of families is NOT a sufficient cache key.
 IF objective_record_candidate.read_projection(
  '11111111-1111-4111-8111-111111111111','melange-calculs-ecrits',7,2,'add,sub',3)->'operations'
 = objective_record_candidate.read_projection(
  '11111111-1111-4111-8111-111111111111','melange-calculs-ecrits',7,2,'add,mul',3)->'operations'
 THEN RAISE EXCEPTION 'subset_not_distinct';END IF;
 IF pg_catalog.has_schema_privilege('anon','objective_record_candidate','USAGE')
  OR pg_catalog.has_schema_privilege('authenticated','objective_record_candidate','USAGE')
  OR pg_catalog.has_table_privilege('anon','objective_record_candidate.credits','SELECT')
  OR pg_catalog.has_function_privilege('anon',
    'objective_record_candidate.credit_verified_event(uuid,text,bigint,integer,text,integer,text,text,uuid,jsonb)','EXECUTE')
 THEN RAISE EXCEPTION 'client_role_grant_leaked'; END IF;
 -- One approved, backend-verified event only: half credit then complement.
 r:=objective_record_candidate.credit_verified_event(
 '11111111-1111-4111-8111-111111111111','melange-calculs-ecrits',7,2,
 'add,sub',3,'record:5','three-lives','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 '{"source":"verified-server-test","answers":[1]}'::jsonb);
 IF (r->>'xpDelta')::integer<>5 THEN RAISE EXCEPTION 'half_cap_wrong: %',r;END IF;
 r:=objective_record_candidate.credit_verified_event(
 '11111111-1111-4111-8111-111111111111','melange-calculs-ecrits',7,2,
 'add,sub',3,'record:5','three-lives','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 '{"answers":[1],"source":"verified-server-test"}'::jsonb);
 IF (r->>'xpDelta')::integer<>0 OR (r->>'duplicate')::boolean IS DISTINCT FROM true
 THEN RAISE EXCEPTION 'replay_duplicated: %',r;END IF;
 r:=objective_record_candidate.credit_verified_event(
 '11111111-1111-4111-8111-111111111111','melange-calculs-ecrits',7,2,
 'add,sub',3,'record:5','sudden','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
 '{"source":"verified-server-test","answers":[2]}'::jsonb);
 IF (r->>'xpDelta')::integer<>5 THEN RAISE EXCEPTION 'complement_wrong: %',r;END IF;
 r:=objective_record_candidate.credit_verified_event(
 '11111111-1111-4111-8111-111111111111','melange-calculs-ecrits',7,2,
 'add,sub',3,'record:5','three-lives','cccccccc-cccc-4ccc-8ccc-cccccccccccc',
 '{"source":"verified-server-test","answers":[3]}'::jsonb);
 IF (r->>'xpDelta')::integer<>0 THEN RAISE EXCEPTION 'overcredit_three: %',r;END IF;
 -- Other subset must not inherit the two-family credit.
 r:=objective_record_candidate.read_projection(
  '11111111-1111-4111-8111-111111111111','melange-calculs-ecrits',7,2,'add,sub',3);
 IF (r->'remaining'->>'sudden')::integer<>11 THEN RAISE EXCEPTION 'remaining_wrong: %',r;END IF;
 r:=objective_record_candidate.read_projection(
  '11111111-1111-4111-8111-111111111111','melange-calculs-ecrits',7,2,'add,mul',3);
 IF (r->'remaining'->>'sudden')::integer<>21 THEN RAISE EXCEPTION 'subset_credit_leaked: %',r;END IF;
 -- Replay collision cannot mutate prior credit.
 e:=false;
 BEGIN
  PERFORM objective_record_candidate.credit_verified_event(
   '11111111-1111-4111-8111-111111111111','melange-calculs-ecrits',7,2,
   'add,sub',3,'record:5','three-lives','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   '{"source":"changed"}'::jsonb);
 EXCEPTION WHEN OTHERS THEN e:=true; END;
 IF NOT e THEN RAISE EXCEPTION 'collision_not_blocked'; END IF;
 -- Wrong mode is always denied. A refused event must leave no receipt.
 e:=false;
 BEGIN
  PERFORM objective_record_candidate.credit_verified_event(
   '11111111-1111-4111-8111-111111111111','melange-calculs-ecrits',7,2,
   'add,sub',3,'classic:4','three-lives','dddddddd-dddd-4ddd-8ddd-dddddddddddd',
   '{}'::jsonb);
 EXCEPTION WHEN OTHERS THEN e:=true;END;
 IF NOT e THEN RAISE EXCEPTION 'mode_mismatch_accepted';END IF;
 IF EXISTS (SELECT 1 FROM objective_record_candidate.receipts
            WHERE event_id='dddddddd-dddd-4ddd-8ddd-dddddddddddd')
 THEN RAISE EXCEPTION 'failed_event_left_receipt'; END IF;
END $$;

-- A teacher reset without repeat permission must retain the non-repeatable credit.
UPDATE objective_record_candidate.authorizations SET reset_epoch=8,repeat_xp=false
WHERE student_id='11111111-1111-4111-8111-111111111111';
DO $$
DECLARE r jsonb; e boolean:=false;
BEGIN
 BEGIN
  PERFORM objective_record_candidate.credit_verified_event(
   '11111111-1111-4111-8111-111111111111','melange-calculs-ecrits',7,2,
   'add,sub',3,'record:5','sudden','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
   '{}'::jsonb);
 EXCEPTION WHEN OTHERS THEN e:=true; END;
 IF NOT e THEN RAISE EXCEPTION 'stale_event_accepted';END IF;
 r:=objective_record_candidate.credit_verified_event(
 '11111111-1111-4111-8111-111111111111','melange-calculs-ecrits',8,2,
 'add,sub',3,'record:5','sudden','ffffffff-ffff-4fff-8fff-ffffffffffff',
 '{"source":"verified-server-test"}'::jsonb);
 IF (r->>'xpDelta')::integer<>0 THEN RAISE EXCEPTION 'repeat_denied_but_credited';END IF;
END $$;

-- Teacher authorizes XP replay on a NEW epoch; never clear earlier credits.
UPDATE objective_record_candidate.authorizations SET reset_epoch=9,repeat_xp=true
WHERE student_id='11111111-1111-4111-8111-111111111111';
DO $$
DECLARE r jsonb;
BEGIN
 r:=objective_record_candidate.credit_verified_event(
 '11111111-1111-4111-8111-111111111111','melange-calculs-ecrits',9,2,
 'add,sub',3,'record:5','three-lives','10101010-1010-4010-8010-101010101010',
 '{"source":"verified-server-test"}'::jsonb);
 IF (r->>'xpDelta')::integer<>5 THEN RAISE EXCEPTION 'explicit_replay_missing';END IF;
END $$;

-- Transaction rollback must cancel a receipt and any XP change as one unit.
BEGIN;
SELECT objective_record_candidate.credit_verified_event(
 '11111111-1111-4111-8111-111111111111','melange-calculs-ecrits',9,2,
 'add,sub',3,'record:10','sudden','20202020-2020-4020-8020-202020202020',
 '{"source":"rollback-fixture"}'::jsonb);
ROLLBACK;
DO $$
BEGIN
 IF EXISTS(SELECT 1 FROM objective_record_candidate.receipts
  WHERE event_id='20202020-2020-4020-8020-202020202020')
 OR EXISTS(SELECT 1 FROM objective_record_candidate.credits
  WHERE student_id='11111111-1111-4111-8111-111111111111'
    AND scope_epoch=9 AND milestone='record:10')
 THEN RAISE EXCEPTION 'rollback_failed';END IF;
END $$;
SELECT 'record_candidate_tests_passed' AS result;
