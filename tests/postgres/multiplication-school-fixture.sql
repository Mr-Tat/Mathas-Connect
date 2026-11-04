-- Disposable PostgreSQL 16 test fixture only; NEVER execute on hosted Supabase.
-- The shared school fixtures have already created student, class, ledgers and trophy trigger.
CREATE TABLE public.connect_multiplier_locks(
 class_id uuid NOT NULL,scope_key text NOT NULL,multipliers integer[] NOT NULL,
 PRIMARY KEY(class_id,scope_key)
);
CREATE OR REPLACE FUNCTION public.test_capture_trophies() RETURNS trigger LANGUAGE plpgsql AS $fn$
DECLARE k text;i int;
BEGIN
 FOREACH k IN ARRAY ARRAY['4','10','20'] LOOP
  FOR i IN 0..2 LOOP
   IF NEW.state_data#>ARRAY['rewards','mastery',k,i::text]='true'::jsonb THEN
    INSERT INTO public.connect_trophy_achievements VALUES(
     NEW.student_id,NEW.app_key,'mastery:'||k||':'||i) ON CONFLICT DO NOTHING;
   END IF;
  END LOOP;
 END LOOP;
 FOR i IN 0..2 LOOP
  IF NEW.state_data#>ARRAY['rewards','sudden',i::text]='true'::jsonb THEN
   INSERT INTO public.connect_trophy_achievements VALUES(
    NEW.student_id,NEW.app_key,'sudden:'||i) ON CONFLICT DO NOTHING;
  END IF;
 END LOOP;
 FOREACH k IN ARRAY ARRAY['bronze','silver','gold'] LOOP
  IF NEW.state_data#>ARRAY['rewards','scoreOne',k]='true'::jsonb THEN
   INSERT INTO public.connect_trophy_achievements VALUES(
    NEW.student_id,NEW.app_key,'scoreOne:'||k) ON CONFLICT DO NOTHING;
  END IF;
 END LOOP;
 -- The actual Connect registry captures all 25 schema flags; the native UI
 -- groups them as 19 visual cups, then derives the Platinum as the 20th.
 FOR i IN 0..2 LOOP
  FOREACH k IN ARRAY ARRAY['bronze','silver','gold'] LOOP
   IF NEW.state_data#>ARRAY['rewards','hardAwards',k,i::text]='true'::jsonb THEN
    INSERT INTO public.connect_trophy_achievements VALUES(
     NEW.student_id,NEW.app_key,'hardAwards:'||k||':'||i) ON CONFLICT DO NOTHING;
   END IF;
  END LOOP;
 END LOOP;
 IF NEW.state_data#>'{rewards,unlockedGold}'='true'::jsonb THEN
  INSERT INTO public.connect_trophy_achievements VALUES(
   NEW.student_id,NEW.app_key,'unlockedGold') ON CONFLICT DO NOTHING;
 END IF;
 RETURN NEW;
END $fn$;

