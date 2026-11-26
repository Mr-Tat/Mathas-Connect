-- CANDIDATE ONLY. Closed by default. No existing result or school visibility altered.
BEGIN;
CREATE TABLE public.connect_milieu_classes(class_id uuid PRIMARY KEY REFERENCES public.connect_classes(id),enabled boolean NOT NULL DEFAULT false);
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
CREATE FUNCTION public.connect_milieu_snapshot_v2(p_student uuid) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT jsonb_build_object('ok',true,'appKey','milieu-segment','studentId',s.id,'displayName',s.display_name,
 'avatar',jsonb_build_object('kind',s.avatar_kind,'value',s.avatar_value,'color',s.avatar_color),
 'revision',coalesce(st.revision,0),'resetEpoch',coalesce(st.reset_epoch,0),'state',coalesce(st.state_data,'{}'::jsonb),
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
 RETURN public.connect_milieu_snapshot_v2(pupil);
END $$;
CREATE FUNCTION public.connect_milieu_begin_v2(p_actor uuid,p_class uuid,p_teacher boolean,p_student uuid,p_event uuid,p_revision bigint,p_epoch bigint,p_activity text,p_mode text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE pupil uuid; s jsonb; r public.connect_milieu_runs%ROWTYPE;
BEGIN
 pupil:=public.connect_milieu_subject_v2(p_actor,p_class,p_teacher);
 IF pupil IS DISTINCT FROM p_student THEN RAISE EXCEPTION 'identity_binding_conflict'; END IF;
 s:=public.connect_milieu_snapshot_v2(pupil);
 IF (s->>'resetEpoch')::bigint<>p_epoch THEN RAISE EXCEPTION 'stale_reset_epoch'; END IF;
 IF (s->>'revision')::bigint<>p_revision THEN RAISE EXCEPTION 'revision_conflict'; END IF;
 IF p_activity NOT IN ('even','odd','mix','gi1','gi2','decimal','g1','g2','g3') OR (p_mode IS NOT NULL AND (p_mode NOT IN ('lives','sudden') OR p_activity NOT IN ('gi2','g3'))) THEN RAISE EXCEPTION 'invalid_result'; END IF;
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
 s:=public.connect_milieu_snapshot_v2(pupil);
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
 INSERT INTO public.connect_milieu_receipts(student_id,class_id,event_id,epoch,proof,judgement) VALUES(p_student,p_class,p_event,p_epoch,p_proof,p_judgement);
 RETURN public.connect_milieu_snapshot_v2(p_student)||jsonb_build_object('eventId',p_event,'duplicate',false,'xpDelta',p_xp-old_xp,'judgement',p_judgement);
END $$;
-- Explicit consent only, scoped to the student's certified event and original class.
CREATE FUNCTION public.connect_milieu_share_v2(p_actor uuid,p_class uuid,p_teacher boolean,p_student uuid,p_event uuid,p_epoch bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE s jsonb; points bigint;
BEGIN
 s:=public.connect_milieu_event_v2(p_actor,p_class,p_teacher,p_student,p_event,p_epoch);
 points:=coalesce((s#>>'{receipt,judgement,points}')::bigint,0);
 IF points<=0 THEN RAISE EXCEPTION 'invalid_result'; END IF;
 INSERT INTO public.connect_milieu_shares(student_id,class_id,event_id) VALUES(p_student,p_class,p_event) ON CONFLICT DO NOTHING;
 RETURN jsonb_build_object('ok',true,'studentId',p_student,'eventId',p_event,'points',points);
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
