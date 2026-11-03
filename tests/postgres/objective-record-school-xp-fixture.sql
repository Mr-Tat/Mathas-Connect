-- Disposable schema modeling the production XP ledger; NEVER run on prod.
CREATE TABLE public.connect_students(id uuid PRIMARY KEY,archived_at timestamptz);
CREATE TABLE public.connect_apps(app_key text PRIMARY KEY);
CREATE TABLE public.connect_states(
 student_id uuid NOT NULL,app_key text NOT NULL,schema_version integer DEFAULT 1,
 revision bigint DEFAULT 0,reset_epoch bigint DEFAULT 0,
 state_data jsonb NOT NULL DEFAULT '{}'::jsonb,updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(student_id,app_key));
CREATE TABLE public.connect_xp_credits(
 student_id uuid NOT NULL,app_key text NOT NULL,
 xp_credited integer NOT NULL DEFAULT 0,evidence jsonb,
 ruleset_version integer,updated_at timestamptz DEFAULT now(),
 PRIMARY KEY(student_id,app_key));
CREATE TABLE public.connect_xp_milestones(
 student_id uuid NOT NULL,app_key text NOT NULL,milestone_key text NOT NULL,
 evidence jsonb,PRIMARY KEY(student_id,app_key,milestone_key));
CREATE TABLE public.connect_xp_award_rules(
 app_key text NOT NULL,award_key text NOT NULL,
 points integer NOT NULL,ruleset_version integer NOT NULL,
 PRIMARY KEY(app_key,award_key));
CREATE TABLE public.connect_parcours_current(
 student_id uuid NOT NULL,app_key text NOT NULL,
 parcours_number integer NOT NULL DEFAULT 1,repeat_xp boolean NOT NULL DEFAULT false,
 PRIMARY KEY(student_id,app_key));
CREATE TABLE public.connect_parcours_xp_bonus(
 student_id uuid NOT NULL,app_key text NOT NULL,
 parcours_number integer NOT NULL,milestone_key text NOT NULL,points integer NOT NULL,
 PRIMARY KEY(student_id,app_key,parcours_number,milestone_key));
CREATE TABLE public.connect_level_profiles(
 student_id uuid PRIMARY KEY,highest_level_reached integer NOT NULL DEFAULT 1,
 level_ruleset_version integer,updated_at timestamptz DEFAULT now());
INSERT INTO public.connect_students(id)
 VALUES('11111111-1111-4111-8111-111111111111');
INSERT INTO public.connect_apps(app_key)
 VALUES('addition-ecrite-simple'),('addition-ecrite-multiple');
INSERT INTO public.connect_xp_award_rules(app_key,award_key,points,ruleset_version)
SELECT a.app_key,x.k,x.points,2 FROM (VALUES
 ('addition-ecrite-simple'),('addition-ecrite-multiple')) a(app_key)
 CROSS JOIN (VALUES
 ('classic:4:perfect',22),('classic:10:pass',30),('classic:10:bonus',6),
 ('classic:20:pass',50),('classic:20:bonus',10),
 ('sudden:5',10),('sudden:10',10),('hard:3',10),('hard:7',10)
 ) x(k,points);
INSERT INTO public.connect_parcours_current(student_id,app_key)
 SELECT id,app_key FROM public.connect_students CROSS JOIN public.connect_apps;
