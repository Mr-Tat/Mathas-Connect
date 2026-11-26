-- School policy: existing rows are TEST/pilot (NULL); school rows use a preset.
-- The class and the approved device are still mandatory. Invisible school cards
-- deny student access; teachers with can_manage can prepare class controls.
BEGIN;
ALTER TABLE public.connect_milieu_classes ADD COLUMN IF NOT EXISTS preset_slug text CHECK(preset_slug IN ('observation','phase1','phase2','phase2b','2eco'));
CREATE OR REPLACE FUNCTION public.connect_milieu_subject_v2(p_actor uuid,p_class uuid,p_teacher boolean)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE pupil uuid; preset text;
BEGIN
 SELECT preset_slug INTO preset FROM public.connect_milieu_classes WHERE class_id=p_class AND enabled FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'app_class_not_open'; END IF;
 PERFORM 1 FROM public.connect_apps WHERE app_key='milieu-segment' AND enabled FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'app_disabled'; END IF;
 IF preset IS NOT NULL AND NOT p_teacher THEN
  PERFORM 1 FROM public.connect_hub_preset_entries WHERE preset_slug=preset AND app_key='milieu-segment' AND visible FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'app_class_not_open'; END IF;
 END IF;
 IF p_teacher THEN
  SELECT s.id INTO STRICT pupil FROM public.connect_teacher_players t JOIN public.connect_students s ON s.id=t.student_id AND s.archived_at IS NULL JOIN public.connect_class_permissions cp ON cp.teacher_id=t.teacher_id AND cp.class_id=p_class AND cp.can_manage WHERE t.teacher_id=p_actor FOR UPDATE OF s FOR SHARE OF cp,t;
 ELSE
  SELECT s.id INTO STRICT pupil FROM public.connect_devices d JOIN public.connect_students s ON s.id=d.student_id AND s.archived_at IS NULL JOIN public.connect_enrollments e ON e.student_id=s.id AND e.class_id=p_class AND e.left_at IS NULL WHERE d.auth_user_id=p_actor AND d.state='approved' FOR UPDATE OF s FOR SHARE OF d,e;
 END IF;
 IF preset IS NULL THEN
  PERFORM 1 FROM public.connect_milieu_approved WHERE student_id=pupil FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'fictive_profile_required'; END IF;
 END IF;
 RETURN pupil;
EXCEPTION WHEN no_data_found OR too_many_rows THEN RAISE EXCEPTION 'approved_identity_required';
END $$;

CREATE OR REPLACE FUNCTION public.connect_milieu_teacher_summary_v2(p_actor uuid,p_class uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE students jsonb; preset text;
BEGIN
 SELECT preset_slug INTO preset FROM public.connect_milieu_classes WHERE class_id=p_class AND enabled FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'app_class_not_open'; END IF;
 PERFORM 1 FROM public.connect_class_permissions WHERE teacher_id=p_actor AND class_id=p_class AND (can_manage OR can_view_results) FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'professor_required'; END IF;
 SELECT coalesce(jsonb_agg(public.connect_milieu_snapshot_v2(s.id,p_class) ORDER BY s.display_name,s.id),'[]'::jsonb) INTO students
 FROM public.connect_students s
 WHERE s.archived_at IS NULL AND (preset IS NOT NULL OR EXISTS(SELECT 1 FROM public.connect_milieu_approved a WHERE a.student_id=s.id)) AND EXISTS(SELECT 1 FROM public.connect_enrollments e WHERE e.student_id=s.id AND e.class_id=p_class AND e.left_at IS NULL);
 RETURN jsonb_build_object('ok',true,'students',students);
END $$;

CREATE OR REPLACE FUNCTION public.connect_milieu_restart_v2(p_actor uuid,p_class uuid,p_scope text,p_part text,p_repeat boolean,p_targets jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE ids uuid[]; live_ids uuid[]; member uuid; rowdata jsonb; s jsonb; epoch bigint; rev bigint; xp int; next_state jsonb; old_number integer; preset text;
BEGIN
 IF p_scope NOT IN ('student','class') OR p_part NOT IN ('all','integerGeometry','decimalGeometry','decimalStage') OR p_repeat IS NULL OR jsonb_typeof(p_targets) IS DISTINCT FROM 'array' OR jsonb_array_length(p_targets)<1 OR jsonb_array_length(p_targets)>200 OR (p_scope='student' AND jsonb_array_length(p_targets)<>1) THEN RAISE EXCEPTION 'invalid_result'; END IF;
 SELECT preset_slug INTO preset FROM public.connect_milieu_classes WHERE class_id=p_class AND enabled FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'app_class_not_open'; END IF;
 PERFORM 1 FROM public.connect_class_permissions WHERE teacher_id=p_actor AND class_id=p_class AND can_manage FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'professor_required'; END IF;
 SELECT array_agg((x->>'studentId')::uuid ORDER BY (x->>'studentId')::uuid) INTO ids FROM jsonb_array_elements(p_targets) x;
 SELECT coalesce(array_agg(s.id ORDER BY s.id),ARRAY[]::uuid[]) INTO live_ids FROM public.connect_students s WHERE s.archived_at IS NULL AND (preset IS NOT NULL OR EXISTS(SELECT 1 FROM public.connect_milieu_approved a WHERE a.student_id=s.id)) AND EXISTS(SELECT 1 FROM public.connect_enrollments e WHERE e.student_id=s.id AND e.class_id=p_class AND e.left_at IS NULL);
 IF cardinality(ids)<>(SELECT count(DISTINCT id) FROM unnest(ids) id) OR NOT(ids<@live_ids) OR (p_scope='class' AND ids IS DISTINCT FROM live_ids) THEN RAISE EXCEPTION 'not_enrolled'; END IF;
 FOREACH member IN ARRAY ids LOOP
  PERFORM 1 FROM public.connect_students WHERE id=member AND archived_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_enrolled'; END IF;
  PERFORM 1 FROM public.connect_enrollments WHERE student_id=member AND class_id=p_class AND left_at IS NULL FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_enrolled'; END IF;
  IF preset IS NULL THEN
   PERFORM 1 FROM public.connect_milieu_approved WHERE student_id=member FOR SHARE;
   IF NOT FOUND THEN RAISE EXCEPTION 'not_enrolled'; END IF;
  END IF;
  SELECT x INTO rowdata FROM jsonb_array_elements(p_targets) x WHERE (x->>'studentId')::uuid=member;
  s:=public.connect_milieu_snapshot_v2(member,p_class);epoch:=(s->>'resetEpoch')::bigint;rev:=(s->>'revision')::bigint;xp:=(s->>'appXp')::int;next_state:=rowdata->'state';
  IF (rowdata->>'epoch')::bigint IS DISTINCT FROM epoch THEN RAISE EXCEPTION 'stale_reset_epoch'; END IF;
  IF (rowdata->>'revision')::bigint IS DISTINCT FROM rev THEN RAISE EXCEPTION 'revision_conflict'; END IF;
  IF (next_state->>'epoch')::bigint IS DISTINCT FROM epoch+1 OR jsonb_typeof(next_state) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'invalid_result'; END IF;
  INSERT INTO public.connect_milieu_archives(student_id,class_id,epoch,part,state) VALUES(member,p_class,epoch,p_part,s->'state');
  SELECT parcours_number INTO old_number FROM public.connect_parcours_current WHERE student_id=member AND app_key='milieu-segment';
  old_number:=coalesce(old_number,1);
  INSERT INTO public.connect_parcours_history(student_id,app_key,parcours_number,class_id,repeat_xp,state_data,archived_xp) VALUES(member,'milieu-segment',old_number,p_class,coalesce((SELECT repeat_xp FROM public.connect_parcours_current WHERE student_id=member AND app_key='milieu-segment'),false),s->'state',xp);
  INSERT INTO public.connect_parcours_current(student_id,app_key,parcours_number,repeat_xp) VALUES(member,'milieu-segment',old_number+1,p_repeat) ON CONFLICT(student_id,app_key) DO UPDATE SET parcours_number=excluded.parcours_number,repeat_xp=excluded.repeat_xp,started_at=now();
  INSERT INTO public.connect_states(student_id,app_key,schema_version,revision,reset_epoch,state_data) VALUES(member,'milieu-segment',2,rev+1,epoch+1,next_state) ON CONFLICT(student_id,app_key) DO UPDATE SET state_data=excluded.state_data,revision=excluded.revision,reset_epoch=excluded.reset_epoch,schema_version=2,updated_at=now();
 END LOOP;
 RETURN jsonb_build_object('ok',true,'count',cardinality(ids),'part',p_part);
END $$;

REVOKE ALL ON FUNCTION public.connect_milieu_subject_v2(uuid,uuid,boolean), public.connect_milieu_teacher_summary_v2(uuid,uuid), public.connect_milieu_restart_v2(uuid,uuid,text,text,boolean,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.connect_milieu_subject_v2(uuid,uuid,boolean), public.connect_milieu_teacher_summary_v2(uuid,uuid), public.connect_milieu_restart_v2(uuid,uuid,text,text,boolean,jsonb) TO service_role;
COMMIT;
