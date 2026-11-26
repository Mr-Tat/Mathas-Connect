-- Candidate : new scope for the full decimal stage; preserve legacy scope semantics.
BEGIN;
CREATE OR REPLACE FUNCTION public.connect_milieu_restart_v2(p_actor uuid,p_class uuid,p_scope text,p_part text,p_repeat boolean,p_targets jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE ids uuid[]; live_ids uuid[]; member uuid; rowdata jsonb; s jsonb; epoch bigint; rev bigint; xp int; next_state jsonb; old_number integer;
BEGIN
 IF p_scope NOT IN ('student','class') OR p_part NOT IN ('all','integerGeometry','decimalGeometry','decimalStage') OR p_repeat IS NULL OR jsonb_typeof(p_targets) IS DISTINCT FROM 'array' OR jsonb_array_length(p_targets)<1 OR jsonb_array_length(p_targets)>200 OR (p_scope='student' AND jsonb_array_length(p_targets)<>1) THEN RAISE EXCEPTION 'invalid_result'; END IF;
 PERFORM 1 FROM public.connect_milieu_classes WHERE class_id=p_class AND enabled FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'app_class_not_open'; END IF;
 PERFORM 1 FROM public.connect_class_permissions WHERE teacher_id=p_actor AND class_id=p_class AND can_manage FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'professor_required'; END IF;
 SELECT array_agg((x->>'studentId')::uuid ORDER BY (x->>'studentId')::uuid) INTO ids FROM jsonb_array_elements(p_targets) x;
 SELECT coalesce(array_agg(s.id ORDER BY s.id),ARRAY[]::uuid[]) INTO live_ids FROM public.connect_students s JOIN public.connect_milieu_approved a ON a.student_id=s.id WHERE s.archived_at IS NULL AND EXISTS(SELECT 1 FROM public.connect_enrollments e WHERE e.student_id=s.id AND e.class_id=p_class AND e.left_at IS NULL);
 IF cardinality(ids)<>(SELECT count(DISTINCT id) FROM unnest(ids) id) OR NOT(ids<@live_ids) OR (p_scope='class' AND ids IS DISTINCT FROM live_ids) THEN RAISE EXCEPTION 'not_enrolled'; END IF;
 FOREACH member IN ARRAY ids LOOP
  PERFORM 1 FROM public.connect_students WHERE id=member AND archived_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_enrolled'; END IF;
  PERFORM 1 FROM public.connect_enrollments WHERE student_id=member AND class_id=p_class AND left_at IS NULL FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_enrolled'; END IF;
  PERFORM 1 FROM public.connect_milieu_approved WHERE student_id=member FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_enrolled'; END IF;
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
ALTER TABLE public.connect_milieu_classes ALTER COLUMN max_activity SET DEFAULT 4;
REVOKE ALL ON FUNCTION public.connect_milieu_restart_v2(uuid,uuid,text,text,boolean,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.connect_milieu_restart_v2(uuid,uuid,text,text,boolean,jsonb) TO service_role;
COMMIT;
