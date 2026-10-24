-- PROPOSITION NON DÉPLOYÉE — Math'as Connect RESTORE / 2026-10-24
-- Révision humaine et recette sur projet isolé obligatoires AVANT exécution.
-- La Edge Function (service_role) vérifie au préalable le JWT réel, can_manage,
-- l'app_key et l'appartenance active. La RPC vérifie de nouveau ces droits.
-- postgresql 15+ ; nécessite pgcrypto pour digest()
CREATE SCHEMA IF NOT EXISTS connect_internal;
REVOKE ALL ON SCHEMA connect_internal FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS connect_internal.restore_previews (
 token_hash text PRIMARY KEY,
 actor_id uuid NOT NULL,
 class_id uuid NOT NULL,
 student_id uuid NOT NULL,
 app_key text NOT NULL,
 expected_revision bigint NOT NULL,
 expected_reset_epoch bigint NOT NULL,
 backup_sha256 text NOT NULL CHECK (backup_sha256 ~ '^[0-9a-f]{64}$'),
 after_sha256 text NOT NULL CHECK (after_sha256 ~ '^[0-9a-f]{64}
 backup_reset_epoch bigint NOT NULL,
 recover_past_reset boolean NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL,
 used_at timestamptz,
 CHECK (expires_at <= created_at + interval '10 minutes')
);
CREATE INDEX IF NOT EXISTS restore_previews_expires_idx ON connect_internal.restore_previews(expires_at);
CREATE TABLE IF NOT EXISTS connect_internal.restore_audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 performed_at timestamptz NOT NULL DEFAULT now(),
 actor_id uuid NOT NULL,
 class_id uuid NOT NULL,
 student_id uuid NOT NULL,
 app_key text NOT NULL,
 backup_sha256 text NOT NULL,
 backup_reset_epoch bigint NOT NULL,
 prior_revision bigint NOT NULL,
 prior_reset_epoch bigint NOT NULL,
 after_revision bigint NOT NULL,
 before_exists boolean NOT NULL,
 before_state jsonb,
 after_sha256 text NOT NULL,
 preview_token_hash text NOT NULL UNIQUE,
 CHECK (before_exists OR before_state IS NULL)
);
REVOKE ALL ON ALL TABLES IN SCHEMA connect_internal FROM PUBLIC, anon, authenticated;
-- Le service_role accède au journal UNIQUEMENT par les RPC ci-dessous ;
-- les tables privées ne sont jamais exposées dans la Data API.

CREATE OR REPLACE FUNCTION public.connect_restore_prepare_v1(
 p_token_hash text, p_actor_id uuid, p_class_id uuid, p_student_id uuid,
 p_app_key text, p_expected_revision bigint, p_expected_reset_epoch bigint,
 p_backup_sha256 text, p_after_state jsonb, p_backup_reset_epoch bigint,
 p_recover_past_reset boolean
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
 IF length(p_token_hash) <> 64 OR p_token_hash !~ '^[0-9a-f]{64}$'
    OR p_backup_sha256 !~ '^[0-9a-f]{64}$'
    THEN RAISE EXCEPTION 'invalid_digest'; END IF;
 IF p_after_state IS NULL OR jsonb_typeof(p_after_state)<>'object' THEN RAISE EXCEPTION 'invalid_state'; END IF;
 IF p_app_key <> 'addition-ecrite-simple' THEN RAISE EXCEPTION 'invalid_app'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.connect_class_permissions
                WHERE teacher_id=p_actor_id AND class_id=p_class_id AND can_manage=true)
 OR NOT EXISTS (SELECT 1 FROM public.connect_enrollments
                WHERE student_id=p_student_id AND class_id=p_class_id AND left_at IS NULL)
 THEN RAISE EXCEPTION 'forbidden'; END IF;
 IF p_expected_revision < 0 OR p_expected_reset_epoch < 0 OR p_backup_reset_epoch < 0
 THEN RAISE EXCEPTION 'invalid_revision'; END IF;
 INSERT INTO connect_internal.restore_previews
  (token_hash,actor_id,class_id,student_id,app_key,expected_revision,expected_reset_epoch,
   backup_sha256,after_sha256,after_state,backup_reset_epoch,recover_past_reset,expires_at)
 VALUES(p_token_hash,p_actor_id,p_class_id,p_student_id,p_app_key,
        p_expected_revision,p_expected_reset_epoch,p_backup_sha256,
        encode(extensions.digest(pg_catalog.convert_to(p_after_state::text,'UTF8'),'sha256'),'hex'),p_after_state,
        p_backup_reset_epoch,p_recover_past_reset,now()+interval '5 minutes');
END $$;

CREATE OR REPLACE FUNCTION public.connect_restore_apply_v1(
 p_token_hash text, p_actor_id uuid, p_class_id uuid, p_student_id uuid,
 p_app_key text, p_backup_sha256 text,
 p_confirmation text
) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE p connect_internal.restore_previews%ROWTYPE;
        s public.connect_states%ROWTYPE;
        v_exists boolean; v_revision bigint; v_epoch bigint;
        v_after_hash text; v_new_revision bigint;
BEGIN
 IF p_confirmation <> 'RESTAURER' THEN RAISE EXCEPTION 'confirmation_required'; END IF;
 SELECT * INTO p FROM connect_internal.restore_previews
  WHERE token_hash=p_token_hash FOR UPDATE;
 IF NOT FOUND OR p.used_at IS NOT NULL OR p.expires_at<=now()
 THEN RAISE EXCEPTION 'preview_expired_or_consumed'; END IF;
 IF p.actor_id<>p_actor_id OR p.class_id<>p_class_id OR p.student_id<>p_student_id
    OR p.app_key<>p_app_key OR p.backup_sha256<>p_backup_sha256
 THEN RAISE EXCEPTION 'preview_mismatch'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.connect_class_permissions
                WHERE teacher_id=p_actor_id AND class_id=p_class_id AND can_manage=true)
 OR NOT EXISTS (SELECT 1 FROM public.connect_enrollments
                WHERE student_id=p_student_id AND class_id=p_class_id AND left_at IS NULL)
 THEN RAISE EXCEPTION 'forbidden'; END IF;
 -- Digest d'un rendu jsonb canonisé côté PostgreSQL ; MUST match the
 -- digest computed by the prepare RPC using the same PostgreSQL cast.
 v_after_hash=encode(extensions.digest(pg_catalog.convert_to(p.after_state::text,'UTF8'),'sha256'),'hex');
 IF p.after_sha256<>v_after_hash THEN RAISE EXCEPTION 'preview_state_changed'; END IF;
 -- Sérialiser aussi le cas où aucune ligne n'existe encore.
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_student_id::text||':'||p_app_key,0));
 SELECT * INTO s FROM public.connect_states
   WHERE student_id=p_student_id AND app_key=p_app_key FOR UPDATE;
 v_exists=FOUND;
 v_revision=CASE WHEN v_exists THEN s.revision ELSE 0 END;
 v_epoch=CASE WHEN v_exists THEN s.reset_epoch ELSE 0 END;
 IF v_revision<>p.expected_revision OR v_epoch<>p.expected_reset_epoch
 THEN RAISE EXCEPTION 'revision_conflict'; END IF;
 IF p.backup_reset_epoch>v_epoch AND v_exists THEN RAISE EXCEPTION 'backup_newer_epoch'; END IF;
 IF v_exists AND p.backup_reset_epoch<>v_epoch AND NOT p.recover_past_reset
 THEN RAISE EXCEPTION 'previous_reset_requires_confirmation'; END IF;
 v_new_revision=v_revision+1;
 -- Le snapshot ET la mutation sont dans la même transaction de cette RPC.
 INSERT INTO connect_internal.restore_audit
 (actor_id,class_id,student_id,app_key,backup_sha256,backup_reset_epoch,
  prior_revision,prior_reset_epoch,after_revision,before_exists,before_state,
  after_sha256,preview_token_hash)
 VALUES (p_actor_id,p_class_id,p_student_id,p_app_key,p_backup_sha256,p.backup_reset_epoch,
         v_revision,v_epoch,v_new_revision,v_exists,
         CASE WHEN v_exists THEN s.state_data ELSE NULL END,
         v_after_hash,p_token_hash);
 IF v_exists THEN
  UPDATE public.connect_states
    SET state_data=p.after_state,revision=v_new_revision,schema_version=1,updated_at=now()
    WHERE student_id=p_student_id AND app_key=p_app_key;
 ELSE
  INSERT INTO public.connect_states(student_id,app_key,revision,reset_epoch,state_data,schema_version,updated_at)
  VALUES(p_student_id,p_app_key,v_new_revision,v_epoch,p.after_state,1,now());
 END IF;
 UPDATE connect_internal.restore_previews SET used_at=now() WHERE token_hash=p_token_hash;
 RETURN v_new_revision;
END $$;

REVOKE ALL ON FUNCTION public.connect_restore_prepare_v1(text,uuid,uuid,uuid,text,bigint,bigint,text,jsonb,bigint,boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.connect_restore_apply_v1(text,uuid,uuid,uuid,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.connect_restore_prepare_v1(text,uuid,uuid,uuid,text,bigint,bigint,text,text,bigint,boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.connect_restore_apply_v1(text,uuid,uuid,uuid,text,text,jsonb,text) TO service_role;
-- prepare stocke l'état exact et calcule son empreinte dans PostgreSQL.
-- apply utilise exclusivement cet état stocké : aucune substitution de payload au clic final.
-- Nécessite: choisir un protocole canonical-jsonb, validation stricte des états,
-- tests PG réels, rollback vérifié, cleanup périodique des previews expirées,
-- rétention et politique d'accès/relecture du journal privé.
),
 after_state jsonb NOT NULL CHECK (jsonb_typeof(after_state) = 'object'),
 backup_reset_epoch bigint NOT NULL,
 recover_past_reset boolean NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL,
 used_at timestamptz,
 CHECK (expires_at <= created_at + interval '10 minutes')
);
CREATE INDEX IF NOT EXISTS restore_previews_expires_idx ON connect_internal.restore_previews(expires_at);
CREATE TABLE IF NOT EXISTS connect_internal.restore_audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 performed_at timestamptz NOT NULL DEFAULT now(),
 actor_id uuid NOT NULL,
 class_id uuid NOT NULL,
 student_id uuid NOT NULL,
 app_key text NOT NULL,
 backup_sha256 text NOT NULL,
 backup_reset_epoch bigint NOT NULL,
 prior_revision bigint NOT NULL,
 prior_reset_epoch bigint NOT NULL,
 after_revision bigint NOT NULL,
 before_exists boolean NOT NULL,
 before_state jsonb,
 after_sha256 text NOT NULL,
 preview_token_hash text NOT NULL UNIQUE,
 CHECK (before_exists OR before_state IS NULL)
);
REVOKE ALL ON ALL TABLES IN SCHEMA connect_internal FROM PUBLIC, anon, authenticated;
-- Le service_role accède au journal UNIQUEMENT par les RPC ci-dessous ;
-- les tables privées ne sont jamais exposées dans la Data API.

CREATE OR REPLACE FUNCTION public.connect_restore_prepare_v1(
 p_token_hash text, p_actor_id uuid, p_class_id uuid, p_student_id uuid,
 p_app_key text, p_expected_revision bigint, p_expected_reset_epoch bigint,
 p_backup_sha256 text, p_after_sha256 text, p_backup_reset_epoch bigint,
 p_recover_past_reset boolean
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
 IF length(p_token_hash) <> 64 OR p_token_hash !~ '^[0-9a-f]{64}$'
    OR p_backup_sha256 !~ '^[0-9a-f]{64}$'
    OR p_after_sha256 !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'invalid_digest'; END IF;
 IF p_app_key <> 'addition-ecrite-simple' THEN RAISE EXCEPTION 'invalid_app'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.connect_class_permissions
                WHERE teacher_id=p_actor_id AND class_id=p_class_id AND can_manage=true)
 OR NOT EXISTS (SELECT 1 FROM public.connect_enrollments
                WHERE student_id=p_student_id AND class_id=p_class_id AND left_at IS NULL)
 THEN RAISE EXCEPTION 'forbidden'; END IF;
 IF p_expected_revision < 0 OR p_expected_reset_epoch < 0 OR p_backup_reset_epoch < 0
 THEN RAISE EXCEPTION 'invalid_revision'; END IF;
 INSERT INTO connect_internal.restore_previews
  (token_hash,actor_id,class_id,student_id,app_key,expected_revision,expected_reset_epoch,
   backup_sha256,after_sha256,backup_reset_epoch,recover_past_reset,expires_at)
 VALUES(p_token_hash,p_actor_id,p_class_id,p_student_id,p_app_key,
        p_expected_revision,p_expected_reset_epoch,p_backup_sha256,p_after_sha256,
        p_backup_reset_epoch,p_recover_past_reset,now()+interval '5 minutes');
END $$;

CREATE OR REPLACE FUNCTION public.connect_restore_apply_v1(
 p_token_hash text, p_actor_id uuid, p_class_id uuid, p_student_id uuid,
 p_app_key text, p_backup_sha256 text, p_after_state jsonb,
 p_confirmation text
) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE p connect_internal.restore_previews%ROWTYPE;
        s public.connect_states%ROWTYPE;
        v_exists boolean; v_revision bigint; v_epoch bigint;
        v_after_hash text; v_new_revision bigint;
BEGIN
 IF p_confirmation <> 'RESTAURER' OR p_after_state IS NULL OR jsonb_typeof(p_after_state)<>'object'
 THEN RAISE EXCEPTION 'confirmation_required'; END IF;
 SELECT * INTO p FROM connect_internal.restore_previews
  WHERE token_hash=p_token_hash FOR UPDATE;
 IF NOT FOUND OR p.used_at IS NOT NULL OR p.expires_at<=now()
 THEN RAISE EXCEPTION 'preview_expired_or_consumed'; END IF;
 IF p.actor_id<>p_actor_id OR p.class_id<>p_class_id OR p.student_id<>p_student_id
    OR p.app_key<>p_app_key OR p.backup_sha256<>p_backup_sha256
 THEN RAISE EXCEPTION 'preview_mismatch'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.connect_class_permissions
                WHERE teacher_id=p_actor_id AND class_id=p_class_id AND can_manage=true)
 OR NOT EXISTS (SELECT 1 FROM public.connect_enrollments
                WHERE student_id=p_student_id AND class_id=p_class_id AND left_at IS NULL)
 THEN RAISE EXCEPTION 'forbidden'; END IF;
 -- Digest d'un rendu jsonb canonisé côté PostgreSQL ; MUST match the
 -- digest computed by the prepare RPC using the same PostgreSQL cast.
 v_after_hash=encode(extensions.digest(convert_to(p_after_state::text,'UTF8'),'sha256'),'hex');
 IF p.after_sha256<>v_after_hash THEN RAISE EXCEPTION 'preview_state_changed'; END IF;
 -- Sérialiser aussi le cas où aucune ligne n'existe encore.
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_student_id::text||':'||p_app_key,0));
 SELECT * INTO s FROM public.connect_states
   WHERE student_id=p_student_id AND app_key=p_app_key FOR UPDATE;
 v_exists=FOUND;
 v_revision=CASE WHEN v_exists THEN s.revision ELSE 0 END;
 v_epoch=CASE WHEN v_exists THEN s.reset_epoch ELSE 0 END;
 IF v_revision<>p.expected_revision OR v_epoch<>p.expected_reset_epoch
 THEN RAISE EXCEPTION 'revision_conflict'; END IF;
 IF p.backup_reset_epoch>v_epoch AND v_exists THEN RAISE EXCEPTION 'backup_newer_epoch'; END IF;
 IF v_exists AND p.backup_reset_epoch<>v_epoch AND NOT p.recover_past_reset
 THEN RAISE EXCEPTION 'previous_reset_requires_confirmation'; END IF;
 v_new_revision=v_revision+1;
 -- Le snapshot ET la mutation sont dans la même transaction de cette RPC.
 INSERT INTO connect_internal.restore_audit
 (actor_id,class_id,student_id,app_key,backup_sha256,backup_reset_epoch,
  prior_revision,prior_reset_epoch,after_revision,before_exists,before_state,
  after_sha256,preview_token_hash)
 VALUES (p_actor_id,p_class_id,p_student_id,p_app_key,p_backup_sha256,p.backup_reset_epoch,
         v_revision,v_epoch,v_new_revision,v_exists,
         CASE WHEN v_exists THEN s.state_data ELSE NULL END,
         v_after_hash,p_token_hash);
 IF v_exists THEN
  UPDATE public.connect_states
    SET state_data=p_after_state,revision=v_new_revision,schema_version=1,updated_at=now()
    WHERE student_id=p_student_id AND app_key=p_app_key;
 ELSE
  INSERT INTO public.connect_states(student_id,app_key,revision,reset_epoch,state_data,schema_version,updated_at)
  VALUES(p_student_id,p_app_key,v_new_revision,v_epoch,p_after_state,1,now());
 END IF;
 UPDATE connect_internal.restore_previews SET used_at=now() WHERE token_hash=p_token_hash;
 RETURN v_new_revision;
END $$;

REVOKE ALL ON FUNCTION public.connect_restore_prepare_v1(text,uuid,uuid,uuid,text,bigint,bigint,text,text,bigint,boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.connect_restore_apply_v1(text,uuid,uuid,uuid,text,text,jsonb,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.connect_restore_prepare_v1(text,uuid,uuid,uuid,text,bigint,bigint,text,text,bigint,boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.connect_restore_apply_v1(text,uuid,uuid,uuid,text,text,jsonb,text) TO service_role;
-- INCOMPLET : prepare doit calculer/attester after_sha256 côté serveur plutôt que
-- croire le hash fourni par l'Edge ; Edge seul est autorisé à appeler cette RPC.
-- Nécessite: choisir un protocole canonical-jsonb, validation stricte des états,
-- tests PG réels, rollback vérifié, cleanup périodique des previews expirées,
-- rétention et politique d'accès/relecture du journal privé.
