-- Projection V2: lecture compacte et réinitialisation du seul score projeté.
-- La remise à zéro ne modifie jamais connect_states, connect_xp_credits,
-- connect_trophy_achievements ni les événements réels du journal.
CREATE TABLE IF NOT EXISTS public.connect_projection_score_reset_audit(
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  class_id uuid NOT NULL REFERENCES public.connect_classes(id) ON DELETE RESTRICT,
  app_key text NOT NULL REFERENCES public.connect_apps(app_key) ON DELETE RESTRICT,
  teacher_id uuid NOT NULL,
  reset_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.connect_projection_score_reset_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.connect_projection_score_reset_audit FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.connect_projection_score_reset_audit TO service_role;
GRANT USAGE,SELECT ON SEQUENCE public.connect_projection_score_reset_audit_id_seq TO service_role;

-- L'appelant (Edge Function) a déjà vérifié JWT ET mot de passe professeur.
-- Le SQL revalide l'appartenance à la classe pour empêcher une erreur d'intégration.
CREATE OR REPLACE FUNCTION public.connect_projection_reset_score_v1(
  p_class uuid,p_app text,p_teacher uuid
) RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public AS $$
DECLARE moment timestamptz;
BEGIN
 IF NOT EXISTS (
    SELECT 1 FROM public.connect_class_permissions
    WHERE class_id=p_class AND teacher_id=p_teacher AND can_manage=true
  ) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.connect_apps WHERE app_key=p_app) THEN
    RAISE EXCEPTION 'unknown_app' USING ERRCODE='22023'; END IF;
 moment:=clock_timestamp();
 INSERT INTO public.connect_projection_score_periods(class_id,app_key,score_since,updated_at,updated_by)
 VALUES (p_class,p_app,moment,moment,p_teacher)
 ON CONFLICT(class_id,app_key) DO UPDATE
 SET score_since=EXCLUDED.score_since,
     updated_at=EXCLUDED.updated_at,
     updated_by=EXCLUDED.updated_by;
 INSERT INTO public.connect_projection_score_reset_audit(class_id,app_key,teacher_id,reset_at)
 VALUES (p_class,p_app,p_teacher,moment);
 RETURN moment;
END;
$$;
REVOKE ALL ON FUNCTION public.connect_projection_reset_score_v1(uuid,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.connect_projection_reset_score_v1(uuid,text,uuid) TO service_role;

-- Des années de scores restent interrogeables en une seule réponse agrégée :
-- aucun LIMIT 1000 imposé par la REST Data API sur les événements individuels.
CREATE OR REPLACE FUNCTION public.connect_projection_best_scores_v1(p_class uuid)
RETURNS TABLE(student_id uuid,app_key text,best_score integer,best_event_at timestamptz)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $$
 SELECT e.student_id,e.app_key,
  MAX(CASE WHEN e.game_points>0 THEN e.game_points ELSE e.game_score END)::integer AS best_score,
  MAX(e.played_at) AS best_event_at
 FROM public.connect_projection_score_events e
 LEFT JOIN public.connect_projection_score_periods p
   ON p.class_id=e.class_id AND p.app_key=e.app_key
 WHERE e.class_id=p_class
   AND e.played_at>=COALESCE(p.score_since,'1970-01-01T00:00:00Z'::timestamptz)
   AND e.captured_at>=COALESCE(p.score_since,'1970-01-01T00:00:00Z'::timestamptz)
 GROUP BY e.student_id,e.app_key
$$;
REVOKE ALL ON FUNCTION public.connect_projection_best_scores_v1(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.connect_projection_best_scores_v1(uuid) TO service_role;

-- Niveau et trophées permanents : groupement serveur, pas de fuite vers public.
CREATE OR REPLACE FUNCTION public.connect_projection_player_badges_v1(p_students uuid[])
RETURNS TABLE(student_id uuid,level integer,trophies bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $$
 SELECT s.id,l.highest_level_reached,COUNT(t.trophy_key)::bigint
 FROM public.connect_students s
 LEFT JOIN public.connect_level_profiles l ON l.student_id=s.id
 LEFT JOIN public.connect_trophy_achievements t ON t.student_id=s.id
 WHERE s.id=ANY(p_students)
 GROUP BY s.id,l.highest_level_reached
$$;
REVOKE ALL ON FUNCTION public.connect_projection_player_badges_v1(uuid[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.connect_projection_player_badges_v1(uuid[]) TO service_role;
