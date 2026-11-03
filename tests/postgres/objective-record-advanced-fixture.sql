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
CREATE TABLE IF NOT EXISTS public.connect_parcours_current(
 student_id uuid NOT NULL,app_key text NOT NULL,parcours_number integer NOT NULL DEFAULT 1,
 repeat_xp boolean NOT NULL DEFAULT false,PRIMARY KEY(student_id,app_key)
);
CREATE TABLE IF NOT EXISTS public.connect_parcours_xp_bonus(
 student_id uuid NOT NULL,app_key text NOT NULL,parcours_number integer NOT NULL,
 milestone_key text NOT NULL,points integer NOT NULL,
 PRIMARY KEY(student_id,app_key,parcours_number,milestone_key)
);
CREATE TABLE IF NOT EXISTS public.connect_xp_award_rules(
 app_key text NOT NULL,award_key text NOT NULL,points integer NOT NULL,
 PRIMARY KEY(app_key,award_key)
);
INSERT INTO public.connect_xp_award_rules(app_key,award_key,points) VALUES
 ('addition-ecrite-simple','sudden:5',10),
 ('addition-ecrite-simple','sudden:10',10),
 ('addition-ecrite-simple','hard:3',10),
 ('addition-ecrite-simple','hard:7',10),
 ('addition-ecrite-multiple','sudden:5',10),
 ('addition-ecrite-multiple','sudden:10',10),
 ('addition-ecrite-multiple','hard:3',10),
 ('addition-ecrite-multiple','hard:7',10);
