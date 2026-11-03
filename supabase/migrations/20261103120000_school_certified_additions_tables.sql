-- Candidate ONLY: new school proof ledger, independent of TEST and native-score receipts.
CREATE TABLE IF NOT EXISTS public.connect_objective_record_school_proof_sessions(
 session_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 student_id uuid NOT NULL REFERENCES public.connect_students(id),
 class_id uuid NOT NULL REFERENCES public.connect_classes(id),
 app_key text NOT NULL REFERENCES public.connect_apps(app_key),
 expected_revision bigint NOT NULL CHECK(expected_revision>=0),
 reset_epoch bigint NOT NULL CHECK(reset_epoch>=0),
 level integer NOT NULL CHECK(level IN (1,2,3)),
 total integer NOT NULL CHECK(total IN (4,10,20)),
 questions jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL,
 consumed_at timestamptz,
 answers_hash text,
 result jsonb
);
CREATE INDEX IF NOT EXISTS connect_school_proof_pending_idx
 ON public.connect_objective_record_school_proof_sessions(student_id,class_id,app_key,created_at DESC)
 WHERE consumed_at IS NULL;
ALTER TABLE public.connect_objective_record_school_proof_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.connect_objective_record_school_proof_sessions FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.connect_objective_record_school_proof_sessions TO service_role;
CREATE TABLE IF NOT EXISTS public.connect_objective_record_school_receipts(
 student_id uuid NOT NULL REFERENCES public.connect_students(id),
 app_key text NOT NULL REFERENCES public.connect_apps(app_key),
 event_id uuid NOT NULL,
 event_hash text NOT NULL CHECK(length(event_hash)=64),
 recorded_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(student_id,app_key,event_id)
);
ALTER TABLE public.connect_objective_record_school_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.connect_objective_record_school_receipts FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.connect_objective_record_school_receipts TO service_role;
