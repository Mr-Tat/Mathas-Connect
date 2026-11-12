-- Lien pédagogique externe « Padlet jeux », déjà actif dans l'ancien Math'as.
-- DML idempotent, aucune migration de schéma, aucun score ni XP, aucun reset.
-- À appliquer sur Math'as Connect uniquement APRÈS la publication du HUB
-- (la miniature GitHub a été importée dans le dépôt autonome Exterieurs).
-- Vérifier le résultat via connect_apps, connect_hub_preset_entries,
-- connect_hub_all_settings et connect_lab_hub_visibility.

BEGIN;

DO $$
DECLARE found_count integer;
BEGIN
  SELECT count(*) INTO found_count
  FROM public.connect_hub_presets
  WHERE slug IN ('observation','phase1','phase2','phase2b','2eco');

  IF found_count <> 5 THEN
    RAISE EXCEPTION 'padlet-jeux: 5 presets requis, % trouvés', found_count;
  END IF;
END $$;

INSERT INTO public.connect_apps
  (app_key,title,launch_url,enabled,hub_section,featured,display_order,image_url)
VALUES
  ('padlet-jeux','Padlet jeux',
   'https://padlet.com/julientatas1/jeux-math-6y4b0kwcj5444l83',
   true,'jeux',false,80,
   'https://raw.githubusercontent.com/Mr-Tat/Exterieurs/main/miniatures/padlet-jeux.webp')
ON CONFLICT (app_key) DO UPDATE SET
  title=EXCLUDED.title,
  launch_url=EXCLUDED.launch_url,
  enabled=EXCLUDED.enabled,
  hub_section=EXCLUDED.hub_section,
  featured=EXCLUDED.featured,
  display_order=EXCLUDED.display_order,
  image_url=EXCLUDED.image_url;

INSERT INTO public.connect_hub_preset_entries
  (preset_slug,app_key,section,display_order,visible,featured)
SELECT slug,'padlet-jeux','jeux',80,true,false
FROM public.connect_hub_presets
WHERE slug IN ('observation','phase1','phase2','phase2b','2eco')
ON CONFLICT (preset_slug,app_key) DO UPDATE SET
  section=EXCLUDED.section,
  display_order=EXCLUDED.display_order,
  visible=EXCLUDED.visible,
  featured=EXCLUDED.featured;

-- « Toutes » : classement dans Jeux, et non Tests.
INSERT INTO public.connect_hub_all_settings
  (app_key,all_order,stage,section,updated_at)
VALUES ('padlet-jeux',80,'published','jeux',now())
ON CONFLICT (app_key) DO UPDATE SET
  all_order=EXCLUDED.all_order,
  stage=EXCLUDED.stage,
  section=EXCLUDED.section,
  updated_at=now();

-- HUB TEST : le Padlet reste un lien externe, sans XP ni simulation Connect.
INSERT INTO public.connect_lab_hub_visibility
  (app_key,visible,updated_at)
VALUES ('padlet-jeux',true,now())
ON CONFLICT (app_key) DO UPDATE SET
  visible=EXCLUDED.visible,
  updated_at=now();

COMMIT;
