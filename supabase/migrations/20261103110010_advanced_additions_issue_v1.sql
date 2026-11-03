-- Immutable arithmetic problem sets, computed in PostgreSQL.
-- No client-selected operands, level, score, stop condition or trophy.
CREATE OR REPLACE FUNCTION public.connect_objective_record_advanced_issue_v1(
 p_student uuid,p_class uuid,p_app text,p_mode text,p_level integer
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $issue$
DECLARE
 v_app constant text:=p_app;
 v_previous public.connect_objective_record_advanced_sessions%ROWTYPE;
 v_state public.connect_states%ROWTYPE;
 v_hard boolean:=p_mode LIKE 'hard-%';
 v_width integer;v_addends integer;v_total integer:=64;
 v_q jsonb:='[]'::jsonb;v_terms jsonb;
 v_i integer;v_j integer;v_k integer;v_len integer;
 v_number numeric;v_digit integer;v_start integer;
 v_session uuid;v_expires timestamptz:=now()+interval '90 minutes';
BEGIN
 IF p_student IS NULL OR p_class IS NULL
 OR public.connect_objective_record_school_class_allowed_v1(p_class) IS DISTINCT FROM true
 OR p_app NOT IN('addition-ecrite-simple','addition-ecrite-multiple')
 OR p_mode NOT IN('three-lives','sudden','hard-three-lives','hard-sudden')
 OR p_level NOT BETWEEN 1 AND 3 THEN RAISE EXCEPTION 'invalid_advanced_config';END IF;
 PERFORM 1 FROM public.connect_students
  WHERE id=p_student AND archived_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'inactive_student';END IF;
 IF NOT EXISTS(
  SELECT 1 FROM public.connect_enrollments
  WHERE student_id=p_student AND class_id=p_class AND left_at IS NULL
 ) AND NOT EXISTS(
  SELECT 1 FROM public.connect_teacher_players tp
  JOIN public.connect_class_permissions cp ON cp.teacher_id=tp.teacher_id
  WHERE tp.student_id=p_student AND cp.class_id=p_class AND cp.can_manage=true
 ) THEN RAISE EXCEPTION 'not_school_subject';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.connect_apps WHERE app_key=v_app AND enabled=true)
 THEN RAISE EXCEPTION 'app_disabled';END IF;
 INSERT INTO public.connect_states(student_id,app_key,schema_version,revision,reset_epoch,state_data)
 VALUES(p_student,v_app,1,0,0,'{}'::jsonb) ON CONFLICT DO NOTHING;
 SELECT * INTO STRICT v_state FROM public.connect_states
 WHERE student_id=p_student AND app_key=v_app FOR UPDATE;
 SELECT * INTO v_previous FROM public.connect_objective_record_advanced_sessions
 WHERE student_id=p_student AND class_id=p_class AND app_key=v_app
   AND consumed_at IS NULL AND expires_at>now()
 ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
 IF FOUND THEN
  IF v_previous.mode<>p_mode OR v_previous.level<>p_level
   OR v_previous.expected_revision<>v_state.revision
   OR v_previous.reset_epoch<>v_state.reset_epoch
  THEN RAISE EXCEPTION 'another_advanced_session_pending';END IF;
  RETURN jsonb_build_object('ok',true,'sessionId',v_previous.session_id,'reused',true,
   'appKey',v_app,'mode',p_mode,'level',p_level,'maxQuestions',v_previous.question_limit,
   'questions',v_previous.questions,'expiresAt',v_previous.expires_at,
   'revision',v_state.revision,'resetEpoch',v_state.reset_epoch);
 END IF;
 v_width:=CASE
  WHEN NOT v_hard AND v_app='addition-ecrite-simple' THEN CASE p_level WHEN 1 THEN 3 WHEN 2 THEN 5 ELSE 7 END
  WHEN NOT v_hard THEN 4+p_level
  WHEN v_app='addition-ecrite-simple' THEN CASE p_level WHEN 1 THEN 10 WHEN 2 THEN 12 ELSE 16 END
  ELSE CASE p_level WHEN 1 THEN 9 WHEN 2 THEN 12 ELSE 14 END END;
 v_addends:=CASE WHEN v_app='addition-ecrite-simple' THEN 2
  WHEN v_hard THEN CASE p_level WHEN 3 THEN 7 ELSE 6 END
  ELSE 2+p_level END;
 FOR v_i IN 1..v_total LOOP
  v_terms:='[]'::jsonb;
  FOR v_j IN 1..v_addends LOOP
   v_len:=CASE
    WHEN NOT v_hard AND v_app='addition-ecrite-simple' AND v_j=2 THEN v_width-1
    WHEN v_hard AND v_app='addition-ecrite-multiple' AND v_j>v_addends/2
     THEN greatest(1,v_width-1-(v_j%2))
    ELSE v_width END;
   v_number:=0;
   FOR v_k IN 1..v_len LOOP
    v_digit:=floor(random()*(CASE WHEN v_k=1 THEN 9 ELSE 10 END))::integer;
    IF v_k=1 THEN v_digit:=v_digit+1;END IF;
    v_number:=v_number*10+v_digit;
   END LOOP;
   v_terms:=v_terms||to_jsonb(v_number::text);
  END LOOP;
  v_q:=v_q||jsonb_build_array(jsonb_build_object(
   'id','q'||v_i,'op','add','addends',v_terms));
 END LOOP;
 INSERT INTO public.connect_objective_record_advanced_sessions(
  student_id,class_id,app_key,mode,level,question_limit,questions,
  expected_revision,reset_epoch,expires_at
 ) VALUES(p_student,p_class,v_app,p_mode,p_level,v_total,v_q,
  v_state.revision,v_state.reset_epoch,v_expires)
 RETURNING session_id INTO v_session;
 RETURN jsonb_build_object('ok',true,'sessionId',v_session,'reused',false,
  'appKey',v_app,'mode',p_mode,'level',p_level,'maxQuestions',v_total,
  'questions',v_q,'expiresAt',v_expires,
  'revision',v_state.revision,'resetEpoch',v_state.reset_epoch);
END $issue$;
REVOKE ALL ON FUNCTION public.connect_objective_record_advanced_issue_v1(uuid,uuid,text,text,integer)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.connect_objective_record_advanced_issue_v1(uuid,uuid,text,text,integer)
 TO service_role;
