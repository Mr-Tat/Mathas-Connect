-- Isolated official challenge ledger for variable-length score modes.
-- This never changes existing CLASSIC sessions or school pupils' progress.
CREATE TABLE IF NOT EXISTS public.connect_objective_record_school_mode_sessions(
 session_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 student_id uuid NOT NULL REFERENCES public.connect_students(id),
 class_id uuid NOT NULL REFERENCES public.connect_classes(id),
 app_key text NOT NULL REFERENCES public.connect_apps(app_key),
 mode text NOT NULL CHECK (mode IN ('three-lives','sudden','hard-three-lives','hard-sudden')),
 level integer NOT NULL CHECK (level BETWEEN 1 AND 3),
 expected_revision bigint NOT NULL CHECK (expected_revision>=0),
 reset_epoch bigint NOT NULL CHECK (reset_epoch>=0),
 questions jsonb NOT NULL CHECK (jsonb_typeof(questions)='array' AND jsonb_array_length(questions)=64),
 created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL,
 consumed_at timestamptz,
 answers_hash text,
 result jsonb
);
CREATE INDEX IF NOT EXISTS connect_school_modes_pending_idx
 ON public.connect_objective_record_school_mode_sessions(student_id,class_id,app_key,mode,level,created_at DESC)
 WHERE consumed_at IS NULL;
ALTER TABLE public.connect_objective_record_school_mode_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.connect_objective_record_school_mode_sessions FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.connect_objective_record_school_mode_sessions TO service_role;
-- No anon/authenticated RLS policies exist: the verified JWT Edge binds
-- student_id and school permission, SQL RPCs also recheck enrollment.
