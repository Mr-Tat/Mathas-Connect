-- Shared pedagogical permissions interface, isolated settings for Mélange.
-- Never touches the finished multiplication app's controls.
ALTER TABLE public.connect_mixed_multiplier_locks
 ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
CREATE TABLE IF NOT EXISTS public.connect_mixed_table_aid (
 class_id uuid NOT NULL REFERENCES public.connect_classes(id) ON DELETE CASCADE,
 scope_key text NOT NULL CHECK(scope_key='class' OR scope_key ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),
 allowed boolean NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(class_id,scope_key)
);
ALTER TABLE public.connect_mixed_table_aid ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.connect_mixed_table_aid FROM PUBLIC,anon,authenticated;
