-- Candidate only. No destructive changes. Refuse rollout if v2 activity already exists.
BEGIN;
LOCK TABLE public.connect_milieu_runs, public.connect_milieu_receipts IN SHARE ROW EXCLUSIVE MODE;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM public.connect_milieu_runs) OR EXISTS(SELECT 1 FROM public.connect_milieu_receipts) OR EXISTS(SELECT 1 FROM public.connect_xp_credits WHERE app_key='milieu-segment' AND xp_credited>0) OR EXISTS(SELECT 1 FROM public.connect_trophy_achievements WHERE app_key='milieu-segment') THEN RAISE EXCEPTION 'milieu_v3_requires_existing_progression_review'; END IF; END $$;
CREATE OR REPLACE FUNCTION public.connect_milieu_begin_v2(p_actor uuid,p_class uuid,p_teacher boolean,p_student uuid,p_event uuid,p_revision bigint,p_epoch bigint,p_activity text,p_mode text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE pupil uuid; s jsonb; r public.connect_milieu_runs%ROWTYPE;
BEGIN
 pupil:=public.connect_milieu_subject_v2(p_actor,p_class,p_teacher);
 IF pupil IS DISTINCT FROM p_student THEN RAISE EXCEPTION 'identity_binding_conflict'; END IF;
 s:=public.connect_milieu_snapshot_v2(pupil,p_class);
 IF (s->>'resetEpoch')::bigint<>p_epoch THEN RAISE EXCEPTION 'stale_reset_epoch'; END IF;
 IF (s->>'revision')::bigint<>p_revision THEN RAISE EXCEPTION 'revision_conflict'; END IF;
 IF p_activity NOT IN ('even','odd','mix','gi1','gi2','decimal1','decimal2','decimal3','g1','g2','g3') OR (p_mode IS NOT NULL AND (p_mode NOT IN ('lives','sudden') OR p_activity NOT IN ('gi2','g3'))) THEN RAISE EXCEPTION 'invalid_result'; END IF;
 IF NOT p_teacher AND (CASE p_activity WHEN 'even' THEN 1 WHEN 'odd' THEN 2 WHEN 'mix' THEN 3 WHEN 'gi1' THEN 4 WHEN 'gi2' THEN 4 WHEN 'decimal1' THEN 5 WHEN 'decimal2' THEN 5 WHEN 'decimal3' THEN 5 ELSE 6 END)>(s->>'maxActivity')::int THEN RAISE EXCEPTION 'activity_locked'; END IF;
 INSERT INTO public.connect_milieu_runs(student_id,class_id,event_id,epoch,activity,mode) VALUES(pupil,p_class,p_event,p_epoch,p_activity,p_mode) ON CONFLICT DO NOTHING;
 SELECT * INTO STRICT r FROM public.connect_milieu_runs WHERE student_id=pupil AND event_id=p_event;
 IF r.class_id<>p_class OR r.epoch<>p_epoch OR r.activity<>p_activity OR r.mode IS DISTINCT FROM p_mode THEN RAISE EXCEPTION 'event_id_reused'; END IF;
 RETURN s||jsonb_build_object('eventId',p_event,'seed',r.seed,'activity',r.activity,'mode',r.mode);
END $$;

REVOKE ALL ON FUNCTION public.connect_milieu_begin_v2(uuid,uuid,boolean,uuid,uuid,bigint,bigint,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.connect_milieu_begin_v2(uuid,uuid,boolean,uuid,uuid,bigint,bigint,text,text) TO service_role;
COMMIT;
