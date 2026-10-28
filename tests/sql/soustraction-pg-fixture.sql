-- Schéma minimal isolé reflétant les colonnes et clés actives vérifiées en production.
-- AUCUNE connexion Supabase, données élèves fictives uniquement.
CREATE TABLE public.connect_apps(
 app_key text PRIMARY KEY CHECK(app_key~'^[a-z0-9][a-z0-9._-]{1,79}$'),
 title text NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
 launch_url text NOT NULL CHECK(launch_url~'^https://[^[:space:]]+$'),
 enabled boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(),
 hub_section text NOT NULL DEFAULT 'jeux' CHECK(hub_section~'^[a-z0-9_-]{1,40}$'),
 featured boolean NOT NULL DEFAULT false,display_order integer NOT NULL DEFAULT 0,
 image_url text CHECK(image_url IS NULL OR image_url~'^https://[^[:space:]]+$')
);
CREATE TABLE public.connect_hub_presets(slug text PRIMARY KEY,label text NOT NULL,display_order integer NOT NULL DEFAULT 0);
CREATE TABLE public.connect_hub_preset_entries(
 preset_slug text REFERENCES public.connect_hub_presets(slug) ON DELETE CASCADE,
 app_key text REFERENCES public.connect_apps(app_key) ON DELETE CASCADE,
 section text NOT NULL CHECK(section~'^[a-z0-9_-]{2,40}$'),display_order integer NOT NULL DEFAULT 0,
 visible boolean NOT NULL DEFAULT true,featured boolean NOT NULL DEFAULT false,
 PRIMARY KEY(preset_slug,app_key)
);
CREATE TABLE public.connect_xp_award_rules(app_key text REFERENCES public.connect_apps(app_key) ON DELETE CASCADE,
 award_key text NOT NULL, points integer NOT NULL CHECK(points BETWEEN 0 AND 500),
 ruleset_version integer NOT NULL DEFAULT 2,PRIMARY KEY(app_key,award_key)
);
CREATE TABLE public.connect_students(id uuid PRIMARY KEY,display_name text NOT NULL,archived_at timestamptz);
CREATE TABLE public.connect_enrollments(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),class_id uuid NOT NULL,student_id uuid NOT NULL REFERENCES public.connect_students(id),
 joined_at timestamptz NOT NULL DEFAULT now(),left_at timestamptz
);
CREATE TABLE public.connect_class_permissions(class_id uuid NOT NULL,teacher_id uuid NOT NULL,
 can_manage boolean NOT NULL DEFAULT false,can_view_results boolean NOT NULL DEFAULT false,
 can_publish boolean NOT NULL DEFAULT false,PRIMARY KEY(class_id,teacher_id));
CREATE TABLE public.connect_states(
 student_id uuid REFERENCES public.connect_students(id),app_key text REFERENCES public.connect_apps(app_key),
 schema_version integer NOT NULL,revision bigint NOT NULL DEFAULT 0,reset_epoch bigint NOT NULL DEFAULT 0,
 state_data jsonb NOT NULL DEFAULT '{}'::jsonb,updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(student_id,app_key)
);
CREATE TABLE public.connect_xp_milestones(
 student_id uuid REFERENCES public.connect_students(id),app_key text REFERENCES public.connect_apps(app_key),
 milestone_key text NOT NULL,achieved_at timestamptz NOT NULL DEFAULT now(),
 evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
 PRIMARY KEY(student_id,app_key,milestone_key)
);
CREATE TABLE public.connect_xp_credits(
 student_id uuid REFERENCES public.connect_students(id),app_key text REFERENCES public.connect_apps(app_key),
 xp_credited integer NOT NULL DEFAULT 0,evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
 ruleset_version integer NOT NULL DEFAULT 1,updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(student_id,app_key)
);
CREATE TABLE public.connect_level_profiles(
 student_id uuid REFERENCES public.connect_students(id) PRIMARY KEY,
 highest_level_reached integer NOT NULL DEFAULT 1,
 level_ruleset_version integer NOT NULL DEFAULT 1,updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.connect_parcours_current(
 student_id uuid REFERENCES public.connect_students(id),app_key text REFERENCES public.connect_apps(app_key),
 parcours_number integer NOT NULL DEFAULT 1,repeat_xp boolean NOT NULL DEFAULT false,
 started_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(student_id,app_key)
);
CREATE TABLE public.connect_parcours_history(
 student_id uuid REFERENCES public.connect_students(id),app_key text REFERENCES public.connect_apps(app_key),
 parcours_number integer NOT NULL,class_id uuid NOT NULL,ended_at timestamptz NOT NULL DEFAULT now(),
 repeat_xp boolean NOT NULL DEFAULT false,state_data jsonb NOT NULL,archived_xp integer NOT NULL DEFAULT 0,
 PRIMARY KEY(student_id,app_key,parcours_number)
);
CREATE TABLE public.connect_parcours_xp_bonus(
 student_id uuid REFERENCES public.connect_students(id),app_key text REFERENCES public.connect_apps(app_key),
 parcours_number integer NOT NULL,milestone_key text NOT NULL,points integer NOT NULL,
 achieved_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(student_id,app_key,parcours_number,milestone_key)
);
-- Les fonctions existent déjà en production, avec EXECUTE révoqué au public.
-- Le remplacement CREATE OR REPLACE doit impérativement conserver ces ACL.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE FUNCTION public.connect_xp_sync_v2(uuid,text,boolean DEFAULT false) RETURNS jsonb LANGUAGE sql AS 'SELECT ''{}''::jsonb';
CREATE FUNCTION public.connect_xp_read_v2(uuid,text,boolean DEFAULT false) RETURNS jsonb LANGUAGE sql AS 'SELECT ''{}''::jsonb';
CREATE FUNCTION public.connect_parcours_restart_one(uuid,uuid,uuid,text,boolean DEFAULT false) RETURNS jsonb LANGUAGE sql AS 'SELECT ''{}''::jsonb';
CREATE FUNCTION public.connect_parcours_restart_class(uuid,uuid,text,boolean DEFAULT false) RETURNS jsonb LANGUAGE sql AS 'SELECT ''{}''::jsonb';
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;
INSERT INTO public.connect_apps(app_key,title,launch_url,enabled,hub_section)
VALUES
 ('addition-ecrite-simple','Addition','https://example.org/add',true,'calculs_ecrits'),
 ('multiplication-ecrite-simple','Multiplication','https://example.org/mul',true,'calculs_ecrits');
INSERT INTO public.connect_hub_presets(slug,label) VALUES
 ('observation','Observation'),('phase1','Phase 1'),('phase2','Phase 2'),('2eco','2 ECO');
-- Un jalon préexistant d'Addition ne doit JAMAIS changer.
INSERT INTO public.connect_xp_award_rules(app_key,award_key,points) VALUES('addition-ecrite-simple','classic:4:perfect',22);
INSERT INTO public.connect_students(id,display_name) VALUES('11111111-1111-4111-8111-111111111111','Test fictif');
INSERT INTO public.connect_enrollments(class_id,student_id) VALUES('22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111');
INSERT INTO public.connect_class_permissions(class_id,teacher_id,can_manage)
VALUES('22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333',true);
INSERT INTO public.connect_states(student_id,app_key,schema_version,revision,state_data)
VALUES('11111111-1111-4111-8111-111111111111','addition-ecrite-simple',1,1,'{"classic":[{"4":4},{},{}]}'::jsonb);
INSERT INTO public.connect_xp_credits(student_id,app_key,xp_credited)
VALUES('11111111-1111-4111-8111-111111111111','addition-ecrite-simple',100);
