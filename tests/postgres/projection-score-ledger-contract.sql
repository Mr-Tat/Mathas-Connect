-- Exécuté UNIQUEMENT dans PostgreSQL 16 jetable GitHub Actions.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE TABLE public.connect_classes(id uuid PRIMARY KEY,name text);
CREATE TABLE public.connect_students(id uuid PRIMARY KEY);
CREATE TABLE public.connect_apps(app_key text PRIMARY KEY);
CREATE TABLE public.connect_enrollments(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 class_id uuid NOT NULL REFERENCES public.connect_classes(id),
 student_id uuid NOT NULL REFERENCES public.connect_students(id),
 joined_at timestamptz NOT NULL DEFAULT now(),
 left_at timestamptz
);
CREATE TABLE public.connect_states(student_id uuid NOT NULL,app_key text NOT NULL,state_data jsonb NOT NULL DEFAULT '{}',
 PRIMARY KEY(student_id,app_key));
INSERT INTO public.connect_classes(id,name) VALUES
 ('11111111-1111-4111-8111-111111111111','Phase 2 A'),
 ('22222222-2222-4222-8222-222222222222','Phase 2 B');
INSERT INTO public.connect_students(id) VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
INSERT INTO public.connect_apps(app_key) VALUES ('addition-ecrite-simple'),('multiplication-ecrite-simple');
INSERT INTO public.connect_enrollments(class_id,student_id) VALUES
 ('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
 ('22222222-2222-4222-8222-222222222222','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
INSERT INTO public.connect_states(student_id,app_key,state_data) VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','addition-ecrite-simple',
 '{"recent":[{"eventId":"aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa","mode":"classic","score":4,"total":4,"points":20,"at":"2026-10-29T12:00:00Z"}]}');
\ir ../../supabase/release-candidates/20261031_projection_v2_score_journal.sql

DO $assert$
BEGIN
 IF (SELECT count(*) FROM public.connect_projection_score_events) <> 1 THEN RAISE EXCEPTION 'Backfill failed'; END IF;
 IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.connect_projection_score_events'::regclass) THEN RAISE EXCEPTION 'Event RLS missing'; END IF;
 IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.connect_projection_score_periods'::regclass) THEN RAISE EXCEPTION 'Period RLS missing'; END IF;
 IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.connect_projection_settings'::regclass) THEN RAISE EXCEPTION 'Settings RLS missing'; END IF;
 IF has_table_privilege('anon','public.connect_projection_score_events','SELECT')
    OR has_table_privilege('authenticated','public.connect_projection_score_periods','UPDATE') THEN RAISE EXCEPTION 'Public privilege leak'; END IF;
END $assert$;

UPDATE public.connect_states
SET state_data='{"recent":[{"eventId":"aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa","mode":"classic","score":4,"total":4,"points":20,"at":"2026-10-29T12:00:00Z"}]}'
WHERE student_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
DO $assert$
BEGIN IF (SELECT count(*) FROM public.connect_projection_score_events)<>1 THEN RAISE EXCEPTION 'Replay duplicated same event'; END IF; END $assert$;

INSERT INTO public.connect_states(student_id,app_key,state_data) VALUES
('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','addition-ecrite-simple',
 '{"recent":[{"eventId":"bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb","mode":"classic","score":3,"total":4,"points":15,"at":"2026-10-29T12:05:00Z"}]}'),
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','multiplication-ecrite-simple',
 '{"recent":[{"eventId":"aaaaaaaa-3333-4333-8333-aaaaaaaaaaaa","mode":"hard","score":5,"total":5,"points":35,"at":"2026-10-29T12:10:00Z"}]}');
DO $assert$
BEGIN
 IF (SELECT count(*) FROM public.connect_projection_score_events)<>3 THEN RAISE EXCEPTION 'Trigger capture failed'; END IF;
 IF (SELECT count(*) FROM public.connect_projection_score_events WHERE class_id='22222222-2222-4222-8222-222222222222')<>1 THEN RAISE EXCEPTION 'Class attribution wrong'; END IF;
END $assert$;

-- Un reset A/addition change uniquement sa date. B/addition et A/multiplication intacts.
INSERT INTO public.connect_projection_score_periods(class_id,app_key,score_since)
VALUES ('11111111-1111-4111-8111-111111111111','addition-ecrite-simple','2026-10-20T00:00:00Z'),
('22222222-2222-4222-8222-222222222222','addition-ecrite-simple','2026-10-25T00:00:00Z'),
('11111111-1111-4111-8111-111111111111','multiplication-ecrite-simple','2026-10-22T00:00:00Z');
INSERT INTO public.connect_projection_score_periods(class_id,app_key,score_since)
VALUES ('11111111-1111-4111-8111-111111111111','addition-ecrite-simple','2026-10-30T00:00:00Z')
ON CONFLICT(class_id,app_key) DO UPDATE SET score_since=excluded.score_since,updated_at=now();
DO $assert$
BEGIN
 IF (SELECT score_since FROM public.connect_projection_score_periods WHERE class_id='22222222-2222-4222-8222-222222222222' AND app_key='addition-ecrite-simple')<>'2026-10-25T00:00:00Z' THEN
  RAISE EXCEPTION 'B period changed'; END IF;
 IF (SELECT score_since FROM public.connect_projection_score_periods WHERE class_id='11111111-1111-4111-8111-111111111111' AND app_key='multiplication-ecrite-simple')<>'2026-10-22T00:00:00Z' THEN
  RAISE EXCEPTION 'Other application period changed'; END IF;
 IF (SELECT count(*) FROM public.connect_projection_score_events)<>3 THEN RAISE EXCEPTION 'Reset erased game events'; END IF;
END $assert$;

UPDATE public.connect_states SET state_data='{"recent":[]}' WHERE student_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
DO $assert$
BEGIN IF (SELECT count(*) FROM public.connect_projection_score_events)<>3 THEN RAISE EXCEPTION 'Score events erased by game reset'; END IF; END $assert$;
SELECT 'OK: score ledger, RLS, replay and reset class/app isolation' AS conclusion;
