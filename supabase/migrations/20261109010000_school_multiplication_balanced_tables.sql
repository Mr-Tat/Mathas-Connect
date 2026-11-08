-- Nouvelles séries Multiplication équilibrées ; les preuves déjà émises ne sont pas altérées.
CREATE OR REPLACE FUNCTION public.connect_objective_record_school_mul_issue_classic_v1(p_student uuid, p_class uuid, p_level integer, p_total integer, p_multipliers integer[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
 v_app constant text:='multiplication-ecrite-simple';
 v_rev bigint;v_epoch bigint;v_existing record;v_locked integer[];v_state jsonb;
 v_q jsonb:='[]'::jsonb;v_a integer;v_m integer;v_i integer;v_deck integer[];v_deck_at integer:=0;v_last_m integer;v_swap_m integer;
 v_width integer;v_len integer;v_base integer;
 v_id uuid;v_expires timestamptz;
BEGIN
 IF p_student IS NULL OR p_class IS NULL OR
    (p_class <> '4bf3400d-a315-4ea4-a2f3-afaca24dc9b9'::uuid
      AND public.connect_objective_record_school_class_allowed_v1(p_class) IS DISTINCT FROM true)
 THEN RAISE EXCEPTION 'school_class_not_allowed';END IF;
 IF p_level NOT IN (1,2,3) OR p_total NOT IN (4,10,20)
  OR p_level IS NULL OR p_total IS NULL OR p_multipliers IS NULL
  OR cardinality(p_multipliers) NOT BETWEEN 1 AND 8
  OR (SELECT count(DISTINCT n) FROM unnest(p_multipliers) n)<>cardinality(p_multipliers)
  OR EXISTS(SELECT 1 FROM unnest(p_multipliers) n WHERE n NOT BETWEEN 2 AND 9)
 THEN RAISE EXCEPTION 'invalid_proof_configuration';END IF;
 PERFORM 1 FROM public.connect_students WHERE id=p_student AND archived_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'inactive_student';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.connect_enrollments e
   WHERE e.student_id=p_student AND e.class_id=p_class AND e.left_at IS NULL)
 AND NOT EXISTS(SELECT 1 FROM public.connect_teacher_players tp
   JOIN public.connect_class_permissions cp ON cp.teacher_id=tp.teacher_id
   WHERE tp.student_id=p_student AND cp.class_id=p_class AND cp.can_manage=true)
 THEN RAISE EXCEPTION 'not_school_subject';END IF;
 SELECT multipliers INTO v_locked FROM public.connect_multiplier_locks
 WHERE class_id=p_class AND scope_key IN (p_student::text,'class')
 ORDER BY CASE WHEN scope_key=p_student::text THEN 0 ELSE 1 END LIMIT 1;
 IF v_locked IS NOT NULL AND NOT(v_locked <@ p_multipliers)
 THEN RAISE EXCEPTION 'multipliers_not_allowed';END IF;
 SELECT coalesce(revision,0),coalesce(reset_epoch,0),state_data INTO v_rev,v_epoch,v_state
 FROM public.connect_states WHERE student_id=p_student AND app_key=v_app;
 IF p_class <> '4bf3400d-a315-4ea4-a2f3-afaca24dc9b9'::uuid AND p_level>1
  AND coalesce((v_state#>>ARRAY['progress','level'||p_level])::boolean,false)=false
 THEN RAISE EXCEPTION 'school_mode_locked';END IF;
 v_rev:=coalesce(v_rev,0);v_epoch:=coalesce(v_epoch,0);
 SELECT * INTO v_existing FROM public.connect_objective_record_school_proof_sessions
 WHERE student_id=p_student AND class_id=p_class AND app_key=v_app
  AND expected_revision=v_rev AND reset_epoch=v_epoch AND level=p_level AND total=p_total
  AND consumed_at IS NULL AND expires_at>now()
  AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(questions) q
    WHERE (q->>'m')::integer <> ALL(p_multipliers))
 ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
 IF FOUND THEN RETURN jsonb_build_object('ok',true,'sessionId',v_existing.session_id,
    'revision',v_rev,'resetEpoch',v_epoch,'level',p_level,'total',p_total,
    'questions',v_existing.questions,'expiresAt',v_existing.expires_at,'reused',true);
 END IF;
 v_width:=CASE p_level WHEN 1 THEN 3 WHEN 2 THEN 5 ELSE 7 END;
 FOR v_i IN 1..p_total LOOP
  v_len:=v_width-CASE WHEN random()<0.15 THEN 1 ELSE 0 END;
  v_base:=power(10::numeric,v_len-1)::integer;
  v_a:=v_base+floor(random()*9*v_base)::integer;
  -- Tirer chaque multiplicateur une fois par paquet mélangé, sans doublon consécutif.
   IF v_deck IS NULL OR v_deck_at>=cardinality(v_deck) THEN
    SELECT array_agg(t.n ORDER BY random()) INTO v_deck FROM unnest(p_multipliers) AS t(n);
    IF cardinality(v_deck)>1 AND v_last_m IS NOT NULL AND v_deck[1]=v_last_m THEN
     v_swap_m:=v_deck[1];v_deck[1]:=v_deck[2];v_deck[2]:=v_swap_m;
    END IF;
    v_deck_at:=0;
   END IF;
   v_deck_at:=v_deck_at+1;
   v_m:=v_deck[v_deck_at];v_last_m:=v_m;
  v_q:=v_q||jsonb_build_array(jsonb_build_object(
    'id','q'||v_i,'op','mul','a',v_a::text,'m',v_m,'width',v_len));
 END LOOP;
 INSERT INTO public.connect_objective_record_school_proof_sessions(
 student_id,class_id,app_key,expected_revision,reset_epoch,level,total,questions,expires_at)
 VALUES(p_student,p_class,v_app,v_rev,v_epoch,p_level,p_total,v_q,now()+interval '90 minutes')
 RETURNING session_id,expires_at INTO v_id,v_expires;
 RETURN jsonb_build_object('ok',true,'sessionId',v_id,'revision',v_rev,
  'resetEpoch',v_epoch,'level',p_level,'total',p_total,
  'questions',v_q,'expiresAt',v_expires,'reused',false);
END $function$;

REVOKE ALL ON FUNCTION public.connect_objective_record_school_mul_issue_classic_v1(uuid,uuid,integer,integer,integer[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.connect_objective_record_school_mul_issue_classic_v1(uuid,uuid,integer,integer,integer[]) TO service_role;

CREATE OR REPLACE FUNCTION public.connect_objective_record_school_mul_issue_extended_v1(p_student uuid, p_class uuid, p_mode text, p_level integer, p_multipliers integer[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
 v_app constant text:='multiplication-ecrite-simple';
 v_total constant integer:=120;
 v_rev bigint;v_epoch bigint;v_existing record;v_locked integer[];
 v_questions jsonb:='[]'::jsonb;v_a numeric;v_m integer;v_i integer;v_deck integer[];v_deck_at integer:=0;v_last_m integer;v_swap_m integer;
 v_width integer;v_len integer;v_base numeric;
 v_id uuid;v_expires timestamptz;v_state jsonb;
BEGIN
 IF p_student IS NULL OR p_class IS NULL OR
    (p_class <> '4bf3400d-a315-4ea4-a2f3-afaca24dc9b9'::uuid
     AND public.connect_objective_record_school_class_allowed_v1(p_class) IS DISTINCT FROM true)
 THEN RAISE EXCEPTION 'school_class_not_allowed';END IF;
 IF p_mode NOT IN ('three-lives','sudden','hard-three-lives','hard-sudden')
  OR p_mode IS NULL OR p_level NOT IN (1,2,3) OR p_level IS NULL
  OR p_multipliers IS NULL OR cardinality(p_multipliers) NOT BETWEEN 1 AND 8
  OR (SELECT count(DISTINCT n) FROM unnest(p_multipliers) n)<>cardinality(p_multipliers)
  OR EXISTS(SELECT 1 FROM unnest(p_multipliers) n WHERE n NOT BETWEEN 2 AND 9)
  OR (p_mode LIKE 'hard-%' AND p_multipliers<>ARRAY[2,3,4,5,6,7,8,9])
 THEN RAISE EXCEPTION 'invalid_proof_configuration';END IF;
 PERFORM 1 FROM public.connect_students WHERE id=p_student AND archived_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'inactive_student';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.connect_enrollments e
   WHERE e.student_id=p_student AND e.class_id=p_class AND e.left_at IS NULL)
 AND NOT EXISTS(SELECT 1 FROM public.connect_teacher_players tp
   JOIN public.connect_class_permissions cp ON cp.teacher_id=tp.teacher_id
   WHERE tp.student_id=p_student AND cp.class_id=p_class AND cp.can_manage=true)
 THEN RAISE EXCEPTION 'not_school_subject';END IF;
 SELECT multipliers INTO v_locked FROM public.connect_multiplier_locks
 WHERE class_id=p_class AND scope_key IN(p_student::text,'class')
 ORDER BY CASE WHEN scope_key=p_student::text THEN 0 ELSE 1 END LIMIT 1;
 IF v_locked IS NOT NULL AND NOT(v_locked <@ p_multipliers)
 THEN RAISE EXCEPTION 'multipliers_not_allowed';END IF;
 SELECT coalesce(revision,0),coalesce(reset_epoch,0),state_data INTO v_rev,v_epoch,v_state
 FROM public.connect_states WHERE student_id=p_student AND app_key=v_app;
 v_rev:=coalesce(v_rev,0);v_epoch:=coalesce(v_epoch,0);v_state:=coalesce(v_state,'{}'::jsonb);
 -- Existing school modes stay locked until authentic Connect results unlock them.
 -- Keep the TEST class available for isolated certification scenarios.
 IF p_class <> '4bf3400d-a315-4ea4-a2f3-afaca24dc9b9'::uuid THEN
  IF p_mode LIKE 'hard-%' THEN
   IF (v_state#>>'{progress,hard}')::boolean IS DISTINCT FROM true
   OR (p_level>1 AND coalesce((v_state#>>ARRAY['hard',(p_level-2)::text])::integer,0)<3)
   THEN RAISE EXCEPTION 'school_mode_locked';END IF;
  ELSE
   IF (v_state#>>ARRAY['progress','sudden'||p_level])::boolean IS DISTINCT FROM true
   THEN RAISE EXCEPTION 'school_mode_locked';END IF;
  END IF;
 END IF;
 IF p_mode IN ('three-lives','sudden')
  AND NOT public.connect_written_record_80_gate_v1(p_student,v_app,p_level)
  THEN RAISE EXCEPTION 'school_mode_locked'; END IF;
  SELECT * INTO v_existing FROM public.connect_objective_record_school_extended_sessions
 WHERE student_id=p_student AND class_id=p_class AND app_key=v_app
  AND mode=p_mode AND level=p_level AND consumed_at IS NULL
  AND expected_revision=v_rev AND reset_epoch=v_epoch AND expires_at>now()
  AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(questions) q
    WHERE (q->>'m')::integer <> ALL(p_multipliers))
 ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
 IF FOUND THEN RETURN jsonb_build_object('ok',true,'sessionId',v_existing.session_id,
   'questions',v_existing.questions,'level',p_level,'width',v_existing.width,
   'mode',p_mode,'limit',v_total,'revision',v_rev,'resetEpoch',v_epoch,
   'expiresAt',v_existing.expires_at,'reused',true);
 END IF;
 v_width:=CASE WHEN p_mode LIKE 'hard-%' THEN
  CASE p_level WHEN 1 THEN 10 WHEN 2 THEN 12 ELSE 16 END
 ELSE CASE p_level WHEN 1 THEN 3 WHEN 2 THEN 5 ELSE 7 END END;
 FOR v_i IN 1..v_total LOOP
  v_len:=v_width-CASE WHEN random()<0.15 THEN 1 ELSE 0 END;
  v_base:=power(10::numeric,v_len-1);
  v_a:=v_base+floor(random()*9*v_base);
  -- Tirer chaque multiplicateur une fois par paquet mélangé, sans doublon consécutif.
   IF v_deck IS NULL OR v_deck_at>=cardinality(v_deck) THEN
    SELECT array_agg(t.n ORDER BY random()) INTO v_deck FROM unnest(p_multipliers) AS t(n);
    IF cardinality(v_deck)>1 AND v_last_m IS NOT NULL AND v_deck[1]=v_last_m THEN
     v_swap_m:=v_deck[1];v_deck[1]:=v_deck[2];v_deck[2]:=v_swap_m;
    END IF;
    v_deck_at:=0;
   END IF;
   v_deck_at:=v_deck_at+1;
   v_m:=v_deck[v_deck_at];v_last_m:=v_m;
  v_questions:=v_questions||jsonb_build_array(jsonb_build_object(
    'id','q'||v_i,'op','mul','a',v_a::text,'m',v_m,'width',v_len));
 END LOOP;
 INSERT INTO public.connect_objective_record_school_extended_sessions(
 student_id,class_id,app_key,mode,level,width,total,expected_revision,
 reset_epoch,questions,expires_at)
 VALUES(p_student,p_class,v_app,p_mode,p_level,v_width,v_total,v_rev,
  v_epoch,v_questions,now()+interval '8 hours')
 RETURNING session_id,expires_at INTO v_id,v_expires;
 RETURN jsonb_build_object('ok',true,'sessionId',v_id,'questions',v_questions,
  'level',p_level,'width',v_width,'mode',p_mode,'limit',v_total,
  'revision',v_rev,'resetEpoch',v_epoch,'expiresAt',v_expires,'reused',false);
END $function$;

REVOKE ALL ON FUNCTION public.connect_objective_record_school_mul_issue_extended_v1(uuid,uuid,text,integer,integer[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.connect_objective_record_school_mul_issue_extended_v1(uuid,uuid,text,integer,integer[]) TO service_role;

