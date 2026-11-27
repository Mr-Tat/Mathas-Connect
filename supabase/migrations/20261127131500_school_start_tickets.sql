-- Server-issued online start authorization, independent of the game engine.
-- A result/XP is still committed only through the existing atomic recorder.
-- Retain tickets for offline retry and idempotent acknowledgement. No auto-expiry:
-- the actual profile, class membership, app and parcours epoch are revalidated.
CREATE TABLE IF NOT EXISTS public.connect_school_start_tickets (
 event_id uuid PRIMARY KEY,
 student_id uuid NOT NULL REFERENCES public.connect_students(id) ON DELETE CASCADE,
 class_id uuid NOT NULL REFERENCES public.connect_classes(id) ON DELETE CASCADE,
 auth_user_id uuid NOT NULL,
 app_key text NOT NULL,
 reset_epoch bigint NOT NULL CHECK (reset_epoch >= 0),
 game_config jsonb NOT NULL CHECK (jsonb_typeof(game_config) = 'object'),
 issued_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.connect_school_start_tickets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.connect_school_start_tickets FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.connect_school_start_tickets TO service_role;
CREATE INDEX IF NOT EXISTS connect_school_start_tickets_subject_idx
 ON public.connect_school_start_tickets(student_id,app_key,reset_epoch);
