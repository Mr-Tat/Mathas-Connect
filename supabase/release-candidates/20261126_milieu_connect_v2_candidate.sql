-- CANDIDATE ONLY. Closed by default. No existing result or school visibility altered.
BEGIN;
CREATE TABLE public.connect_milieu_classes(class_id uuid PRIMARY KEY REFERENCES public.connect_classes(id),enabled boolean NOT NULL DEFAULT false,max_activity int NOT NULL DEFAULT 6 CHECK(max_activity BETWEEN 1 AND 6));
CREATE TABLE public.connect_milieu_approved(student_id uuid PRIMARY KEY REFERENCES public.connect_students(id));
CREATE TABLE public.connect_milieu_runs(student_id uuid NOT NULL REFERENCES public.connect_students(id),class_id uuid NOT NULL REFERENCES public.connect_classes(id),event_id uuid NOT NULL,epoch bigint NOT NULL,activity text NOT NULL,mode text,seed uuid NOT NULL DEFAULT gen_random_uuid(),created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(student_id,event_id));
CREATE TABLE public.connect_milieu_receipts(student_id uuid NOT NULL,class_id uuid NOT NULL,event_id uuid NOT NULL,epoch bigint NOT NULL,proof jsonb NOT NULL,judgement jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(student_id,event_id),FOREIGN KEY(student_id,event_id) REFERENCES public.connect_milieu_runs(student_id,event_id));
CREATE TABLE public.connect_milieu_shares(student_id uuid NOT NULL,class_id uuid NOT NULL,event_id uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(student_id,class_id,event_id),FOREIGN KEY(student_id,event_id) REFERENCES public.connect_milieu_receipts(student_id,event_id));
CREATE TABLE public.connect_milieu_archives(student_id uuid NOT NULL,class_id uuid NOT NULL,epoch bigint NOT NULL,part text NOT NULL,state jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(student_id,epoch));
CREATE FUNCTION public.connect_milieu_subject_v2(p_actor uuid,p_class uuid,p_teacher boolean)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE pupil uuid;
BEGIN
 PERFORM 1 FROM public.connect_milieu_classes WHERE class_id=p_class AND enabled FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'app_class_not_open'; END IF;
 PERFORM 1 FROM public.connect_apps WHERE app_key='milieu-segment' AND enabled FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'app_disabled'; END IF;
 IF p_teacher THEN
  SELECT s.id INTO STRICT pupil FROM public.connect_teacher_players t JOIN public.connect_students s ON s.id=t.student_id AND s.archived_at IS NULL JOIN public.connect_class_permissions cp ON cp.teacher_id=t.teacher_id AND cp.class_id=p_class AND cp.can_manage WHERE t.teacher_id=p_actor FOR UPDATE OF s FOR SHARE OF cp,t;
 ELSE
  SELECT s.id INTO STRICT pupil FROM public.connect_devices d JOIN public.connect_students s ON s.id=d.student_id AND s.archived_at IS NULL JOIN public.connect_enrollments e ON e.student_id=s.id AND e.class_id=p_class AND e.left_at IS NULL WHERE d.auth_user_id=p_actor AND d.state='approved' FOR UPDATE OF s FOR SHARE OF d,e;
 END IF;
 PERFORM 1 FROM public.connect_milieu_approved WHERE student_id=pupil FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'fictive_profile_required'; END IF;
 RETURN pupil;
EXCEPTION WHEN no_data_found OR too_many_rows THEN RAISE EXCEPTION 'approved_identity_required';
END $$;
CREATE FUNCTION public.connect_milieu_snapshot_v2(p_student uuid,p_class uuid DEFAULT NULL) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT jsonb_build_object('ok',true,'appKey','milieu-segment','studentId',s.id,'displayName',s.display_name,
 'avatar',jsonb_build_object('kind',s.avatar_kind,'value',s.avatar_value,'color',s.avatar_color),
 'maxActivity',coalesce((SELECT max_activity FROM public.connect_milieu_classes WHERE class_id=p_class),6),'revision',coalesce(st.revision,0),'resetEpoch',coalesce(st.reset_epoch,0),'state',coalesce(st.state_data,'{}'::jsonb),
 'totalXp',(SELECT coalesce(sum(xp_credited),0) FROM public.connect_xp_credits WHERE student_id=s.id),
 'appXp',(SELECT coalesce(sum(xp_credited),0) FROM public.connect_xp_credits WHERE student_id=s.id AND app_key='milieu-segment'),
 'day',to_char(now() AT TIME ZONE 'Europe/Brussels','YYYY-MM-DD'))
 FROM public.connect_students s LEFT JOIN public.connect_states st ON st.student_id=s.id AND st.app_key='milieu-segment' WHERE s.id=p_student AND s.archived_at IS NULL;
$$;
CREATE FUNCTION public.connect_milieu_load_v2(p_actor uuid,p_class uuid,p_teacher boolean,p_expected uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE pupil uuid;
BEGIN pupil:=public.connect_milieu_subject_v2(p_actor,p_class,p_teacher);
 IF p_expected IS NOT NULL AND p_expected<>pupil THEN RAISE EXCEPTION 'identity_binding_conflict'; END IF;
 RETURN public.connect_milieu_snapshot_v2(pupil,p_class);
END $$;
CREATE FUNCTION public.connect_milieu_begin_v2(p_actor uuid,p_class uuid,p_teacher boolean,p_student uuid,p_event uuid,p_revision bigint,p_epoch bigint,p_activity text,p_mode text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE pupil uuid; s jsonb; r public.connect_milieu_runs%ROWTYPE;
BEGIN
 pupil:=public.connect_milieu_subject_v2(p_actor,p_class,p_teacher);
 IF pupil IS DISTINCT FROM p_student THEN RAISE EXCEPTION 'identity_binding_conflict'; END IF;
 s:=public.connect_milieu_snapshot_v2(pupil,p_class);
 IF (s->>'resetEpoch')::bigint<>p_epoch THEN RAISE EXCEPTION 'stale_reset_epoch'; END IF;
 IF (s->>'revision')::bigint<>p_revision THEN RAISE EXCEPTION 'revision_conflict'; END IF;
 IF p_activity NOT IN ('even','odd','mix','gi1','gi2','decimal','g1','g2','g3') OR (p_mode IS NOT NULL AND (p_mode NOT IN ('lives','sudden') OR p_activity NOT IN ('gi2','g3'))) THEN RAISE EXCEPTION 'invalid_result'; END IF;
 IF NOT p_teacher AND (CASE p_activity WHEN 'even' THEN 1 WHEN 'odd' THEN 2 WHEN 'mix' THEN 3 WHEN 'gi1' THEN 4 WHEN 'gi2' THEN 4 WHEN 'decimal' THEN 5 ELSE 6 END)>(s->>'maxActivity')::int THEN RAISE EXCEPTION 'activity_locked'; END IF;
 INSERT INTO public.connect_milieu_runs(student_id,class_id,event_id,epoch,activity,mode) VALUES(pupil,p_class,p_event,p_epoch,p_activity,p_mode) ON CONFLICT DO NOTHING;
 SELECT * INTO STRICT r FROM public.connect_milieu_runs WHERE student_id=pupil AND event_id=p_event;
 IF r.class_id<>p_class OR r.epoch<>p_epoch OR r.activity<>p_activity OR r.mode IS DISTINCT FROM p_mode THEN RAISE EXCEPTION 'event_id_reused'; END IF;
 RETURN s||jsonb_build_object('eventId',p_event,'seed',r.seed,'activity',r.activity,'mode',r.mode);
END $$;
CREATE FUNCTION public.connect_milieu_event_v2(p_actor uuid,p_class uuid,p_teacher boolean,p_student uuid,p_event uuid,p_epoch bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE pupil uuid; r public.connect_milieu_runs%ROWTYPE; rec public.connect_milieu_receipts%ROWTYPE; s jsonb;
BEGIN
 pupil:=public.connect_milieu_subject_v2(p_actor,p_class,p_teacher);
 IF pupil IS DISTINCT FROM p_student THEN RAISE EXCEPTION 'identity_binding_conflict'; END IF;
 s:=public.connect_milieu_snapshot_v2(pupil,p_class);
 IF (s->>'resetEpoch')::bigint<>p_epoch THEN RAISE EXCEPTION 'stale_reset_epoch'; END IF;
 SELECT * INTO r FROM public.connect_milieu_runs WHERE student_id=pupil AND event_id=p_event AND class_id=p_class AND epoch=p_epoch;
 IF NOT FOUND THEN RAISE EXCEPTION 'run_missing'; END IF;
 SELECT * INTO rec FROM public.connect_milieu_receipts WHERE student_id=pupil AND event_id=p_event;
 RETURN s||jsonb_build_object('eventId',p_event,'seed',r.seed,'activity',r.activity,'mode',r.mode,'receipt',CASE WHEN rec.event_id IS NULL THEN NULL ELSE jsonb_build_object('proof',rec.proof,'judgement',rec.judgement) END);
END $$;
-- p_state and p_judgement are calculated ONLY in the trusted Edge function.
-- Browser roles have no access to this routine, including via PostgREST.
CREATE FUNCTION public.connect_milieu_commit_v2(p_actor uuid,p_class uuid,p_teacher boolean,p_student uuid,p_event uuid,p_epoch bigint,p_revision bigint,p_proof jsonb,p_judgement jsonb,p_state jsonb,p_xp integer,p_cups text[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE s jsonb; old_xp integer; t text;
BEGIN
 s:=public.connect_milieu_event_v2(p_actor,p_class,p_teacher,p_student,p_event,p_epoch);
 IF s->'receipt' IS DISTINCT FROM 'null'::jsonb THEN
  IF s#>'{receipt,proof}' IS DISTINCT FROM p_proof THEN RAISE EXCEPTION 'event_id_reused'; END IF;
  RETURN s - 'seed' - 'receipt' || jsonb_build_object('duplicate',true,'xpDelta',0,'judgement',s#>'{receipt,judgement}');
 END IF;
 IF (s->>'revision')::bigint<>p_revision THEN RAISE EXCEPTION 'revision_conflict'; END IF;
 old_xp:=(s->>'appXp')::int;
 IF p_xp<old_xp OR p_xp>10000000 OR (p_state->>'epoch')::bigint IS DISTINCT FROM p_epoch OR jsonb_typeof(p_state) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'invalid_result'; END IF;
 INSERT INTO public.connect_states(student_id,app_key,schema_version,revision,reset_epoch,state_data) VALUES(p_student,'milieu-segment',2,p_revision+1,p_epoch,p_state)
 ON CONFLICT(student_id,app_key) DO UPDATE SET state_data=excluded.state_data,revision=excluded.revision,schema_version=2,updated_at=now();
 INSERT INTO public.connect_xp_credits(student_id,app_key,xp_credited,evidence,ruleset_version) VALUES(p_student,'milieu-segment',p_xp,jsonb_build_object('source','milieu-v2'),2)
 ON CONFLICT(student_id,app_key) DO UPDATE SET xp_credited=excluded.xp_credited,evidence=excluded.evidence,ruleset_version=2,updated_at=now();
 FOREACH t IN ARRAY p_cups LOOP INSERT INTO public.connect_trophy_achievements(student_id,app_key,trophy_key) VALUES(p_student,'milieu-segment',t) ON CONFLICT DO NOTHING; END LOOP;
 INSERT INTO public.connect_level_profiles(student_id,highest_level_reached,level_ruleset_version,updated_at)
 SELECT p_student,least(999,CASE WHEN sum(xp_credited)<300 THEN 1+sum(xp_credited)/50 ELSE 7+(sum(xp_credited)-300)/100 END)::int,2,now() FROM public.connect_xp_credits WHERE student_id=p_student
 ON CONFLICT(student_id) DO UPDATE SET highest_level_reached=greatest(connect_level_profiles.highest_level_reached,excluded.highest_level_reached),level_ruleset_version=2,updated_at=now();
 INSERT INTO public.connect_milieu_receipts(student_id,class_id,event_id,epoch,proof,judgement) VALUES(p_student,p_class,p_event,p_epoch,p_proof,p_judgement);
 RETURN public.connect_milieu_snapshot_v2(p_student,p_class)||jsonb_build_object('eventId',p_event,'duplicate',false,'xpDelta',p_xp-old_xp,'judgement',p_judgement);
END $$;
-- Explicit consent only, scoped to the student's certified event and original class.
CREATE FUNCTION public.connect_milieu_share_v2(p_actor uuid,p_class uuid,p_teacher boolean,p_student uuid,p_event uuid,p_epoch bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE s jsonb; pupil uuid; r public.connect_milieu_receipts%ROWTYPE; points int; since timestamptz; best int; today_best int; is_today boolean;
BEGIN
 pupil:=public.connect_milieu_subject_v2(p_actor,p_class,p_teacher);
 IF pupil IS DISTINCT FROM p_student THEN RAISE EXCEPTION 'identity_binding_conflict'; END IF;
 s:=public.connect_milieu_snapshot_v2(pupil,p_class);
 IF (s->>'resetEpoch')::bigint<>p_epoch THEN RAISE EXCEPTION 'stale_reset_epoch'; END IF;
 SELECT * INTO r FROM public.connect_milieu_receipts WHERE student_id=pupil AND class_id=p_class AND event_id=p_event;
 IF NOT FOUND THEN RAISE EXCEPTION 'run_missing'; END IF;
 -- After a targeted reset, old certified bests of untouched activities may still be shared.
 -- A request carrying an old epoch can never publish anything.
 IF NOT EXISTS(SELECT 1 FROM jsonb_each(coalesce(s#>ARRAY['state','scoresByClass',p_class::text],'{}'::jsonb)) x WHERE x.value->>'dayEvent'=p_event::text OR x.value->>'allEvent'=p_event::text)
 AND r.epoch<>p_epoch THEN RAISE EXCEPTION 'stale_reset_epoch'; END IF;
 points:=coalesce((r.judgement->>'points')::int,0);
 IF points<=0 THEN RAISE EXCEPTION 'invalid_result'; END IF;
 SELECT score_since INTO since FROM public.connect_projection_score_periods WHERE class_id=p_class AND app_key='milieu-segment';
 since:=coalesce(since,'1970-01-01Z'::timestamptz);
 IF r.created_at<since THEN RAISE EXCEPTION 'score_reset'; END IF;
 SELECT coalesce(max(e.game_points),0),coalesce(max(e.game_points) FILTER(WHERE (e.played_at AT TIME ZONE 'Europe/Brussels')::date=(now() AT TIME ZONE 'Europe/Brussels')::date),0)
 INTO best,today_best FROM public.connect_projection_score_events e JOIN public.connect_projection_score_consents c USING(student_id,class_id,app_key,event_id)
 WHERE e.student_id=pupil AND e.class_id=p_class AND e.app_key='milieu-segment' AND e.played_at>=since AND e.captured_at>=since;
 is_today:=(r.created_at AT TIME ZONE 'Europe/Brussels')::date=(now() AT TIME ZONE 'Europe/Brussels')::date;
 IF EXISTS(SELECT 1 FROM public.connect_projection_score_consents WHERE student_id=pupil AND class_id=p_class AND app_key='milieu-segment' AND event_id=p_event)
 THEN RETURN jsonb_build_object('ok',true,'studentId',pupil,'eventId',p_event,'points',points,'consentRecorded',true,'duplicate',true,'boardBest',best,'boardTodayBest',today_best); END IF;
 IF points<=best AND (NOT is_today OR points<=today_best) THEN RETURN jsonb_build_object('ok',true,'studentId',pupil,'eventId',p_event,'points',points,'consentRecorded',false,'alreadyCovered',true,'boardBest',best,'boardTodayBest',today_best); END IF;
 INSERT INTO public.connect_projection_score_events(student_id,class_id,app_key,event_id,game_mode,game_score,game_total,game_points,played_at)
 VALUES(pupil,p_class,'milieu-segment',p_event,concat_ws(':',r.judgement->>'activity',r.judgement->>'mode'),(r.judgement->>'firstGood')::int,(r.judgement->>'total')::int,points,r.created_at) ON CONFLICT DO NOTHING;
 INSERT INTO public.connect_projection_score_consents(student_id,class_id,app_key,event_id) VALUES(pupil,p_class,'milieu-segment',p_event) ON CONFLICT DO NOTHING;
 INSERT INTO public.connect_milieu_shares(student_id,class_id,event_id) VALUES(pupil,p_class,p_event) ON CONFLICT DO NOTHING;
 RETURN jsonb_build_object('ok',true,'studentId',pupil,'eventId',p_event,'points',points,'consentRecorded',true,'boardBest',greatest(best,points),'boardTodayBest',greatest(today_best,CASE WHEN is_today THEN points ELSE 0 END));
END $$;
CREATE FUNCTION public.connect_milieu_board_v2(p_actor uuid,p_class uuid,p_teacher boolean,p_student uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE pupil uuid; since timestamptz; b int; d int;
BEGIN
 pupil:=public.connect_milieu_subject_v2(p_actor,p_class,p_teacher);
 IF pupil IS DISTINCT FROM p_student THEN RAISE EXCEPTION 'identity_binding_conflict'; END IF;
 SELECT score_since INTO since FROM public.connect_projection_score_periods WHERE class_id=p_class AND app_key='milieu-segment';
 since:=coalesce(since,'1970-01-01Z'::timestamptz);
 SELECT coalesce(max(e.game_points),0),coalesce(max(e.game_points) FILTER(WHERE (e.played_at AT TIME ZONE 'Europe/Brussels')::date=(now() AT TIME ZONE 'Europe/Brussels')::date),0)
 INTO b,d FROM public.connect_projection_score_events e JOIN public.connect_projection_score_consents c USING(student_id,class_id,app_key,event_id)
 WHERE e.student_id=pupil AND e.class_id=p_class AND e.app_key='milieu-segment' AND e.played_at>=since AND e.captured_at>=since;
 RETURN jsonb_build_object('ok',true,'boardBest',b,'boardTodayBest',d,'scoreSince',since);
END $$;
CREATE FUNCTION public.connect_milieu_teacher_summary_v2(p_actor uuid,p_class uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE students jsonb;
BEGIN
 PERFORM 1 FROM public.connect_milieu_classes WHERE class_id=p_class AND enabled FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'app_class_not_open'; END IF;
 PERFORM 1 FROM public.connect_class_permissions WHERE teacher_id=p_actor AND class_id=p_class AND (can_manage OR can_view_results) FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'professor_required'; END IF;
 SELECT coalesce(jsonb_agg(public.connect_milieu_snapshot_v2(s.id,p_class) ORDER BY s.display_name,s.id),'[]'::jsonb) INTO students
 FROM public.connect_students s JOIN public.connect_milieu_approved a ON a.student_id=s.id
 WHERE s.archived_at IS NULL AND EXISTS(SELECT 1 FROM public.connect_enrollments e WHERE e.student_id=s.id AND e.class_id=p_class AND e.left_at IS NULL);
 RETURN jsonb_build_object('ok',true,'students',students);
END $$;
CREATE FUNCTION public.connect_milieu_restart_v2(p_actor uuid,p_class uuid,p_scope text,p_part text,p_repeat boolean,p_targets jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE ids uuid[]; live_ids uuid[]; member uuid; rowdata jsonb; s jsonb; epoch bigint; rev bigint; xp int; next_state jsonb; old_number integer;
BEGIN
 IF p_scope NOT IN ('student','class') OR p_part NOT IN ('all','integerGeometry','decimalGeometry') OR p_repeat IS NULL OR jsonb_typeof(p_targets) IS DISTINCT FROM 'array' OR jsonb_array_length(p_targets)<1 OR jsonb_array_length(p_targets)>200 OR (p_scope='student' AND jsonb_array_length(p_targets)<>1) THEN RAISE EXCEPTION 'invalid_result'; END IF;
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
-- Class ceiling is optional and defaults to the entire mastery-based progression.
-- A lower ceiling affects new runs, never an already authorized run or archived XP.
CREATE FUNCTION public.connect_milieu_class_cap_v2(p_actor uuid,p_class uuid,p_max int DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE cap int;
BEGIN
 PERFORM 1 FROM public.connect_class_permissions WHERE teacher_id=p_actor AND class_id=p_class AND can_manage FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'professor_required'; END IF;
 IF p_max IS NULL THEN SELECT max_activity INTO cap FROM public.connect_milieu_classes WHERE class_id=p_class AND enabled FOR SHARE;
 ELSE
  IF p_max NOT BETWEEN 1 AND 6 THEN RAISE EXCEPTION 'invalid_result'; END IF;
  UPDATE public.connect_milieu_classes SET max_activity=p_max WHERE class_id=p_class AND enabled RETURNING max_activity INTO cap;
 END IF;
 IF NOT FOUND THEN RAISE EXCEPTION 'app_class_not_open'; END IF;
 RETURN jsonb_build_object('ok',true,'maxActivity',cap);
END $$;
DO $permissions$
DECLARE n text;
BEGIN
 FOR n IN SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'connect_milieu_%' LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',n);
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',n);
  EXECUTE format('GRANT SELECT,INSERT,UPDATE ON public.%I TO service_role',n);
 END LOOP;
 FOR n IN SELECT p.oid::regprocedure::text FROM pg_proc p JOIN pg_namespace ns ON ns.oid=p.pronamespace WHERE ns.nspname='public' AND p.proname LIKE 'connect_milieu_%' LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',n);
  EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',n);
 END LOOP;
END $permissions$;
COMMIT;
