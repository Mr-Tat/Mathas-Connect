-- Aucun élève réel ; réutilise le banc PostgreSQL jetable du journal.
\ir projection-score-ledger-contract.sql
CREATE TABLE public.connect_class_permissions(
 class_id uuid NOT NULL,teacher_id uuid NOT NULL,can_manage boolean NOT NULL DEFAULT false,
 PRIMARY KEY(class_id,teacher_id)
);
CREATE TABLE public.connect_level_profiles(student_id uuid PRIMARY KEY,highest_level_reached integer);
CREATE TABLE public.connect_trophy_achievements(student_id uuid NOT NULL,trophy_key text NOT NULL,PRIMARY KEY(student_id,trophy_key));
INSERT INTO public.connect_class_permissions(class_id,teacher_id,can_manage) VALUES
 ('11111111-1111-4111-8111-111111111111','99999999-9999-4999-8999-999999999999',true),
 ('22222222-2222-4222-8222-222222222222','99999999-9999-4999-8999-999999999999',true);
INSERT INTO public.connect_level_profiles(student_id,highest_level_reached)
 VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',4);
INSERT INTO public.connect_trophy_achievements(student_id,trophy_key)
 VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','bronze'),('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','argent');
\ir ../../supabase/release-candidates/20261031_projection_v2_protected_reset.sql

DO $assert$
DECLARE old_b timestamptz;old_other timestamptz;after_a timestamptz;badges record;
BEGIN
 SELECT score_since INTO old_b FROM public.connect_projection_score_periods
 WHERE class_id='22222222-2222-4222-8222-222222222222' AND app_key='addition-ecrite-simple';
 SELECT score_since INTO old_other FROM public.connect_projection_score_periods
 WHERE class_id='11111111-1111-4111-8111-111111111111' AND app_key='multiplication-ecrite-simple';

 BEGIN
  PERFORM public.connect_projection_reset_score_v1('11111111-1111-4111-8111-111111111111','addition-ecrite-simple','88888888-8888-4888-8888-888888888888');
  RAISE EXCEPTION 'Unauthorized reset was allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;

 after_a:=public.connect_projection_reset_score_v1('11111111-1111-4111-8111-111111111111','addition-ecrite-simple','99999999-9999-4999-8999-999999999999');

 IF (SELECT score_since FROM public.connect_projection_score_periods
 WHERE class_id='11111111-1111-4111-8111-111111111111' AND app_key='addition-ecrite-simple')<>after_a
 THEN RAISE EXCEPTION 'Reset date incorrect';END IF;
 IF (SELECT score_since FROM public.connect_projection_score_periods
 WHERE class_id='22222222-2222-4222-8222-222222222222' AND app_key='addition-ecrite-simple')<>old_b
 THEN RAISE EXCEPTION 'Phase 2 B reset accidentally';END IF;
 IF (SELECT score_since FROM public.connect_projection_score_periods
 WHERE class_id='11111111-1111-4111-8111-111111111111' AND app_key='multiplication-ecrite-simple')<>old_other
 THEN RAISE EXCEPTION 'Multiplication reset accidentally';END IF;
 IF (SELECT count(*) FROM public.connect_projection_score_reset_audit)<>1 THEN RAISE EXCEPTION 'Audit incorrect';END IF;
 IF (SELECT count(*) FROM public.connect_projection_score_events)<>3 THEN RAISE EXCEPTION 'Real game event was erased';END IF;
 IF (SELECT count(*) FROM public.connect_projection_best_scores_v1('11111111-1111-4111-8111-111111111111') WHERE app_key='addition-ecrite-simple')<>0
 THEN RAISE EXCEPTION 'Old class score not hidden';END IF;
 IF (SELECT count(*) FROM public.connect_projection_best_scores_v1('22222222-2222-4222-8222-222222222222') WHERE app_key='addition-ecrite-simple')<>1
 THEN RAISE EXCEPTION 'Other class best score lost';END IF;
 SELECT * INTO badges FROM public.connect_projection_player_badges_v1(ARRAY['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa']::uuid[]) LIMIT 1;
 IF badges.level<>4 OR badges.trophies<>2 THEN RAISE EXCEPTION 'Profile badges wrong';END IF;
 IF has_function_privilege('anon','public.connect_projection_reset_score_v1(uuid,text,uuid)','EXECUTE')
 OR has_function_privilege('authenticated','public.connect_projection_best_scores_v1(uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'Insecure RPC grants';END IF;
 IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.connect_projection_score_reset_audit'::regclass)
 THEN RAISE EXCEPTION 'Audit table RLS missing';END IF;
END $assert$;
SELECT 'OK: authorized reset class/app isolation, audit, badges, roles' AS conclusion;
