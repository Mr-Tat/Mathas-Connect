-- Permet plusieurs parcours avec XP à regagner, sans modifier les crédits acquis.
-- Les crédits restent entiers, contrôlés et limités bien en dessous de INT32.
ALTER TABLE public.connect_xp_credits
  DROP CONSTRAINT connect_xp_credits_xp_credited_check;
ALTER TABLE public.connect_xp_credits
  ADD CONSTRAINT connect_xp_credits_xp_credited_check
  CHECK (xp_credited >= 0 AND xp_credited <= 10000000);
