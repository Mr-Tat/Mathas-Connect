-- DRAFT NON DEPLOYE / NON TESTE SUR POSTGRESQL
-- A revoir après mise au point et recette de restore_atomic_v1_NOT_DEPLOYED.sql.
-- Le retour arrière est lui aussi conditionné à la révision exacte :
-- il ne doit jamais écraser une nouvelle partie jouée après restauration.
CREATE TABLE IF NOT EXISTS connect_internal.restore_undo_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  restore_id bigint NOT NULL UNIQUE REFERENCES connect_internal.restore_audit(id),
  actor_id uuid NOT NULL,
  undone_at timestamptz NOT NULL DEFAULT now(),
  prior_revision bigint NOT NULL,
  after_revision bigint NOT NULL
);
REVOKE ALL ON connect_internal.restore_undo_audit FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.connect_restore_undo_v1(
 p_restore_id bigint,p_actor_id uuid,p_expected_revision bigint,p_expected_reset_epoch bigint,
 p_confirmation text
) RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE a connect_internal.restore_audit%ROWTYPE;
 s public.connect_states%ROWTYPE;
 v_new_revision bigint;
BEGIN
 IF p_confirmation<>'ANNULER RESTAURATION' THEN RAISE EXCEPTION 'confirmation_required'; END IF;
 SELECT * INTO a FROM connect_internal.restore_audit WHERE id=p_restore_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'unknown_restore'; END IF;
 IF EXISTS (SELECT 1 FROM connect_internal.restore_undo_audit WHERE restore_id=p_restore_id)
 THEN RAISE EXCEPTION 'already_undone'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.connect_class_permissions
  WHERE teacher_id=p_actor_id AND class_id=a.class_id AND can_manage=true)
 OR NOT EXISTS (SELECT 1 FROM public.connect_enrollments
  WHERE student_id=a.student_id AND class_id=a.class_id AND left_at IS NULL)
 THEN RAISE EXCEPTION 'forbidden'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(a.student_id::text||':'||a.app_key,0));
 SELECT * INTO s FROM public.connect_states
  WHERE student_id=a.student_id AND app_key=a.app_key FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'state_missing'; END IF;
 IF s.revision<>p_expected_revision OR s.reset_epoch<>p_expected_reset_epoch
  OR s.revision<>a.after_revision OR s.reset_epoch<>a.prior_reset_epoch
 THEN RAISE EXCEPTION 'state_changed_since_restore'; END IF;
 IF encode(extensions.digest(pg_catalog.convert_to(s.state_data::text,'UTF8'),'sha256'),'hex')<>a.after_sha256
 THEN RAISE EXCEPTION 'state_changed_since_restore'; END IF;
 -- Ne jamais effacer la ligne, même si l'état n'existait pas avant :
 -- une révision croissante protège les clients contre les caches anciens.
 v_new_revision=s.revision+1;
 UPDATE public.connect_states SET
   state_data=CASE WHEN a.before_exists THEN a.before_state ELSE '{}'::jsonb END,
   schema_version=1,revision=v_new_revision,updated_at=now()
 WHERE student_id=a.student_id AND app_key=a.app_key;
 INSERT INTO connect_internal.restore_undo_audit
 (restore_id,actor_id,prior_revision,after_revision)
 VALUES(p_restore_id,p_actor_id,s.revision,v_new_revision);
 RETURN v_new_revision;
END $$;
REVOKE ALL ON FUNCTION public.connect_restore_undo_v1(bigint,uuid,bigint,bigint,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.connect_restore_undo_v1(bigint,uuid,bigint,bigint,text) TO service_role;
-- Restant à faire avant intégration :
-- (1) journal privé accessible uniquement via RPC dédiée au professeur ;
-- (2) authentification de l'acteur par l'Edge, jamais un UUID client libre ;
-- (3) tests PostgreSQL véritable sur une base isolée, transaction rollback ;
-- (4) sémantique du retour à absence d'état / scores vides à valider ;
-- (5) révocation des droits et politique de rétention.
