-- Connect: durable native trophies and read-only per-app progress (31/10/2026).
-- Deploy exactly once via Supabase apply_migration. No pupil scores/XP are reset.
-- Trophy ledger is append-only for ordinary operations. Restore/reset preserve awards.
CREATE TABLE IF NOT EXISTS public.connect_trophy_achievements (
  student_id uuid NOT NULL REFERENCES public.connect_students(id) ON DELETE CASCADE,
  app_key text NOT NULL REFERENCES public.connect_apps(app_key),
  trophy_key text NOT NULL,
  achieved_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT connect_trophy_achievements_pk PRIMARY KEY (student_id, app_key, trophy_key)
);
ALTER TABLE public.connect_trophy_achievements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.connect_trophy_achievements FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.connect_trophy_achievements TO service_role;

-- Exactly 25 distinct slots of the existing native V3 award schema.
-- Never derive trophies from XP milestones, score values or number of plays.
CREATE OR REPLACE FUNCTION public.connect_trophy_keys_v1(p_rewards jsonb)
RETURNS TABLE(trophy_key text)
LANGUAGE sql IMMUTABLE SET search_path TO 'public','pg_temp'
AS $body$
  SELECT 'mastery:'||k||':'||i
  FROM (VALUES ('4'),('10'),('20')) AS lengths(k)
  CROSS JOIN generate_series(0,2) AS levels(i)
  WHERE p_rewards #> ARRAY['mastery',k,i::text] = 'true'::jsonb
  UNION ALL
  SELECT 'sudden:'||i FROM generate_series(0,2) AS levels(i)
  WHERE p_rewards #> ARRAY['sudden',i::text] = 'true'::jsonb
  UNION ALL
  SELECT 'hardAwards:'||c||':'||i
  FROM (VALUES ('bronze'),('silver'),('gold')) AS colors(c)
  CROSS JOIN generate_series(0,2) AS levels(i)
  WHERE p_rewards #> ARRAY['hardAwards',c,i::text] = 'true'::jsonb
  UNION ALL
  SELECT 'scoreOne:'||c FROM (VALUES ('bronze'),('silver'),('gold')) AS colors(c)
  WHERE p_rewards #> ARRAY['scoreOne',c] = 'true'::jsonb
  UNION ALL
  SELECT 'unlockedGold'
  WHERE p_rewards->'unlockedGold' = 'true'::jsonb;
$body$;
REVOKE ALL ON FUNCTION public.connect_trophy_keys_v1(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.connect_trophy_keys_v1(jsonb) TO service_role;

-- Backfill existing trophies from BOTH active and previously archived parcours.
-- Does not change a single current result, revision, reset epoch or XP credit.
INSERT INTO public.connect_trophy_achievements(student_id, app_key, trophy_key)
SELECT DISTINCT source.student_id,source.app_key,keys.trophy_key
FROM (
  SELECT student_id,app_key,state_data->'rewards' AS rewards FROM public.connect_states
  UNION ALL
  SELECT student_id,app_key,state_data->'rewards' AS rewards FROM public.connect_parcours_history
) source
CROSS JOIN LATERAL public.connect_trophy_keys_v1(source.rewards) AS keys
WHERE source.app_key IN (
 'addition-ecrite-simple','multiplication-ecrite-simple','soustraction-ecrite-simple',
 'addition-ecrite-multiple','melange-calculs-ecrits'
)
ON CONFLICT (student_id,app_key,trophy_key) DO NOTHING;

-- Every *completed and persisted* game record keeps new trophies independently of
-- resettable score state. Existing atomic score+XP RPCs are unchanged.
CREATE OR REPLACE FUNCTION public.connect_trophy_capture_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp'
AS $body$
BEGIN
  IF NEW.app_key IN (
    'addition-ecrite-simple','multiplication-ecrite-simple','soustraction-ecrite-simple',
    'addition-ecrite-multiple','melange-calculs-ecrits'
  ) THEN
    INSERT INTO public.connect_trophy_achievements(student_id,app_key,trophy_key)
    SELECT NEW.student_id,NEW.app_key,k.trophy_key
    FROM public.connect_trophy_keys_v1(NEW.state_data->'rewards') AS k
    ON CONFLICT (student_id,app_key,trophy_key) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$body$;
REVOKE ALL ON FUNCTION public.connect_trophy_capture_v1() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS connect_trophy_capture_v1 ON public.connect_states;
CREATE TRIGGER connect_trophy_capture_v1
AFTER INSERT OR UPDATE OF state_data ON public.connect_states
FOR EACH ROW EXECUTE FUNCTION public.connect_trophy_capture_v1();

-- Build the native V3 structure from immutable, server-owned trophy keys.
-- Works even when a professor reset left state_data='{}'.
CREATE OR REPLACE FUNCTION public.connect_trophy_rewards_v1(p_student uuid,p_app text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $body$
DECLARE result jsonb := '{"version":3,"mastery":{"4":[false,false,false],"10":[false,false,false],"20":[false,false,false]},"sudden":[false,false,false],"hardAwards":{"bronze":[false,false,false],"silver":[false,false,false],"gold":[false,false,false]},"scoreOne":{"bronze":false,"silver":false,"gold":false},"unlockedGold":false}'::jsonb;
  item record;
BEGIN
  IF p_app NOT IN ('addition-ecrite-simple','multiplication-ecrite-simple',
    'soustraction-ecrite-simple','addition-ecrite-multiple','melange-calculs-ecrits')
  THEN RAISE EXCEPTION 'unsupported_app'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.connect_trophy_achievements
    WHERE student_id=p_student AND app_key=p_app) THEN RETURN NULL; END IF;
  FOR item IN SELECT trophy_key FROM public.connect_trophy_achievements
    WHERE student_id=p_student AND app_key=p_app
  LOOP
    result:=jsonb_set(result,string_to_array(item.trophy_key,':'),'true'::jsonb,false);
  END LOOP;
  RETURN result;
END;
$body$;
REVOKE ALL ON FUNCTION public.connect_trophy_rewards_v1(uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.connect_trophy_rewards_v1(uuid,text) TO service_role;

-- Lifetime XP credits remain untouched. Only the per-app *current parcours* gauge
-- restarts from zero (credits at this parcours minus last archived cumulative credit).
CREATE OR REPLACE FUNCTION public.connect_profile_progress_v1(p_student uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $body$
DECLARE result jsonb; total_trophies integer; app_progress jsonb;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.connect_students WHERE id=p_student AND archived_at IS NULL)
  THEN RAISE EXCEPTION 'inactive_student'; END IF;
  SELECT count(*)::integer INTO total_trophies
  FROM public.connect_trophy_achievements
  WHERE student_id=p_student;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
      'appKey', a.app_key,
      'xpEarned', greatest(coalesce(x.xp_credited,0) - coalesce(previous.archived_xp,0),0),
      'xpMax', coalesce(r.max_xp,0),
      'trophiesEarned',coalesce(t.trophies,0),
      'trophiesMax',25
    ) ORDER BY a.display_order, a.app_key),'[]'::jsonb) INTO app_progress
  FROM public.connect_apps a
  LEFT JOIN public.connect_xp_credits x
    ON x.student_id=p_student AND x.app_key=a.app_key
  LEFT JOIN LATERAL (
    SELECT archived_xp FROM public.connect_parcours_history h
    WHERE h.student_id=p_student AND h.app_key=a.app_key
    ORDER BY parcours_number DESC LIMIT 1
  ) previous ON true
  LEFT JOIN LATERAL (
    SELECT (sum(points)*3)::integer AS max_xp FROM public.connect_xp_award_rules
    WHERE app_key=a.app_key
  ) r ON true
  LEFT JOIN LATERAL (
    SELECT count(*)::integer AS trophies FROM public.connect_trophy_achievements t
    WHERE t.student_id=p_student AND t.app_key=a.app_key
  ) t ON true
  WHERE a.app_key IN ('addition-ecrite-simple','multiplication-ecrite-simple',
    'soustraction-ecrite-simple','addition-ecrite-multiple','melange-calculs-ecrits');
  result:=jsonb_build_object('totalTrophies',coalesce(total_trophies,0),'apps',app_progress);
  RETURN result;
END;
$body$;
REVOKE ALL ON FUNCTION public.connect_profile_progress_v1(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.connect_profile_progress_v1(uuid) TO service_role;
