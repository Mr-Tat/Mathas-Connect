-- [DÉCISION PROFESSEUR 2026-11-03]
-- Tous les élèves actifs (hors profil joueur professeur) commencent avec
-- l'initiale officielle du prénom et un fond transparent.
-- Récompenses 3/6/10/15/20 : validations dans connect-api, pas dans SQL.
-- AUCUN XP, score, trophée, inscription, consentement ou alias n'est modifié.
BEGIN;

-- Sauvegarde privée pour un retour arrière précis sans stocker les noms des
-- élèves dans le dépôt ni exposer leurs profils dans le Data API.
CREATE SCHEMA IF NOT EXISTS connect_private;
REVOKE ALL ON SCHEMA connect_private FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS connect_private.avatar_backup_20261103 (
 student_id uuid PRIMARY KEY,
 avatar_kind text NOT NULL,
 avatar_value text,
 avatar_color text NOT NULL,
 backed_up_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON TABLE connect_private.avatar_backup_20261103 FROM PUBLIC, anon, authenticated;
INSERT INTO connect_private.avatar_backup_20261103
 (student_id,avatar_kind,avatar_value,avatar_color)
SELECT s.id,s.avatar_kind,s.avatar_value,s.avatar_color
FROM public.connect_students s
WHERE s.archived_at IS NULL
 AND NOT EXISTS(SELECT 1 FROM public.connect_teacher_players t WHERE t.student_id=s.id)
ON CONFLICT (student_id) DO NOTHING;

-- Tous les NOUVEAUX comptes reçoivent aussi la même base.
ALTER TABLE public.connect_students ALTER COLUMN avatar_color SET DEFAULT 'transparent';
CREATE OR REPLACE FUNCTION public.connect_default_initial_avatar_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
SET search_path TO 'public','pg_temp'
AS $function$
BEGIN
 IF NEW.avatar_kind='letter' AND NEW.avatar_value IS NULL THEN
  NEW.avatar_value:=upper(left(btrim(NEW.display_name),1));
 END IF;
 RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.connect_default_initial_avatar_v1() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS connect_default_initial_avatar_v1 ON public.connect_students;
CREATE TRIGGER connect_default_initial_avatar_v1
 BEFORE INSERT ON public.connect_students
 FOR EACH ROW EXECUTE FUNCTION public.connect_default_initial_avatar_v1();

-- Ne toucher ni aux élèves archivés ni au profil dédié Monsieur T.
UPDATE public.connect_students s SET
 avatar_kind='letter',
 avatar_value=upper(left(btrim(s.display_name),1)),
 avatar_color='transparent'
WHERE s.archived_at IS NULL
 AND NOT EXISTS(SELECT 1 FROM public.connect_teacher_players t WHERE t.student_id=s.id)
 AND nullif(btrim(s.display_name),'') IS NOT NULL
 AND (s.avatar_kind IS DISTINCT FROM 'letter'
   OR s.avatar_value IS DISTINCT FROM upper(left(btrim(s.display_name),1))
   OR s.avatar_color IS DISTINCT FROM 'transparent');
COMMIT;

-- Contrôle READ-ONLY après installation :
-- SELECT count(*) FROM public.connect_students s
-- WHERE s.archived_at IS NULL
--   AND NOT EXISTS(SELECT 1 FROM public.connect_teacher_players t WHERE t.student_id=s.id)
--   AND (s.avatar_kind<>'letter'
--     OR s.avatar_value IS DISTINCT FROM upper(left(btrim(s.display_name),1))
--     OR s.avatar_color<>'transparent');
-- Résultat attendu immédiatement après déploiement : 0.
--
-- ROLLBACK MANUEL NON DESTRUCTIF (à n'exécuter que si aucun élève n'a déjà
-- changé son profil depuis la remise à zéro) :
-- UPDATE public.connect_students s SET
--  avatar_kind=b.avatar_kind,avatar_value=b.avatar_value,avatar_color=b.avatar_color
-- FROM connect_private.avatar_backup_20261103 b
-- WHERE s.id=b.student_id;
-- ALTER TABLE public.connect_students ALTER COLUMN avatar_color SET DEFAULT 'ocean';
-- DROP TRIGGER IF EXISTS connect_default_initial_avatar_v1 ON public.connect_students;
-- DROP FUNCTION IF EXISTS public.connect_default_initial_avatar_v1();
