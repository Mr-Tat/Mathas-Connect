-- [PROPOSÉ] 2026-11-03 — deux additions, sans application en production.
-- Installer après recette PostgreSQL, AVANT le nouvel Edge et AVANT Pages.
-- Aucun UPDATE/DELETE des scores, XP, états, périodes ou consentements existants.

CREATE OR REPLACE FUNCTION public.connect_projection_addition_score_summary_v1(
 p_student uuid, p_class uuid, p_app text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO ''
AS $fn$
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
  SELECT MAX(CASE WHEN e.game_points>0 THEN e.game_points ELSE e.game_score END)::integer AS points
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
  'boardBest',COALESCE((SELECT points FROM published),0));
$fn$;

CREATE OR REPLACE FUNCTION public.connect_projection_share_improved_addition_v1(
 p_student uuid, p_class uuid, p_app text, p_event uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path TO ''
AS $fn$
DECLARE
 v_event public.connect_projection_score_events%ROWTYPE;
 v_since timestamptz;
 v_previous integer:=0;
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

 SELECT COALESCE(MAX(CASE WHEN e.game_points>0 THEN e.game_points ELSE e.game_score END),0)::integer
 INTO v_previous
 FROM public.connect_projection_score_events e
 JOIN public.connect_projection_score_consents c
   ON c.student_id=e.student_id AND c.class_id=e.class_id
  AND c.app_key=e.app_key AND c.event_id=e.event_id
 WHERE e.student_id=p_student AND e.class_id=p_class AND e.app_key=p_app
  AND e.played_at>=COALESCE(v_since,'1970-01-01Z'::timestamptz)
  AND e.captured_at>=COALESCE(v_since,'1970-01-01Z'::timestamptz);
 v_points:=CASE WHEN v_event.game_points>0 THEN v_event.game_points ELSE v_event.game_score END;
 IF v_points<=v_previous THEN
  RETURN jsonb_build_object('ok',false,'error','not_improved','boardBest',v_previous);
 END IF;

 INSERT INTO public.connect_projection_score_consents(student_id,class_id,app_key,event_id)
 VALUES(p_student,p_class,p_app,p_event) ON CONFLICT(student_id,app_key,event_id) DO NOTHING;
 RETURN jsonb_build_object('ok',true,'consentRecorded',true,'improved',true,
                           'boardBest',v_points);
END;
$fn$;

REVOKE ALL ON FUNCTION public.connect_projection_addition_score_summary_v1(uuid,uuid,text)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.connect_projection_share_improved_addition_v1(uuid,uuid,text,uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.connect_projection_addition_score_summary_v1(uuid,uuid,text)
 TO service_role;
GRANT EXECUTE ON FUNCTION public.connect_projection_share_improved_addition_v1(uuid,uuid,text,uuid)
 TO service_role;
