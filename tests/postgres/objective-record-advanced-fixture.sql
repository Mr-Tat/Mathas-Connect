-- Extra columns/tables used by production advanced proof, absent from
-- the deliberately minimal classic SQL unit-test fixture.
ALTER TABLE public.connect_apps ADD COLUMN enabled boolean NOT NULL DEFAULT true;
CREATE TABLE IF NOT EXISTS public.connect_xp_milestones(
 student_id uuid NOT NULL,
 app_key text NOT NULL,
 milestone_key text NOT NULL,
 evidence jsonb,
 PRIMARY KEY(student_id,app_key,milestone_key)
);
