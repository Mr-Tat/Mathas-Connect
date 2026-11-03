-- A student may only play server-issued sums: all operands remain fixed in a
-- private session and retries reuse the same question set (no reroll farming).
CREATE OR REPLACE FUNCTION public.connect_objective_record_school_issue_mode_v1(
 p_student uuid,p_class uuid,p_app text,p_mode text,p_level integer
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $issue$
DECLARE
 v_rev bigint:=0;v_epoch bigint:=0;
 v_old public.connect_objective_record_school_mode_sessions%ROWTYPE;
 v_questions jsonb:='[]'::jsonb;v_terms jsonb;
 v_width integer;v_terms_count integer;v_len integer;v_min numeric;
 v_n numeric;v_i integer;v_j integer;v_id uuid;v_expires timestamptz;
BEGIN
 IF p_student IS NULL OR p_class IS NULL
   OR public.connect_objective_record_school_class_allowed_v1(p_class) IS DISTINCT FROM true
   OR p_app NOT IN ('addition-ecrite-simple','addition-ecrite-multiple')
   OR p_mode NOT IN ('three-lives','sudden','hard-three-lives','hard-sudden')
   OR p_level NOT BETWEEN 1 AND 3 OR p_app IS NULL OR p_mode IS NULL OR p_level IS NULL
 THEN RAISE EXCEPTION 'invalid_mode_configuration';END IF;
 PERFORM 1 FROM public.connect_students
  WHERE id=p_student AND archived_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'inactive_student';END IF;
 IF NOT EXISTS(
  SELECT 1 FROM public.connect_enrollments
   WHERE student_id=p_student AND class_id=p_class AND left_at IS NULL
 ) AND NOT EXISTS(
  SELECT 1 FROM public.connect_teacher_players tp
  JOIN public.connect_class_permissions cp
   ON cp.teacher_id=tp.teacher_id AND cp.class_id=p_class AND cp.can_manage=true
  WHERE tp.student_id=p_student
 ) THEN RAISE EXCEPTION 'not_school_subject';END IF;
 SELECT coalesce(revision,0),coalesce(reset_epoch,0) INTO v_rev,v_epoch
 FROM public.connect_states WHERE student_id=p_student AND app_key=p_app;
 v_rev:=coalesce(v_rev,0);v_epoch:=coalesce(v_epoch,0);
 SELECT * INTO v_old FROM public.connect_objective_record_school_mode_sessions
 WHERE student_id=p_student AND class_id=p_class AND app_key=p_app
  AND mode=p_mode AND level=p_level AND consumed_at IS NULL
  AND expires_at>now() AND expected_revision=v_rev AND reset_epoch=v_epoch
 ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
 IF FOUND THEN
  RETURN jsonb_build_object('ok',true,'sessionId',v_old.session_id,
   'mode',p_mode,'level',p_level,'questions',v_old.questions,
   'expiresAt',v_old.expires_at,'reused',true);
 END IF;
 v_width:=CASE WHEN p_mode LIKE 'hard-%'
  THEN CASE WHEN p_app='addition-ecrite-simple'
    THEN CASE p_level WHEN 1 THEN 10 WHEN 2 THEN 12 ELSE 16 END
    ELSE CASE p_level WHEN 1 THEN 9 WHEN 2 THEN 12 ELSE 14 END END
  ELSE CASE WHEN p_app='addition-ecrite-simple'
    THEN CASE p_level WHEN 1 THEN 3 WHEN 2 THEN 5 ELSE 7 END
    ELSE p_level+4 END END;
 v_terms_count:=CASE WHEN p_app='addition-ecrite-simple' THEN 2
   WHEN p_mode LIKE 'hard-%' THEN CASE p_level WHEN 3 THEN 7 ELSE 6 END
   ELSE p_level+2 END;
 FOR v_i IN 1..64 LOOP
  v_terms:='[]'::jsonb;
  FOR v_j IN 1..v_terms_count LOOP
   -- Match standard/hard operand widths without unsafe floating-point
   -- integers: BIG numeric values are sent to the game as decimal STRINGS.
   v_len:=v_width;
   IF p_app='addition-ecrite-simple' AND v_j=2 AND random()<0.15
   THEN v_len:=v_len-1;
   ELSIF p_app='addition-ecrite-multiple' AND v_j>2 AND random()<0.55
   THEN v_len:=v_len-CASE WHEN p_mode LIKE 'hard-%' AND random()<0.5 THEN 2 ELSE 1 END;
   END IF;
   v_min:=power(10::numeric,v_len-1);
   v_n:=v_min+trunc(random()::numeric*9*v_min);
   v_terms:=v_terms||jsonb_build_array(v_n::text);
  END LOOP;
  v_questions:=v_questions||jsonb_build_array(jsonb_build_object(
    'id','q'||v_i,'op','add','addends',v_terms));
 END LOOP;
 INSERT INTO public.connect_objective_record_school_mode_sessions(
  student_id,class_id,app_key,mode,level,expected_revision,reset_epoch,questions,expires_at
 ) VALUES(p_student,p_class,p_app,p_mode,p_level,v_rev,v_epoch,v_questions,now()+interval '90 minutes')
 RETURNING session_id,expires_at INTO v_id,v_expires;
 RETURN jsonb_build_object('ok',true,'sessionId',v_id,'mode',p_mode,
  'level',p_level,'questions',v_questions,'expiresAt',v_expires,'reused',false);
END $issue$;
REVOKE ALL ON FUNCTION public.connect_objective_record_school_issue_mode_v1(
 uuid,uuid,text,text,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.connect_objective_record_school_issue_mode_v1(
 uuid,uuid,text,text,integer) TO service_role;
