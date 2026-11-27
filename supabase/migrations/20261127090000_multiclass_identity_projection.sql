-- Class provenance for shared pupil accounts. No pupil state or reward reset.
ALTER TABLE public.connect_abaque_receipts ADD COLUMN IF NOT EXISTS class_id uuid REFERENCES public.connect_classes(id);

CREATE OR REPLACE FUNCTION public.connect_abaque_receipt_class_matches_v1(p_student uuid,p_event uuid,p_origin uuid,p_at timestamptz,p_class uuid)
RETURNS boolean LANGUAGE sql STABLE SET search_path TO '' AS $$
 SELECT CASE WHEN p_origin IS NOT NULL THEN p_origin=p_class
 WHEN EXISTS(SELECT 1 FROM public.connect_projection_score_events e WHERE e.student_id=p_student AND e.app_key='abaque-longueurs' AND e.event_id=p_event)
 THEN EXISTS(SELECT 1 FROM public.connect_projection_score_events e WHERE e.student_id=p_student AND e.app_key='abaque-longueurs' AND e.event_id=p_event AND e.class_id=p_class)
 WHEN EXISTS(SELECT 1 FROM public.connect_teacher_players t WHERE t.student_id=p_student)
 THEN true
 ELSE (SELECT count(DISTINCT e.class_id)=1 AND coalesce(bool_or(e.class_id=p_class),false)
   FROM public.connect_enrollments e WHERE e.student_id=p_student AND e.joined_at<=p_at
    AND (e.left_at IS NULL OR e.left_at>p_at)) END;
$$;
REVOKE ALL ON FUNCTION public.connect_abaque_receipt_class_matches_v1(uuid,uuid,uuid,timestamptz,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.connect_abaque_receipt_class_matches_v1(uuid,uuid,uuid,timestamptz,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.connect_projection_capture_scores_v1()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  classes uuid[];
  class_value uuid;
  part jsonb;
  sid text;
  score_text text;
  points_text text;
  total_text text;
  at_text text;
  mode_text text;
  played timestamptz;
BEGIN
  BEGIN
    IF jsonb_typeof(NEW.state_data->'recent') IS DISTINCT FROM 'array' THEN RETURN NEW; END IF;

    FOR part IN SELECT value FROM jsonb_array_elements(NEW.state_data->'recent') LOOP
      sid:=part->>'eventId';
      score_text:=part->>'score';
      points_text:=part->>'points';
      total_text:=part->>'total';
      at_text:=part->>'at';
      mode_text:=part->>'mode';
      IF sid IS NULL OR sid !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
         OR score_text IS NULL OR score_text !~ '^[0-9]{1,8}$'
         OR at_text IS NULL OR at_text !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T'
         OR mode_text IS NULL OR length(mode_text)>40 THEN
        CONTINUE;
      END IF;
      BEGIN
        played:=at_text::timestamptz;
        IF played>now()+interval '5 minutes' THEN CONTINUE; END IF;
        -- A certified session binds the event to its own class, even during
        -- the finish transaction (consumed_at is set after this trigger).
        SELECT array_agg(DISTINCT x.class_id) INTO classes FROM (
          SELECT class_id FROM public.connect_objective_record_school_proof_sessions
            WHERE session_id=sid::uuid AND student_id=NEW.student_id AND app_key=NEW.app_key
          UNION
          SELECT class_id FROM public.connect_objective_record_school_extended_sessions
            WHERE session_id=sid::uuid AND student_id=NEW.student_id AND app_key=NEW.app_key
          UNION
          SELECT class_id FROM public.connect_objective_record_test_proof_sessions
            WHERE session_id=sid::uuid AND student_id=NEW.student_id AND app_key=NEW.app_key
        ) x;
        IF coalesce(cardinality(classes),0)=0 THEN
          -- Legacy results: use a class only if uniquely attributable at play time.
          SELECT array_agg(DISTINCT class_id) INTO classes FROM public.connect_enrollments
            WHERE student_id=NEW.student_id AND joined_at<=played
              AND (left_at IS NULL OR left_at>played);
        END IF;
        IF coalesce(cardinality(classes),0)<>1 THEN CONTINUE; END IF;
        class_value:=classes[1];
        INSERT INTO public.connect_projection_score_events(
          student_id,class_id,app_key,event_id,game_mode,game_score,
          game_total,game_points,played_at
        ) VALUES(
          NEW.student_id,class_value,NEW.app_key,sid::uuid,mode_text,score_text::integer,
          CASE WHEN total_text ~ '^[0-9]{1,8}$' THEN total_text::integer ELSE NULL END,
          CASE WHEN points_text ~ '^[0-9]{1,8}$' THEN points_text::integer ELSE NULL END,
          played
        ) ON CONFLICT(student_id,app_key,event_id) DO NOTHING;
      EXCEPTION WHEN OTHERS THEN
        -- Ne jamais faire échouer l'enregistrement d'un vrai élève pour l'affichage.
        CONTINUE;
      END;
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    RETURN NEW;
  END;
  RETURN NEW;
END;
$function$
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
 reply jsonb; record_before jsonb; day_key text:=to_char(now() AT TIME ZONE 'Europe/Brussels','YYYY-MM-DD');threshold integer;trophy text;assisted boolean;
BEGIN
 pupil:=public.connect_abaque_subject_v1(p_actor,p_class,p_teacher);
 IF pupil IS DISTINCT FROM p_student THEN RAISE EXCEPTION 'identity_binding_conflict'; END IF;
 PERFORM 1 FROM public.connect_students WHERE id=pupil AND archived_at IS NULL FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM public.connect_apps WHERE app_key='abaque-longueurs' AND enabled) THEN RAISE EXCEPTION 'app_disabled'; END IF;
 IF p_event IS NULL OR p_revision IS NULL OR p_revision<0 OR p_epoch IS NULL OR p_epoch<0
 OR p_result->>'eventId' IS DISTINCT FROM p_event::text OR (p_result->>'ruleset' IS NULL OR p_result->>'ruleset' NOT IN ('1','2','3','4'))
 THEN RAISE EXCEPTION 'invalid_result'; END IF;
 IF p_result->>'eligible' IS NULL OR p_result->>'eligible' NOT IN ('true','false') THEN RAISE EXCEPTION 'invalid_result'; END IF;
 eligible:=(p_result->>'eligible')::boolean;
 IF p_result->>'ruleset' IN ('2','3','4') AND (p_result->>'assisted' IS NULL OR p_result->>'assisted' NOT IN ('true','false')) THEN
  RAISE EXCEPTION 'invalid_result';
 END IF;
 assisted:=p_result->>'ruleset' IN ('2','3','4') AND coalesce((p_result->>'assisted')::boolean,false);
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
 -- Une ancienne preuve hors ligne (V1 ou V2) peut ne pas porter ce nouveau détail.
 -- Si présent, il doit être issu de la preuve arithmétique validée par Edge.
 -- Les deux attestations d'autonomie V3 sont certifiées par l'Edge et
 -- ne peuvent pas être déduites des anciens XP ou des meilleurs scores.
 IF p_result->>'ruleset' IN ('3','4') THEN
  IF p_result->>'cleanPerfect' NOT IN ('true','false')
   OR p_result->>'cleanRecord' NOT IN ('true','false')
   OR (p_result->>'cleanPerfect')::boolean IS DISTINCT FROM
     (kind IN ('one','three','five') AND first_good=total AND NOT assisted)
   OR (p_result->>'cleanRecord')::boolean IS DISTINCT FROM
     (kind='sudden' AND NOT assisted)
  THEN RAISE EXCEPTION 'invalid_result'; END IF;
 END IF;
 IF p_result ? 'resultDots' THEN
  IF p_result->>'ruleset' NOT IN ('2','3','4') OR kind NOT IN ('one','three','five')
   OR jsonb_typeof(p_result->'resultDots') IS DISTINCT FROM 'array'
  THEN RAISE EXCEPTION 'invalid_result'; END IF;
  IF jsonb_array_length(p_result->'resultDots')<>total
   OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(p_result->'resultDots') AS d(v)
    WHERE d.v NOT IN ('green','red','blue','purple'))
   OR (SELECT count(*) FROM jsonb_array_elements_text(p_result->'resultDots') AS d(v)
    WHERE d.v<>'red')<>first_good
  THEN RAISE EXCEPTION 'invalid_result'; END IF;
 END IF;
 IF NOT p_teacher AND (
   (kind='moves' AND NOT (SELECT a.activity_2_allowed FROM public.connect_abaque_classes a WHERE a.class_id=p_class AND a.enabled))
   OR (kind IN ('one','three','five','lives','sudden') AND NOT (SELECT a.activity_3_allowed FROM public.connect_abaque_classes a WHERE a.class_id=p_class AND a.enabled))
 ) THEN RAISE EXCEPTION 'teacher_authorization_required'; END IF;
 INSERT INTO public.connect_states(student_id,app_key,schema_version,revision,reset_epoch,state_data)
 VALUES(pupil,'abaque-longueurs',1,0,0,'{}') ON CONFLICT DO NOTHING;
 SELECT * INTO STRICT current_state FROM public.connect_states WHERE student_id=pupil AND app_key='abaque-longueurs' FOR UPDATE;
 IF current_state.reset_epoch<>p_epoch THEN RAISE EXCEPTION 'stale_reset_epoch'; END IF;
 IF EXISTS(SELECT 1 FROM public.connect_abaque_receipts WHERE student_id=pupil AND event_id=p_event) THEN
  IF EXISTS(SELECT 1 FROM public.connect_abaque_receipts WHERE student_id=pupil AND event_id=p_event AND (judgement IS DISTINCT FROM p_result OR (class_id IS NOT NULL AND class_id IS DISTINCT FROM p_class))) THEN RAISE EXCEPTION 'event_id_reused'; END IF;
  reply:=public.connect_abaque_snapshot_v1(pupil)||jsonb_build_object('activityAccess',public.connect_abaque_access_v1(p_class,p_teacher));
  RETURN reply||jsonb_build_object('eventId',p_event,'duplicate',true,'xp',(reply->'xp')||jsonb_build_object('delta',0));
 END IF;
 IF current_state.revision<>p_revision THEN RAISE EXCEPTION 'revision_conflict'; END IF;
 native:=current_state.state_data;
 -- Une ancienne preuve hors ligne (V1 ou V2) peut ne pas porter ce nouveau détail.
 -- Si présent, il doit être issu de la preuve arithmétique validée par Edge.
 -- Les deux attestations d'autonomie V3 sont certifiées par l'Edge et
 -- ne peuvent pas être déduites des anciens XP ou des meilleurs scores.
 IF p_result->>'ruleset' IN ('3','4') THEN
  IF p_result->>'cleanPerfect' NOT IN ('true','false')
   OR p_result->>'cleanRecord' NOT IN ('true','false')
   OR (p_result->>'cleanPerfect')::boolean IS DISTINCT FROM
     (kind IN ('one','three','five') AND first_good=total AND NOT assisted)
   OR (p_result->>'cleanRecord')::boolean IS DISTINCT FROM
     (kind='sudden' AND NOT assisted)
  THEN RAISE EXCEPTION 'invalid_result'; END IF;
 END IF;
 IF p_result ? 'resultDots' THEN
  IF p_result->>'ruleset' NOT IN ('2','3','4') OR kind NOT IN ('one','three','five')
   OR jsonb_typeof(p_result->'resultDots') IS DISTINCT FROM 'array'
  THEN RAISE EXCEPTION 'invalid_result'; END IF;
  IF jsonb_array_length(p_result->'resultDots')<>total
   OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(p_result->'resultDots') AS d(v)
    WHERE d.v NOT IN ('green','red','blue','purple'))
   OR (SELECT count(*) FROM jsonb_array_elements_text(p_result->'resultDots') AS d(v)
    WHERE d.v<>'red')<>first_good
  THEN RAISE EXCEPTION 'invalid_result'; END IF;
 END IF;
 IF NOT p_teacher AND (
  -- Les deux premieres activites gardent les deux series a 80 % quand la classe
  -- utilise le parcours pedagogique complet.
  ((SELECT a.unlock_mode FROM public.connect_abaque_classes a WHERE a.class_id=p_class AND a.enabled)='mastery_80'
   AND ((kind='moves' AND jsonb_array_length(coalesce(native#>'{stage1,passes}','[]'))<2)
    OR (kind='one' AND jsonb_array_length(coalesce(native#>'{stage2,passes}','[]'))<2)))
  -- Quel que soit le deblocage PROF (all_open ou mastery_80), les 3 sous-niveaux
  -- exigent toujours 75 % dans les series precedentes.
  OR ((SELECT a.unlock_mode FROM public.connect_abaque_classes a WHERE a.class_id=p_class AND a.enabled)
      IN ('all_open','mastery_80')
   AND ((kind='three' AND NOT (coalesce((native#>>'{modeScores,one}')::int, CASE WHEN native#>>'{modes,one}' IN ('orange','green') THEN 3 ELSE 0 END)>=3))
     OR (kind='five' AND NOT (coalesce((native#>>'{modeScores,one}')::int, CASE WHEN native#>>'{modes,one}' IN ('orange','green') THEN 3 ELSE 0 END)>=3 AND coalesce((native#>>'{modeScores,three}')::int, CASE WHEN native#>>'{modes,three}' IN ('orange','green') THEN 9 ELSE 0 END)>=9))
     OR (kind IN ('lives','sudden') AND NOT (coalesce((native#>>'{modeScores,one}')::int, CASE WHEN native#>>'{modes,one}' IN ('orange','green') THEN 3 ELSE 0 END)>=3 AND coalesce((native#>>'{modeScores,three}')::int, CASE WHEN native#>>'{modes,three}' IN ('orange','green') THEN 9 ELSE 0 END)>=9 AND coalesce((native#>>'{modeScores,five}')::int, CASE WHEN native#>>'{modes,five}' IN ('orange','green') THEN 15 ELSE 0 END)>=15))))
 ) THEN RAISE EXCEPTION 'activity_locked'; END IF;

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
    AND receipt.reset_epoch BETWEEN coalesce((native->>'stage12ProofEpoch')::bigint,p_epoch) AND p_epoch
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
   -- Conserver les détails uniquement pour la meilleure série (ou une égalité).
   -- Un ancien record sans preuve unitaire reste sans pastilles colorées.
   IF p_result->>'ruleset' IN ('2','3','4')
    AND jsonb_typeof(p_result->'resultDots')='array'
    AND first_good>=coalesce((scores->>kind)::bigint,-1)
   THEN
    native:=native||jsonb_build_object('modeDots',
      coalesce(native->'modeDots','{}'::jsonb)||
      jsonb_build_object(kind,p_result->'resultDots'));
   END IF;
   scores:=scores||jsonb_build_object(kind,greatest(coalesce((scores->>kind)::int,0),first_good));
   grade:=CASE WHEN (scores->>kind)::int=total THEN 'green' WHEN (scores->>kind)::int*4>=total*3 THEN 'orange' ELSE 'red' END;
   native:=native||jsonb_build_object('modeScores',scores,'modes',coalesce(native->'modes','{}'::jsonb)||jsonb_build_object(kind,grade));
   IF p_result->>'cleanPerfect'='true' THEN
    native:=native||jsonb_build_object('cleanPerfect',coalesce(native->'cleanPerfect','{}'::jsonb)||jsonb_build_object(kind,true));
   END IF;
   IF kind='one' AND first_good>=3 THEN PERFORM public.connect_abaque_award_v1(pupil,'one:pass',CASE WHEN assisted THEN 9 ELSE 12 END); END IF;
    IF kind='one' AND first_good=4 THEN PERFORM public.connect_abaque_award_v1(pupil,'one:perfect',CASE WHEN assisted THEN 6 ELSE 8 END); END IF;
   IF kind='three' AND first_good>=10 THEN PERFORM public.connect_abaque_award_v1(pupil,'three:pass',CASE WHEN assisted THEN 14 ELSE 18 END); END IF;
   IF kind='three' AND first_good=12 THEN PERFORM public.connect_abaque_award_v1(pupil,'three:perfect',CASE WHEN assisted THEN 10 ELSE 14 END); END IF;
   IF kind='five' AND first_good>=16 THEN PERFORM public.connect_abaque_award_v1(pupil,'five:pass',CASE WHEN assisted THEN 21 ELSE 28 END); END IF;
   IF kind='five' AND first_good=20 THEN PERFORM public.connect_abaque_award_v1(pupil,'five:perfect',CASE WHEN assisted THEN 9 ELSE 12 END); END IF;
   IF coalesce(native#>>'{cleanPerfect,one}','false')='true'
      AND coalesce(native#>>'{cleanPerfect,three}','false')='true'
      AND coalesce(native#>>'{cleanPerfect,five}','false')='true' THEN
    INSERT INTO public.connect_trophy_achievements(student_id,app_key,trophy_key) VALUES(pupil,'abaque-longueurs','abaque:gold') ON CONFLICT DO NOTHING;
   END IF;
  ELSE
   -- Trois paliers XP partagés entre 3 vies et Mort subite : 3, 6, 10 pages de 5 conversions.
   -- La fin de partie est obligatoirement confirmée par la preuve du serveur.
   IF eligible AND first_good>=15 THEN PERFORM public.connect_abaque_award_v1(pupil,'record:15',CASE WHEN assisted THEN 18 ELSE 24 END); END IF;
   IF eligible AND first_good>=30 THEN PERFORM public.connect_abaque_award_v1(pupil,'record:30',CASE WHEN assisted THEN 18 ELSE 24 END); END IF;
   IF eligible AND first_good>=50 THEN PERFORM public.connect_abaque_award_v1(pupil,'record:50',CASE WHEN assisted THEN 18 ELSE 24 END); END IF;
   IF kind='sudden' THEN
    native:=native||jsonb_build_object('suddenBest',greatest(coalesce((native->>'suddenBest')::int,0),first_good),
     'modes',coalesce(native->'modes','{}'::jsonb)||jsonb_build_object('sudden',CASE WHEN first_good>0 THEN 'green' ELSE 'red' END));
    -- Each record page contains five conversions. One proof represents one run;
    -- separate runs and the three-lives variant never combine for these cups.
    FOR threshold,trophy IN SELECT * FROM (VALUES (15,'abaque:sudden-bronze'),(25,'abaque:sudden-silver'),(40,'abaque:sudden-gold')) AS cups(conversions,trophy_key) LOOP
     IF first_good>=threshold AND p_result->>'cleanRecord'='true' THEN
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
 INSERT INTO public.connect_abaque_receipts(student_id,event_id,reset_epoch,judgement,class_id) VALUES(pupil,p_event,p_epoch,p_result,p_class);
 reply:=public.connect_abaque_snapshot_v1(pupil)||jsonb_build_object('activityAccess',public.connect_abaque_access_v1(p_class,p_teacher));
 RETURN reply||jsonb_build_object('eventId',p_event,'duplicate',false,'xp',(reply->'xp')||jsonb_build_object('delta',earned_after-earned_before));
END $function$
;
CREATE OR REPLACE FUNCTION public.connect_projection_abaque_share_v1(p_student uuid, p_class uuid, p_app text, p_event uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
 v_receipt public.connect_abaque_receipts%ROWTYPE;
 v_epoch bigint;
 v_points integer;
 v_first integer;
 v_total integer;
 v_kind text;
 v_since timestamptz;
 v_best integer:=0;
 v_today integer:=0;
 v_today_played boolean;
BEGIN
 IF p_student IS NULL OR p_class IS NULL OR p_event IS NULL OR p_app IS DISTINCT FROM 'abaque-longueurs' THEN
  RETURN jsonb_build_object('ok',false,'error','invalid_score_event');
 END IF;
 -- Le verrou rend atomique le calcul du meilleur score et l'autorisation.
 PERFORM 1 FROM public.connect_students WHERE id=p_student AND archived_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','player_not_active'); END IF;
 IF NOT EXISTS(SELECT 1 FROM public.connect_enrollments WHERE student_id=p_student AND class_id=p_class AND left_at IS NULL)
  AND NOT EXISTS(SELECT 1 FROM public.connect_teacher_players tp JOIN public.connect_class_permissions cp
   ON cp.teacher_id=tp.teacher_id AND cp.class_id=p_class AND cp.can_manage
   WHERE tp.student_id=p_student)
 THEN RETURN jsonb_build_object('ok',false,'error','wrong_class'); END IF;
 SELECT reset_epoch INTO v_epoch FROM public.connect_states
  WHERE student_id=p_student AND app_key='abaque-longueurs';
 SELECT * INTO v_receipt FROM public.connect_abaque_receipts
  WHERE student_id=p_student AND event_id=p_event AND reset_epoch=v_epoch
   AND public.connect_abaque_receipt_class_matches_v1(student_id,event_id,class_id,created_at,p_class);
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','event_not_found'); END IF;
 v_kind:=v_receipt.judgement->>'kind';
 IF v_kind NOT IN ('one','three','five','lives','sudden')
  OR v_receipt.judgement->>'eligible' IS DISTINCT FROM 'true'
  OR v_receipt.judgement->>'eventId' IS DISTINCT FROM p_event::text
 THEN RETURN jsonb_build_object('ok',false,'error','invalid_score_event'); END IF;
 v_points:=(v_receipt.judgement->>'points')::integer;
 v_first:=(v_receipt.judgement->>'firstTry')::integer;
 v_total:=(v_receipt.judgement->>'total')::integer;
 IF v_points IS NULL OR v_points<=0 OR v_first IS NULL OR v_total IS NULL OR v_first<0 OR v_first>v_total
 THEN RETURN jsonb_build_object('ok',false,'error','invalid_score_event'); END IF;
 SELECT score_since INTO v_since FROM public.connect_projection_score_periods
  WHERE class_id=p_class AND app_key=p_app;
 IF v_receipt.created_at<coalesce(v_since,'1970-01-01Z'::timestamptz)
 THEN RETURN jsonb_build_object('ok',false,'error','score_reset'); END IF;
 -- Le deuxième clic sur un événement déjà consenti ne publie rien de plus.
 IF EXISTS(SELECT 1 FROM public.connect_projection_score_consents
   WHERE student_id=p_student AND class_id=p_class AND app_key=p_app AND event_id=p_event)
 THEN RETURN jsonb_build_object('ok',true,'consentRecorded',true,'duplicate',true); END IF;
 SELECT coalesce(max(CASE WHEN e.game_points>0 THEN e.game_points ELSE e.game_score END),0)::integer,
  coalesce(max(CASE WHEN e.game_points>0 THEN e.game_points ELSE e.game_score END) FILTER (
    WHERE (e.played_at AT TIME ZONE 'Europe/Brussels')::date =
     (now() AT TIME ZONE 'Europe/Brussels')::date),0)::integer
 INTO v_best,v_today
 FROM public.connect_projection_score_events e
 JOIN public.connect_projection_score_consents c
 ON c.student_id=e.student_id AND c.class_id=e.class_id AND c.app_key=e.app_key AND c.event_id=e.event_id
 WHERE e.student_id=p_student AND e.class_id=p_class AND e.app_key=p_app
 AND e.played_at>=coalesce(v_since,'1970-01-01Z'::timestamptz)
 AND e.captured_at>=coalesce(v_since,'1970-01-01Z'::timestamptz);
 v_today_played:=(v_receipt.created_at AT TIME ZONE 'Europe/Brussels')::date =
   (now() AT TIME ZONE 'Europe/Brussels')::date;
 IF v_points<=v_best AND (NOT v_today_played OR v_points<=v_today)
 THEN RETURN jsonb_build_object('ok',false,'error','not_improved','boardBest',v_best,'boardTodayBest',v_today); END IF;
 -- Insérer seulement ici, APRÈS la décision explicite de l'élève.
 INSERT INTO public.connect_projection_score_events
  (student_id,class_id,app_key,event_id,game_mode,game_score,game_total,game_points,played_at)
 VALUES(p_student,p_class,p_app,p_event,v_kind,v_first,v_total,v_points,v_receipt.created_at)
 ON CONFLICT(student_id,app_key,event_id) DO NOTHING;
 INSERT INTO public.connect_projection_score_consents(student_id,class_id,app_key,event_id)
 VALUES(p_student,p_class,p_app,p_event)
 ON CONFLICT(student_id,app_key,event_id) DO NOTHING;
 RETURN jsonb_build_object('ok',true,'consentRecorded',true,'improved',v_points>v_best,
  'dailyImproved',v_today_played AND v_points>v_today,
  'boardBest',greatest(v_best,v_points),
  'boardTodayBest',greatest(v_today,CASE WHEN v_today_played THEN v_points ELSE 0 END));
END;$function$
;
CREATE OR REPLACE FUNCTION public.connect_projection_abaque_summary_v1(p_student uuid, p_class uuid, p_app text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
 WITH verified AS (
  SELECT r.event_id,r.created_at AS at,r.judgement->>'kind' AS mode,
   (r.judgement->>'points')::integer AS points,
   (r.judgement->>'firstTry')::integer AS correct,
   (r.judgement->>'total')::integer AS total
  FROM public.connect_abaque_receipts r
  JOIN public.connect_states st ON st.student_id=r.student_id
   AND st.app_key='abaque-longueurs' AND st.reset_epoch=r.reset_epoch
  WHERE r.student_id=p_student AND p_app='abaque-longueurs'
   AND public.connect_abaque_receipt_class_matches_v1(r.student_id,r.event_id,r.class_id,r.created_at,p_class)
   AND r.judgement->>'eligible'='true'
   AND r.judgement->>'kind' IN ('one','three','five','lives','sudden')
 ), published AS (
  SELECT max(e.game_points) AS best,
   max(e.game_points) FILTER(WHERE (e.played_at AT TIME ZONE 'Europe/Brussels')::date=
      (now() AT TIME ZONE 'Europe/Brussels')::date) AS today
  FROM public.connect_projection_score_events e
  JOIN public.connect_projection_score_consents c
   ON c.student_id=e.student_id AND c.class_id=e.class_id AND c.app_key=e.app_key AND c.event_id=e.event_id
  LEFT JOIN public.connect_projection_score_periods period
   ON period.class_id=e.class_id AND period.app_key=e.app_key
  WHERE e.student_id=p_student AND e.class_id=p_class AND e.app_key=p_app
   AND e.played_at>=coalesce(period.score_since,'1970-01-01Z'::timestamptz)
   AND e.captured_at>=coalesce(period.score_since,'1970-01-01Z'::timestamptz)
 )
 SELECT jsonb_build_object('ok',true,
   'events',coalesce((SELECT jsonb_agg(jsonb_build_object('eventId',event_id,'mode',mode,
     'points',points,'score',correct,'total',total,'at',at) ORDER BY at DESC)
    FROM (SELECT * FROM verified ORDER BY at DESC LIMIT 50) v),'[]'::jsonb),
   'bestThree',coalesce((SELECT jsonb_agg(jsonb_build_object('eventId',event_id,'mode',mode,
     'points',points,'score',correct,'total',total,'at',at) ORDER BY points DESC,at DESC)
    FROM (SELECT * FROM verified ORDER BY points DESC,at DESC LIMIT 3) v),'[]'::jsonb),
   'todayBest',(SELECT jsonb_build_object('eventId',event_id,'mode',mode,
     'points',points,'score',correct,'total',total,'at',at)
    FROM verified WHERE (at AT TIME ZONE 'Europe/Brussels')::date=
     (now() AT TIME ZONE 'Europe/Brussels')::date ORDER BY points DESC,at DESC LIMIT 1),
   'boardBest',coalesce((SELECT best FROM published),0),
   'boardTodayBest',coalesce((SELECT today FROM published),0));
$function$
;

-- Detach a single membership; preserve the profile, devices and all acquisitions.
CREATE OR REPLACE FUNCTION public.connect_detach_student_class_v1(p_teacher uuid,p_class uuid,p_student uuid)
RETURNS boolean LANGUAGE plpgsql SET search_path TO '' AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.connect_class_permissions WHERE teacher_id=p_teacher AND class_id=p_class AND can_manage) THEN RAISE EXCEPTION 'forbidden'; END IF;
 PERFORM 1 FROM public.connect_students WHERE id=p_student AND archived_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'student_not_active'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.connect_enrollments WHERE student_id=p_student AND class_id=p_class AND left_at IS NULL) THEN RAISE EXCEPTION 'not_enrolled'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.connect_enrollments WHERE student_id=p_student AND class_id<>p_class AND left_at IS NULL) THEN RAISE EXCEPTION 'last_class'; END IF;
 IF EXISTS(SELECT 1 FROM public.connect_teacher_players WHERE student_id=p_student) THEN RAISE EXCEPTION 'teacher_profile_protected'; END IF;
 UPDATE public.connect_enrollments SET left_at=now() WHERE student_id=p_student AND class_id=p_class AND left_at IS NULL;
 UPDATE public.connect_launches SET revoked_at=now() WHERE student_id=p_student AND class_id=p_class AND revoked_at IS NULL;
 RETURN true;
END; $$;
REVOKE ALL ON FUNCTION public.connect_detach_student_class_v1(uuid,uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.connect_detach_student_class_v1(uuid,uuid,uuid) TO service_role;
