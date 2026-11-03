-- 2026-11-03: the native addition game has 19 award CUPS plus Platinum.
-- Previous profile RPC counted 25 internal V3 booleans (including three
-- mastery prerequisites per level), and did not count the Platinum cup.
-- Change the READ-ONLY profile summary; do not delete/edit trophy ledger rows.
CREATE OR REPLACE FUNCTION public.connect_addition_visible_trophies_v1(p_rewards jsonb)
RETURNS integer
LANGUAGE plpgsql IMMUTABLE
SET search_path TO 'pg_catalog','pg_temp'
AS $body$
DECLARE
  visible_cups integer:=0;
  level_index integer;
  color_name text;
BEGIN
  IF p_rewards IS NULL THEN RETURN 0; END IF;
  FOR level_index IN 0..2 LOOP
    -- Three mastery achievements (4/4, 10/10, 20/20) form ONE cup/level.
    IF p_rewards #> ARRAY['mastery','4',level_index::text] = 'true'::jsonb
       AND p_rewards #> ARRAY['mastery','10',level_index::text] = 'true'::jsonb
       AND p_rewards #> ARRAY['mastery','20',level_index::text] = 'true'::jsonb
    THEN visible_cups:=visible_cups+1; END IF;
    IF p_rewards #> ARRAY['sudden',level_index::text] = 'true'::jsonb
    THEN visible_cups:=visible_cups+1; END IF;
  END LOOP;
  FOREACH color_name IN ARRAY ARRAY['bronze','silver','gold'] LOOP
    IF p_rewards #> ARRAY['scoreOne',color_name] = 'true'::jsonb
    THEN visible_cups:=visible_cups+1; END IF;
    FOR level_index IN 0..2 LOOP
      IF p_rewards #> ARRAY['hardAwards',color_name,level_index::text] = 'true'::jsonb
      THEN visible_cups:=visible_cups+1; END IF;
    END LOOP;
  END LOOP;
  IF p_rewards->'unlockedGold' = 'true'::jsonb THEN visible_cups:=visible_cups+1; END IF;
  -- The twentieth cup (Platinum) is derivative: all 19 ordinary cups won.
  RETURN visible_cups + CASE WHEN visible_cups=19 THEN 1 ELSE 0 END;
END;
$body$;
REVOKE ALL ON FUNCTION public.connect_addition_visible_trophies_v1(jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.connect_addition_visible_trophies_v1(jsonb) TO service_role;

-- Existing per-app XP/level logic and security remain unchanged.
-- Only the TWO school additions use native 20-cup semantics; other app_keys
-- retain their current registry-count behavior pending their own UI audit.
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
  WHERE student_id=p_student
    AND app_key NOT IN ('addition-ecrite-simple','addition-ecrite-multiple');
  total_trophies:=total_trophies
    + public.connect_addition_visible_trophies_v1(
        public.connect_trophy_rewards_v1(p_student,'addition-ecrite-simple'))
    + public.connect_addition_visible_trophies_v1(
        public.connect_trophy_rewards_v1(p_student,'addition-ecrite-multiple'));
  SELECT coalesce(jsonb_agg(jsonb_build_object(
      'appKey', a.app_key,
      'xpEarned', greatest(coalesce(x.xp_credited,0) - coalesce(previous.archived_xp,0),0),
      'xpMax', coalesce(r.max_xp,0),
      'trophiesEarned', CASE
        WHEN a.app_key IN ('addition-ecrite-simple','addition-ecrite-multiple')
          THEN public.connect_addition_visible_trophies_v1(
            public.connect_trophy_rewards_v1(p_student,a.app_key))
        ELSE coalesce(t.trophies,0) END,
      'trophiesMax',CASE
        WHEN a.app_key IN ('addition-ecrite-simple','addition-ecrite-multiple') THEN 20
        ELSE 25 END
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
