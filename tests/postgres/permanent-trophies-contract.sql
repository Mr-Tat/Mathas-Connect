-- Disposable PostgreSQL 16: fixtures, exact candidate, then assertions.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE TABLE public.connect_students(id uuid PRIMARY KEY,archived_at timestamptz);
CREATE TABLE public.connect_apps(app_key text PRIMARY KEY,display_order integer);
CREATE TABLE public.connect_states(student_id uuid NOT NULL,app_key text NOT NULL,state_data jsonb NOT NULL DEFAULT '{}',revision bigint DEFAULT 0,reset_epoch bigint DEFAULT 0,PRIMARY KEY(student_id,app_key));
CREATE TABLE public.connect_parcours_history(student_id uuid NOT NULL,app_key text NOT NULL,parcours_number integer,archived_xp integer,state_data jsonb NOT NULL DEFAULT '{}');
CREATE TABLE public.connect_xp_credits(student_id uuid NOT NULL,app_key text NOT NULL,xp_credited integer,PRIMARY KEY(student_id,app_key));
CREATE TABLE public.connect_xp_award_rules(app_key text NOT NULL,points integer);
INSERT INTO public.connect_students(id) VALUES
('11111111-1111-4111-8111-111111111111'),
('22222222-2222-4222-8222-222222222222');
INSERT INTO public.connect_apps(app_key,display_order) VALUES
('addition-ecrite-simple',10),('soustraction-ecrite-simple',20),
('multiplication-ecrite-simple',30),('addition-ecrite-multiple',40),('melange-calculs-ecrits',50);
INSERT INTO public.connect_xp_award_rules(app_key,points)
VALUES ('addition-ecrite-simple',158),('soustraction-ecrite-simple',158),('melange-calculs-ecrits',198);
INSERT INTO public.connect_xp_credits(student_id,app_key,xp_credited) VALUES
('11111111-1111-4111-8111-111111111111','addition-ecrite-simple',88),
('11111111-1111-4111-8111-111111111111','soustraction-ecrite-simple',40);
INSERT INTO public.connect_states(student_id,app_key,state_data) VALUES
('11111111-1111-4111-8111-111111111111','addition-ecrite-simple','{"rewards":{"version":3,"sudden":[false,true,false]}}'),
('11111111-1111-4111-8111-111111111111','soustraction-ecrite-simple','{}'),
('22222222-2222-4222-8222-222222222222','addition-ecrite-simple','{}');
INSERT INTO public.connect_parcours_history(student_id,app_key,parcours_number,archived_xp,state_data) VALUES
('11111111-1111-4111-8111-111111111111','addition-ecrite-simple',1,60,'{"rewards":{"version":3,"mastery":{"4":[true,false,false]}}}'),
('11111111-1111-4111-8111-111111111111','soustraction-ecrite-simple',1,40,'{"rewards":{"version":3,"unlockedGold":true}}');
\ir ../../supabase/release-candidates/20261031_permanent_trophies_hub_v1.sql
DO $test$
DECLARE result jsonb; native jsonb;
BEGIN
 SELECT public.connect_profile_progress_v1('11111111-1111-4111-8111-111111111111') INTO result;
 IF result->>'totalTrophies' <> '3' THEN RAISE EXCEPTION 'bad total %',result; END IF;
 IF (SELECT elem->>'xpEarned' FROM jsonb_array_elements(result->'apps') elem WHERE elem->>'appKey'='addition-ecrite-simple') <> '28'
 THEN RAISE EXCEPTION 'bad current parcours xp %',result; END IF;
 IF (SELECT elem->>'xpEarned' FROM jsonb_array_elements(result->'apps') elem WHERE elem->>'appKey'='soustraction-ecrite-simple') <> '0'
 THEN RAISE EXCEPTION 'reset did not reset per-app xp %',result; END IF;
 IF (SELECT elem->>'trophiesEarned' FROM jsonb_array_elements(result->'apps') elem WHERE elem->>'appKey'='soustraction-ecrite-simple') <> '1'
 THEN RAISE EXCEPTION 'archived trophy lost %',result; END IF;
 SELECT public.connect_trophy_rewards_v1('11111111-1111-4111-8111-111111111111','addition-ecrite-simple') INTO native;
 IF native#>'{mastery,4,0}' <> 'true'::jsonb OR native#>'{sudden,1}' <> 'true'::jsonb THEN
  RAISE EXCEPTION 'native trophies did not survive reset %',native;
 END IF;
 IF has_function_privilege('anon','public.connect_profile_progress_v1(uuid)','EXECUTE') THEN RAISE EXCEPTION 'anonymous RPC access'; END IF;
 IF has_function_privilege('authenticated','public.connect_trophy_rewards_v1(uuid,text)','EXECUTE') THEN RAISE EXCEPTION 'RPC access from authenticated'; END IF;
END $test$;
-- Simulated reset: no trophy in new state; trigger keeps durable trophy ledger.
UPDATE public.connect_states SET state_data='{}' WHERE student_id='11111111-1111-4111-8111-111111111111' AND app_key='addition-ecrite-simple';
-- A single newly earned native trophy is append-only; duplicate write does not add.
UPDATE public.connect_states SET state_data='{"rewards":{"scoreOne":{"bronze":true}}}' WHERE student_id='11111111-1111-4111-8111-111111111111' AND app_key='addition-ecrite-simple';
UPDATE public.connect_states SET state_data='{"rewards":{"scoreOne":{"bronze":true}}}' WHERE student_id='11111111-1111-4111-8111-111111111111' AND app_key='addition-ecrite-simple';
DO $test$
DECLARE result jsonb;
BEGIN
 SELECT public.connect_profile_progress_v1('11111111-1111-4111-8111-111111111111') INTO result;
 IF result->>'totalTrophies'<>'4' THEN RAISE EXCEPTION 'duplicate trophies %',result; END IF;
 IF (SELECT count(*) FROM public.connect_trophy_achievements WHERE student_id='22222222-2222-4222-8222-222222222222')<>0
 THEN RAISE EXCEPTION 'student isolation broken'; END IF;
 IF (SELECT xp_credited FROM public.connect_xp_credits WHERE student_id='11111111-1111-4111-8111-111111111111' AND app_key='addition-ecrite-simple')<>88
 THEN RAISE EXCEPTION 'global lifetime XP changed'; END IF;
END $test$;
