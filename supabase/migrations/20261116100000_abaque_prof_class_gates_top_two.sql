-- Abaque teacher classroom gates + durable top two certified scores.
-- Existing XP credits, stage passes, receipts, trophies and reset semantics stay intact.
ALTER TABLE public.connect_abaque_classes
 ADD COLUMN IF NOT EXISTS activity_2_allowed boolean NOT NULL DEFAULT false,
 ADD COLUMN IF NOT EXISTS activity_3_allowed boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.connect_abaque_access_v1(p_class uuid,p_teacher boolean)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $function$
 SELECT jsonb_build_object(
  'activity2',coalesce(a.activity_2_allowed,false) OR p_teacher,
  'activity3',coalesce(a.activity_3_allowed,false) OR p_teacher,
  'teacherFree',p_teacher)
 FROM public.connect_abaque_classes a WHERE a.class_id=p_class AND a.enabled;
$function$;

CREATE OR REPLACE FUNCTION public.connect_abaque_class_gates_get_v1(p_actor uuid,p_class uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $function$
DECLARE b2 boolean;b3 boolean;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.connect_class_permissions
 WHERE class_id=p_class AND teacher_id=p_actor AND can_manage) THEN RAISE EXCEPTION 'professor_required'; END IF;
 SELECT activity_2_allowed,activity_3_allowed INTO b2,b3 FROM public.connect_abaque_classes
 WHERE class_id=p_class AND enabled FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'app_class_not_open'; END IF;
 RETURN jsonb_build_object('ok',true,'activity2',b2,'activity3',b3);
END $function$;

CREATE OR REPLACE FUNCTION public.connect_abaque_class_gates_set_v1(p_actor uuid,p_class uuid,p_activity integer,p_allowed boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $function$
DECLARE b2 boolean;b3 boolean;
BEGIN
 IF p_activity IS NULL OR p_activity NOT IN (2,3) OR p_allowed IS NULL THEN RAISE EXCEPTION 'invalid_request'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.connect_class_permissions
 WHERE class_id=p_class AND teacher_id=p_actor AND can_manage) THEN RAISE EXCEPTION 'professor_required'; END IF;
 UPDATE public.connect_abaque_classes
 SET activity_2_allowed=CASE WHEN p_activity=2 THEN p_allowed ELSE activity_2_allowed END,
     activity_3_allowed=CASE WHEN p_activity=3 THEN p_allowed ELSE activity_3_allowed END
 WHERE class_id=p_class AND enabled
 RETURNING activity_2_allowed,activity_3_allowed INTO b2,b3;
 IF NOT FOUND THEN RAISE EXCEPTION 'app_class_not_open'; END IF;
 RETURN jsonb_build_object('ok',true,'activity2',b2,'activity3',b3);
END $function$;

-- Migrate historical certified receipts without treating one attempt as two.
WITH reconstructed AS (
 SELECT s.student_id,
 coalesce((
  SELECT jsonb_agg(score ORDER BY score DESC) FROM (
   SELECT (r.judgement->>'firstTry')::integer AS score
   FROM public.connect_abaque_receipts r
   WHERE r.student_id=s.student_id AND r.reset_epoch=s.reset_epoch AND r.judgement->>'kind'='build'
   ORDER BY score DESC,r.event_id LIMIT 2
  ) top_two
 ),(
  SELECT jsonb_agg(score ORDER BY score DESC) FROM (
   SELECT value::integer AS score
   FROM jsonb_array_elements_text(coalesce(s.state_data#>'{stage1,passScores}','[]'::jsonb)) value
   ORDER BY score DESC LIMIT 2
  ) historical
 ),'[]'::jsonb) AS best_build,
 coalesce((
  SELECT jsonb_agg(score ORDER BY score DESC) FROM (
   SELECT (r.judgement->>'firstTry')::integer AS score
   FROM public.connect_abaque_receipts r
   WHERE r.student_id=s.student_id AND r.reset_epoch=s.reset_epoch AND r.judgement->>'kind'='moves'
   ORDER BY score DESC,r.event_id LIMIT 2
  ) top_two
 ),(
  SELECT jsonb_agg(score ORDER BY score DESC) FROM (
   SELECT value::integer AS score
   FROM jsonb_array_elements_text(coalesce(s.state_data#>'{stage2,passScores}','[]'::jsonb)) value
   ORDER BY score DESC LIMIT 2
  ) historical
 ),'[]'::jsonb) AS best_moves
 FROM public.connect_states s WHERE s.app_key='abaque-longueurs'
)
UPDATE public.connect_states s
SET state_data=s.state_data||jsonb_build_object(
 'stage1',coalesce(s.state_data->'stage1','{}'::jsonb)||jsonb_build_object('topScores',r.best_build),
 'stage2',coalesce(s.state_data->'stage2','{}'::jsonb)||jsonb_build_object('topScores',r.best_moves))
FROM reconstructed r WHERE s.student_id=r.student_id AND s.app_key='abaque-longueurs';

-- This remains private: service-role Edge RPC only.
REVOKE ALL ON FUNCTION public.connect_abaque_access_v1(uuid,boolean) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.connect_abaque_class_gates_get_v1(uuid,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.connect_abaque_class_gates_set_v1(uuid,uuid,integer,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.connect_abaque_access_v1(uuid,boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.connect_abaque_class_gates_get_v1(uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.connect_abaque_class_gates_set_v1(uuid,uuid,integer,boolean) TO service_role;

CREATE OR REPLACE FUNCTION public.connect_abaque_load_v1(p_actor uuid, p_class uuid, p_teacher boolean DEFAULT false, p_expected uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE pupil uuid;
BEGIN
 pupil:=public.connect_abaque_subject_v1(p_actor,p_class,p_teacher);
 IF p_expected IS NOT NULL AND pupil<>p_expected THEN RAISE EXCEPTION 'identity_binding_conflict'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.connect_apps WHERE app_key='abaque-longueurs' AND enabled) THEN RAISE EXCEPTION 'app_disabled'; END IF;
 RETURN public.connect_abaque_snapshot_v1(pupil)||jsonb_build_object('activityAccess',public.connect_abaque_access_v1(p_class,p_teacher));
END $function$
;

CREATE OR REPLACE FUNCTION public.connect_abaque_record_v1(p_actor uuid, p_class uuid, p_teacher boolean, p_student uuid, p_event uuid, p_revision bigint, p_epoch bigint, p_result jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE pupil uuid; current_state public.connect_states%ROWTYPE; native jsonb; segment jsonb; grades jsonb; scores jsonb;
 kind text; grade text; eligible boolean;level_limit integer; first_good bigint; total bigint; points bigint; count_passes integer; limit_total integer;
 earned_before integer; earned_after integer; total_xp integer; level_now integer; previous_level integer; perfect_count integer;
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
 IF NOT p_teacher AND (
   (kind='moves' AND NOT (SELECT a.activity_2_allowed FROM public.connect_abaque_classes a WHERE a.class_id=p_class AND a.enabled))
   OR (kind IN ('one','three','five','lives','sudden') AND NOT (SELECT a.activity_3_allowed FROM public.connect_abaque_classes a WHERE a.class_id=p_class AND a.enabled))
 ) THEN RAISE EXCEPTION 'teacher_authorization_required'; END IF;
 INSERT INTO public.connect_states(student_id,app_key,schema_version,revision,reset_epoch,state_data)
 VALUES(pupil,'abaque-longueurs',1,0,0,'{}') ON CONFLICT DO NOTHING;
 SELECT * INTO STRICT current_state FROM public.connect_states WHERE student_id=pupil AND app_key='abaque-longueurs' FOR UPDATE;
 IF current_state.reset_epoch<>p_epoch THEN RAISE EXCEPTION 'stale_reset_epoch'; END IF;
 IF EXISTS(SELECT 1 FROM public.connect_abaque_receipts WHERE student_id=pupil AND event_id=p_event) THEN
  IF EXISTS(SELECT 1 FROM public.connect_abaque_receipts WHERE student_id=pupil AND event_id=p_event AND judgement IS DISTINCT FROM p_result) THEN RAISE EXCEPTION 'event_id_reused'; END IF;
  reply:=public.connect_abaque_snapshot_v1(pupil)||jsonb_build_object('activityAccess',public.connect_abaque_access_v1(p_class,p_teacher));
  RETURN reply||jsonb_build_object('eventId',p_event,'duplicate',true,'xp',(reply->'xp')||jsonb_build_object('delta',0));
 END IF;
 IF current_state.revision<>p_revision THEN RAISE EXCEPTION 'revision_conflict'; END IF;
 native:=current_state.state_data;
 IF NOT p_teacher AND ((kind='moves' AND jsonb_array_length(coalesce(native#>'{stage1,passes}','[]'))<2)
 OR (kind='one' AND jsonb_array_length(coalesce(native#>'{stage2,passes}','[]'))<2)
 OR (kind='three' AND coalesce(native#>>'{modes,one}','red') NOT IN ('orange','green'))
 OR (kind='five' AND coalesce(native#>>'{modes,three}','red') NOT IN ('orange','green'))
 OR (kind IN ('lives','sudden') AND NOT (coalesce((native#>>'{modeScores,one}')::int,0)>=4
  AND coalesce((native#>>'{modeScores,three}')::int,0)>=10
  AND coalesce((native#>>'{modeScores,five}')::int,0)>=16)))
 THEN RAISE EXCEPTION 'activity_locked'; END IF;

 SELECT coalesce(sum(amount),0)::int INTO earned_before FROM public.connect_abaque_rights WHERE student_id=pupil;
 IF kind IN ('build','moves') THEN
  kind:=CASE kind WHEN 'build' THEN 'stage1' ELSE 'stage2' END;
  segment:=coalesce(native->kind,'{"passes":[],"passScores":[],"failed":false}'::jsonb);
  count_passes:=jsonb_array_length(coalesce(segment->'passes','[]'::jsonb));
  grade:=CASE WHEN first_good=total THEN 'green' WHEN first_good*5>=total*4 THEN 'orange' ELSE 'red' END;
  segment:=segment||jsonb_build_object('best',greatest(coalesce((segment->>'best')::int,0),first_good));
  -- Two highest scores from independent validated games; progression passes remain separate.
  SELECT coalesce(jsonb_agg(top_score ORDER BY top_score DESC),'[]'::jsonb) INTO grades
  FROM (SELECT value AS top_score FROM (
   SELECT item::integer AS value FROM jsonb_array_elements_text(coalesce(segment->'topScores',segment->'passScores','[]'::jsonb)) item
   UNION ALL SELECT first_good::integer
  ) ranked ORDER BY value DESC LIMIT 2) top_two;
  segment:=segment||jsonb_build_object('topScores',grades);
  IF grade<>'red' AND count_passes<2 THEN
   count_passes:=count_passes+1;
   segment:=segment||jsonb_build_object('passes',coalesce(segment->'passes','[]'::jsonb)||to_jsonb(grade),
    'passScores',coalesce(segment->'passScores','[]'::jsonb)||to_jsonb(first_good),'failed',false,'failedScore',NULL);
   PERFORM public.connect_abaque_award_v1(pupil,(CASE kind WHEN 'stage1' THEN 'build' ELSE 'moves' END)||':'||count_passes,CASE count_passes WHEN 1 THEN 8 ELSE 6 END);
  ELSIF grade='red' AND count_passes<2 THEN segment:=segment||jsonb_build_object('failed',true,'failedScore',first_good); END IF;
  IF first_good=total THEN
   PERFORM public.connect_abaque_award_v1(pupil,(CASE kind WHEN 'stage1' THEN 'build' ELSE 'moves' END)||':perfect',6);
  END IF;
  -- Les trophées bronze et argent exigent deux séries distinctes à 100 %.
  -- Les deux réussites >=80 % restent suffisantes pour débloquer la suite.
  -- On compte les preuves serveur déjà enregistrées dans ce cycle de remise à zéro,
  -- plus la série courante qui sera enregistrée en reçu juste après cette RPC.
  SELECT least(2,count(*)::integer+CASE WHEN first_good=total THEN 1 ELSE 0 END)
  INTO perfect_count
  FROM public.connect_abaque_receipts AS receipt
  WHERE receipt.student_id=pupil
    AND receipt.reset_epoch=p_epoch
    AND receipt.judgement->>'kind'=CASE kind WHEN 'stage1' THEN 'build' ELSE 'moves' END
    AND (receipt.judgement->>'firstTry')::bigint=total
    AND (receipt.judgement->>'total')::bigint=total;
  segment:=segment||jsonb_build_object('perfectRuns',perfect_count);
  IF perfect_count>=2 THEN
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
   IF kind='three' AND first_good=12 THEN PERFORM public.connect_abaque_award_v1(pupil,'three:perfect',14); END IF;
   IF kind='five' AND first_good>=16 THEN PERFORM public.connect_abaque_award_v1(pupil,'five:pass',28); END IF;
   IF kind='five' AND first_good=20 THEN PERFORM public.connect_abaque_award_v1(pupil,'five:perfect',12); END IF;
   IF (SELECT count(*) FROM public.connect_abaque_rights WHERE student_id=pupil AND milestone IN ('one:perfect','three:perfect','five:perfect'))=3 THEN
    INSERT INTO public.connect_trophy_achievements(student_id,app_key,trophy_key) VALUES(pupil,'abaque-longueurs','abaque:gold') ON CONFLICT DO NOTHING;
   END IF;
  ELSE
   -- Trois paliers XP partagés entre 3 vies et Mort subite : 3, 6, 10 pages de 5 conversions.
   -- La fin de partie est obligatoirement confirmée par la preuve du serveur.
   IF eligible AND first_good>=15 THEN PERFORM public.connect_abaque_award_v1(pupil,'record:15',24); END IF;
   IF eligible AND first_good>=30 THEN PERFORM public.connect_abaque_award_v1(pupil,'record:30',24); END IF;
   IF eligible AND first_good>=50 THEN PERFORM public.connect_abaque_award_v1(pupil,'record:50',24); END IF;
   IF kind='sudden' THEN
    native:=native||jsonb_build_object('suddenBest',greatest(coalesce((native->>'suddenBest')::int,0),first_good),
     'modes',coalesce(native->'modes','{}'::jsonb)||jsonb_build_object('sudden',CASE WHEN first_good>0 THEN 'green' ELSE 'red' END));
    -- Each record page contains five conversions. One proof represents one run;
    -- separate runs and the three-lives variant never combine for these cups.
    FOR threshold,trophy IN SELECT * FROM (VALUES (15,'abaque:sudden-bronze'),(25,'abaque:sudden-silver'),(40,'abaque:sudden-gold')) AS cups(conversions,trophy_key) LOOP
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
 IF earned_after>204 THEN RAISE EXCEPTION 'xp_cap'; END IF;
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
 reply:=public.connect_abaque_snapshot_v1(pupil)||jsonb_build_object('activityAccess',public.connect_abaque_access_v1(p_class,p_teacher));
 RETURN reply||jsonb_build_object('eventId',p_event,'duplicate',false,'xp',(reply->'xp')||jsonb_build_object('delta',earned_after-earned_before));
END $function$
;
