-- OFFLINE CANDIDATE. Requires separate production authorization and schema audit.
-- New app only; no school preset rows, existing RPC replacements or data reset.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='45s';
DO $guard$
BEGIN
 IF EXISTS(SELECT 1 FROM public.connect_apps WHERE app_key='abaque-longueurs')
 OR EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname LIKE 'connect_abaque_%')
 THEN RAISE EXCEPTION 'abaque_already_exists_review_required'; END IF;
 IF to_regclass('public.connect_trophy_achievements') IS NULL THEN RAISE EXCEPTION 'permanent_trophy_ledger_required'; END IF;
END $guard$;
INSERT INTO public.connect_apps(app_key,title,launch_url,image_url,enabled,hub_section,featured,display_order)
VALUES('abaque-longueurs','Abaque des longueurs','https://mr-tat.github.io/Mathas-Connect/apps/GRAN-abaque-m-1/?connect=1',NULL,false,'outil',false,70);
INSERT INTO public.connect_lab_hub_visibility(app_key,visible) VALUES('abaque-longueurs',false);

-- Future school access is a data activation, never a second application.
CREATE TABLE public.connect_abaque_classes(
 class_id uuid PRIMARY KEY REFERENCES public.connect_classes(id),
 enabled boolean NOT NULL DEFAULT false,pilot_only boolean NOT NULL DEFAULT true
);
INSERT INTO public.connect_abaque_classes(class_id) VALUES('4bf3400d-a315-4ea4-a2f3-afaca24dc9b9');
ALTER TABLE public.connect_abaque_classes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.connect_abaque_classes FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.connect_abaque_classes TO service_role;

-- Empty by default: a Lab enrollment alone does not certify a fictitious pupil.
CREATE TABLE public.connect_abaque_pilot_students(
 student_id uuid PRIMARY KEY REFERENCES public.connect_students(id) ON DELETE CASCADE,
 approved_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.connect_abaque_pilot_students ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.connect_abaque_pilot_students FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,DELETE ON public.connect_abaque_pilot_students TO service_role;

CREATE TABLE public.connect_abaque_rights(
 student_id uuid NOT NULL REFERENCES public.connect_students(id) ON DELETE CASCADE,
 milestone text NOT NULL CHECK(milestone IN ('build:1','build:2','build:perfect','moves:1','moves:2','moves:perfect','one:pass','one:perfect','three:pass','three:perfect','five:pass','five:perfect','record:5','record:10')),
 amount integer NOT NULL CHECK(amount BETWEEN 0 AND 28),achieved_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(student_id,milestone)
);
CREATE TABLE public.connect_abaque_receipts(
 student_id uuid NOT NULL REFERENCES public.connect_students(id) ON DELETE CASCADE,event_id uuid NOT NULL,
 reset_epoch bigint NOT NULL CHECK(reset_epoch>=0),judgement jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(student_id,event_id)
);
ALTER TABLE public.connect_abaque_rights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connect_abaque_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.connect_abaque_rights,public.connect_abaque_receipts FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.connect_abaque_rights TO service_role;
GRANT SELECT,INSERT ON public.connect_abaque_receipts TO service_role;

-- Authorization is repeated inside each database transaction, so a revoked
-- device or enrollment is not admitted merely because Edge checked it earlier.
CREATE FUNCTION public.connect_abaque_subject_v1(p_actor uuid,p_class uuid,p_teacher boolean DEFAULT false)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
DECLARE result uuid;require_fictive boolean;
BEGIN
 IF p_actor IS NULL OR p_class IS NULL THEN RAISE EXCEPTION 'app_class_not_open'; END IF;
 SELECT pilot_only INTO require_fictive FROM public.connect_abaque_classes WHERE class_id=p_class AND enabled FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'app_class_not_open'; END IF;
 IF p_teacher THEN
  SELECT s.id INTO STRICT result FROM public.connect_teacher_players t
  JOIN public.connect_students s ON s.id=t.student_id AND s.archived_at IS NULL
  JOIN public.connect_class_permissions cp ON cp.teacher_id=t.teacher_id AND cp.class_id=p_class AND cp.can_manage
  WHERE t.teacher_id=p_actor FOR UPDATE OF s FOR SHARE OF cp;
 ELSE
  SELECT s.id INTO STRICT result FROM public.connect_devices d
  JOIN public.connect_students s ON s.id=d.student_id AND s.archived_at IS NULL
  JOIN public.connect_enrollments e ON e.student_id=s.id AND e.class_id=p_class AND e.left_at IS NULL
  WHERE d.auth_user_id=p_actor AND d.state='approved' FOR UPDATE OF s FOR SHARE OF d,e;
 END IF;
 IF result IS NULL THEN RAISE EXCEPTION 'approved_identity_required'; END IF;
 IF require_fictive THEN
  PERFORM 1 FROM public.connect_abaque_pilot_students WHERE student_id=result FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'fictive_profile_required'; END IF;
 END IF;
 RETURN result;
EXCEPTION WHEN no_data_found OR too_many_rows THEN RAISE EXCEPTION 'approved_identity_required';
END $$;

CREATE FUNCTION public.connect_abaque_award_v1(p_student uuid,p_key text,p_amount integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
DECLARE maximum integer;
BEGIN
 maximum:=CASE p_key WHEN 'build:1' THEN 8 WHEN 'build:2' THEN 6 WHEN 'build:perfect' THEN 6
 WHEN 'moves:1' THEN 8 WHEN 'moves:2' THEN 6 WHEN 'moves:perfect' THEN 6
 WHEN 'one:pass' THEN 12 WHEN 'one:perfect' THEN 8 WHEN 'three:pass' THEN 18 WHEN 'three:perfect' THEN 10
 WHEN 'five:pass' THEN 28 WHEN 'five:perfect' THEN 12 WHEN 'record:5' THEN 12 WHEN 'record:10' THEN 20 END;
 IF maximum IS NULL OR p_amount IS NULL OR p_amount<=0 OR p_amount>maximum THEN RAISE EXCEPTION 'invalid_award'; END IF;
 INSERT INTO public.connect_abaque_rights AS r(student_id,milestone,amount) VALUES(p_student,p_key,p_amount)
 ON CONFLICT(student_id,milestone) DO UPDATE SET amount=greatest(r.amount,excluded.amount);
END $$;

CREATE FUNCTION public.connect_abaque_snapshot_v1(p_student uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
DECLARE current_state public.connect_states%ROWTYPE; earned jsonb; remaining jsonb; rights jsonb; xp integer; total_xp integer;
BEGIN
 SELECT * INTO current_state FROM public.connect_states WHERE student_id=p_student AND app_key='abaque-longueurs';
 SELECT coalesce(jsonb_object_agg(milestone,amount),'{}'::jsonb),coalesce(sum(amount),0)::int INTO rights,xp
 FROM public.connect_abaque_rights WHERE student_id=p_student;
 SELECT coalesce(jsonb_agg(trophy_key ORDER BY trophy_key),'[]'::jsonb) INTO earned
 FROM public.connect_trophy_achievements WHERE student_id=p_student AND app_key='abaque-longueurs';
 SELECT coalesce(sum(xp_credited),0)::int INTO total_xp FROM public.connect_xp_credits WHERE student_id=p_student;
 remaining:=jsonb_build_object(
 'build',20-coalesce((rights->>'build:1')::int,0)-coalesce((rights->>'build:2')::int,0)-coalesce((rights->>'build:perfect')::int,0),
 'moves',20-coalesce((rights->>'moves:1')::int,0)-coalesce((rights->>'moves:2')::int,0)-coalesce((rights->>'moves:perfect')::int,0),
 'one',20-coalesce((rights->>'one:pass')::int,0)-coalesce((rights->>'one:perfect')::int,0),
 'three',28-coalesce((rights->>'three:pass')::int,0)-coalesce((rights->>'three:perfect')::int,0),
 'five',40-coalesce((rights->>'five:pass')::int,0)-coalesce((rights->>'five:perfect')::int,0),
 'lives',greatest(6-coalesce((rights->>'record:5')::int,0),0)+greatest(10-coalesce((rights->>'record:10')::int,0),0),
 'sudden',32-coalesce((rights->>'record:5')::int,0)-coalesce((rights->>'record:10')::int,0));
 RETURN jsonb_build_object('ok',true,'appKey','abaque-longueurs','studentId',p_student,
 'revision',coalesce(current_state.revision,0),'resetEpoch',coalesce(current_state.reset_epoch,0),
 'displayName',(SELECT display_name FROM public.connect_students WHERE id=p_student),'state',coalesce(current_state.state_data,'{}'::jsonb),'xp',jsonb_build_object('appXp',xp,'max',160,'total',total_xp,'remaining',remaining),
 'trophies',earned,'ruleset',1);
END $$;

CREATE FUNCTION public.connect_abaque_load_v1(p_actor uuid,p_class uuid,p_teacher boolean DEFAULT false,p_expected uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
DECLARE pupil uuid;
BEGIN
 pupil:=public.connect_abaque_subject_v1(p_actor,p_class,p_teacher);
 IF p_expected IS NOT NULL AND pupil<>p_expected THEN RAISE EXCEPTION 'identity_binding_conflict'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.connect_apps WHERE app_key='abaque-longueurs' AND enabled) THEN RAISE EXCEPTION 'app_disabled'; END IF;
 RETURN public.connect_abaque_snapshot_v1(pupil);
END $$;

-- p_result is the bounded proof judgement produced by the dedicated Edge,
-- never a client-supplied XP, state snapshot or trophy declaration.
CREATE FUNCTION public.connect_abaque_record_v1(p_actor uuid,p_class uuid,p_teacher boolean,p_student uuid,
 p_event uuid,p_revision bigint,p_epoch bigint,p_result jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
DECLARE pupil uuid; current_state public.connect_states%ROWTYPE; native jsonb; segment jsonb; grades jsonb; scores jsonb;
 kind text; grade text; eligible boolean;level_limit integer; first_good bigint; total bigint; points bigint; count_passes integer; limit_total integer;
 earned_before integer; earned_after integer; total_xp integer; level_now integer; previous_level integer;
 reply jsonb; record_before jsonb; day_key text:=to_char(now() AT TIME ZONE 'Europe/Brussels','YYYY-MM-DD');threshold integer;trophy text;
BEGIN
 pupil:=public.connect_abaque_subject_v1(p_actor,p_class,p_teacher);
 IF pupil IS DISTINCT FROM p_student THEN RAISE EXCEPTION 'identity_binding_conflict'; END IF;
 PERFORM 1 FROM public.connect_students WHERE id=pupil AND archived_at IS NULL FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM public.connect_apps WHERE app_key='abaque-longueurs' AND enabled) THEN RAISE EXCEPTION 'app_disabled'; END IF;
 IF p_event IS NULL OR p_revision IS NULL OR p_revision<0 OR p_epoch IS NULL OR p_epoch<0
 OR p_result->>'eventId' IS DISTINCT FROM p_event::text OR p_result->>'ruleset' IS DISTINCT FROM '1'
 THEN RAISE EXCEPTION 'invalid_result'; END IF;
 IF p_result->>'eligible' IS NULL OR p_result->>'eligible' NOT IN ('true','false') THEN RAISE EXCEPTION 'invalid_result'; END IF;
 eligible:=(p_result->>'eligible')::boolean;
 kind:=p_result->>'kind';first_good:=(p_result->>'firstTry')::bigint;total:=(p_result->>'total')::bigint;points:=(p_result->>'points')::bigint;
 limit_total:=CASE kind WHEN 'build' THEN 12 WHEN 'moves' THEN 8 WHEN 'one' THEN 4 WHEN 'three' THEN 12 WHEN 'five' THEN 20 ELSE NULL END;
 IF kind IS NULL OR kind NOT IN ('build','moves','one','three','five','lives','sudden') OR first_good IS NULL OR first_good<0
 OR total IS NULL OR total<1 OR total>9007199254740991 OR first_good>total OR points IS NULL OR points<0 OR points>9007199254740991
 OR (limit_total IS NOT NULL AND total<>limit_total) OR (kind IN ('build','moves') AND points<>0)
 OR (NOT eligible AND kind NOT IN ('lives','sudden'))
 OR (kind IN ('lives','sudden') AND (total-first_good IS DISTINCT FROM (p_result->>'errors')::int
  OR (eligible AND (p_result->>'errors')::int<>CASE kind WHEN 'lives' THEN 3 ELSE 1 END)
  OR (NOT eligible AND (p_result->>'errors')::int>=CASE kind WHEN 'lives' THEN 3 ELSE 1 END)))
 THEN RAISE EXCEPTION 'invalid_result'; END IF;
 INSERT INTO public.connect_states(student_id,app_key,schema_version,revision,reset_epoch,state_data)
 VALUES(pupil,'abaque-longueurs',1,0,0,'{}') ON CONFLICT DO NOTHING;
 SELECT * INTO STRICT current_state FROM public.connect_states WHERE student_id=pupil AND app_key='abaque-longueurs' FOR UPDATE;
 IF current_state.reset_epoch<>p_epoch THEN RAISE EXCEPTION 'stale_reset_epoch'; END IF;
 IF EXISTS(SELECT 1 FROM public.connect_abaque_receipts WHERE student_id=pupil AND event_id=p_event) THEN
  IF EXISTS(SELECT 1 FROM public.connect_abaque_receipts WHERE student_id=pupil AND event_id=p_event AND judgement IS DISTINCT FROM p_result) THEN RAISE EXCEPTION 'event_id_reused'; END IF;
  reply:=public.connect_abaque_snapshot_v1(pupil);
  RETURN reply||jsonb_build_object('eventId',p_event,'duplicate',true,'xp',(reply->'xp')||jsonb_build_object('delta',0));
 END IF;
 IF current_state.revision<>p_revision THEN RAISE EXCEPTION 'revision_conflict'; END IF;
 native:=current_state.state_data;
 IF (kind='moves' AND jsonb_array_length(coalesce(native#>'{stage1,passes}','[]'))<2)
 OR (kind='one' AND jsonb_array_length(coalesce(native#>'{stage2,passes}','[]'))<2)
 OR (kind='three' AND coalesce(native#>>'{modes,one}','red') NOT IN ('orange','green'))
 OR (kind='five' AND coalesce(native#>>'{modes,three}','red') NOT IN ('orange','green'))
 OR (kind IN ('lives','sudden') AND NOT (coalesce((native#>>'{modeScores,one}')::int,0)>=4
  AND coalesce((native#>>'{modeScores,three}')::int,0)>=10
  AND coalesce((native#>>'{modeScores,five}')::int,0)>=16))
 THEN RAISE EXCEPTION 'activity_locked'; END IF;

 SELECT coalesce(sum(amount),0)::int INTO earned_before FROM public.connect_abaque_rights WHERE student_id=pupil;
 IF kind IN ('build','moves') THEN
  kind:=CASE kind WHEN 'build' THEN 'stage1' ELSE 'stage2' END;
  segment:=coalesce(native->kind,'{"passes":[],"passScores":[],"failed":false}'::jsonb);
  count_passes:=jsonb_array_length(coalesce(segment->'passes','[]'::jsonb));
  grade:=CASE WHEN first_good=total THEN 'green' WHEN first_good*5>=total*4 THEN 'orange' ELSE 'red' END;
  segment:=segment||jsonb_build_object('best',greatest(coalesce((segment->>'best')::int,0),first_good));
  IF grade<>'red' AND count_passes<2 THEN
   count_passes:=count_passes+1;
   segment:=segment||jsonb_build_object('passes',coalesce(segment->'passes','[]'::jsonb)||to_jsonb(grade),
    'passScores',coalesce(segment->'passScores','[]'::jsonb)||to_jsonb(first_good),'failed',false,'failedScore',NULL);
   PERFORM public.connect_abaque_award_v1(pupil,(CASE kind WHEN 'stage1' THEN 'build' ELSE 'moves' END)||':'||count_passes,CASE count_passes WHEN 1 THEN 8 ELSE 6 END);
  ELSIF grade='red' AND count_passes<2 THEN segment:=segment||jsonb_build_object('failed',true,'failedScore',first_good); END IF;
  IF first_good=total THEN
   PERFORM public.connect_abaque_award_v1(pupil,(CASE kind WHEN 'stage1' THEN 'build' ELSE 'moves' END)||':perfect',6);
   INSERT INTO public.connect_trophy_achievements(student_id,app_key,trophy_key)
   VALUES(pupil,'abaque-longueurs',CASE kind WHEN 'stage1' THEN 'abaque:bronze' ELSE 'abaque:silver' END) ON CONFLICT DO NOTHING;
  END IF;
  native:=native||jsonb_build_object(kind,segment);
 ELSE
  IF kind IN ('one','three','five') THEN
   scores:=coalesce(native->'modeScores','{}'::jsonb);
   scores:=scores||jsonb_build_object(kind,greatest(coalesce((scores->>kind)::int,0),first_good));
   grade:=CASE WHEN (scores->>kind)::int=total THEN 'green' WHEN (scores->>kind)::int*5>=total*4 THEN 'orange' ELSE 'red' END;
   native:=native||jsonb_build_object('modeScores',scores,'modes',coalesce(native->'modes','{}'::jsonb)||jsonb_build_object(kind,grade));
   IF kind='one' AND first_good>=3 THEN PERFORM public.connect_abaque_award_v1(pupil,'one:pass',12); END IF;
    IF kind='one' AND first_good=4 THEN PERFORM public.connect_abaque_award_v1(pupil,'one:perfect',8); END IF;
   IF kind='three' AND first_good>=10 THEN PERFORM public.connect_abaque_award_v1(pupil,'three:pass',18); END IF;
   IF kind='three' AND first_good=12 THEN PERFORM public.connect_abaque_award_v1(pupil,'three:perfect',10); END IF;
   IF kind='five' AND first_good>=16 THEN PERFORM public.connect_abaque_award_v1(pupil,'five:pass',28); END IF;
   IF kind='five' AND first_good=20 THEN PERFORM public.connect_abaque_award_v1(pupil,'five:perfect',12); END IF;
   IF (SELECT count(*) FROM public.connect_abaque_rights WHERE student_id=pupil AND milestone IN ('one:perfect','three:perfect','five:perfect'))=3 THEN
    INSERT INTO public.connect_trophy_achievements(student_id,app_key,trophy_key) VALUES(pupil,'abaque-longueurs','abaque:gold') ON CONFLICT DO NOTHING;
   END IF;
  ELSE
   IF eligible AND first_good>=5 THEN PERFORM public.connect_abaque_award_v1(pupil,'record:5',CASE kind WHEN 'lives' THEN 6 ELSE 12 END); END IF;
   IF eligible AND first_good>=10 THEN PERFORM public.connect_abaque_award_v1(pupil,'record:10',CASE kind WHEN 'lives' THEN 10 ELSE 20 END); END IF;
   IF kind='sudden' THEN
    native:=native||jsonb_build_object('suddenBest',greatest(coalesce((native->>'suddenBest')::int,0),first_good),
     'modes',coalesce(native->'modes','{}'::jsonb)||jsonb_build_object('sudden',CASE WHEN first_good>0 THEN 'green' ELSE 'red' END));
    -- Each record page is one conversion. One proof represents one run;
    -- separate runs and the three-lives variant never combine for these cups.
    FOR threshold,trophy IN SELECT * FROM (VALUES (3,'abaque:sudden-bronze'),(5,'abaque:sudden-silver'),(8,'abaque:sudden-gold')) AS cups(pages,trophy_key) LOOP
     IF first_good>=threshold THEN
      INSERT INTO public.connect_trophy_achievements(student_id,app_key,trophy_key)
      VALUES(pupil,'abaque-longueurs',trophy) ON CONFLICT DO NOTHING;
     END IF;
    END LOOP;
   END IF;
  END IF;
  scores:=coalesce(native->'recordsByMode','{}'::jsonb);
  native:=native||jsonb_build_object('recordsByMode',scores||jsonb_build_object(kind,greatest(coalesce((scores->>kind)::bigint,0),points)));
  record_before:=coalesce(native->'scoreRecords','{"dayBest":0,"allBest":0,"medals":[]}'::jsonb);
  IF record_before->>'dayDate' IS DISTINCT FROM day_key THEN record_before:=record_before||jsonb_build_object('dayDate',day_key,'dayBest',0,'dayMode',''); END IF;
  IF points>coalesce((record_before->>'dayBest')::bigint,0) THEN record_before:=record_before||jsonb_build_object('dayBest',points,'dayMode',kind); END IF;
  IF points>coalesce((record_before->>'allBest')::bigint,0) THEN record_before:=record_before||jsonb_build_object('allBest',points,'allMode',kind); END IF;
  native:=native||jsonb_build_object('scoreRecords',record_before||jsonb_build_object('medals','[]'::jsonb));
 END IF;
 SELECT coalesce(sum(amount),0)::int INTO earned_after FROM public.connect_abaque_rights WHERE student_id=pupil;
 IF earned_after>160 THEN RAISE EXCEPTION 'xp_cap'; END IF;
 INSERT INTO public.connect_xp_credits(student_id,app_key,xp_credited,evidence,ruleset_version,updated_at)
 VALUES(pupil,'abaque-longueurs',earned_after,'{"source":"abaque-rights-v1"}',1,now())
 ON CONFLICT(student_id,app_key) DO UPDATE SET xp_credited=excluded.xp_credited,evidence=excluded.evidence,ruleset_version=1,updated_at=now();
 SELECT coalesce(sum(xp_credited),0)::int INTO total_xp FROM public.connect_xp_credits WHERE student_id=pupil;
 level_now:=least(999,CASE WHEN total_xp<300 THEN 1+total_xp/50 ELSE 7+(total_xp-300)/100 END);
 SELECT coalesce(highest_level_reached,1) INTO previous_level FROM public.connect_level_profiles WHERE student_id=pupil;
 INSERT INTO public.connect_level_profiles(student_id,highest_level_reached,level_ruleset_version,updated_at)
 VALUES(pupil,greatest(coalesce(previous_level,1),level_now),2,now())
 ON CONFLICT(student_id) DO UPDATE SET highest_level_reached=greatest(connect_level_profiles.highest_level_reached,excluded.highest_level_reached),level_ruleset_version=2,updated_at=now();
 UPDATE public.connect_states SET state_data=native,revision=revision+1,updated_at=now() WHERE student_id=pupil AND app_key='abaque-longueurs';
 INSERT INTO public.connect_abaque_receipts(student_id,event_id,reset_epoch,judgement) VALUES(pupil,p_event,p_epoch,p_result);
 reply:=public.connect_abaque_snapshot_v1(pupil);
 RETURN reply||jsonb_build_object('eventId',p_event,'duplicate',false,'xp',(reply->'xp')||jsonb_build_object('delta',earned_after-earned_before));
END $$;

CREATE FUNCTION public.connect_abaque_restart_v1(p_actor uuid,p_class uuid,p_student uuid,p_epoch bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
DECLARE current_state public.connect_states%ROWTYPE; old_number integer; require_fictive boolean;
BEGIN
 SELECT pilot_only INTO require_fictive FROM public.connect_abaque_classes WHERE class_id=p_class AND enabled FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'app_class_not_open'; END IF;
 PERFORM 1 FROM public.connect_class_permissions WHERE teacher_id=p_actor AND class_id=p_class AND can_manage FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'professor_required'; END IF;
 PERFORM 1 FROM public.connect_students s JOIN public.connect_enrollments e ON e.student_id=s.id AND e.class_id=p_class AND e.left_at IS NULL
 WHERE s.id=p_student AND s.archived_at IS NULL FOR UPDATE OF s;
 IF NOT FOUND THEN RAISE EXCEPTION 'not_enrolled'; END IF;
 IF require_fictive THEN
  PERFORM 1 FROM public.connect_abaque_pilot_students WHERE student_id=p_student FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'fictive_profile_required'; END IF;
 END IF;
 INSERT INTO public.connect_states(student_id,app_key,schema_version,revision,reset_epoch,state_data)
 VALUES(p_student,'abaque-longueurs',1,0,0,'{}') ON CONFLICT DO NOTHING;
 SELECT * INTO STRICT current_state FROM public.connect_states WHERE student_id=p_student AND app_key='abaque-longueurs' FOR UPDATE;
 IF p_epoch IS NULL OR current_state.reset_epoch<>p_epoch THEN RAISE EXCEPTION 'stale_reset_epoch'; END IF;
 SELECT parcours_number INTO old_number FROM public.connect_parcours_current WHERE student_id=p_student AND app_key='abaque-longueurs';
 old_number:=coalesce(old_number,1);
 INSERT INTO public.connect_parcours_history(student_id,app_key,parcours_number,class_id,repeat_xp,state_data,archived_xp)
 VALUES(p_student,'abaque-longueurs',old_number,p_class,false,current_state.state_data,
 (SELECT coalesce(sum(amount),0)::int FROM public.connect_abaque_rights WHERE student_id=p_student));
 INSERT INTO public.connect_parcours_current(student_id,app_key,parcours_number,repeat_xp)
 VALUES(p_student,'abaque-longueurs',old_number+1,false)
 ON CONFLICT(student_id,app_key) DO UPDATE SET parcours_number=excluded.parcours_number,repeat_xp=false,started_at=now();
 UPDATE public.connect_states SET state_data='{}',revision=revision+1,reset_epoch=reset_epoch+1,updated_at=now()
 WHERE student_id=p_student AND app_key='abaque-longueurs';
 RETURN public.connect_abaque_snapshot_v1(p_student);
END $$;

CREATE FUNCTION public.connect_abaque_teacher_v1(p_actor uuid,p_class uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
DECLARE result jsonb; require_fictive boolean;
BEGIN
 SELECT pilot_only INTO require_fictive FROM public.connect_abaque_classes WHERE class_id=p_class AND enabled FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'app_class_not_open'; END IF;
 PERFORM 1 FROM public.connect_class_permissions WHERE teacher_id=p_actor AND class_id=p_class AND (can_manage OR can_view_results) FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'professor_required'; END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('studentId',s.id,'displayName',s.display_name,
  'result',public.connect_abaque_snapshot_v1(s.id)) ORDER BY s.display_name,s.id),'[]'::jsonb) INTO result
 FROM public.connect_students s WHERE s.archived_at IS NULL AND (NOT require_fictive OR EXISTS(SELECT 1 FROM public.connect_abaque_pilot_students approved WHERE approved.student_id=s.id)) AND EXISTS(
  SELECT 1 FROM public.connect_enrollments e WHERE e.student_id=s.id AND e.class_id=p_class AND e.left_at IS NULL);
 RETURN jsonb_build_object('ok',true,'appKey','abaque-longueurs','students',result);
END $$;

-- Pilot administration is limited to the TEST class and an authenticated manager.
-- Confirmation adds only an explicit allowlist; it changes no score, XP or device approval.
CREATE FUNCTION public.connect_abaque_pilot_status_v1(p_actor uuid,p_class uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
DECLARE ready boolean;
BEGIN
 IF p_class IS DISTINCT FROM '4bf3400d-a315-4ea4-a2f3-afaca24dc9b9'::uuid THEN RAISE EXCEPTION 'pilot_class_required'; END IF;
 PERFORM 1 FROM public.connect_class_permissions WHERE teacher_id=p_actor AND class_id=p_class AND can_manage FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'professor_required'; END IF;
 SELECT coalesce(a.enabled AND c.enabled AND c.pilot_only,false) INTO ready
 FROM public.connect_apps a CROSS JOIN public.connect_abaque_classes c
 WHERE a.app_key='abaque-longueurs' AND c.class_id=p_class;
 RETURN jsonb_build_object('ok',true,'appKey','abaque-longueurs','ready',coalesce(ready,false));
END $$;

CREATE FUNCTION public.connect_abaque_pilot_approve_v1(p_actor uuid,p_class uuid,p_students uuid[],p_include_teacher boolean,p_confirmed boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
DECLARE selected uuid[];teacher_student uuid;valid_count integer;
BEGIN
 IF p_class IS DISTINCT FROM '4bf3400d-a315-4ea4-a2f3-afaca24dc9b9'::uuid THEN RAISE EXCEPTION 'pilot_class_required'; END IF;
 IF p_confirmed IS DISTINCT FROM true OR p_students IS NULL OR cardinality(p_students)>100
 OR array_position(p_students,NULL) IS NOT NULL OR (cardinality(p_students)=0 AND p_include_teacher IS DISTINCT FROM true)
 THEN RAISE EXCEPTION 'fictive_confirmation_required'; END IF;
 PERFORM 1 FROM public.connect_class_permissions WHERE teacher_id=p_actor AND class_id=p_class AND can_manage FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'professor_required'; END IF;
 PERFORM 1 FROM public.connect_abaque_classes WHERE class_id=p_class AND enabled AND pilot_only FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'app_class_not_open'; END IF;
 PERFORM 1 FROM public.connect_apps WHERE app_key='abaque-longueurs' AND enabled FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'app_disabled'; END IF;
 SELECT coalesce(array_agg(DISTINCT id),'{}'::uuid[]) INTO selected FROM unnest(p_students) AS chosen(id);
 PERFORM 1 FROM public.connect_students s JOIN public.connect_enrollments e ON e.student_id=s.id AND e.class_id=p_class AND e.left_at IS NULL
 WHERE s.id=ANY(selected) AND s.archived_at IS NULL FOR UPDATE OF s FOR SHARE OF e;
 SELECT count(*) INTO valid_count FROM public.connect_students s WHERE s.id=ANY(selected) AND s.archived_at IS NULL AND EXISTS(
  SELECT 1 FROM public.connect_enrollments e WHERE e.student_id=s.id AND e.class_id=p_class AND e.left_at IS NULL);
 IF valid_count<>cardinality(selected) THEN RAISE EXCEPTION 'not_enrolled'; END IF;
 IF p_include_teacher THEN
  SELECT t.student_id INTO teacher_student FROM public.connect_teacher_players t JOIN public.connect_students s ON s.id=t.student_id AND s.archived_at IS NULL
  WHERE t.teacher_id=p_actor FOR UPDATE OF s FOR SHARE OF t;
  IF teacher_student IS NULL THEN RAISE EXCEPTION 'teacher_player_required'; END IF;
  SELECT array_agg(DISTINCT id) INTO selected FROM unnest(selected||ARRAY[teacher_student]) AS chosen(id);
 END IF;
 INSERT INTO public.connect_abaque_pilot_students(student_id) SELECT unnest(selected) ON CONFLICT DO NOTHING;
 RETURN jsonb_build_object('ok',true,'appKey','abaque-longueurs','approvedCount',cardinality(selected));
END $$;

-- Additive wrapper: existing profile RPC and its five apps remain unchanged.
CREATE FUNCTION public.connect_abaque_profile_progress_v1(p_student uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
DECLARE previous jsonb; item jsonb; snapshot jsonb; archived integer;
BEGIN
 previous:=public.connect_profile_progress_v1(p_student);
 snapshot:=public.connect_abaque_snapshot_v1(p_student);
 SELECT archived_xp INTO archived FROM public.connect_parcours_history WHERE student_id=p_student AND app_key='abaque-longueurs' ORDER BY parcours_number DESC LIMIT 1;
 item:=jsonb_build_object('appKey','abaque-longueurs','xpEarned',greatest((snapshot#>>'{xp,appXp}')::int-coalesce(archived,0),0),
  'xpMax',160,'trophiesEarned',jsonb_array_length(snapshot->'trophies'),'trophiesMax',6);
 RETURN previous||jsonb_build_object('apps',coalesce(previous->'apps','[]'::jsonb)||jsonb_build_array(item));
END $$;

DO $permissions$
DECLARE signature text;
BEGIN
 FOR signature IN SELECT p.oid::regprocedure::text FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname LIKE 'connect_abaque_%' LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',signature);
  EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',signature);
 END LOOP;
END $permissions$;
COMMIT;
