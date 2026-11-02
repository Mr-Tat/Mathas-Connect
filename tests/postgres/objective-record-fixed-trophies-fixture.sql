-- Disposable PG 16 test fixture for permanent trophy trigger behavior.
-- This mirrors the native Connect trophy keys, not a public API.
CREATE TABLE public.connect_trophy_achievements(
 student_id uuid NOT NULL,app_key text NOT NULL,trophy_key text NOT NULL,
 PRIMARY KEY(student_id,app_key,trophy_key)
);
CREATE FUNCTION public.connect_trophy_rewards_v1(p_student uuid,p_app text)
RETURNS jsonb LANGUAGE plpgsql AS $fn$
DECLARE
 t jsonb:='{"version":3,"mastery":{"4":[false,false,false],"10":[false,false,false],"20":[false,false,false]},"sudden":[false,false,false],"hardAwards":{"bronze":[false,false,false],"silver":[false,false,false],"gold":[false,false,false]},"scoreOne":{"bronze":false,"silver":false,"gold":false},"unlockedGold":false}'::jsonb;
 rec record;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.connect_trophy_achievements
  WHERE student_id=p_student AND app_key=p_app) THEN RETURN NULL;END IF;
 FOR rec IN SELECT trophy_key FROM public.connect_trophy_achievements
 WHERE student_id=p_student AND app_key=p_app LOOP
  t:=jsonb_set(t,string_to_array(rec.trophy_key,':'),'true'::jsonb,false);
 END LOOP;
 RETURN t;
END $fn$;
CREATE FUNCTION public.test_capture_trophies() RETURNS trigger LANGUAGE plpgsql AS $fn$
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
 RETURN NEW;
END $fn$;
CREATE TRIGGER test_trophy_capture AFTER UPDATE ON public.connect_states
FOR EACH ROW EXECUTE FUNCTION public.test_capture_trophies();
