-- Runs only after tests/postgres/permanent-trophies-contract.sql fixtures
-- and the candidate 20-visible-trophies SQL on the same disposable database.
DO $test$
DECLARE
  profile jsonb; v integer; app jsonb; second jsonb;
  all_cups jsonb:='{
   "mastery":{"4":[true,true,true],"10":[true,true,true],"20":[true,true,true]},
   "sudden":[true,true,true],
   "hardAwards":{"bronze":[true,true,true],"silver":[true,true,true],"gold":[true,true,true]},
   "scoreOne":{"bronze":true,"silver":true,"gold":true},
   "unlockedGold":true
  }'::jsonb;
BEGIN
  IF public.connect_addition_visible_trophies_v1(NULL)<>0 THEN RAISE EXCEPTION 'unknown rewards should not invent cups'; END IF;
  IF public.connect_addition_visible_trophies_v1('{"mastery":{"4":[true,false,false]}}'::jsonb)<>0
  THEN RAISE EXCEPTION '4/4 alone is not a mastery cup'; END IF;
  IF public.connect_addition_visible_trophies_v1('{"mastery":{"4":[true,false,false],"10":[true,false,false],"20":[true,false,false]}}'::jsonb)<>1
  THEN RAISE EXCEPTION 'three completed objectives are one mastery cup'; END IF;
  IF public.connect_addition_visible_trophies_v1(all_cups)<>20
  THEN RAISE EXCEPTION '19 normal cups plus Platinum must be 20'; END IF;
  IF public.connect_addition_visible_trophies_v1(jsonb_set(all_cups,'{unlockedGold}','false'::jsonb,false))<>18
  THEN RAISE EXCEPTION 'Platinum must be absent before every other cup'; END IF;
  SELECT public.connect_profile_progress_v1('11111111-1111-4111-8111-111111111111') INTO profile;
  SELECT elem INTO app FROM jsonb_array_elements(profile->'apps') elem
    WHERE elem->>'appKey'='addition-ecrite-simple';
  SELECT elem INTO second FROM jsonb_array_elements(profile->'apps') elem
    WHERE elem->>'appKey'='addition-ecrite-multiple';
  IF (app->>'trophiesMax')<>'20' OR (second->>'trophiesMax')<>'20'
  THEN RAISE EXCEPTION 'HUB needs 20 trophies for both additions %',profile; END IF;
  IF (app->>'trophiesEarned')<>'2'
  THEN RAISE EXCEPTION 'intermediate mastery must not be counted as an earned cup %',profile; END IF;
  IF (second->>'trophiesEarned')<>'0'
  THEN RAISE EXCEPTION 'fresh addition multiple should have 0/20 %',profile; END IF;
  -- Other applications keep their previous semantics until separately audited.
  IF (SELECT elem->>'trophiesMax' FROM jsonb_array_elements(profile->'apps') elem
      WHERE elem->>'appKey'='soustraction-ecrite-simple')<>'25'
  THEN RAISE EXCEPTION 'non-addition max changed unexpectedly %',profile; END IF;
  IF profile->>'totalTrophies'<>'3'
  THEN RAISE EXCEPTION 'identity total must also reflect 20-cup semantics %',profile; END IF;
  IF app->>'xpEarned'<>'28'
  THEN RAISE EXCEPTION 'current XP changed unexpectedly %',profile; END IF;
  IF (SELECT xp_credited FROM public.connect_xp_credits
    WHERE student_id='11111111-1111-4111-8111-111111111111'
    AND app_key='addition-ecrite-simple')<>88
  THEN RAISE EXCEPTION 'trophy UI changed XP ledger'; END IF;
  IF (SELECT count(*) FROM public.connect_trophy_achievements
      WHERE student_id='11111111-1111-4111-8111-111111111111')<>4
  THEN RAISE EXCEPTION 'read-only trophy summary must preserve ledger'; END IF;
  IF has_function_privilege('anon','public.connect_addition_visible_trophies_v1(jsonb)','EXECUTE')
     OR has_function_privilege('authenticated','public.connect_addition_visible_trophies_v1(jsonb)','EXECUTE')
  THEN RAISE EXCEPTION 'unauthorized helper RPC exposure'; END IF;
END;
$test$;
