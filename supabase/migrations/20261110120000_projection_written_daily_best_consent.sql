-- Décision du 10/11/2026 : le meilleur score certifié DU JOUR peut être publié
-- même lorsqu'il ne bat pas le record historique. Un consentement Oui est toujours obligatoire.
-- Les fonctions remplacées sont dérivées des définitions LIVE lues en lecture seule.
-- Aucun score, XP, trophée ou consentement ancien n'est modifié par cette migration.

-- connect_projection_addition_score_summary_v1
CREATE OR REPLACE FUNCTION public.connect_projection_addition_score_summary_v1(p_student uuid, p_class uuid, p_app text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
 WITH events AS (
  SELECT e.event_id, e.game_mode, e.game_score, e.game_total, e.played_at,
         CASE WHEN e.game_points>0 THEN e.game_points ELSE e.game_score END AS points
  FROM public.connect_projection_score_events e
  WHERE e.student_id=p_student AND e.class_id=p_class AND e.app_key=p_app
 ), latest AS (
  SELECT * FROM events ORDER BY played_at DESC,event_id DESC LIMIT 50
 ), top AS (
  SELECT * FROM events ORDER BY points DESC,played_at DESC,event_id DESC LIMIT 3
 ), today AS (
  SELECT * FROM events
  WHERE (played_at AT TIME ZONE 'Europe/Brussels')::date =
        (now() AT TIME ZONE 'Europe/Brussels')::date
  ORDER BY points DESC,played_at DESC,event_id DESC LIMIT 1
 ), published AS (
  SELECT MAX(CASE WHEN e.game_points>0 THEN e.game_points ELSE e.game_score END)::integer AS points,
         MAX(CASE WHEN e.game_points>0 THEN e.game_points ELSE e.game_score END)
           FILTER (WHERE (e.played_at AT TIME ZONE 'Europe/Brussels')::date =
                         (now() AT TIME ZONE 'Europe/Brussels')::date)::integer AS daily_points
  FROM public.connect_projection_score_events e
  JOIN public.connect_projection_score_consents c
    ON c.student_id=e.student_id AND c.class_id=e.class_id
   AND c.app_key=e.app_key AND c.event_id=e.event_id
  LEFT JOIN public.connect_projection_score_periods p
    ON p.class_id=e.class_id AND p.app_key=e.app_key
  WHERE e.student_id=p_student AND e.class_id=p_class AND e.app_key=p_app
   AND e.played_at>=COALESCE(p.score_since,'1970-01-01Z'::timestamptz)
   AND e.captured_at>=COALESCE(p.score_since,'1970-01-01Z'::timestamptz)
 )
 SELECT jsonb_build_object('ok',true,
  'events',COALESCE((SELECT jsonb_agg(jsonb_build_object(
    'eventId',event_id,'mode',game_mode,'score',game_score,'total',game_total,
    'points',points,'at',played_at) ORDER BY played_at DESC,event_id DESC)
    FROM latest),'[]'::jsonb),
  'bestThree',COALESCE((SELECT jsonb_agg(jsonb_build_object(
    'eventId',event_id,'mode',game_mode,'score',game_score,'total',game_total,
    'points',points,'at',played_at) ORDER BY points DESC,played_at DESC,event_id DESC)
    FROM top),'[]'::jsonb),
  'todayBest',(SELECT jsonb_build_object(
    'eventId',event_id,'mode',game_mode,'score',game_score,'total',game_total,
    'points',points,'at',played_at) FROM today),
  'boardBest',COALESCE((SELECT points FROM published),0),
  'boardTodayBest',COALESCE((SELECT daily_points FROM published),0));
$function$;

-- connect_projection_mul_share_improved_v1
CREATE OR REPLACE FUNCTION public.connect_projection_mul_share_improved_v1(p_student uuid, p_class uuid, p_app text, p_event uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE
 v_event public.connect_projection_score_events%ROWTYPE;
 v_since timestamptz;
 v_previous integer:=0;
 v_today integer:=0;
 v_points integer;
BEGIN
 IF p_student IS NULL OR p_class IS NULL OR p_event IS NULL
    OR p_app <> 'multiplication-ecrite-simple'
    OR p_app IS NULL THEN
  RETURN jsonb_build_object('ok',false,'error','invalid_score_event');
 END IF;
 -- Sérialiser deux clics concurrents, pour ne publier que de vrais records.
 PERFORM 1 FROM public.connect_students WHERE id=p_student AND archived_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','player_not_active');END IF;
 IF NOT EXISTS(
  SELECT 1 FROM public.connect_enrollments
   WHERE student_id=p_student AND class_id=p_class AND left_at IS NULL
 ) AND NOT EXISTS(
  SELECT 1 FROM public.connect_teacher_players tp
   JOIN public.connect_class_permissions cp ON cp.teacher_id=tp.teacher_id
   WHERE tp.student_id=p_student AND cp.class_id=p_class AND cp.can_manage=true
 ) THEN RETURN jsonb_build_object('ok',false,'error','wrong_class');END IF;

 SELECT * INTO v_event FROM public.connect_projection_score_events
 WHERE student_id=p_student AND class_id=p_class AND app_key=p_app AND event_id=p_event;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','event_not_found');END IF;
 IF NOT (EXISTS (SELECT 1 FROM public.connect_objective_record_school_proof_sessions ps
 WHERE ps.session_id=v_event.event_id AND ps.student_id=v_event.student_id AND ps.class_id=v_event.class_id
  AND ps.app_key=v_event.app_key AND ps.consumed_at IS NOT NULL AND ps.result->>'proofVerified'='true')
 OR EXISTS (SELECT 1 FROM public.connect_objective_record_school_extended_sessions es
 WHERE es.session_id=v_event.event_id AND es.student_id=v_event.student_id AND es.class_id=v_event.class_id
  AND es.app_key=v_event.app_key AND es.consumed_at IS NOT NULL AND es.result->>'proofVerified'='true')) THEN RETURN jsonb_build_object('ok',false,'error','invalid_score_event');END IF;
 SELECT score_since INTO v_since FROM public.connect_projection_score_periods
 WHERE class_id=p_class AND app_key=p_app;
 IF v_event.played_at<COALESCE(v_since,'1970-01-01Z'::timestamptz)
   OR v_event.captured_at<COALESCE(v_since,'1970-01-01Z'::timestamptz)
 THEN RETURN jsonb_build_object('ok',false,'error','score_reset');END IF;

 SELECT COALESCE(MAX(CASE WHEN e.game_points>0 THEN e.game_points ELSE e.game_score END),0)::integer,
        COALESCE(MAX(CASE WHEN e.game_points>0 THEN e.game_points ELSE e.game_score END)
           FILTER (WHERE (e.played_at AT TIME ZONE 'Europe/Brussels')::date =
                         (now() AT TIME ZONE 'Europe/Brussels')::date),0)::integer
 INTO v_previous,v_today
 FROM public.connect_projection_score_events e
 JOIN public.connect_projection_score_consents c
   ON c.student_id=e.student_id AND c.class_id=e.class_id
  AND c.app_key=e.app_key AND c.event_id=e.event_id
 WHERE e.student_id=p_student AND e.class_id=p_class AND e.app_key=p_app
  AND (EXISTS (SELECT 1 FROM public.connect_objective_record_school_proof_sessions ps
 WHERE ps.session_id=e.event_id AND ps.student_id=e.student_id AND ps.class_id=e.class_id
  AND ps.app_key=e.app_key AND ps.consumed_at IS NOT NULL AND ps.result->>'proofVerified'='true')
 OR EXISTS (SELECT 1 FROM public.connect_objective_record_school_extended_sessions es
 WHERE es.session_id=e.event_id AND es.student_id=e.student_id AND es.class_id=e.class_id
  AND es.app_key=e.app_key AND es.consumed_at IS NOT NULL AND es.result->>'proofVerified'='true'))
  AND e.played_at>=COALESCE(v_since,'1970-01-01Z'::timestamptz)
  AND e.captured_at>=COALESCE(v_since,'1970-01-01Z'::timestamptz);
 v_points:=CASE WHEN v_event.game_points>0 THEN v_event.game_points ELSE v_event.game_score END;
 -- Le record historique reste intact ; un score du jour peut être publié
 -- s'il dépasse le meilleur score DÉJÀ publié aujourd'hui. Les parties
 -- anciennes gardent le verrou historique et les resets existants.
 IF v_points<=v_previous AND (
   (v_event.played_at AT TIME ZONE 'Europe/Brussels')::date <>
   (now() AT TIME ZONE 'Europe/Brussels')::date OR v_points<=v_today
 ) THEN
  RETURN jsonb_build_object('ok',false,'error','not_improved',
    'boardBest',v_previous,'boardTodayBest',v_today);
 END IF;

 INSERT INTO public.connect_projection_score_consents(student_id,class_id,app_key,event_id)
 VALUES(p_student,p_class,p_app,p_event) ON CONFLICT(student_id,app_key,event_id) DO NOTHING;
 RETURN jsonb_build_object('ok',true,'consentRecorded',true,
                           'improved',v_points>v_previous,
                           'dailyImproved',
                            (v_event.played_at AT TIME ZONE 'Europe/Brussels')::date =
                             (now() AT TIME ZONE 'Europe/Brussels')::date AND v_points>v_today,
                           'boardBest',GREATEST(v_points,v_previous),
                           'boardTodayBest',GREATEST(v_today,CASE WHEN
                            (v_event.played_at AT TIME ZONE 'Europe/Brussels')::date =
                            (now() AT TIME ZONE 'Europe/Brussels')::date
                             THEN v_points ELSE 0 END));
END;
$function$;

-- connect_projection_mul_verified_summary_v1
CREATE OR REPLACE FUNCTION public.connect_projection_mul_verified_summary_v1(p_student uuid, p_class uuid, p_app text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
 WITH events AS (
  SELECT e.event_id, e.game_mode, e.game_score, e.game_total, e.played_at,
         CASE WHEN e.game_points>0 THEN e.game_points ELSE e.game_score END AS points
  FROM public.connect_projection_score_events e
  WHERE e.student_id=p_student AND e.class_id=p_class AND e.app_key='multiplication-ecrite-simple'
  AND p_app='multiplication-ecrite-simple' AND (EXISTS (SELECT 1 FROM public.connect_objective_record_school_proof_sessions ps
 WHERE ps.session_id=e.event_id AND ps.student_id=e.student_id AND ps.class_id=e.class_id
  AND ps.app_key=e.app_key AND ps.consumed_at IS NOT NULL AND ps.result->>'proofVerified'='true')
 OR EXISTS (SELECT 1 FROM public.connect_objective_record_school_extended_sessions es
 WHERE es.session_id=e.event_id AND es.student_id=e.student_id AND es.class_id=e.class_id
  AND es.app_key=e.app_key AND es.consumed_at IS NOT NULL AND es.result->>'proofVerified'='true'))
 ), latest AS (
  SELECT * FROM events ORDER BY played_at DESC,event_id DESC LIMIT 50
 ), top AS (
  SELECT * FROM events ORDER BY points DESC,played_at DESC,event_id DESC LIMIT 3
 ), today AS (
  SELECT * FROM events
  WHERE (played_at AT TIME ZONE 'Europe/Brussels')::date =
        (now() AT TIME ZONE 'Europe/Brussels')::date
  ORDER BY points DESC,played_at DESC,event_id DESC LIMIT 1
 ), published AS (
  SELECT MAX(CASE WHEN e.game_points>0 THEN e.game_points ELSE e.game_score END)::integer AS points,
         MAX(CASE WHEN e.game_points>0 THEN e.game_points ELSE e.game_score END)
           FILTER (WHERE (e.played_at AT TIME ZONE 'Europe/Brussels')::date =
                         (now() AT TIME ZONE 'Europe/Brussels')::date)::integer AS daily_points
  FROM public.connect_projection_score_events e
  JOIN public.connect_projection_score_consents c
    ON c.student_id=e.student_id AND c.class_id=e.class_id
   AND c.app_key=e.app_key AND c.event_id=e.event_id
  LEFT JOIN public.connect_projection_score_periods p
    ON p.class_id=e.class_id AND p.app_key=e.app_key
  WHERE e.student_id=p_student AND e.class_id=p_class AND e.app_key='multiplication-ecrite-simple'
   AND (EXISTS (SELECT 1 FROM public.connect_objective_record_school_proof_sessions ps
 WHERE ps.session_id=e.event_id AND ps.student_id=e.student_id AND ps.class_id=e.class_id
  AND ps.app_key=e.app_key AND ps.consumed_at IS NOT NULL AND ps.result->>'proofVerified'='true')
 OR EXISTS (SELECT 1 FROM public.connect_objective_record_school_extended_sessions es
 WHERE es.session_id=e.event_id AND es.student_id=e.student_id AND es.class_id=e.class_id
  AND es.app_key=e.app_key AND es.consumed_at IS NOT NULL AND es.result->>'proofVerified'='true'))
   AND e.played_at>=COALESCE(p.score_since,'1970-01-01Z'::timestamptz)
   AND e.captured_at>=COALESCE(p.score_since,'1970-01-01Z'::timestamptz)
 )
 SELECT jsonb_build_object('ok',true,
  'events',COALESCE((SELECT jsonb_agg(jsonb_build_object(
    'eventId',event_id,'mode',game_mode,'score',game_score,'total',game_total,
    'points',points,'at',played_at) ORDER BY played_at DESC,event_id DESC)
    FROM latest),'[]'::jsonb),
  'bestThree',COALESCE((SELECT jsonb_agg(jsonb_build_object(
    'eventId',event_id,'mode',game_mode,'score',game_score,'total',game_total,
    'points',points,'at',played_at) ORDER BY points DESC,played_at DESC,event_id DESC)
    FROM top),'[]'::jsonb),
  'todayBest',(SELECT jsonb_build_object(
    'eventId',event_id,'mode',game_mode,'score',game_score,'total',game_total,
    'points',points,'at',played_at) FROM today),
  'boardBest',COALESCE((SELECT points FROM published),0),
  'boardTodayBest',COALESCE((SELECT daily_points FROM published),0));
$function$;

-- connect_projection_share_improved_addition_v1
CREATE OR REPLACE FUNCTION public.connect_projection_share_improved_addition_v1(p_student uuid, p_class uuid, p_app text, p_event uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE
 v_event public.connect_projection_score_events%ROWTYPE;
 v_since timestamptz;
 v_previous integer:=0;
 v_today integer:=0;
 v_points integer;
BEGIN
 IF p_student IS NULL OR p_class IS NULL OR p_event IS NULL
    OR p_app NOT IN ('addition-ecrite-simple','addition-ecrite-multiple')
    OR p_app IS NULL THEN
  RETURN jsonb_build_object('ok',false,'error','invalid_score_event');
 END IF;
 -- Sérialiser deux clics concurrents, pour ne publier que de vrais records.
 PERFORM 1 FROM public.connect_students WHERE id=p_student AND archived_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','player_not_active');END IF;
 IF NOT EXISTS(
  SELECT 1 FROM public.connect_enrollments
   WHERE student_id=p_student AND class_id=p_class AND left_at IS NULL
 ) AND NOT EXISTS(
  SELECT 1 FROM public.connect_teacher_players tp
   JOIN public.connect_class_permissions cp ON cp.teacher_id=tp.teacher_id
   WHERE tp.student_id=p_student AND cp.class_id=p_class AND cp.can_manage=true
 ) THEN RETURN jsonb_build_object('ok',false,'error','wrong_class');END IF;

 SELECT * INTO v_event FROM public.connect_projection_score_events
 WHERE student_id=p_student AND class_id=p_class AND app_key=p_app AND event_id=p_event;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','event_not_found');END IF;
 SELECT score_since INTO v_since FROM public.connect_projection_score_periods
 WHERE class_id=p_class AND app_key=p_app;
 IF v_event.played_at<COALESCE(v_since,'1970-01-01Z'::timestamptz)
   OR v_event.captured_at<COALESCE(v_since,'1970-01-01Z'::timestamptz)
 THEN RETURN jsonb_build_object('ok',false,'error','score_reset');END IF;

 SELECT COALESCE(MAX(CASE WHEN e.game_points>0 THEN e.game_points ELSE e.game_score END),0)::integer,
        COALESCE(MAX(CASE WHEN e.game_points>0 THEN e.game_points ELSE e.game_score END)
           FILTER (WHERE (e.played_at AT TIME ZONE 'Europe/Brussels')::date =
                         (now() AT TIME ZONE 'Europe/Brussels')::date),0)::integer
 INTO v_previous,v_today
 FROM public.connect_projection_score_events e
 JOIN public.connect_projection_score_consents c
   ON c.student_id=e.student_id AND c.class_id=e.class_id
  AND c.app_key=e.app_key AND c.event_id=e.event_id
 WHERE e.student_id=p_student AND e.class_id=p_class AND e.app_key=p_app
  AND e.played_at>=COALESCE(v_since,'1970-01-01Z'::timestamptz)
  AND e.captured_at>=COALESCE(v_since,'1970-01-01Z'::timestamptz);
 v_points:=CASE WHEN v_event.game_points>0 THEN v_event.game_points ELSE v_event.game_score END;
 -- Le record historique reste intact ; un score du jour peut être publié
 -- s'il dépasse le meilleur score DÉJÀ publié aujourd'hui. Les parties
 -- anciennes gardent le verrou historique et les resets existants.
 IF v_points<=v_previous AND (
   (v_event.played_at AT TIME ZONE 'Europe/Brussels')::date <>
   (now() AT TIME ZONE 'Europe/Brussels')::date OR v_points<=v_today
 ) THEN
  RETURN jsonb_build_object('ok',false,'error','not_improved',
    'boardBest',v_previous,'boardTodayBest',v_today);
 END IF;

 INSERT INTO public.connect_projection_score_consents(student_id,class_id,app_key,event_id)
 VALUES(p_student,p_class,p_app,p_event) ON CONFLICT(student_id,app_key,event_id) DO NOTHING;
 RETURN jsonb_build_object('ok',true,'consentRecorded',true,
                           'improved',v_points>v_previous,
                           'dailyImproved',
                            (v_event.played_at AT TIME ZONE 'Europe/Brussels')::date =
                             (now() AT TIME ZONE 'Europe/Brussels')::date AND v_points>v_today,
                           'boardBest',GREATEST(v_points,v_previous),
                           'boardTodayBest',GREATEST(v_today,CASE WHEN
                            (v_event.played_at AT TIME ZONE 'Europe/Brussels')::date =
                            (now() AT TIME ZONE 'Europe/Brussels')::date
                             THEN v_points ELSE 0 END));
END;
$function$;

-- connect_projection_sub_share_improved_v1
CREATE OR REPLACE FUNCTION public.connect_projection_sub_share_improved_v1(p_student uuid, p_class uuid, p_app text, p_event uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE
 v_event public.connect_projection_score_events%ROWTYPE;
 v_since timestamptz;
 v_previous integer:=0;
 v_today integer:=0;
 v_points integer;
BEGIN
 IF p_student IS NULL OR p_class IS NULL OR p_event IS NULL
    OR p_app <> 'soustraction-ecrite-simple'
    OR p_app IS NULL THEN
  RETURN jsonb_build_object('ok',false,'error','invalid_score_event');
 END IF;
 -- Sérialiser deux clics concurrents, pour ne publier que de vrais records.
 PERFORM 1 FROM public.connect_students WHERE id=p_student AND archived_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','player_not_active');END IF;
 IF NOT EXISTS(
  SELECT 1 FROM public.connect_enrollments
   WHERE student_id=p_student AND class_id=p_class AND left_at IS NULL
 ) AND NOT EXISTS(
  SELECT 1 FROM public.connect_teacher_players tp
   JOIN public.connect_class_permissions cp ON cp.teacher_id=tp.teacher_id
   WHERE tp.student_id=p_student AND cp.class_id=p_class AND cp.can_manage=true
 ) THEN RETURN jsonb_build_object('ok',false,'error','wrong_class');END IF;

 SELECT * INTO v_event FROM public.connect_projection_score_events
 WHERE student_id=p_student AND class_id=p_class AND app_key=p_app AND event_id=p_event;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','event_not_found');END IF;
 IF NOT (EXISTS (SELECT 1 FROM public.connect_objective_record_school_proof_sessions ps
 WHERE ps.session_id=v_event.event_id AND ps.student_id=v_event.student_id AND ps.class_id=v_event.class_id
  AND ps.app_key=v_event.app_key AND ps.consumed_at IS NOT NULL AND ps.result->>'proofVerified'='true')
 OR EXISTS (SELECT 1 FROM public.connect_objective_record_school_extended_sessions es
 WHERE es.session_id=v_event.event_id AND es.student_id=v_event.student_id AND es.class_id=v_event.class_id
  AND es.app_key=v_event.app_key AND es.consumed_at IS NOT NULL AND es.result->>'proofVerified'='true')) THEN RETURN jsonb_build_object('ok',false,'error','invalid_score_event');END IF;
 SELECT score_since INTO v_since FROM public.connect_projection_score_periods
 WHERE class_id=p_class AND app_key=p_app;
 IF v_event.played_at<COALESCE(v_since,'1970-01-01Z'::timestamptz)
   OR v_event.captured_at<COALESCE(v_since,'1970-01-01Z'::timestamptz)
 THEN RETURN jsonb_build_object('ok',false,'error','score_reset');END IF;

 SELECT COALESCE(MAX(CASE WHEN e.game_points>0 THEN e.game_points ELSE e.game_score END),0)::integer,
        COALESCE(MAX(CASE WHEN e.game_points>0 THEN e.game_points ELSE e.game_score END)
           FILTER (WHERE (e.played_at AT TIME ZONE 'Europe/Brussels')::date =
                         (now() AT TIME ZONE 'Europe/Brussels')::date),0)::integer
 INTO v_previous,v_today
 FROM public.connect_projection_score_events e
 JOIN public.connect_projection_score_consents c
   ON c.student_id=e.student_id AND c.class_id=e.class_id
  AND c.app_key=e.app_key AND c.event_id=e.event_id
 WHERE e.student_id=p_student AND e.class_id=p_class AND e.app_key=p_app
  AND (EXISTS (SELECT 1 FROM public.connect_objective_record_school_proof_sessions ps
 WHERE ps.session_id=e.event_id AND ps.student_id=e.student_id AND ps.class_id=e.class_id
  AND ps.app_key=e.app_key AND ps.consumed_at IS NOT NULL AND ps.result->>'proofVerified'='true')
 OR EXISTS (SELECT 1 FROM public.connect_objective_record_school_extended_sessions es
 WHERE es.session_id=e.event_id AND es.student_id=e.student_id AND es.class_id=e.class_id
  AND es.app_key=e.app_key AND es.consumed_at IS NOT NULL AND es.result->>'proofVerified'='true'))
  AND e.played_at>=COALESCE(v_since,'1970-01-01Z'::timestamptz)
  AND e.captured_at>=COALESCE(v_since,'1970-01-01Z'::timestamptz);
 v_points:=CASE WHEN v_event.game_points>0 THEN v_event.game_points ELSE v_event.game_score END;
 -- Le record historique reste intact ; un score du jour peut être publié
 -- s'il dépasse le meilleur score DÉJÀ publié aujourd'hui. Les parties
 -- anciennes gardent le verrou historique et les resets existants.
 IF v_points<=v_previous AND (
   (v_event.played_at AT TIME ZONE 'Europe/Brussels')::date <>
   (now() AT TIME ZONE 'Europe/Brussels')::date OR v_points<=v_today
 ) THEN
  RETURN jsonb_build_object('ok',false,'error','not_improved',
    'boardBest',v_previous,'boardTodayBest',v_today);
 END IF;

 INSERT INTO public.connect_projection_score_consents(student_id,class_id,app_key,event_id)
 VALUES(p_student,p_class,p_app,p_event) ON CONFLICT(student_id,app_key,event_id) DO NOTHING;
 RETURN jsonb_build_object('ok',true,'consentRecorded',true,
                           'improved',v_points>v_previous,
                           'dailyImproved',
                            (v_event.played_at AT TIME ZONE 'Europe/Brussels')::date =
                             (now() AT TIME ZONE 'Europe/Brussels')::date AND v_points>v_today,
                           'boardBest',GREATEST(v_points,v_previous),
                           'boardTodayBest',GREATEST(v_today,CASE WHEN
                            (v_event.played_at AT TIME ZONE 'Europe/Brussels')::date =
                            (now() AT TIME ZONE 'Europe/Brussels')::date
                             THEN v_points ELSE 0 END));
END;
$function$;

-- connect_projection_sub_verified_summary_v1
CREATE OR REPLACE FUNCTION public.connect_projection_sub_verified_summary_v1(p_student uuid, p_class uuid, p_app text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
 WITH events AS (
  SELECT e.event_id, e.game_mode, e.game_score, e.game_total, e.played_at,
         CASE WHEN e.game_points>0 THEN e.game_points ELSE e.game_score END AS points
  FROM public.connect_projection_score_events e
  WHERE e.student_id=p_student AND e.class_id=p_class AND e.app_key='soustraction-ecrite-simple'
  AND p_app='soustraction-ecrite-simple' AND (EXISTS (SELECT 1 FROM public.connect_objective_record_school_proof_sessions ps
 WHERE ps.session_id=e.event_id AND ps.student_id=e.student_id AND ps.class_id=e.class_id
  AND ps.app_key=e.app_key AND ps.consumed_at IS NOT NULL AND ps.result->>'proofVerified'='true')
 OR EXISTS (SELECT 1 FROM public.connect_objective_record_school_extended_sessions es
 WHERE es.session_id=e.event_id AND es.student_id=e.student_id AND es.class_id=e.class_id
  AND es.app_key=e.app_key AND es.consumed_at IS NOT NULL AND es.result->>'proofVerified'='true'))
 ), latest AS (
  SELECT * FROM events ORDER BY played_at DESC,event_id DESC LIMIT 50
 ), top AS (
  SELECT * FROM events ORDER BY points DESC,played_at DESC,event_id DESC LIMIT 3
 ), today AS (
  SELECT * FROM events
  WHERE (played_at AT TIME ZONE 'Europe/Brussels')::date =
        (now() AT TIME ZONE 'Europe/Brussels')::date
  ORDER BY points DESC,played_at DESC,event_id DESC LIMIT 1
 ), published AS (
  SELECT MAX(CASE WHEN e.game_points>0 THEN e.game_points ELSE e.game_score END)::integer AS points,
         MAX(CASE WHEN e.game_points>0 THEN e.game_points ELSE e.game_score END)
           FILTER (WHERE (e.played_at AT TIME ZONE 'Europe/Brussels')::date =
                         (now() AT TIME ZONE 'Europe/Brussels')::date)::integer AS daily_points
  FROM public.connect_projection_score_events e
  JOIN public.connect_projection_score_consents c
    ON c.student_id=e.student_id AND c.class_id=e.class_id
   AND c.app_key=e.app_key AND c.event_id=e.event_id
  LEFT JOIN public.connect_projection_score_periods p
    ON p.class_id=e.class_id AND p.app_key=e.app_key
  WHERE e.student_id=p_student AND e.class_id=p_class AND e.app_key='soustraction-ecrite-simple'
   AND (EXISTS (SELECT 1 FROM public.connect_objective_record_school_proof_sessions ps
 WHERE ps.session_id=e.event_id AND ps.student_id=e.student_id AND ps.class_id=e.class_id
  AND ps.app_key=e.app_key AND ps.consumed_at IS NOT NULL AND ps.result->>'proofVerified'='true')
 OR EXISTS (SELECT 1 FROM public.connect_objective_record_school_extended_sessions es
 WHERE es.session_id=e.event_id AND es.student_id=e.student_id AND es.class_id=e.class_id
  AND es.app_key=e.app_key AND es.consumed_at IS NOT NULL AND es.result->>'proofVerified'='true'))
   AND e.played_at>=COALESCE(p.score_since,'1970-01-01Z'::timestamptz)
   AND e.captured_at>=COALESCE(p.score_since,'1970-01-01Z'::timestamptz)
 )
 SELECT jsonb_build_object('ok',true,
  'events',COALESCE((SELECT jsonb_agg(jsonb_build_object(
    'eventId',event_id,'mode',game_mode,'score',game_score,'total',game_total,
    'points',points,'at',played_at) ORDER BY played_at DESC,event_id DESC)
    FROM latest),'[]'::jsonb),
  'bestThree',COALESCE((SELECT jsonb_agg(jsonb_build_object(
    'eventId',event_id,'mode',game_mode,'score',game_score,'total',game_total,
    'points',points,'at',played_at) ORDER BY points DESC,played_at DESC,event_id DESC)
    FROM top),'[]'::jsonb),
  'todayBest',(SELECT jsonb_build_object(
    'eventId',event_id,'mode',game_mode,'score',game_score,'total',game_total,
    'points',points,'at',played_at) FROM today),
  'boardBest',COALESCE((SELECT points FROM published),0),
  'boardTodayBest',COALESCE((SELECT daily_points FROM published),0));
$function$;

