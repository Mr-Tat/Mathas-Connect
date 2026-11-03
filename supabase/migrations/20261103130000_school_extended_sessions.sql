-- Certified non-classic school game sessions. Completely separate from the
-- existing CLASSIC ledger, so no existing challenge or pupil state is altered.
CREATE TABLE public.connect_objective_record_school_extended_sessions(
 session_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 student_id uuid NOT NULL REFERENCES public.connect_students(id),
 class_id uuid NOT NULL REFERENCES public.connect_classes(id),
 app_key text NOT NULL REFERENCES public.connect_apps(app_key),
 mode text NOT NULL CHECK(mode IN ('three-lives','sudden','hard-three-lives','hard-sudden')),
 level integer NOT NULL CHECK(level BETWEEN 1 AND 3),
 width integer NOT NULL CHECK(width BETWEEN 3 AND 16),
 total integer NOT NULL DEFAULT 120 CHECK(total=120),
 expected_revision bigint NOT NULL CHECK(expected_revision>=0),
 reset_epoch bigint NOT NULL CHECK(reset_epoch>=0),
 questions jsonb NOT NULL CHECK(jsonb_typeof(questions)='array'),
 created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL,
 consumed_at timestamptz,
 answers_hash text,
 result jsonb
);
CREATE INDEX connect_school_extended_pending_idx
 ON public.connect_objective_record_school_extended_sessions(student_id,class_id,app_key,mode,level,created_at DESC)
 WHERE consumed_at IS NULL;
ALTER TABLE public.connect_objective_record_school_extended_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.connect_objective_record_school_extended_sessions FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.connect_objective_record_school_extended_sessions TO service_role;
