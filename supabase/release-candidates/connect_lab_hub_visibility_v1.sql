-- Catalogue isolé du HUB de la classe fictive. Ne modifie aucun des quatre HUB.
-- La table est privée ; seule l'Edge dédiée peut y accéder via service_role.
CREATE TABLE IF NOT EXISTS public.connect_lab_hub_visibility(
  app_key text PRIMARY KEY REFERENCES public.connect_apps(app_key) ON DELETE CASCADE,
  visible boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.connect_lab_hub_visibility ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.connect_lab_hub_visibility FROM PUBLIC, anon, authenticated;
COMMENT ON TABLE public.connect_lab_hub_visibility IS
  'Affichage facultatif pour Classe démo - TEST uniquement, jamais les presets observation/phase1/phase2/2eco';
