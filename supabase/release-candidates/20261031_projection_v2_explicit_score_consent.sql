-- Score-publication consent is independent of the real game's saved record.
-- Neither a teacher nor any game can infer consent from an XP or a saved score.
-- A pupil explicitly offers the individual eventId from the end-of-game prompt.
CREATE TABLE IF NOT EXISTS public.connect_projection_score_consents (
 student_id uuid NOT NULL REFERENCES public.connect_students(id) ON DELETE RESTRICT,
 class_id uuid NOT NULL REFERENCES public.connect_classes(id) ON DELETE RESTRICT,
 app_key text NOT NULL REFERENCES public.connect_apps(app_key) ON DELETE RESTRICT,
 event_id uuid NOT NULL,
 consented_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(student_id,app_key,event_id)
);
ALTER TABLE public.connect_projection_score_consents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.connect_projection_score_consents FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.connect_projection_score_consents TO service_role;
CREATE INDEX IF NOT EXISTS connect_projection_consents_class_idx
 ON public.connect_projection_score_consents(class_id,app_key,student_id);

-- Only explicitly submitted *saved* scores may appear on the projected board.
-- The score itself always comes from the immutable, server-validated game journal.
CREATE OR REPLACE FUNCTION public.connect_projection_best_scores_v1(p_class uuid)
RETURNS TABLE(student_id uuid,app_key text,best_score integer,best_event_at timestamptz)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $$
 SELECT e.student_id,e.app_key,
  MAX(CASE WHEN e.game_points>0 THEN e.game_points ELSE e.game_score END)::integer AS best_score,
  MAX(e.played_at) AS best_event_at
 FROM public.connect_projection_score_events e
 JOIN public.connect_projection_score_consents c
  ON c.student_id=e.student_id AND c.class_id=e.class_id
   AND c.app_key=e.app_key AND c.event_id=e.event_id
 LEFT JOIN public.connect_projection_score_periods p
  ON p.class_id=e.class_id AND p.app_key=e.app_key
 WHERE e.class_id=p_class
   AND e.played_at>=COALESCE(p.score_since,'1970-01-01T00:00:00Z'::timestamptz)
   AND e.captured_at>=COALESCE(p.score_since,'1970-01-01T00:00:00Z'::timestamptz)
 GROUP BY e.student_id,e.app_key
$$;
REVOKE ALL ON FUNCTION public.connect_projection_best_scores_v1(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.connect_projection_best_scores_v1(uuid) TO service_role;
