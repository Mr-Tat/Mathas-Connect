-- [DÉCISION PROFESSEUR, 2026-11-03] Une célébration plein écran
-- au retour sur le HUB, une fois par élève et par palier 3/6/10/15/20.
-- Le JWT élève ne dispose d'aucune permission directe de lecture ou d'écriture.
-- Toutes les lectures et confirmations passent par connect-api qui contrôle
-- session anonyme, appareil approuvé, inscription et niveau Connect serveur.
BEGIN;
CREATE TABLE IF NOT EXISTS public.connect_profile_reward_celebrations(
 student_id uuid NOT NULL REFERENCES public.connect_students(id) ON DELETE CASCADE,
 reward_level smallint NOT NULL CHECK(reward_level IN (3,6,10,15,20)),
 celebrated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT connect_profile_reward_celebrations_pkey PRIMARY KEY (student_id,reward_level)
);
ALTER TABLE public.connect_profile_reward_celebrations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.connect_profile_reward_celebrations FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.connect_profile_reward_celebrations TO service_role;
COMMENT ON TABLE public.connect_profile_reward_celebrations IS
 'Paliers de personnalisation célébrés par élève ; uniquement via Edge Connect authentifiée. Aucun XP modifié.';
COMMIT;

-- Validation après installation : RLS activée, 0 enregistrements initiaux.
-- SELECT relrowsecurity FROM pg_class
--   WHERE oid='public.connect_profile_reward_celebrations'::regclass;
-- SELECT COUNT(*) FROM public.connect_profile_reward_celebrations;
-- Pour revenir en arrière, retirer d'abord le code appelant la table puis
-- DROP TABLE public.connect_profile_reward_celebrations ; (perd seulement les ACK).