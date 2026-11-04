-- CANDIDAT NON DÉPLOYÉ : statistique agrégée par classe et application.
-- Pourcentage des exercices issus de PARTIES TERMINÉES et enregistrées.
-- Les exercices commencés lors d'une partie interrompue ne sont pas journalisés
-- par les jeux actuels : ne jamais présenter ce taux comme exhaustif.
--
-- Préparer la validation SQL sur TEST, puis déployer uniquement avec autorisation.
-- La réinitialisation du score projeté NE réinitialise PAS les pourcentages.
CREATE OR REPLACE FUNCTION public.connect_projection_completed_attempt_counts_v1(p_classes uuid[])
RETURNS TABLE(class_id uuid, app_key text, correct bigint, attempted bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO pg_catalog, public
AS $fn$
  SELECT e.class_id, e.app_key,
    SUM(e.game_score)::bigint AS correct,
    SUM(e.game_total)::bigint AS attempted
  FROM public.connect_projection_score_events AS e
  WHERE cardinality(p_classes) BETWEEN 1 AND 5
    AND e.class_id = ANY(p_classes)
    -- Une partie achevée produit un event_id unique, jamais doublé.
    AND e.game_total BETWEEN 1 AND 100
    AND e.game_score BETWEEN 0 AND e.game_total
    -- Mort subite : son total peut représenter des questions NON tentées.
    AND lower(e.game_mode) NOT IN ('sudden', 'mort-subite', 'mort_subite', 'sudden-death')
    -- Les agrégats représentent les élèves actuellement inscrits.
    AND EXISTS (
      SELECT 1 FROM public.connect_enrollments AS m
      WHERE m.student_id = e.student_id AND m.class_id = e.class_id
        AND m.left_at IS NULL
    )
    -- Les parties du profil professeur ne sont pas des résultats d'élèves.
    AND NOT EXISTS (
      SELECT 1 FROM public.connect_teacher_players AS t
      WHERE t.student_id = e.student_id
    )
  GROUP BY e.class_id, e.app_key
$fn$;

-- La fonction est appelée UNIQUEMENT par l'Edge professeur, après getUser
-- + connect_class_permissions. Aucun accès REST direct par les élèves.
REVOKE ALL ON FUNCTION public.connect_projection_completed_attempt_counts_v1(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.connect_projection_completed_attempt_counts_v1(uuid[]) TO service_role;
