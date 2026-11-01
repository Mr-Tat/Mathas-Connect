-- RESEARCH CANDIDATE ONLY. Never apply to a live Supabase project.
-- This file is intentionally NOT a Supabase migration. No student fixtures.
-- The service must verify each arithmetic answer and the session identity BEFORE
-- invoking credit_verified_event. A client journal alone is not a proof.
BEGIN;
CREATE SCHEMA objective_record_candidate;
REVOKE ALL ON SCHEMA objective_record_candidate FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA objective_record_candidate TO service_role;

CREATE TABLE objective_record_candidate.authorizations (
 student_id uuid NOT NULL,
 app_key text NOT NULL,
 reset_epoch bigint NOT NULL CHECK (reset_epoch>=0),
 ruleset_version integer NOT NULL CHECK (ruleset_version>0),
 approved boolean NOT NULL DEFAULT false,
 repeat_xp boolean NOT NULL DEFAULT false,
 PRIMARY KEY(student_id,app_key)
);
CREATE TABLE objective_record_candidate.rules (
 app_key text NOT NULL,
 ruleset_version integer NOT NULL CHECK(ruleset_version>0),
 level integer NOT NULL CHECK(level BETWEEN 1 AND 3),
 operations_key text NOT NULL CHECK(operations_key IN ('','add','sub','mul','add,sub','add,mul','sub,mul','add,sub,mul')),
 milestone text NOT NULL CHECK(milestone IN ('classic:4','classic:10','classic:20','record:5','record:10')),
 full_xp integer NOT NULL CHECK(full_xp BETWEEN 1 AND 100000),
 PRIMARY KEY(app_key,ruleset_version,level,operations_key,milestone),
 CHECK((app_key='melange-calculs-ecrits' AND operations_key<>'') OR
       (app_key IN ('addition-ecrite-simple','addition-ecrite-multiple',
         'soustraction-ecrite-simple','multiplication-ecrite-simple') AND operations_key=''))
);
CREATE TABLE objective_record_candidate.credits (
 student_id uuid NOT NULL,
 app_key text NOT NULL,
 scope_epoch bigint NOT NULL CHECK(scope_epoch>=0),
 ruleset_version integer NOT NULL CHECK(ruleset_version>0),
 level integer NOT NULL CHECK(level BETWEEN 1 AND 3),
 operations_key text NOT NULL,
 milestone text NOT NULL,
 credited integer NOT NULL CHECK(credited>=0),
 PRIMARY KEY(student_id,app_key,scope_epoch,ruleset_version,level,operations_key,milestone)
);
CREATE TABLE objective_record_candidate.receipts (
 student_id uuid NOT NULL,
 event_id uuid NOT NULL,
 event_hash text NOT NULL CHECK(length(event_hash)=64),
 xp_delta integer NOT NULL CHECK(xp_delta>=0),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(student_id,event_id)
);
REVOKE ALL ON ALL TABLES IN SCHEMA objective_record_candidate FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON ALL TABLES IN SCHEMA objective_record_candidate TO service_role;

-- Canonicalization is strict: the caller must send operations in stable add/sub/mul order.
-- Fail closed on unknown operations, versions, stale epochs and unapproved identities.
CREATE FUNCTION objective_record_candidate.read_projection(
 p_student uuid,p_app text,p_epoch bigint,p_level integer,
 p_operations text,p_ruleset integer
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE a record; sc bigint; r record; credits integer;
 c4 integer:=NULL; c10 integer:=NULL; c20 integer:=NULL;
 three integer:=0; sudden integer:=0; n integer:=0;
BEGIN
 IF p_student IS NULL OR p_epoch IS NULL OR p_level NOT BETWEEN 1 AND 3
  OR p_ruleset IS NULL OR p_operations IS NULL THEN RETURN NULL;END IF;
 SELECT * INTO a FROM objective_record_candidate.authorizations
  WHERE student_id=p_student AND app_key=p_app;
 IF NOT FOUND OR NOT a.approved OR a.reset_epoch<>p_epoch
  OR a.ruleset_version<>p_ruleset THEN RETURN NULL; END IF;
 sc:=CASE WHEN a.repeat_xp THEN p_epoch ELSE 0 END;
 FOR r IN SELECT milestone,full_xp FROM objective_record_candidate.rules
  WHERE app_key=p_app AND ruleset_version=p_ruleset AND level=p_level AND operations_key=p_operations
 LOOP
  SELECT credited INTO credits FROM objective_record_candidate.credits
   WHERE student_id=p_student AND app_key=p_app AND scope_epoch=sc AND ruleset_version=p_ruleset
     AND level=p_level AND operations_key=p_operations AND milestone=r.milestone;
  credits:=COALESCE(credits,0);n:=n+1;
  IF r.milestone='classic:4' THEN c4:=GREATEST(0,r.full_xp-credits);
  ELSIF r.milestone='classic:10' THEN c10:=GREATEST(0,r.full_xp-credits);
  ELSIF r.milestone='classic:20' THEN c20:=GREATEST(0,r.full_xp-credits);
  ELSE
   three:=three+GREATEST(0,r.full_xp/2-credits);
   sudden:=sudden+GREATEST(0,r.full_xp-credits);
  END IF;
 END LOOP;
 -- All five explicit rule rows are mandatory; no invented or partial rights.
 IF n<>5 OR c4 IS NULL OR c10 IS NULL OR c20 IS NULL THEN RETURN NULL;END IF;
 RETURN jsonb_build_object('ok',true,'active',true,'version',1,'appKey',p_app,
  'level',p_level,'operations',CASE WHEN p_operations='' THEN '[]'::jsonb ELSE to_jsonb(string_to_array(p_operations,',')) END,
  'resetEpoch',p_epoch,'rulesetVersion',p_ruleset,
  'remaining',jsonb_build_object('4',c4,'10',c10,'20',c20,'three-lives',three,'sudden',sudden));
END $$;

-- Trusted BACKEND ONLY. This function never verifies arithmetic and cannot safely
-- accept raw browser payloads. The backend must independently validate proofs,
-- operation/method/level, score, one error per completed calculation, end-of-game,
-- student approval and epoch, BEFORE calling this function as service_role.
-- p_evidence is server-issued normalized evidence; SHA-256 freezes event identity.
CREATE FUNCTION objective_record_candidate.credit_verified_event(
 p_student uuid,p_app text,p_epoch bigint,p_level integer,p_operations text,
 p_ruleset integer,p_milestone text,p_mode text,p_event uuid,p_evidence jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE a record; v_full_xp integer; old_credit integer:=0; target integer;
 delta integer; sc bigint; h text; existing record;
BEGIN
 IF p_student IS NULL OR p_app IS NULL OR p_event IS NULL
  OR p_evidence IS NULL OR jsonb_typeof(p_evidence)<>'object'
  OR p_milestone IS NULL OR p_mode NOT IN ('classic','three-lives','sudden')
  OR p_level NOT BETWEEN 1 AND 3 OR p_epoch IS NULL OR p_ruleset IS NULL
  OR p_operations IS NULL THEN RAISE EXCEPTION 'invalid_event'; END IF;
 IF (p_mode='classic')<>(p_milestone LIKE 'classic:%') THEN RAISE EXCEPTION 'mode_milestone_mismatch'; END IF;
 -- Serialize per student/app, including all operations and modes.
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_student::text||':'||p_app,0));
 SELECT * INTO a FROM objective_record_candidate.authorizations
 WHERE student_id=p_student AND app_key=p_app FOR UPDATE;
 IF NOT FOUND OR NOT a.approved OR a.reset_epoch<>p_epoch OR a.ruleset_version<>p_ruleset
 THEN RAISE EXCEPTION 'unapproved_or_stale'; END IF;
 sc:=CASE WHEN a.repeat_xp THEN p_epoch ELSE 0 END;
 h:=pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
  jsonb_build_object('app',p_app,'epoch',p_epoch,'level',p_level,
   'operations',p_operations,'ruleset',p_ruleset,'milestone',p_milestone,
   'mode',p_mode,'evidence',p_evidence)::text,'UTF8')),'hex');
 SELECT * INTO existing FROM objective_record_candidate.receipts
 WHERE student_id=p_student AND event_id=p_event FOR UPDATE;
 IF FOUND THEN
  IF existing.event_hash<>h THEN RAISE EXCEPTION 'event_collision';END IF;
  RETURN jsonb_build_object('ok',true,'duplicate',true,'xpDelta',0);
 END IF;
 SELECT rule.full_xp INTO v_full_xp FROM objective_record_candidate.rules AS rule
  WHERE app_key=p_app AND ruleset_version=p_ruleset AND level=p_level
   AND operations_key=p_operations AND milestone=p_milestone;
 IF NOT FOUND THEN RAISE EXCEPTION 'missing_rule';END IF;
 target:=CASE WHEN p_mode='three-lives' THEN v_full_xp/2 ELSE v_full_xp END;
 SELECT credited INTO old_credit FROM objective_record_candidate.credits
 WHERE student_id=p_student AND app_key=p_app AND scope_epoch=sc
  AND ruleset_version=p_ruleset AND level=p_level AND operations_key=p_operations
  AND milestone=p_milestone FOR UPDATE;
 old_credit:=COALESCE(old_credit,0);
 delta:=GREATEST(0,target-old_credit);
 INSERT INTO objective_record_candidate.credits
  (student_id,app_key,scope_epoch,ruleset_version,level,operations_key,milestone,credited)
 VALUES (p_student,p_app,sc,p_ruleset,p_level,p_operations,p_milestone,old_credit+delta)
 ON CONFLICT(student_id,app_key,scope_epoch,ruleset_version,level,operations_key,milestone)
 DO UPDATE SET credited=EXCLUDED.credited;
 INSERT INTO objective_record_candidate.receipts(student_id,event_id,event_hash,xp_delta)
 VALUES(p_student,p_event,h,delta);
 -- Trophies are deliberately NOT minted by this candidate. Only existing
 -- native Sudden Death server flow can award an authentic trophy.
 RETURN jsonb_build_object('ok',true,'duplicate',false,'xpDelta',delta,
  'creditedTotal',old_credit+delta,'cap',target);
END $$;

-- Atomic MULTI-MILESTONE record award. A verified 10-correct game must credit
-- record:5 and record:10 as ONE transaction and produce ONE receipt.
-- The service MUST derive score/mode from verifyServerTranscript and must
-- consume the private issued-session record in the same future transaction.
CREATE FUNCTION objective_record_candidate.credit_verified_record(
 p_student uuid,p_app text,p_epoch bigint,p_level integer,p_operations text,
 p_ruleset integer,p_mode text,p_event uuid,p_verified_score integer,p_evidence jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $record$
DECLARE a record; rule record; sc bigint; old_credit integer; target integer;
 delta integer; total_delta integer:=0; matched integer:=0; required integer:=0;
 existing record; hash text; details jsonb:='[]'::jsonb;
BEGIN
 IF p_student IS NULL OR p_app IS NULL OR p_event IS NULL OR p_epoch IS NULL
  OR p_ruleset IS NULL OR p_level IS NULL OR p_level NOT BETWEEN 1 AND 3
  OR p_operations IS NULL OR p_mode NOT IN ('three-lives','sudden')
  OR p_verified_score IS NULL OR p_verified_score NOT BETWEEN 0 AND 1000
  OR p_evidence IS NULL OR jsonb_typeof(p_evidence)<>'object'
 THEN RAISE EXCEPTION 'invalid_verified_result';END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_student::text||':'||p_app,0));
 SELECT * INTO a FROM objective_record_candidate.authorizations
  WHERE student_id=p_student AND app_key=p_app FOR UPDATE;
 IF NOT FOUND OR NOT a.approved OR a.reset_epoch<>p_epoch OR a.ruleset_version<>p_ruleset
 THEN RAISE EXCEPTION 'unapproved_or_stale';END IF;
 sc:=CASE WHEN a.repeat_xp THEN p_epoch ELSE 0 END;
 hash:=pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
  jsonb_build_object('type','verified-record','app',p_app,'epoch',p_epoch,
   'level',p_level,'operations',p_operations,'ruleset',p_ruleset,'mode',p_mode,
   'score',p_verified_score,'evidence',p_evidence)::text,'UTF8')),'hex');
 SELECT * INTO existing FROM objective_record_candidate.receipts
  WHERE student_id=p_student AND event_id=p_event FOR UPDATE;
 IF FOUND THEN
  IF existing.event_hash<>hash THEN RAISE EXCEPTION 'event_collision';END IF;
  RETURN jsonb_build_object('ok',true,'duplicate',true,'xpDelta',0);
 END IF;
 required:=CASE WHEN p_verified_score>=10 THEN 2 WHEN p_verified_score>=5 THEN 1 ELSE 0 END;
 FOR rule IN SELECT milestone,full_xp FROM objective_record_candidate.rules
 WHERE app_key=p_app AND ruleset_version=p_ruleset AND level=p_level
 AND operations_key=p_operations
 AND ((milestone='record:5' AND p_verified_score>=5)
  OR (milestone='record:10' AND p_verified_score>=10))
 ORDER BY milestone
 LOOP
  matched:=matched+1;
  target:=CASE WHEN p_mode='three-lives' THEN rule.full_xp/2 ELSE rule.full_xp END;
  SELECT credited INTO old_credit FROM objective_record_candidate.credits
   WHERE student_id=p_student AND app_key=p_app AND scope_epoch=sc
    AND ruleset_version=p_ruleset AND level=p_level AND operations_key=p_operations
    AND milestone=rule.milestone FOR UPDATE;
  old_credit:=COALESCE(old_credit,0);
  delta:=GREATEST(0,target-old_credit);
  INSERT INTO objective_record_candidate.credits
   (student_id,app_key,scope_epoch,ruleset_version,level,operations_key,milestone,credited)
  VALUES(p_student,p_app,sc,p_ruleset,p_level,p_operations,rule.milestone,old_credit+delta)
  ON CONFLICT(student_id,app_key,scope_epoch,ruleset_version,level,operations_key,milestone)
  DO UPDATE SET credited=EXCLUDED.credited;
  total_delta:=total_delta+delta;
  details:=details||jsonb_build_array(jsonb_build_object('milestone',rule.milestone,'delta',delta));
 END LOOP;
 IF matched<>required THEN RAISE EXCEPTION 'missing_record_rule';END IF;
 INSERT INTO objective_record_candidate.receipts(student_id,event_id,event_hash,xp_delta)
 VALUES(p_student,p_event,hash,total_delta);
 RETURN jsonb_build_object('ok',true,'duplicate',false,'xpDelta',total_delta,
  'milestones',details);
END $record$;

REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA objective_record_candidate FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA objective_record_candidate TO service_role;
COMMIT;
