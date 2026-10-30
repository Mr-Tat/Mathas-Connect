-- Disposable LOCAL database only, no production migration replay.
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE TABLE public.connect_apps(app_key text PRIMARY KEY,title text,launch_url text,image_url text,enabled boolean,hub_section text,featured boolean,display_order integer);
CREATE TABLE public.connect_hub_preset_entries(preset_slug text,app_key text,section text,display_order integer,visible boolean,featured boolean,PRIMARY KEY(preset_slug,app_key));
CREATE TABLE public.connect_xp_award_rules(app_key text,award_key text,points integer,PRIMARY KEY(app_key,award_key));
-- Disposable test-only tables derived from production column/constraint metadata.
-- The real candidate RPCs are already installed by the PostgreSQL CI workflow.
-- No production or real students are connected.
CREATE TABLE public.connect_students(
 id uuid PRIMARY KEY,display_name text NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 120),
 archived_at timestamptz
);
CREATE TABLE public.connect_class_permissions(
 class_id uuid NOT NULL,teacher_id uuid NOT NULL,can_manage boolean NOT NULL DEFAULT false,
 can_view_results boolean NOT NULL DEFAULT false,can_publish boolean NOT NULL DEFAULT false,
 PRIMARY KEY (class_id,teacher_id),CHECK (can_manage OR can_view_results OR can_publish)
);
CREATE TABLE public.connect_enrollments(
 id uuid PRIMARY KEY,class_id uuid NOT NULL,student_id uuid NOT NULL,
 joined_at timestamptz NOT NULL DEFAULT now(),left_at timestamptz,
 CHECK (left_at IS NULL OR left_at>=joined_at)
);
CREATE TABLE public.connect_states(
 student_id uuid NOT NULL,app_key text NOT NULL,schema_version int NOT NULL,
 revision bigint NOT NULL DEFAULT 0 CHECK(revision>=0),
 reset_epoch bigint NOT NULL DEFAULT 0 CHECK(reset_epoch>=0),
 state_data jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(state_data)='object' AND pg_column_size(state_data)<=65536),
 updated_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(student_id,app_key)
);
CREATE TABLE public.connect_xp_milestones(
 student_id uuid NOT NULL,app_key text NOT NULL,milestone_key text NOT NULL CHECK(length(milestone_key) BETWEEN 3 AND 72),
 achieved_at timestamptz NOT NULL DEFAULT now(),evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
 PRIMARY KEY(student_id,app_key,milestone_key)
);
CREATE TABLE public.connect_xp_credits(
 student_id uuid NOT NULL,app_key text NOT NULL,
 xp_credited int NOT NULL DEFAULT 0 CHECK(xp_credited BETWEEN 0 AND 10000000),
 evidence jsonb NOT NULL DEFAULT '{}'::jsonb,ruleset_version int NOT NULL DEFAULT 1,
 updated_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(student_id,app_key)
);
CREATE TABLE public.connect_level_profiles(
 student_id uuid PRIMARY KEY,highest_level_reached int NOT NULL DEFAULT 1 CHECK(highest_level_reached BETWEEN 1 AND 999),
 level_ruleset_version int NOT NULL DEFAULT 1,updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.connect_parcours_current(
 student_id uuid NOT NULL,app_key text NOT NULL,parcours_number int NOT NULL DEFAULT 1 CHECK(parcours_number BETWEEN 1 AND 10000),
 repeat_xp boolean NOT NULL DEFAULT false,started_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(student_id,app_key)
);
CREATE TABLE public.connect_parcours_history(
 student_id uuid NOT NULL,app_key text NOT NULL,parcours_number int NOT NULL CHECK(parcours_number BETWEEN 1 AND 10000),
 class_id uuid NOT NULL,ended_at timestamptz NOT NULL DEFAULT now(),
 repeat_xp boolean NOT NULL DEFAULT false,state_data jsonb NOT NULL,archived_xp int NOT NULL DEFAULT 0,
 PRIMARY KEY(student_id,app_key,parcours_number)
);
CREATE TABLE public.connect_parcours_xp_bonus(
 student_id uuid NOT NULL,app_key text NOT NULL,parcours_number int NOT NULL CHECK(parcours_number>=2),
 milestone_key text NOT NULL,points int NOT NULL CHECK(points>=0),achieved_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(student_id,app_key,parcours_number,milestone_key)
);
-- Existing published preference and shared RPC sentinel must remain untouched.
INSERT INTO public.connect_apps(app_key,title,enabled,featured) VALUES('addition-ecrite-multiple','Existing addition',true,false);
INSERT INTO public.connect_hub_preset_entries(preset_slug,app_key,visible,featured) VALUES('phase1','addition-ecrite-multiple',true,false);
CREATE FUNCTION public.connect_xp_sync_v2(uuid,text,boolean) RETURNS jsonb LANGUAGE sql AS $$ SELECT '{"untouched":true}'::jsonb $$;
