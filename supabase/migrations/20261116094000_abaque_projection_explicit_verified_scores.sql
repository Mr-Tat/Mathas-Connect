-- Abaque -> projection V2. Publication uniquement après choix Oui, via événement certifié.
-- Aucun changement des scores privés, XP, trophées ou événements des calculs écrits.
CREATE OR REPLACE FUNCTION public.connect_projection_abaque_share_v1(
 p_student uuid,p_class uuid,p_app text,p_event uuid)
RETURNS jsonb
LANGUAGE plpgsql SET search_path TO public,pg_temp AS $func$
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
  WHERE student_id=p_student AND event_id=p_event AND reset_epoch=v_epoch;
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
END;$func$;

CREATE OR REPLACE FUNCTION public.connect_projection_abaque_summary_v1(
 p_student uuid,p_class uuid,p_app text)
RETURNS jsonb LANGUAGE sql STABLE SET search_path TO public,pg_temp AS $func$
 WITH verified AS (
  SELECT r.event_id,r.created_at AS at,r.judgement->>'kind' AS mode,
   (r.judgement->>'points')::integer AS points,
   (r.judgement->>'firstTry')::integer AS correct,
   (r.judgement->>'total')::integer AS total
  FROM public.connect_abaque_receipts r
  JOIN public.connect_states st ON st.student_id=r.student_id
   AND st.app_key='abaque-longueurs' AND st.reset_epoch=r.reset_epoch
  WHERE r.student_id=p_student AND p_app='abaque-longueurs'
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
$func$;
REVOKE ALL ON FUNCTION public.connect_projection_abaque_share_v1(uuid,uuid,text,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.connect_projection_abaque_summary_v1(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.connect_projection_abaque_share_v1(uuid,uuid,text,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.connect_projection_abaque_summary_v1(uuid,uuid,text) TO service_role;
