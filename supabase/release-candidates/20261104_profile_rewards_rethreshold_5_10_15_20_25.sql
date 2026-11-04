-- Math'as Connect — cinq nouveaux niveaux de personnalisation du HUB.
-- Animal N5 (200 XP), couleur N10 (600 XP), smiley N15 (1100 XP),
-- pseudo N20 (1600 XP), objet N25 (2100 XP).
-- NE CHANGE PAS les crédits XP, les niveaux, les profils ou les avatars enregistrés.
-- Seuls les nouveaux accusés de réception de célébration sont désormais acceptés.
BEGIN;
-- Abort safely if an old celebration appeared since the audited preflight.
DO $guard$
BEGIN
 IF EXISTS(
  SELECT 1 FROM public.connect_profile_reward_celebrations
  WHERE reward_level NOT IN (5,10,15,20,25)
 ) THEN
  RAISE EXCEPTION 'legacy_reward_ack_present_migration_requires_review';
 END IF;
END;
$guard$;
ALTER TABLE public.connect_profile_reward_celebrations
 DROP CONSTRAINT IF EXISTS connect_profile_reward_celebrations_reward_level_check;
ALTER TABLE public.connect_profile_reward_celebrations
 ADD CONSTRAINT connect_profile_reward_celebrations_reward_level_check
 CHECK (reward_level IN (5,10,15,20,25));
COMMIT;

-- Lecture seule après déploiement :
-- SELECT pg_get_constraintdef(oid) FROM pg_constraint
-- WHERE conrelid='public.connect_profile_reward_celebrations'::regclass
-- AND conname='connect_profile_reward_celebrations_reward_level_check';
-- Aucune réinitialisation XP, identité, alias, avatar ni des anciens acquis.
