-- Only permitted active school pupils and teacher test-players can issue these arithmetic questions.
CREATE OR REPLACE FUNCTION public.connect_objective_record_school_issue_add_v1(
 p_student uuid,p_class uuid,p_level integer,p_total integer
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $issue$
DECLARE
 v_class constant uuid:=p_class;
 v_app constant text:='addition-ecrite-simple';
 v_revision bigint;v_epoch bigint;v_existing record;
 v_questions jsonb:='[]'::jsonb;v_a integer;v_b integer;v_i integer;
 v_digits integer;v_second integer;v_min integer;v_second_min integer;
 v_id uuid;v_expiry timestamptz;
BEGIN
 IF (p_class IS NULL OR public.connect_objective_record_school_class_allowed_v1(p_class) IS DISTINCT FROM true) OR p_student IS NULL THEN RAISE EXCEPTION 'school_class_not_allowed';END IF;
 IF p_level NOT IN (1,2,3) OR p_total NOT IN (4,10,20) OR p_level IS NULL OR p_total IS NULL
 THEN RAISE EXCEPTION 'invalid_proof_configuration';END IF;
 PERFORM 1 FROM public.connect_students WHERE id=p_student AND archived_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'inactive_student';END IF;
 IF NOT EXISTS(
  SELECT 1 FROM public.connect_enrollments e WHERE e.student_id=p_student
   AND e.class_id=v_class AND e.left_at IS NULL
 ) AND NOT EXISTS(
  SELECT 1 FROM public.connect_teacher_players tp
  JOIN public.connect_class_permissions cp ON cp.teacher_id=tp.teacher_id
  WHERE tp.student_id=p_student AND cp.class_id=v_class AND cp.can_manage=true
 ) THEN RAISE EXCEPTION 'not_school_subject';END IF;
 SELECT coalesce(revision,0),coalesce(reset_epoch,0) INTO v_revision,v_epoch
  FROM public.connect_states WHERE student_id=p_student AND app_key=v_app;
 v_revision:=coalesce(v_revision,0);v_epoch:=coalesce(v_epoch,0);
 SELECT * INTO v_existing FROM public.connect_objective_record_school_proof_sessions
 WHERE student_id=p_student AND class_id=v_class AND app_key=v_app AND consumed_at IS NULL
  AND expires_at>now() AND expected_revision=v_revision AND reset_epoch=v_epoch
  AND level=p_level AND total=p_total
 ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
 IF FOUND THEN
  RETURN jsonb_build_object('ok',true,'sessionId',v_existing.session_id,
   'questions',v_existing.questions,'revision',v_revision,'resetEpoch',v_epoch,
   'level',p_level,'total',p_total,'reused',true,'expiresAt',v_existing.expires_at);
 END IF;
 v_digits:=CASE p_level WHEN 1 THEN 3 WHEN 2 THEN 5 ELSE 7 END;
 v_min:=power(10::numeric,v_digits-1)::integer;
 FOR v_i IN 1..p_total LOOP
  -- Match the native level widths (3, 5, 7 digits). A second addend
  -- has one fewer digit in approximately 15% of questions.
  v_second:=CASE WHEN random()<.15 THEN v_digits-1 ELSE v_digits END;
  v_second_min:=power(10::numeric,v_second-1)::integer;
  v_a:=v_min+floor(random()*9*v_min)::integer;
  v_b:=v_second_min+floor(random()*9*v_second_min)::integer;
  v_questions:=v_questions||jsonb_build_array(
    jsonb_build_object('id','q'||v_i,'op','add','a',v_a,'b',v_b));
 END LOOP;
 INSERT INTO public.connect_objective_record_school_proof_sessions(
  student_id,class_id,app_key,expected_revision,reset_epoch,level,total,questions,expires_at)
 VALUES(p_student,v_class,v_app,v_revision,v_epoch,p_level,p_total,v_questions,now()+interval '90 minutes')
 RETURNING session_id,expires_at INTO v_id,v_expiry;
 RETURN jsonb_build_object('ok',true,'sessionId',v_id,
  'questions',v_questions,'revision',v_revision,'resetEpoch',v_epoch,
  'level',p_level,'total',p_total,'reused',false,'expiresAt',v_expiry);
END $issue$;
REVOKE ALL ON FUNCTION public.connect_objective_record_school_issue_add_v1(uuid,uuid,integer,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.connect_objective_record_school_issue_add_v1(uuid,uuid,integer,integer) TO service_role;
