-- Permission to open multiplication tables during exercises (including HARD).
-- Independent from recorded scores and the existing compulsory multiplier locks.
CREATE TABLE IF NOT EXISTS public.connect_multiplier_table_aid (
 class_id uuid NOT NULL REFERENCES public.connect_classes(id) ON DELETE CASCADE,
 scope_key text NOT NULL CHECK (length(scope_key) BETWEEN 1 AND 80),
 allowed boolean NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(class_id,scope_key)
);
ALTER TABLE public.connect_multiplier_table_aid ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.connect_multiplier_table_aid FROM PUBLIC,anon,authenticated;
