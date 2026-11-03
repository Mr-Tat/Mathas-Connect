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

-- DB independently rechecks the school allow-list, including against compromised
-- or misconfigured Edge clients. TEST profiles are not accepted.
CREATE OR REPLACE FUNCTION public.connect_objective_record_school_class_allowed_v1(p_class uuid)
 RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path='' AS $check$
 SELECT p_class IN (
  '8fe170fa-9e8f-4e80-885a-b0ba68026f64'::uuid,
  '71f5f4a5-3f25-4ec7-ac29-c33d2e6b395e'::uuid,
  '1b021ed9-4846-4203-9c7b-4b5fa8d7adab'::uuid,
  '0d8ba828-59cc-468b-a4b8-7b2a1af10b88'::uuid,
  'a9195199-0a28-4e86-99ce-47b36dd6e646'::uuid
 );
$check$;
REVOKE ALL ON FUNCTION public.connect_objective_record_school_class_allowed_v1(uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.connect_objective_record_school_class_allowed_v1(uuid)
 TO service_role;
