-- Disposable PostgreSQL 16 only; no Connect production data.
CREATE TABLE public.connect_students(id uuid PRIMARY KEY,archived_at timestamptz);
CREATE TABLE public.connect_apps(app_key text PRIMARY KEY);
CREATE TABLE public.connect_states(student_id uuid,app_key text,state_data jsonb NOT NULL DEFAULT '{}'::jsonb,
 revision bigint DEFAULT 0, reset_epoch bigint DEFAULT 0,schema_version integer DEFAULT 1,
 updated_at timestamptz DEFAULT now(), PRIMARY KEY(student_id,app_key));
CREATE TABLE public.connect_xp_credits(student_id uuid,app_key text,xp_credited integer NOT NULL DEFAULT 0,
 evidence jsonb DEFAULT '{}'::jsonb,ruleset_version integer DEFAULT 1,
 updated_at timestamptz DEFAULT now(),PRIMARY KEY(student_id,app_key));
CREATE TABLE public.connect_xp_milestones(student_id uuid,app_key text,milestone_key text,
 achieved_at timestamptz NOT NULL DEFAULT now(),evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
 PRIMARY KEY(student_id,app_key,milestone_key));
CREATE TABLE public.connect_parcours_current(student_id uuid,app_key text,parcours_number integer,
 repeat_xp boolean,started_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(student_id,app_key));
CREATE TABLE public.connect_parcours_xp_bonus(student_id uuid,app_key text,parcours_number integer,
 milestone_key text,points integer NOT NULL,achieved_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(student_id,app_key,parcours_number,milestone_key));
CREATE TABLE public.connect_xp_award_rules(app_key text,award_key text,points integer,ruleset_version integer DEFAULT 2,
 PRIMARY KEY(app_key,award_key));
CREATE TABLE public.connect_level_profiles(student_id uuid PRIMARY KEY,highest_level_reached integer DEFAULT 1,
 level_ruleset_version integer DEFAULT 2,updated_at timestamptz DEFAULT now());
INSERT INTO public.connect_apps(app_key) VALUES ('addition-ecrite-simple'),('addition-ecrite-multiple'),
 ('multiplication-ecrite-simple'),('soustraction-ecrite-simple');
INSERT INTO public.connect_students(id) VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc');
INSERT INTO public.connect_parcours_current(student_id,app_key,parcours_number,repeat_xp,started_at)
VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','addition-ecrite-simple',1,false,now()-interval '2 days'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','addition-ecrite-multiple',1,false,now()-interval '2 days'),
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','multiplication-ecrite-simple',1,false,now()-interval '2 days');
INSERT INTO public.connect_states(student_id,app_key,state_data) VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','addition-ecrite-simple','{"threeLives":[5,0,0],"sudden":[0,0,0],"hardThree":[0,0,0],"hard":[0,0,0]}'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','addition-ecrite-multiple','{"threeLives":[0,0,0],"sudden":[5,0,0],"hardThree":[0,0,0],"hard":[0,0,0]}'),
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','multiplication-ecrite-simple','{"threeLives":[5,0,0],"sudden":[0,0,0],"hardThree":[0,0,0],"hard":[0,0,0]}');
INSERT INTO public.connect_xp_award_rules(app_key,award_key,points)
SELECT a.app_key, r.award_key,r.points
FROM (SELECT app_key FROM public.connect_apps) a
CROSS JOIN (VALUES
 ('classic:4:perfect',22),('classic:10:pass',30),('classic:10:bonus',6),
 ('classic:20:pass',50),('classic:20:bonus',10),
 ('sudden:5',10),('sudden:10',10),('hard:3',10),('hard:7',10)
) r(award_key,points);
