-- All operands are chosen by PostgreSQL and are decimal STRINGS because
-- HARD runs legitimately contain 16-digit operands (unsafe as JS numbers).
CREATE OR REPLACE FUNCTION public.connect_objective_record_school_issue_extended_v1(
 p_student uuid,p_class uuid,p_app text,p_mode text,p_level integer
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $issue$
DECLARE
 v_rev bigint:=0;v_epoch bigint:=0;v_previous record;
 v_width integer;v_terms_count integer;v_total constant integer:=120;
 v_i integer;v_j integer;v_len integer;v_num numeric;v_base numeric;
 v_addends jsonb;v_questions jsonb:='[]'::jsonb;
 v_session uuid;v_expires timestamptz;
BEGIN
 IF p_student IS NULL OR p_class IS NULL
  OR public.connect_objective_record_school_class_allowed_v1(p_class) IS DISTINCT FROM true
 THEN RAISE EXCEPTION 'school_class_not_allowed';END IF;
 IF p_app NOT IN ('addition-ecrite-simple','addition-ecrite-multiple')
  OR p_app IS NULL
  OR p_mode NOT IN ('sudden','three-lives','hard-sudden','hard-three-lives')
  OR p_mode IS NULL OR p_level NOT BETWEEN 1 AND 3 OR p_level IS NULL
 THEN RAISE EXCEPTION 'invalid_proof_configuration';END IF;
 PERFORM 1 FROM public.connect_students WHERE id=p_student AND archived_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'inactive_student';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.connect_enrollments
    WHERE student_id=p_student AND class_id=p_class AND left_at IS NULL)
 AND NOT EXISTS(SELECT 1 FROM public.connect_teacher_players tp
    JOIN public.connect_class_permissions cp ON cp.teacher_id=tp.teacher_id
    WHERE tp.student_id=p_student AND cp.class_id=p_class AND cp.can_manage=true)
 THEN RAISE EXCEPTION 'not_school_subject';END IF;
 v_width:=CASE WHEN p_mode LIKE 'hard-%' THEN
   CASE WHEN p_app='addition-ecrite-simple' THEN CASE p_level WHEN 1 THEN 10 WHEN 2 THEN 12 ELSE 16 END
   ELSE CASE p_level WHEN 1 THEN 9 WHEN 2 THEN 12 ELSE 14 END END
 ELSE CASE WHEN p_app='addition-ecrite-simple' THEN CASE p_level WHEN 1 THEN 3 WHEN 2 THEN 5 ELSE 7 END
   ELSE p_level+4 END END;
 SELECT coalesce(revision,0),coalesce(reset_epoch,0) INTO v_rev,v_epoch
  FROM public.connect_states WHERE student_id=p_student AND app_key=p_app;
 v_rev:=coalesce(v_rev,0);v_epoch:=coalesce(v_epoch,0);
 SELECT * INTO v_previous FROM public.connect_objective_record_school_extended_sessions
 WHERE student_id=p_student AND class_id=p_class AND app_key=p_app
  AND mode=p_mode AND level=p_level AND consumed_at IS NULL
  AND expires_at>now() AND expected_revision=v_rev AND reset_epoch=v_epoch
 ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
 IF FOUND THEN RETURN jsonb_build_object('ok',true,'sessionId',v_previous.session_id,
    'questions',v_previous.questions,'level',p_level,'width',v_width,
    'mode',p_mode,'limit',v_total,'revision',v_rev,'resetEpoch',v_epoch,
    'expiresAt',v_previous.expires_at,'reused',true);END IF;
 FOR v_i IN 1..v_total LOOP
  v_terms_count:=CASE
    WHEN p_mode LIKE 'hard-%' AND p_app='addition-ecrite-simple' THEN 2
    WHEN p_mode LIKE 'hard-%' AND p_app='addition-ecrite-multiple' THEN CASE WHEN p_level=3 THEN 7 ELSE 6 END
    WHEN p_app='addition-ecrite-simple' THEN 2
    ELSE p_level+2+floor(random()*2)::integer END;
  v_addends:='[]'::jsonb;
  FOR v_j IN 1..v_terms_count LOOP
   v_len:=v_width-CASE WHEN v_j>2 AND random()<.48 THEN 1
                       WHEN v_j=2 AND p_app='addition-ecrite-simple' AND random()<.15 THEN 1
                       ELSE 0 END;
   v_base:=power(10::numeric,v_len-1);
   v_num:=v_base+floor(random()*9*v_base);
   v_addends:=v_addends||jsonb_build_array(v_num::text);
  END LOOP;
  v_questions:=v_questions||jsonb_build_array(jsonb_build_object(
   'id','q'||v_i,'op','add','width',v_width,'addends',v_addends));
 END LOOP;
 INSERT INTO public.connect_objective_record_school_extended_sessions(
  student_id,class_id,app_key,mode,level,width,total,expected_revision,
  reset_epoch,questions,expires_at)
 VALUES(p_student,p_class,p_app,p_mode,p_level,v_width,v_total,v_rev,v_epoch,
  v_questions,now()+interval '8 hours')
 RETURNING session_id,expires_at INTO v_session,v_expires;
 RETURN jsonb_build_object('ok',true,'sessionId',v_session,
  'questions',v_questions,'level',p_level,'width',v_width,
  'mode',p_mode,'limit',v_total,'revision',v_rev,'resetEpoch',v_epoch,
  'expiresAt',v_expires,'reused',false);
END $issue$;
REVOKE ALL ON FUNCTION public.connect_objective_record_school_issue_extended_v1(uuid,uuid,text,text,integer)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.connect_objective_record_school_issue_extended_v1(uuid,uuid,text,text,integer)
 TO service_role;
