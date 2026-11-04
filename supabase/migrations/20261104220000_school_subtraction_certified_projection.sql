-- Soustraction scolaire certifiée : nouvelles fonctions dédiées, données isolées.
-- Les copies natives, deux techniques, historiques, XP et trophées existants restent conservés.
-- AUCUNE carte de classe n'est activée par cette migration.
BEGIN;
-- The dedicated school multiplication CLASSIC proof is additive and never modifies an Addition function.
-- TEST subject is allowed for controlled, rollback-only acceptance tests.

-- Only callable by a validated arithmetic proof. Never expose this RPC to pupils.
-- Real-school private transaction, called solely by server-grader, NEVER by a browser.
-- Browser/native scores are excluded. Database also enforces school enrollment.
-- The INSERT/UPDATE trigger connect_trophy_capture_v1 inserts permanent cups.
CREATE OR REPLACE FUNCTION public.connect_objective_record_school_sub_record_classic_v1(
 p_student uuid,p_class uuid,p_app text,p_event uuid,p_expected_revision bigint,
 p_reset_epoch bigint,p_mode text,p_level integer,p_score integer,p_total integer
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $record$
DECLARE
 v_class constant uuid:=p_class;
 v_current public.connect_states%ROWTYPE;
 v_state jsonb;v_ids jsonb;v_recent jsonb;v_event jsonb;
 v_hash text;v_existing text;v_when timestamptz:=now();v_i int;
 v_previous int;v_points int;v_xp jsonb;v_day text;v_best_today int;v_rewards jsonb;
BEGIN
 IF (p_class IS NULL OR (public.connect_objective_record_school_class_allowed_v1(p_class) IS DISTINCT FROM true AND p_class <> '4bf3400d-a315-4ea4-a2f3-afaca24dc9b9'::uuid))
  OR p_app IS DISTINCT FROM 'soustraction-ecrite-simple'
  OR p_student IS NULL OR p_event IS NULL
  OR p_expected_revision IS NULL OR p_expected_revision<0
  OR p_reset_epoch IS NULL OR p_reset_epoch<0
  OR p_mode IS DISTINCT FROM 'classic' OR p_level NOT BETWEEN 1 AND 3
  OR p_score IS NULL OR p_score NOT BETWEEN 0 AND 1000
  OR (p_mode='classic' AND (p_total NOT IN (4,10,20) OR p_total IS NULL OR p_score>p_total))
  OR (p_mode='sudden' AND p_total IS NOT NULL)
 THEN RAISE EXCEPTION 'invalid_result';END IF;
 PERFORM 1 FROM public.connect_students WHERE id=p_student AND archived_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'inactive_student';END IF;
 -- Defence in depth: even service_role cannot submit a TEST-class award for
 -- a real-class pupil. Monsieur T is accepted only if the teacher is actually
 -- authorized in TEST and the pupil id is that teacher's explicit player.
 IF NOT EXISTS(
   SELECT 1 FROM public.connect_enrollments e
   WHERE e.student_id=p_student AND e.class_id=v_class AND e.left_at IS NULL
 ) AND NOT EXISTS(
   SELECT 1 FROM public.connect_teacher_players tp
   JOIN public.connect_class_permissions cp ON cp.teacher_id=tp.teacher_id
   WHERE tp.student_id=p_student AND cp.class_id=v_class AND cp.can_manage=true
 ) THEN RAISE EXCEPTION 'not_school_subject';END IF;
 v_hash:=pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
 jsonb_build_object('app',p_app,'class',p_class,'mode',p_mode,'level',p_level,
   'score',p_score,'total',p_total,'epoch',p_reset_epoch)::text,'UTF8')),'hex');
 SELECT event_hash INTO v_existing FROM public.connect_objective_record_school_receipts
  WHERE student_id=p_student AND app_key=p_app AND event_id=p_event;
 IF FOUND THEN
  IF v_existing<>v_hash THEN RAISE EXCEPTION 'event_collision';END IF;
  SELECT * INTO v_current FROM public.connect_states
   WHERE student_id=p_student AND app_key=p_app FOR UPDATE;
  v_xp:=public.connect_xp_read_v2(p_student,p_app,false);
  RETURN jsonb_build_object('ok',true,'duplicate',true,
   'revision',coalesce(v_current.revision,0),'resetEpoch',coalesce(v_current.reset_epoch,0),
   'state',coalesce(v_current.state_data,'{}'::jsonb),
   'xp',v_xp||jsonb_build_object('delta',0));
 END IF;
 INSERT INTO public.connect_states(student_id,app_key,schema_version,revision,reset_epoch,state_data)
 VALUES(p_student,p_app,1,0,0,'{}'::jsonb) ON CONFLICT DO NOTHING;
 SELECT * INTO STRICT v_current FROM public.connect_states
  WHERE student_id=p_student AND app_key=p_app FOR UPDATE;
 IF v_current.reset_epoch<>p_reset_epoch THEN RAISE EXCEPTION 'stale_reset_epoch';END IF;
 IF v_current.revision<>p_expected_revision THEN RAISE EXCEPTION 'revision_conflict';END IF;
 v_state:=coalesce(v_current.state_data,'{}'::jsonb);
 IF jsonb_typeof(v_state->'classic') IS DISTINCT FROM 'array'
 THEN v_state:=jsonb_set(v_state,'{classic}','[{}, {}, {}]'::jsonb,true);END IF;
 IF jsonb_typeof(v_state->'sudden') IS DISTINCT FROM 'array'
 THEN v_state:=jsonb_set(v_state,'{sudden}','[null,null,null]'::jsonb,true);END IF;
 IF jsonb_typeof(v_state->'progress') IS DISTINCT FROM 'object'
 THEN v_state:=jsonb_set(v_state,'{progress}','{}'::jsonb,true);END IF;
 v_i:=p_level-1;
 IF p_mode='classic' THEN
  v_previous:=coalesce((v_state#>>ARRAY['classic',v_i::text,p_total::text])::int,0);
  v_state:=jsonb_set(v_state,ARRAY['classic',v_i::text,p_total::text],
   to_jsonb(greatest(v_previous,p_score)),true);
  IF p_total>=10 AND p_score*5>=p_total*4 THEN
   v_state:=jsonb_set(v_state,ARRAY['progress','sudden'||p_level],to_jsonb(true),true);
   IF p_level=1 THEN v_state:=jsonb_set(v_state,'{progress,level2}',to_jsonb(true),true);END IF;
   IF p_level=2 THEN v_state:=jsonb_set(v_state,'{progress,level3}',to_jsonb(true),true);END IF;
  END IF;
  IF p_total>=10 AND p_score=p_total THEN
   v_state:=jsonb_set(v_state,ARRAY['progress','perfect'||p_level],to_jsonb(true),true);
  END IF;
  IF (v_state#>>'{progress,perfect1}')::boolean IS TRUE
   AND (v_state#>>'{progress,perfect2}')::boolean IS TRUE
   AND (v_state#>>'{progress,perfect3}')::boolean IS TRUE
  THEN v_state:=jsonb_set(v_state,'{progress,hard}',to_jsonb(true),true);END IF;
 ELSE
  v_previous:=coalesce((v_state#>>ARRAY['sudden',v_i::text])::int,0);
  v_state:=jsonb_set(v_state,ARRAY['sudden',v_i::text],
   to_jsonb(greatest(v_previous,p_score)),true);
 END IF;
 -- Soustraction : points natifs (indépendants des crédits XP).
 v_points:=round(5::numeric*p_score*(0.8::numeric+0.2*p_level)*
   CASE p_total WHEN 20 THEN 1.6::numeric WHEN 10 THEN 1.3::numeric ELSE 1::numeric END)::int;
 -- Import ALL trophies previously captured by the permanent registry (survives reset).
 -- No client-sent trophy fields or localStorage state can grant these awards.
 v_rewards:=coalesce(public.connect_trophy_rewards_v1(p_student,p_app),
 '{"version":3,"mastery":{"4":[false,false,false],"10":[false,false,false],"20":[false,false,false]},
 "sudden":[false,false,false],"hardAwards":{"bronze":[false,false,false],
 "silver":[false,false,false],"gold":[false,false,false]},
 "scoreOne":{"bronze":false,"silver":false,"gold":false},
 "unlockedGold":false}'::jsonb);
 IF p_mode='classic' AND p_score=p_total THEN
  v_rewards:=jsonb_set(v_rewards,ARRAY['mastery',p_total::text,v_i::text],'true'::jsonb,false);
 END IF;
 IF p_mode='sudden' AND p_score>=25 THEN
  v_rewards:=jsonb_set(v_rewards,ARRAY['sudden',v_i::text],'true'::jsonb,false);
 END IF;
 -- Single-session score cups. The 2x sudden score affects points only,
 -- never the XP awarded by connect_xp_sync_v2.
 IF v_points>=200 THEN v_rewards:=jsonb_set(v_rewards,'{scoreOne,bronze}','true'::jsonb,false);END IF;
 IF v_points>=400 THEN v_rewards:=jsonb_set(v_rewards,'{scoreOne,silver}','true'::jsonb,false);END IF;
 IF v_points>=600 THEN v_rewards:=jsonb_set(v_rewards,'{scoreOne,gold}','true'::jsonb,false);END IF;
 -- Hard trophies and unlockedGold are intentionally NOT awarded by these modes.
 v_state:=jsonb_set(v_state,'{rewards}',v_rewards,true);
 v_ids:=jsonb_build_array(p_event::text)||
  CASE WHEN jsonb_typeof(v_state->'ids')='array' THEN v_state->'ids' ELSE '[]'::jsonb END;
 SELECT coalesce(jsonb_agg(e.value ORDER BY e.ord),'[]'::jsonb) INTO v_ids
  FROM jsonb_array_elements(v_ids) WITH ORDINALITY AS e(value,ord) WHERE e.ord<=50;
 v_state:=jsonb_set(v_state,'{ids}',v_ids,true);
 v_event:=jsonb_build_object('eventId',p_event::text,'mode',p_mode,'level',p_level,
  'score',p_score,'total',p_total,'points',v_points,
  'at',to_char(v_when AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
 v_recent:=jsonb_build_array(v_event)||
  CASE WHEN jsonb_typeof(v_state->'recent')='array' THEN v_state->'recent' ELSE '[]'::jsonb END;
 SELECT coalesce(jsonb_agg(e.value ORDER BY e.ord),'[]'::jsonb) INTO v_recent
  FROM jsonb_array_elements(v_recent) WITH ORDINALITY AS e(value,ord) WHERE e.ord<=3;
 v_state:=jsonb_set(v_state,'{recent}',v_recent,true);
 v_state:=jsonb_set(v_state,'{bestPoints}',
  to_jsonb(greatest(coalesce((v_state->>'bestPoints')::int,0),v_points)),true);
 v_day:=(v_when AT TIME ZONE 'Europe/Brussels')::date::text;
 v_best_today:=CASE WHEN v_state#>>'{todayBest,day}'=v_day
  THEN coalesce((v_state#>>'{todayBest,points}')::int,0) ELSE 0 END;
 v_state:=jsonb_set(v_state,'{todayBest}',
  jsonb_build_object('day',v_day,'points',greatest(v_best_today,v_points)),true);
 INSERT INTO public.connect_objective_record_school_receipts(student_id,app_key,event_id,event_hash)
  VALUES(p_student,p_app,p_event,v_hash);
 UPDATE public.connect_states SET state_data=v_state,revision=v_current.revision+1,
  updated_at=v_when WHERE student_id=p_student AND app_key=p_app;
 -- One PostgreSQL transaction owns the receipt, state revision and official XP.
 v_xp:=public.connect_xp_sync_v2(p_student,p_app,false);
 RETURN jsonb_build_object('ok',true,'duplicate',false,'revision',v_current.revision+1,
  'resetEpoch',v_current.reset_epoch,'state',v_state,'xp',v_xp);
END $record$;

-- Newly defined SCHOOL function has no inherited privileges: explicitly revoke
-- the PostgreSQL default PUBLIC EXECUTE and grant only the trusted Edge service.
REVOKE ALL ON FUNCTION public.connect_objective_record_school_sub_record_classic_v1(
 uuid,uuid,text,uuid,bigint,bigint,text,integer,integer,integer)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.connect_objective_record_school_sub_record_classic_v1(
 uuid,uuid,text,uuid,bigint,bigint,text,integer,integer,integer)
 TO service_role;




-- Aucune paire de nombres ne provient du navigateur : le serveur émet les calculs.
CREATE OR REPLACE FUNCTION public.connect_objective_record_school_sub_issue_classic_v1(
 p_student uuid,p_class uuid,p_level integer,p_total integer,p_method text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $issue$
DECLARE
 v_app constant text:='soustraction-ecrite-simple';
 v_rev bigint;v_epoch bigint;v_existing record;
 v_questions jsonb:='[]'::jsonb;v_a numeric;v_b numeric;v_i integer;
 v_width integer;v_len integer;v_base numeric;
 v_id uuid;v_expires timestamptz;
BEGIN
 IF p_student IS NULL OR p_class IS NULL OR
    (p_class <> '4bf3400d-a315-4ea4-a2f3-afaca24dc9b9'::uuid
      AND public.connect_objective_record_school_class_allowed_v1(p_class) IS DISTINCT FROM true)
 THEN RAISE EXCEPTION 'school_class_not_allowed';END IF;
 IF p_level NOT IN (1,2,3) OR p_total NOT IN (4,10,20)
  OR p_level IS NULL OR p_total IS NULL OR p_method NOT IN ('addBottom','takeTop')
  OR p_method IS NULL
 THEN RAISE EXCEPTION 'invalid_proof_configuration';END IF;
 PERFORM 1 FROM public.connect_students WHERE id=p_student AND archived_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'inactive_student';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.connect_enrollments e
   WHERE e.student_id=p_student AND e.class_id=p_class AND e.left_at IS NULL)
 AND NOT EXISTS(SELECT 1 FROM public.connect_teacher_players tp
   JOIN public.connect_class_permissions cp ON cp.teacher_id=tp.teacher_id
   WHERE tp.student_id=p_student AND cp.class_id=p_class AND cp.can_manage=true)
 THEN RAISE EXCEPTION 'not_school_subject';END IF;
 SELECT coalesce(revision,0),coalesce(reset_epoch,0) INTO v_rev,v_epoch
 FROM public.connect_states WHERE student_id=p_student AND app_key=v_app;
 v_rev:=coalesce(v_rev,0);v_epoch:=coalesce(v_epoch,0);
 SELECT * INTO v_existing FROM public.connect_objective_record_school_proof_sessions
 WHERE student_id=p_student AND class_id=p_class AND app_key=v_app
  AND expected_revision=v_rev AND reset_epoch=v_epoch AND level=p_level AND total=p_total
  AND consumed_at IS NULL AND expires_at>now()
  AND (questions->0->>'method')=p_method
 ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
 IF FOUND THEN RETURN jsonb_build_object('ok',true,'sessionId',v_existing.session_id,
    'revision',v_rev,'resetEpoch',v_epoch,'level',p_level,'total',p_total,
    'method',p_method,'questions',v_existing.questions,
    'expiresAt',v_existing.expires_at,'reused',true);END IF;
 v_width:=CASE p_level WHEN 1 THEN 3 WHEN 2 THEN 5 ELSE 7 END;
 FOR v_i IN 1..p_total LOOP
  v_len:=v_width-CASE WHEN random()<0.15 THEN 1 ELSE 0 END;
  v_base:=power(10::numeric,v_len-1);
  v_a:=v_base+floor(random()*9*v_base);
  v_b:=greatest(1,floor(random()*v_a));
  v_questions:=v_questions||jsonb_build_array(jsonb_build_object(
    'id','q'||v_i,'op','sub','a',v_a::text,'b',v_b::text,
    'method',p_method,'width',v_len));
 END LOOP;
 INSERT INTO public.connect_objective_record_school_proof_sessions(
 student_id,class_id,app_key,expected_revision,reset_epoch,level,total,questions,expires_at)
 VALUES(p_student,p_class,v_app,v_rev,v_epoch,p_level,p_total,v_questions,now()+interval '90 minutes')
 RETURNING session_id,expires_at INTO v_id,v_expires;
 RETURN jsonb_build_object('ok',true,'sessionId',v_id,'revision',v_rev,
  'resetEpoch',v_epoch,'level',p_level,'total',p_total,
  'method',p_method,'questions',v_questions,'expiresAt',v_expires,'reused',false);
END $issue$;
REVOKE ALL ON FUNCTION public.connect_objective_record_school_sub_issue_classic_v1(uuid,uuid,integer,integer,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.connect_objective_record_school_sub_issue_classic_v1(uuid,uuid,integer,integer,text) TO service_role;

CREATE OR REPLACE FUNCTION public.connect_objective_record_school_sub_finish_classic_v1(
 p_student uuid,p_class uuid,p_session uuid,p_answers jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $finish$
DECLARE
 v_app constant text:='soustraction-ecrite-simple';
 v_s public.connect_objective_record_school_proof_sessions%ROWTYPE;
 v_q jsonb;v_ans jsonb;v_i integer;v_a numeric;v_b numeric;
 v_correct integer:=0;v_hash text;v_ack jsonb;v_width integer;
BEGIN
 IF p_student IS NULL OR p_class IS NULL OR p_session IS NULL
  OR (p_class <> '4bf3400d-a315-4ea4-a2f3-afaca24dc9b9'::uuid
    AND public.connect_objective_record_school_class_allowed_v1(p_class) IS DISTINCT FROM true)
  OR jsonb_typeof(p_answers) IS DISTINCT FROM 'array'
  OR jsonb_array_length(p_answers) NOT IN (4,10,20)
 THEN RAISE EXCEPTION 'invalid_proof_answers';END IF;
 PERFORM 1 FROM public.connect_students WHERE id=p_student AND archived_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'inactive_student';END IF;
 SELECT * INTO v_s FROM public.connect_objective_record_school_proof_sessions
 WHERE session_id=p_session AND student_id=p_student AND class_id=p_class AND app_key=v_app FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'proof_not_found';END IF;
 IF v_s.total<>jsonb_array_length(p_answers) OR v_s.level NOT IN (1,2,3)
  OR jsonb_array_length(v_s.questions)<>v_s.total
 THEN RAISE EXCEPTION 'invalid_proof_answers';END IF;
 v_hash:=pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_answers::text,'UTF8')),'hex');
 IF v_s.consumed_at IS NOT NULL THEN
  IF v_s.answers_hash<>v_hash THEN RAISE EXCEPTION 'proof_replay_collision';END IF;
  RETURN v_s.result||jsonb_build_object('duplicate',true,
   'xp',v_s.result->'xp'||jsonb_build_object('delta',0));END IF;
 IF v_s.expires_at<=now() THEN RAISE EXCEPTION 'proof_expired';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.connect_enrollments e
   WHERE e.student_id=p_student AND e.class_id=p_class AND e.left_at IS NULL)
 AND NOT EXISTS(SELECT 1 FROM public.connect_teacher_players tp
   JOIN public.connect_class_permissions cp ON cp.teacher_id=tp.teacher_id
   WHERE tp.student_id=p_student AND cp.class_id=p_class AND cp.can_manage=true)
 THEN RAISE EXCEPTION 'not_school_subject';END IF;
 FOR v_i IN 0..v_s.total-1 LOOP
  v_q:=v_s.questions->v_i;v_ans:=p_answers->v_i;
  IF jsonb_typeof(v_ans) IS DISTINCT FROM 'object'
    OR (SELECT count(*) FROM jsonb_object_keys(v_ans))<>2
    OR NOT(v_ans ? 'id' AND v_ans ? 'answer')
    OR v_ans->>'id' IS DISTINCT FROM v_q->>'id'
    OR jsonb_typeof(v_ans->'answer') IS DISTINCT FROM 'string'
    OR (v_ans->>'answer') !~ '^[0-9]{1,16}$'
    OR v_q->>'op' IS DISTINCT FROM 'sub'
    OR v_q->>'method' NOT IN ('addBottom','takeTop')
    OR (v_q->>'a') !~ '^[1-9][0-9]{1,6}$'
    OR (v_q->>'b') !~ '^[1-9][0-9]{0,6}$'
  THEN RAISE EXCEPTION 'invalid_proof_answers';END IF;
  v_a:=(v_q->>'a')::numeric;v_b:=(v_q->>'b')::numeric;
  v_width:=length(v_q->>'a');
  IF v_b>v_a OR v_b<=0 OR v_q->>'width' IS DISTINCT FROM v_width::text
   OR v_width NOT BETWEEN (CASE v_s.level WHEN 1 THEN 2 WHEN 2 THEN 4 ELSE 6 END)
                   AND (CASE v_s.level WHEN 1 THEN 3 WHEN 2 THEN 5 ELSE 7 END)
  THEN RAISE EXCEPTION 'invalid_proof_answers';END IF;
  IF (v_ans->>'answer')::numeric = v_a-v_b THEN v_correct:=v_correct+1;END IF;
 END LOOP;
 v_ack:=public.connect_objective_record_school_sub_record_classic_v1(
   p_student,p_class,v_app,p_session,v_s.expected_revision,v_s.reset_epoch,
   'classic',v_s.level,v_correct,v_s.total);
 UPDATE public.connect_objective_record_school_proof_sessions
 SET consumed_at=now(),answers_hash=v_hash,
  result=v_ack||jsonb_build_object('proofVerified',true,'verifiedScore',v_correct)
 WHERE session_id=p_session;
 RETURN v_ack||jsonb_build_object('proofVerified',true,'verifiedScore',v_correct);
END $finish$;
REVOKE ALL ON FUNCTION public.connect_objective_record_school_sub_finish_classic_v1(uuid,uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.connect_objective_record_school_sub_finish_classic_v1(uuid,uuid,uuid,jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.connect_objective_record_school_sub_record_extended_v1(p_student uuid, p_class uuid, p_app text, p_event uuid, p_expected_revision bigint, p_reset_epoch bigint, p_mode text, p_level integer, p_score integer, p_attempted integer, p_hash text, p_method text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
 v_row public.connect_states%ROWTYPE;
 v_state jsonb;v_rewards jsonb;v_i text:=(p_level-1)::text;
 v_shared text;v_mode_key text;
 v_previous integer;v_points integer;v_xp jsonb;
 v_event jsonb;v_ids jsonb;v_recent jsonb;v_when timestamptz:=now();
 v_day text;v_best_today integer;v_weight numeric;
BEGIN
 IF p_student IS NULL OR p_class IS NULL OR p_event IS NULL
  OR (public.connect_objective_record_school_class_allowed_v1(p_class) IS DISTINCT FROM true AND p_class <> '4bf3400d-a315-4ea4-a2f3-afaca24dc9b9'::uuid)
  OR p_app IS DISTINCT FROM 'soustraction-ecrite-simple' OR p_app IS NULL
  OR p_mode NOT IN ('sudden','three-lives','hard-sudden','hard-three-lives') OR p_mode IS NULL
  OR p_level NOT BETWEEN 1 AND 3 OR p_level IS NULL
  OR p_score IS NULL OR p_score<0 OR p_score>120
  OR p_attempted IS NULL OR p_attempted NOT BETWEEN 1 AND 120 OR p_score>p_attempted
  OR p_expected_revision IS NULL OR p_expected_revision<0
  OR p_reset_epoch IS NULL OR p_reset_epoch<0
  OR p_hash IS NULL OR length(p_hash)<>64
  OR p_method NOT IN ('addBottom','takeTop') OR p_method IS NULL
 THEN RAISE EXCEPTION 'invalid_result';END IF;
 PERFORM 1 FROM public.connect_students WHERE id=p_student AND archived_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'inactive_student';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.connect_enrollments
     WHERE student_id=p_student AND class_id=p_class AND left_at IS NULL)
  AND NOT EXISTS(SELECT 1 FROM public.connect_teacher_players tp
     JOIN public.connect_class_permissions cp ON cp.teacher_id=tp.teacher_id
     WHERE tp.student_id=p_student AND cp.class_id=p_class AND cp.can_manage=true)
 THEN RAISE EXCEPTION 'not_school_subject';END IF;
 INSERT INTO public.connect_states(student_id,app_key,schema_version,revision,reset_epoch,state_data)
 VALUES(p_student,p_app,1,0,0,'{}'::jsonb) ON CONFLICT DO NOTHING;
 SELECT * INTO STRICT v_row FROM public.connect_states
 WHERE student_id=p_student AND app_key=p_app FOR UPDATE;
 IF v_row.reset_epoch<>p_reset_epoch THEN RAISE EXCEPTION 'stale_reset_epoch';END IF;
 IF EXISTS(SELECT 1 FROM public.connect_objective_record_school_receipts
    WHERE student_id=p_student AND app_key=p_app AND event_id=p_event)
 THEN RAISE EXCEPTION 'proof_replay_collision';END IF;
 IF v_row.revision<>p_expected_revision THEN RAISE EXCEPTION 'revision_conflict';END IF;
 v_state:=coalesce(v_row.state_data,'{}'::jsonb);
 IF jsonb_typeof(v_state->'sudden') IS DISTINCT FROM 'array'
 THEN v_state:=jsonb_set(v_state,'{sudden}','[0,0,0]'::jsonb,true);END IF;
 IF jsonb_typeof(v_state->'hard') IS DISTINCT FROM 'array'
 THEN v_state:=jsonb_set(v_state,'{hard}','[0,0,0]'::jsonb,true);END IF;
 IF jsonb_typeof(v_state->'threeLives') IS DISTINCT FROM 'array'
 THEN v_state:=jsonb_set(v_state,'{threeLives}','[0,0,0]'::jsonb,true);END IF;
 IF jsonb_typeof(v_state->'hardThreeLives') IS DISTINCT FROM 'array'
 THEN v_state:=jsonb_set(v_state,'{hardThreeLives}','[0,0,0]'::jsonb,true);END IF;
 v_shared:=CASE WHEN p_mode LIKE 'hard-%' THEN 'hard' ELSE 'sudden' END;
 v_mode_key:=CASE p_mode WHEN 'three-lives' THEN 'threeLives'
   WHEN 'hard-three-lives' THEN 'hardThreeLives' ELSE v_shared END;
 v_previous:=coalesce((v_state#>>ARRAY[v_mode_key,v_i])::integer,0);
 v_state:=jsonb_set(v_state,ARRAY[v_mode_key,v_i],
   to_jsonb(greatest(v_previous,p_score)),true);
 -- Preserve best threshold evidence independently of the chosen mode.
 -- 3 vies : paliers propres, ne pas gonfler le score Mort subite.
 -- Points propres à Soustraction, distincts des XP et calculés sur la preuve.
 SELECT COALESCE(SUM(LEAST(4::numeric,power(1.035::numeric,k))),0)
   INTO v_weight FROM generate_series(0,p_score-1) AS k;
 v_points:=round(5::numeric *
  CASE WHEN p_mode LIKE 'hard-%' THEN 1.4::numeric+0.2*p_level ELSE 0.8::numeric+0.2*p_level END *
  CASE WHEN p_mode IN ('sudden','hard-sudden') THEN 1.6::numeric ELSE 1::numeric END *
  CASE WHEN p_mode IN ('sudden','hard-sudden') THEN v_weight ELSE p_score::numeric END)::integer;
 -- Read the permanent ledger, not ephemeral local browser trophy claims.
 v_rewards:=coalesce(public.connect_trophy_rewards_v1(p_student,p_app),
  '{"version":3,"mastery":{"4":[false,false,false],"10":[false,false,false],"20":[false,false,false]},"sudden":[false,false,false],"hardAwards":{"bronze":[false,false,false],"silver":[false,false,false],"gold":[false,false,false]},"scoreOne":{"bronze":false,"silver":false,"gold":false},"unlockedGold":false}'::jsonb);
 IF p_mode='sudden' AND p_score>=25 THEN
  v_rewards:=jsonb_set(v_rewards,ARRAY['sudden',v_i],'true'::jsonb,false);
 END IF;
 IF p_mode='hard-sudden' THEN
  IF p_score>=3 THEN v_rewards:=jsonb_set(v_rewards,ARRAY['hardAwards','bronze',v_i],'true'::jsonb,false);END IF;
  IF p_score>=5 THEN v_rewards:=jsonb_set(v_rewards,ARRAY['hardAwards','silver',v_i],'true'::jsonb,false);END IF;
  IF p_score>=10 THEN v_rewards:=jsonb_set(v_rewards,ARRAY['hardAwards','gold',v_i],'true'::jsonb,false);END IF;
 END IF;
 IF v_points>=200 THEN v_rewards:=jsonb_set(v_rewards,'{scoreOne,bronze}','true'::jsonb,false);END IF;
 IF v_points>=400 THEN v_rewards:=jsonb_set(v_rewards,'{scoreOne,silver}','true'::jsonb,false);END IF;
 IF v_points>=600 THEN v_rewards:=jsonb_set(v_rewards,'{scoreOne,gold}','true'::jsonb,false);END IF;
 -- Le Platine natif reste déduit des 19 coupes, sans nouveau jeton arbitraire.
 -- Le déblocage complet est strictement issu de la progression serveur :
 -- 3 niveaux classiques parfaits + HARD 1 et 2 (au moins trois réussites).
 IF coalesce((v_state#>>'{progress,hard}')::boolean,false)
   AND coalesce((v_state#>>'{hard,0}')::integer,0)>=3
   AND coalesce((v_state#>>'{hard,1}')::integer,0)>=3
 THEN v_rewards:=jsonb_set(v_rewards,'{unlockedGold}','true'::jsonb,false);
 END IF;
 IF p_mode='sudden' THEN
  IF jsonb_typeof(v_state->'suddenMethods') IS DISTINCT FROM 'object'
  THEN v_state:=jsonb_set(v_state,'{suddenMethods}','{}'::jsonb,true);END IF;
  IF jsonb_typeof(v_state#>ARRAY['suddenMethods',p_method]) IS DISTINCT FROM 'array'
  THEN v_state:=jsonb_set(v_state,ARRAY['suddenMethods',p_method],'[0,0,0]'::jsonb,true);END IF;
  v_previous:=coalesce((v_state#>>ARRAY['suddenMethods',p_method,v_i])::integer,0);
  v_state:=jsonb_set(v_state,ARRAY['suddenMethods',p_method,v_i],
    to_jsonb(greatest(v_previous,p_score)),true);
 END IF;
 v_state:=jsonb_set(v_state,'{rewards}',v_rewards,true);
 v_ids:=jsonb_build_array(p_event::text)||
  CASE WHEN jsonb_typeof(v_state->'ids')='array' THEN v_state->'ids' ELSE '[]'::jsonb END;
 SELECT coalesce(jsonb_agg(value ORDER BY ord),'[]'::jsonb) INTO v_ids
 FROM jsonb_array_elements(v_ids) WITH ORDINALITY AS item(value,ord) WHERE ord<=50;
 v_state:=jsonb_set(v_state,'{ids}',v_ids,true);
 v_event:=jsonb_build_object('eventId',p_event::text,'mode',p_mode,'level',p_level,
  'score',p_score,'total',NULL,'points',v_points,
  'at',to_char(v_when AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
 v_recent:=jsonb_build_array(v_event)||
  CASE WHEN jsonb_typeof(v_state->'recent')='array' THEN v_state->'recent' ELSE '[]'::jsonb END;
 SELECT coalesce(jsonb_agg(value ORDER BY ord),'[]'::jsonb) INTO v_recent
 FROM jsonb_array_elements(v_recent) WITH ORDINALITY AS item(value,ord) WHERE ord<=3;
 v_state:=jsonb_set(v_state,'{recent}',v_recent,true);
 v_state:=jsonb_set(v_state,'{bestPoints}',
  to_jsonb(greatest(coalesce((v_state->>'bestPoints')::integer,0),v_points)),true);
 v_day:=(v_when AT TIME ZONE 'Europe/Brussels')::date::text;
 v_best_today:=CASE WHEN v_state#>>'{todayBest,day}'=v_day
 THEN coalesce((v_state#>>'{todayBest,points}')::integer,0) ELSE 0 END;
 v_state:=jsonb_set(v_state,'{todayBest}',
  jsonb_build_object('day',v_day,'points',greatest(v_best_today,v_points)),true);
 INSERT INTO public.connect_objective_record_school_receipts(student_id,app_key,event_id,event_hash)
 VALUES(p_student,p_app,p_event,p_hash);
 UPDATE public.connect_states SET state_data=v_state,revision=v_row.revision+1,
  updated_at=v_when WHERE student_id=p_student AND app_key=p_app;
 v_xp:=public.connect_xp_sync_v2(p_student,p_app,false);
 RETURN jsonb_build_object('ok',true,'duplicate',false,'proofVerified',true,
   'verifiedScore',p_score,'attempted',p_attempted,'mode',p_mode,
   'revision',v_row.revision+1,'resetEpoch',v_row.reset_epoch,
   'state',v_state,'xp',v_xp);
END $function$;



CREATE OR REPLACE FUNCTION public.connect_objective_record_school_sub_issue_extended_v1(
 p_student uuid,p_class uuid,p_mode text,p_level integer,p_method text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $issue$
DECLARE
 v_app constant text:='soustraction-ecrite-simple';
 v_total constant integer:=120;
 v_rev bigint;v_epoch bigint;v_existing record;
 v_questions jsonb:='[]'::jsonb;v_a numeric;v_b numeric;v_i integer;
 v_width integer;v_len integer;v_base numeric;
 v_id uuid;v_expires timestamptz;v_state jsonb;
BEGIN
 IF p_student IS NULL OR p_class IS NULL OR
    (p_class <> '4bf3400d-a315-4ea4-a2f3-afaca24dc9b9'::uuid
     AND public.connect_objective_record_school_class_allowed_v1(p_class) IS DISTINCT FROM true)
 THEN RAISE EXCEPTION 'school_class_not_allowed';END IF;
 IF p_mode NOT IN ('three-lives','sudden','hard-three-lives','hard-sudden')
  OR p_mode IS NULL OR p_level NOT IN (1,2,3) OR p_level IS NULL
  OR p_method NOT IN ('addBottom','takeTop') OR p_method IS NULL
 THEN RAISE EXCEPTION 'invalid_proof_configuration';END IF;
 PERFORM 1 FROM public.connect_students WHERE id=p_student AND archived_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'inactive_student';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.connect_enrollments e
   WHERE e.student_id=p_student AND e.class_id=p_class AND e.left_at IS NULL)
 AND NOT EXISTS(SELECT 1 FROM public.connect_teacher_players tp
   JOIN public.connect_class_permissions cp ON cp.teacher_id=tp.teacher_id
   WHERE tp.student_id=p_student AND cp.class_id=p_class AND cp.can_manage=true)
 THEN RAISE EXCEPTION 'not_school_subject';END IF;
 SELECT coalesce(revision,0),coalesce(reset_epoch,0),state_data INTO v_rev,v_epoch,v_state
 FROM public.connect_states WHERE student_id=p_student AND app_key=v_app;
 v_rev:=coalesce(v_rev,0);v_epoch:=coalesce(v_epoch,0);
 v_state:=coalesce(v_state,'{}'::jsonb);
 IF p_class <> '4bf3400d-a315-4ea4-a2f3-afaca24dc9b9'::uuid THEN
  IF p_mode LIKE 'hard-%' THEN
   IF (v_state#>>'{progress,hard}')::boolean IS DISTINCT FROM true
   THEN RAISE EXCEPTION 'school_mode_locked';END IF;
  ELSE
   IF (v_state#>>ARRAY['progress','sudden'||p_level])::boolean IS DISTINCT FROM true
   THEN RAISE EXCEPTION 'school_mode_locked';END IF;
  END IF;
 END IF;
 SELECT * INTO v_existing FROM public.connect_objective_record_school_extended_sessions
 WHERE student_id=p_student AND class_id=p_class AND app_key=v_app
  AND mode=p_mode AND level=p_level AND consumed_at IS NULL
  AND expected_revision=v_rev AND reset_epoch=v_epoch AND expires_at>now()
  AND (questions->0->>'method')=p_method
 ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
 IF FOUND THEN RETURN jsonb_build_object('ok',true,'sessionId',v_existing.session_id,
   'questions',v_existing.questions,'level',p_level,'width',v_existing.width,
   'mode',p_mode,'method',p_method,'limit',v_total,'revision',v_rev,'resetEpoch',v_epoch,
   'expiresAt',v_existing.expires_at,'reused',true);END IF;
 v_width:=CASE WHEN p_mode LIKE 'hard-%' THEN
  CASE p_level WHEN 1 THEN 10 WHEN 2 THEN 12 ELSE 16 END
 ELSE CASE p_level WHEN 1 THEN 3 WHEN 2 THEN 5 ELSE 7 END END;
 FOR v_i IN 1..v_total LOOP
  v_len:=v_width-CASE WHEN random()<0.15 THEN 1 ELSE 0 END;
  v_base:=power(10::numeric,v_len-1);
  v_a:=v_base+floor(random()*9*v_base);
  v_b:=greatest(1,floor(random()*v_a));
  v_questions:=v_questions||jsonb_build_array(jsonb_build_object(
    'id','q'||v_i,'op','sub','a',v_a::text,'b',v_b::text,
    'method',p_method,'width',v_len));
 END LOOP;
 INSERT INTO public.connect_objective_record_school_extended_sessions(
 student_id,class_id,app_key,mode,level,width,total,expected_revision,
 reset_epoch,questions,expires_at)
 VALUES(p_student,p_class,v_app,p_mode,p_level,v_width,v_total,v_rev,
  v_epoch,v_questions,now()+interval '8 hours')
 RETURNING session_id,expires_at INTO v_id,v_expires;
 RETURN jsonb_build_object('ok',true,'sessionId',v_id,'questions',v_questions,
  'level',p_level,'width',v_width,'mode',p_mode,'method',p_method,'limit',v_total,
  'revision',v_rev,'resetEpoch',v_epoch,'expiresAt',v_expires,'reused',false);
END $issue$;
REVOKE ALL ON FUNCTION public.connect_objective_record_school_sub_issue_extended_v1(uuid,uuid,text,integer,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.connect_objective_record_school_sub_issue_extended_v1(uuid,uuid,text,integer,text) TO service_role;

CREATE OR REPLACE FUNCTION public.connect_objective_record_school_sub_finish_extended_v1(
 p_student uuid,p_class uuid,p_session uuid,p_answers jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $finish$
DECLARE
 v_app constant text:='soustraction-ecrite-simple';
 v_s public.connect_objective_record_school_extended_sessions%ROWTYPE;
 v_q jsonb;v_ans jsonb;v_i integer;v_a numeric;v_b numeric;
 v_score integer:=0;v_errors integer:=0;v_lives integer;v_count integer;
 v_hash text;v_ack jsonb;v_width integer;
BEGIN
 IF p_student IS NULL OR p_class IS NULL OR p_session IS NULL
  OR (p_class <> '4bf3400d-a315-4ea4-a2f3-afaca24dc9b9'::uuid
    AND public.connect_objective_record_school_class_allowed_v1(p_class) IS DISTINCT FROM true)
  OR jsonb_typeof(p_answers) IS DISTINCT FROM 'array'
  OR jsonb_array_length(p_answers) NOT BETWEEN 1 AND 120
 THEN RAISE EXCEPTION 'invalid_proof_answers';END IF;
 PERFORM 1 FROM public.connect_students WHERE id=p_student AND archived_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'inactive_student';END IF;
 SELECT * INTO v_s FROM public.connect_objective_record_school_extended_sessions
 WHERE session_id=p_session AND student_id=p_student AND class_id=p_class AND app_key=v_app FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'proof_not_found';END IF;
 v_count:=jsonb_array_length(p_answers);
 v_hash:=pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_answers::text,'UTF8')),'hex');
 IF v_s.consumed_at IS NOT NULL THEN
  IF v_s.answers_hash<>v_hash THEN RAISE EXCEPTION 'proof_replay_collision';END IF;
  RETURN v_s.result||jsonb_build_object('duplicate',true,
   'xp',v_s.result->'xp'||jsonb_build_object('delta',0));END IF;
 IF v_s.expires_at<=now() THEN RAISE EXCEPTION 'proof_expired';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.connect_enrollments e
   WHERE e.student_id=p_student AND e.class_id=p_class AND e.left_at IS NULL)
 AND NOT EXISTS(SELECT 1 FROM public.connect_teacher_players tp
   JOIN public.connect_class_permissions cp ON cp.teacher_id=tp.teacher_id
   WHERE tp.student_id=p_student AND cp.class_id=p_class AND cp.can_manage=true)
 THEN RAISE EXCEPTION 'not_school_subject';END IF;
 IF v_s.total<>120 OR jsonb_array_length(v_s.questions)<>120
  OR v_s.level NOT BETWEEN 1 AND 3 OR v_s.mode NOT IN ('sudden','three-lives','hard-sudden','hard-three-lives')
  OR v_s.width NOT IN (3,5,7,10,12,16)
 THEN RAISE EXCEPTION 'invalid_proof_configuration';END IF;
 v_lives:=CASE WHEN v_s.mode LIKE '%three-lives' THEN 3 ELSE 1 END;
 FOR v_i IN 0..v_count-1 LOOP
  IF v_errors>=v_lives THEN RAISE EXCEPTION 'proof_continued_after_end';END IF;
  v_q:=v_s.questions->v_i;v_ans:=p_answers->v_i;
  IF jsonb_typeof(v_ans) IS DISTINCT FROM 'object'
    OR (SELECT count(*) FROM jsonb_object_keys(v_ans))<>2
    OR NOT(v_ans ? 'id' AND v_ans ? 'answer')
    OR v_ans->>'id' IS DISTINCT FROM v_q->>'id'
    OR jsonb_typeof(v_ans->'answer') IS DISTINCT FROM 'string'
    OR (v_ans->>'answer') !~ '^[0-9]{1,16}$'
    OR v_q->>'op' IS DISTINCT FROM 'sub'
    OR v_q->>'method' NOT IN ('addBottom','takeTop')
    OR (v_q->>'a') !~ '^[1-9][0-9]{1,15}$'
    OR (v_q->>'b') !~ '^[1-9][0-9]{0,15}$'
  THEN RAISE EXCEPTION 'invalid_proof_answers';END IF;
  v_a:=(v_q->>'a')::numeric;v_b:=(v_q->>'b')::numeric;
  v_width:=length(v_q->>'a');
  IF v_b<=0 OR v_b>v_a OR v_q->>'width' IS DISTINCT FROM v_width::text
   OR v_width NOT BETWEEN v_s.width-1 AND v_s.width
  THEN RAISE EXCEPTION 'invalid_proof_answers';END IF;
  IF (v_ans->>'answer')::numeric=v_a-v_b THEN v_score:=v_score+1;
  ELSE v_errors:=v_errors+1;END IF;
 END LOOP;
 IF v_count<120 AND v_errors<>v_lives THEN RAISE EXCEPTION 'proof_incomplete_game';END IF;
 v_ack:=public.connect_objective_record_school_sub_record_extended_v1(
  p_student,p_class,v_app,p_session,v_s.expected_revision,v_s.reset_epoch,
  v_s.mode,v_s.level,v_score,v_count,v_hash,v_s.questions->0->>'method');
 UPDATE public.connect_objective_record_school_extended_sessions
 SET consumed_at=now(),answers_hash=v_hash,result=v_ack WHERE session_id=p_session;
 RETURN v_ack;
END $finish$;
REVOKE ALL ON FUNCTION public.connect_objective_record_school_sub_finish_extended_v1(uuid,uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.connect_objective_record_school_sub_finish_extended_v1(uuid,uuid,uuid,jsonb) TO service_role;


-- Conserver tous les paliers historiques; 3 vies gagne une moitié sans l'autre.
INSERT INTO public.connect_xp_award_rules(app_key,award_key,points,ruleset_version)
SELECT 'soustraction-ecrite-simple',r.award_key,r.points,r.ruleset_version
FROM public.connect_xp_award_rules r
WHERE r.app_key='addition-ecrite-simple'
 AND r.award_key IN ('sudden:5:half','sudden:5:complement','sudden:10:half','sudden:10:complement',
  'hard:3:half','hard:3:complement','hard:7:half','hard:7:complement')
ON CONFLICT(app_key,award_key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.connect_xp_sync_v2(p_student uuid, p_app text, p_force boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare s jsonb; i int; n int; score int; best int; k text; added int:=0; beforexp int:=0; afterxp int:=0; totalxp int:=0; levelnow int; priorlevel int:=1; rulesversion int:=2; replay int:=1; repeated boolean:=false; rec record; earned boolean; bonusxp int:=0; replay_started timestamptz; milestone_full text; milestone_half text; milestone_extra text;
begin
 if p_app NOT IN ('addition-ecrite-simple','multiplication-ecrite-simple','soustraction-ecrite-simple','addition-ecrite-multiple') then raise exception 'not_integrated';end if;
 perform 1 from public.connect_students where id=p_student and archived_at is null for update;
 if not found then raise exception 'inactive_student';end if;
 select coalesce(state_data,'{}'::jsonb) into s from public.connect_states where student_id=p_student and app_key=p_app;
 s:=coalesce(s,'{}'::jsonb);
 select coalesce(xp_credited,0) into beforexp from public.connect_xp_credits where student_id=p_student and app_key=p_app;
 beforexp:=coalesce(beforexp,0);
 select parcours_number,repeat_xp,started_at into replay,repeated,replay_started from public.connect_parcours_current where student_id=p_student and app_key=p_app;
 replay:=coalesce(replay,1);repeated:=coalesce(repeated,false);
 for i in 0..2 loop
  for n in select unnest(array[4,10,20]) loop
   score=coalesce((s#>>array['classic',i::text,n::text])::int,-1);
   if n=4 and score=4 then
    k='classic:'||(i+1)||':4:perfect';
    insert into public.connect_xp_milestones(student_id,app_key,milestone_key,evidence) values(p_student,p_app,k,jsonb_build_object('source','record','score',score)) on conflict do nothing;
   elsif n in (10,20) then
    if score*5>=n*4 then
     k='classic:'||(i+1)||':'||n||':pass';
     insert into public.connect_xp_milestones(student_id,app_key,milestone_key,evidence) values(p_student,p_app,k,jsonb_build_object('source','record','score',score)) on conflict do nothing;
    end if;
    if score=n then
     k='classic:'||(i+1)||':'||n||':bonus';
     insert into public.connect_xp_milestones(student_id,app_key,milestone_key,evidence) values(p_student,p_app,k,jsonb_build_object('source','record','score',score)) on conflict do nothing;
    end if;
   end if;
  end loop;
  if p_app in ('addition-ecrite-simple','addition-ecrite-multiple','multiplication-ecrite-simple','soustraction-ecrite-simple') then
  -- A 3-vies proof earns 5 XP for each survival tier; a genuine
  -- Mort subite proof can complete the same tier to 10 XP total.
  -- Historical full milestones remain untouched and fully credited.
  for rec in select mode_name, thresholds from
    (values ('sudden',array[5,10]),('hard',array[3,7])) AS modes(mode_name,thresholds)
  loop
   score:=coalesce((s#>>array[rec.mode_name,i::text])::int,0);
   best:=coalesce((s#>>array[case when rec.mode_name='sudden' then 'threeLives' when p_app='soustraction-ecrite-simple' then 'hardThreeLives' else 'hardThree' end,i::text])::int,0);
   for n in select unnest(rec.thresholds) loop
    milestone_full:=rec.mode_name||':'||(i+1)||':'||n;
    milestone_half:=milestone_full||':half';
    milestone_extra:=milestone_full||':complement';
    if score>=n then
     if not exists(select 1 from public.connect_xp_milestones
        where student_id=p_student and app_key=p_app and milestone_key=milestone_full) then
      k:=case when exists(select 1 from public.connect_xp_milestones
        where student_id=p_student and app_key=p_app and milestone_key=milestone_half)
        then milestone_extra else milestone_full end;
      insert into public.connect_xp_milestones(student_id,app_key,milestone_key,evidence)
        values(p_student,p_app,k,jsonb_build_object('source','record','mode',rec.mode_name,'score',score))
        on conflict do nothing;
     end if;
    elsif best>=n then
     if not exists(select 1 from public.connect_xp_milestones
        where student_id=p_student and app_key=p_app and milestone_key=milestone_full) then
      insert into public.connect_xp_milestones(student_id,app_key,milestone_key,evidence)
        values(p_student,p_app,milestone_half,jsonb_build_object('source','record','mode',rec.mode_name||'-three-lives','score',best))
        on conflict do nothing;
     end if;
    end if;
   end loop;
  end loop;
  else
   -- Other integrated games retain their existing survival XP rules.
   score=coalesce((s#>>array['sudden',i::text])::int,0);
   for n in select unnest(array[5,10]) loop
    if score>=n then
     k='sudden:'||(i+1)||':'||n;
     insert into public.connect_xp_milestones(student_id,app_key,milestone_key,evidence)
      values(p_student,p_app,k,jsonb_build_object('source','record','score',score)) on conflict do nothing;
    end if;
   end loop;
   score=coalesce((s#>>array['hard',i::text])::int,0);
   for n in select unnest(array[3,7]) loop
    if score>=n then
     k='hard:'||(i+1)||':'||n;
     insert into public.connect_xp_milestones(student_id,app_key,milestone_key,evidence)
      values(p_student,p_app,k,jsonb_build_object('source','record','score',score)) on conflict do nothing;
    end if;
   end loop;
  end if;
 end loop;
 select coalesce(sum(r.points),0) into afterxp
 from public.connect_xp_milestones m join public.connect_xp_award_rules r on r.app_key=m.app_key and (
 r.award_key = concat_ws(':',split_part(m.milestone_key,':',1),split_part(m.milestone_key,':',3),nullif(split_part(m.milestone_key,':',4),''))
 )
 where m.student_id=p_student and m.app_key=p_app;
 if afterxp>474 then raise exception 'xp_cap';end if;
 if repeated and replay>=2 then
  -- Only milestones acquired before the current parcours can generate
  -- replay XP. Fresh rights discovered in this parcours do not double-credit.
  for rec in select m.milestone_key,r.points from public.connect_xp_milestones m join public.connect_xp_award_rules r
    on r.app_key=m.app_key and r.award_key=concat_ws(':',split_part(m.milestone_key,':',1),split_part(m.milestone_key,':',3),nullif(split_part(m.milestone_key,':',4),''))
   where m.student_id=p_student and m.app_key=p_app and m.achieved_at<replay_started loop
   if p_app in ('addition-ecrite-simple','addition-ecrite-multiple','multiplication-ecrite-simple','soustraction-ecrite-simple')
    and split_part(rec.milestone_key,':',1) in ('sudden','hard') then continue; end if;
   earned:=false;i:=split_part(rec.milestone_key,':',2)::int-1;n:=split_part(rec.milestone_key,':',3)::int;
   if split_part(rec.milestone_key,':',1)='classic' then
     score:=coalesce((s#>>array['classic',i::text,n::text])::int,-1);
     if n=4 then earned:=score=4;
     elsif n in(10,20) then earned:=case when split_part(rec.milestone_key,':',4)='bonus' then score=n else score*5>=n*4 end;end if;
   elsif split_part(rec.milestone_key,':',1)='sudden' then
     earned:=coalesce((s#>>array['sudden',i::text])::int,0)>=n;
   elsif split_part(rec.milestone_key,':',1)='hard' then
     earned:=coalesce((s#>>array['hard',i::text])::int,0)>=n;
   end if;
   if earned then insert into public.connect_parcours_xp_bonus(student_id,app_key,parcours_number,milestone_key,points)
    values(p_student,p_app,replay,rec.milestone_key,rec.points) on conflict do nothing;end if;
  end loop;
  if p_app in ('addition-ecrite-simple','addition-ecrite-multiple','multiplication-ecrite-simple','soustraction-ecrite-simple') then
  -- For already known survival tiers, replay in 3-vies earns the first 5,
  -- and real sudden death the complementary 5, independent of the
  -- mode used during the original parcours.
  for i in 0..2 loop
   for rec in select mode_name, thresholds from
     (values ('sudden',array[5,10]),('hard',array[3,7])) AS modes(mode_name,thresholds)
   loop
    score:=coalesce((s#>>array[rec.mode_name,i::text])::int,0);
    best:=coalesce((s#>>array[case when rec.mode_name='sudden' then 'threeLives' when p_app='soustraction-ecrite-simple' then 'hardThreeLives' else 'hardThree' end,i::text])::int,0);
    for n in select unnest(rec.thresholds) loop
     milestone_full:=rec.mode_name||':'||(i+1)||':'||n;
     milestone_half:=milestone_full||':half';
     milestone_extra:=milestone_full||':complement';
     if exists (select 1 from public.connect_xp_milestones m where
       m.student_id=p_student and m.app_key=p_app and m.achieved_at<replay_started
       and m.milestone_key in (milestone_full,milestone_half,milestone_extra)) then
      if greatest(score,best)>=n then
       insert into public.connect_parcours_xp_bonus(student_id,app_key,parcours_number,milestone_key,points)
        values(p_student,p_app,replay,milestone_half,5) on conflict do nothing;
      end if;
      if score>=n then
       insert into public.connect_parcours_xp_bonus(student_id,app_key,parcours_number,milestone_key,points)
        values(p_student,p_app,replay,milestone_extra,5) on conflict do nothing;
      end if;
     end if;
    end loop;
   end loop;
  end loop;
  end if;
 end if;
 select coalesce(sum(points),0) into bonusxp from public.connect_parcours_xp_bonus where student_id=p_student and app_key=p_app;
 afterxp:=afterxp+bonusxp;
 insert into public.connect_xp_credits(student_id,app_key,xp_credited,evidence,ruleset_version,updated_at)
 values(p_student,p_app,afterxp,jsonb_build_object('milestones',true,'count',(select count(*) from public.connect_xp_milestones where student_id=p_student and app_key=p_app)),rulesversion,now())
 on conflict(student_id,app_key) do update set xp_credited=excluded.xp_credited,evidence=excluded.evidence,ruleset_version=excluded.ruleset_version,updated_at=now();
 select coalesce(sum(xp_credited),0) into totalxp from public.connect_xp_credits where student_id=p_student;
 levelnow=case when totalxp<300 then 1+(totalxp/50) else 7+((totalxp-300)/100) end;
 select coalesce(highest_level_reached,1) into priorlevel from public.connect_level_profiles where student_id=p_student;
 priorlevel=coalesce(priorlevel,1);
 insert into public.connect_level_profiles(student_id,highest_level_reached,level_ruleset_version,updated_at)
 values(p_student,levelnow,2,now())
 on conflict(student_id) do update set highest_level_reached=excluded.highest_level_reached,level_ruleset_version=2,updated_at=now();
 return jsonb_build_object('appXp',afterxp,'delta',afterxp-beforexp,'total',totalxp,'level',levelnow,'previousLevel',priorlevel,'next',case when levelnow<7 then levelnow*50 else 300+(levelnow-6)*100 end,'active',true,'rulesetVersion',2);
end $function$;


CREATE OR REPLACE FUNCTION public.connect_projection_sub_verified_summary_v1(p_student uuid, p_class uuid, p_app text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
 WITH events AS (
  SELECT e.event_id, e.game_mode, e.game_score, e.game_total, e.played_at,
         CASE WHEN e.game_points>0 THEN e.game_points ELSE e.game_score END AS points
  FROM public.connect_projection_score_events e
  WHERE e.student_id=p_student AND e.class_id=p_class AND e.app_key='soustraction-ecrite-simple'
  AND p_app='soustraction-ecrite-simple' AND (EXISTS (SELECT 1 FROM public.connect_objective_record_school_proof_sessions ps
 WHERE ps.session_id=e.event_id AND ps.student_id=e.student_id AND ps.class_id=e.class_id
  AND ps.app_key=e.app_key AND ps.consumed_at IS NOT NULL AND ps.result->>'proofVerified'='true')
 OR EXISTS (SELECT 1 FROM public.connect_objective_record_school_extended_sessions es
 WHERE es.session_id=e.event_id AND es.student_id=e.student_id AND es.class_id=e.class_id
  AND es.app_key=e.app_key AND es.consumed_at IS NOT NULL AND es.result->>'proofVerified'='true'))
 ), latest AS (
  SELECT * FROM events ORDER BY played_at DESC,event_id DESC LIMIT 50
 ), top AS (
  SELECT * FROM events ORDER BY points DESC,played_at DESC,event_id DESC LIMIT 3
 ), today AS (
  SELECT * FROM events
  WHERE (played_at AT TIME ZONE 'Europe/Brussels')::date =
        (now() AT TIME ZONE 'Europe/Brussels')::date
  ORDER BY points DESC,played_at DESC,event_id DESC LIMIT 1
 ), published AS (
  SELECT MAX(CASE WHEN e.game_points>0 THEN e.game_points ELSE e.game_score END)::integer AS points
  FROM public.connect_projection_score_events e
  JOIN public.connect_projection_score_consents c
    ON c.student_id=e.student_id AND c.class_id=e.class_id
   AND c.app_key=e.app_key AND c.event_id=e.event_id
  LEFT JOIN public.connect_projection_score_periods p
    ON p.class_id=e.class_id AND p.app_key=e.app_key
  WHERE e.student_id=p_student AND e.class_id=p_class AND e.app_key='soustraction-ecrite-simple'
   AND (EXISTS (SELECT 1 FROM public.connect_objective_record_school_proof_sessions ps
 WHERE ps.session_id=e.event_id AND ps.student_id=e.student_id AND ps.class_id=e.class_id
  AND ps.app_key=e.app_key AND ps.consumed_at IS NOT NULL AND ps.result->>'proofVerified'='true')
 OR EXISTS (SELECT 1 FROM public.connect_objective_record_school_extended_sessions es
 WHERE es.session_id=e.event_id AND es.student_id=e.student_id AND es.class_id=e.class_id
  AND es.app_key=e.app_key AND es.consumed_at IS NOT NULL AND es.result->>'proofVerified'='true'))
   AND e.played_at>=COALESCE(p.score_since,'1970-01-01Z'::timestamptz)
   AND e.captured_at>=COALESCE(p.score_since,'1970-01-01Z'::timestamptz)
 )
 SELECT jsonb_build_object('ok',true,
  'events',COALESCE((SELECT jsonb_agg(jsonb_build_object(
    'eventId',event_id,'mode',game_mode,'score',game_score,'total',game_total,
    'points',points,'at',played_at) ORDER BY played_at DESC,event_id DESC)
    FROM latest),'[]'::jsonb),
  'bestThree',COALESCE((SELECT jsonb_agg(jsonb_build_object(
    'eventId',event_id,'mode',game_mode,'score',game_score,'total',game_total,
    'points',points,'at',played_at) ORDER BY points DESC,played_at DESC,event_id DESC)
    FROM top),'[]'::jsonb),
  'todayBest',(SELECT jsonb_build_object(
    'eventId',event_id,'mode',game_mode,'score',game_score,'total',game_total,
    'points',points,'at',played_at) FROM today),
  'boardBest',COALESCE((SELECT points FROM published),0));
$function$;

CREATE OR REPLACE FUNCTION public.connect_projection_sub_share_improved_v1(p_student uuid, p_class uuid, p_app text, p_event uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE
 v_event public.connect_projection_score_events%ROWTYPE;
 v_since timestamptz;
 v_previous integer:=0;
 v_points integer;
BEGIN
 IF p_student IS NULL OR p_class IS NULL OR p_event IS NULL
    OR p_app <> 'soustraction-ecrite-simple'
    OR p_app IS NULL THEN
  RETURN jsonb_build_object('ok',false,'error','invalid_score_event');
 END IF;
 -- Sérialiser deux clics concurrents, pour ne publier que de vrais records.
 PERFORM 1 FROM public.connect_students WHERE id=p_student AND archived_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','player_not_active');END IF;
 IF NOT EXISTS(
  SELECT 1 FROM public.connect_enrollments
   WHERE student_id=p_student AND class_id=p_class AND left_at IS NULL
 ) AND NOT EXISTS(
  SELECT 1 FROM public.connect_teacher_players tp
   JOIN public.connect_class_permissions cp ON cp.teacher_id=tp.teacher_id
   WHERE tp.student_id=p_student AND cp.class_id=p_class AND cp.can_manage=true
 ) THEN RETURN jsonb_build_object('ok',false,'error','wrong_class');END IF;

 SELECT * INTO v_event FROM public.connect_projection_score_events
 WHERE student_id=p_student AND class_id=p_class AND app_key=p_app AND event_id=p_event;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','event_not_found');END IF;
 IF NOT (EXISTS (SELECT 1 FROM public.connect_objective_record_school_proof_sessions ps
 WHERE ps.session_id=v_event.event_id AND ps.student_id=v_event.student_id AND ps.class_id=v_event.class_id
  AND ps.app_key=v_event.app_key AND ps.consumed_at IS NOT NULL AND ps.result->>'proofVerified'='true')
 OR EXISTS (SELECT 1 FROM public.connect_objective_record_school_extended_sessions es
 WHERE es.session_id=v_event.event_id AND es.student_id=v_event.student_id AND es.class_id=v_event.class_id
  AND es.app_key=v_event.app_key AND es.consumed_at IS NOT NULL AND es.result->>'proofVerified'='true')) THEN RETURN jsonb_build_object('ok',false,'error','invalid_score_event');END IF;
 SELECT score_since INTO v_since FROM public.connect_projection_score_periods
 WHERE class_id=p_class AND app_key=p_app;
 IF v_event.played_at<COALESCE(v_since,'1970-01-01Z'::timestamptz)
   OR v_event.captured_at<COALESCE(v_since,'1970-01-01Z'::timestamptz)
 THEN RETURN jsonb_build_object('ok',false,'error','score_reset');END IF;

 SELECT COALESCE(MAX(CASE WHEN e.game_points>0 THEN e.game_points ELSE e.game_score END),0)::integer
 INTO v_previous
 FROM public.connect_projection_score_events e
 JOIN public.connect_projection_score_consents c
   ON c.student_id=e.student_id AND c.class_id=e.class_id
  AND c.app_key=e.app_key AND c.event_id=e.event_id
 WHERE e.student_id=p_student AND e.class_id=p_class AND e.app_key=p_app
  AND (EXISTS (SELECT 1 FROM public.connect_objective_record_school_proof_sessions ps
 WHERE ps.session_id=e.event_id AND ps.student_id=e.student_id AND ps.class_id=e.class_id
  AND ps.app_key=e.app_key AND ps.consumed_at IS NOT NULL AND ps.result->>'proofVerified'='true')
 OR EXISTS (SELECT 1 FROM public.connect_objective_record_school_extended_sessions es
 WHERE es.session_id=e.event_id AND es.student_id=e.student_id AND es.class_id=e.class_id
  AND es.app_key=e.app_key AND es.consumed_at IS NOT NULL AND es.result->>'proofVerified'='true'))
  AND e.played_at>=COALESCE(v_since,'1970-01-01Z'::timestamptz)
  AND e.captured_at>=COALESCE(v_since,'1970-01-01Z'::timestamptz);
 v_points:=CASE WHEN v_event.game_points>0 THEN v_event.game_points ELSE v_event.game_score END;
 IF v_points<=v_previous THEN
  RETURN jsonb_build_object('ok',false,'error','not_improved','boardBest',v_previous);
 END IF;

 INSERT INTO public.connect_projection_score_consents(student_id,class_id,app_key,event_id)
 VALUES(p_student,p_class,p_app,p_event) ON CONFLICT(student_id,app_key,event_id) DO NOTHING;
 RETURN jsonb_build_object('ok',true,'consentRecorded',true,'improved',true,
                           'boardBest',v_points);
END;
$function$;

REVOKE ALL ON FUNCTION public.connect_projection_sub_verified_summary_v1(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.connect_projection_sub_verified_summary_v1(uuid,uuid,text) TO service_role;
REVOKE ALL ON FUNCTION public.connect_projection_sub_share_improved_v1(uuid,uuid,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.connect_projection_sub_share_improved_v1(uuid,uuid,text,uuid) TO service_role;

COMMIT;