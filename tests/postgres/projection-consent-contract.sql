-- Contrat isolé, sans accès aux élèves réels.
\ir projection-protected-reset-contract.sql
\ir ../../supabase/release-candidates/20261031_projection_v2_explicit_score_consent.sql

DO $checks$
BEGIN
 IF (SELECT count(*) FROM public.connect_projection_best_scores_v1(
   '22222222-2222-4222-8222-222222222222'))<>0 THEN
   RAISE EXCEPTION 'Score displayed without explicit pupil consent';
 END IF;
 IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.connect_projection_score_consents'::regclass)
 THEN RAISE EXCEPTION 'Missing score consent RLS';END IF;
 IF has_table_privilege('anon','public.connect_projection_score_consents','SELECT')
 OR has_table_privilege('authenticated','public.connect_projection_score_consents','INSERT')
 THEN RAISE EXCEPTION 'Score consent exposed to public Data API';END IF;
END $checks$;

INSERT INTO public.connect_projection_score_consents(student_id,class_id,app_key,event_id)
VALUES('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222',
 'addition-ecrite-simple','bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb');
DO $checks$
BEGIN
 IF (SELECT count(*) FROM public.connect_projection_best_scores_v1(
  '22222222-2222-4222-8222-222222222222'))<>1 THEN
  RAISE EXCEPTION 'Explicitly offered saved score not visible';END IF;
 IF (SELECT count(*) FROM public.connect_projection_best_scores_v1(
  '11111111-1111-4111-8111-111111111111'))<>0 THEN
  RAISE EXCEPTION 'Consent of another class leaked to this board';END IF;
END $checks$;

-- A fake/unrecorded event cannot produce a score, even with a consent row.
INSERT INTO public.connect_projection_score_consents(student_id,class_id,app_key,event_id)
VALUES('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111',
 'multiplication-ecrite-simple','aaaaaaaa-eeee-4eee-8eee-aaaaaaaaaaaa');
DO $checks$
BEGIN
 IF (SELECT count(*) FROM public.connect_projection_best_scores_v1(
  '11111111-1111-4111-8111-111111111111'))<>0 THEN
   RAISE EXCEPTION 'Unverified synthetic score became public'; END IF;
 IF (SELECT count(*) FROM public.connect_projection_score_events)<>3 THEN
   RAISE EXCEPTION 'Consent modified real game results'; END IF;
END $checks$;
SELECT 'OK: explicit opt-in only, RLS, isolation and no fake scoreboard events' result;
