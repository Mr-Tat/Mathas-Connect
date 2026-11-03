-- Advanced modes use their own immutable, server-authored arithmetic transcript.
-- The existing 18 classic pathways are deliberately left unchanged.
CREATE TABLE IF NOT EXISTS public.connect_objective_record_advanced_sessions(
 session_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 student_id uuid NOT NULL REFERENCES public.connect_students(id),
 class_id uuid NOT NULL REFERENCES public.connect_classes(id),
 app_key text NOT NULL REFERENCES public.connect_apps(app_key)
  CHECK(app_key IN('addition-ecrite-simple','addition-ecrite-multiple')),
 mode text NOT NULL CHECK(mode IN('three-lives','sudden','hard-three-lives','hard-sudden')),
 level integer NOT NULL CHECK(level BETWEEN 1 AND 3),
 question_limit integer NOT NULL CHECK(question_limit BETWEEN 10 AND 64),
 questions jsonb NOT NULL CHECK(jsonb_typeof(questions)='array'),
 expected_revision bigint NOT NULL CHECK(expected_revision>=0),
 reset_epoch bigint NOT NULL CHECK(reset_epoch>=0),
 created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL,
 consumed_at timestamptz,
 answers_hash text,
 result jsonb,
 CHECK((consumed_at IS NULL AND answers_hash IS NULL AND result IS NULL)
    OR (consumed_at IS NOT NULL AND answers_hash IS NOT NULL AND result IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS connect_advanced_unconsumed_idx
 ON public.connect_objective_record_advanced_sessions(student_id,class_id,app_key,created_at DESC)
 WHERE consumed_at IS NULL;
ALTER TABLE public.connect_objective_record_advanced_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.connect_objective_record_advanced_sessions FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.connect_objective_record_advanced_sessions TO service_role;
