-- STAGING ONLY. Ne pas exécuter sur la production avant validation explicite.
-- Ajout exclusivement additif : aucune modification des données des trois jeux.
BEGIN;
INSERT INTO public.connect_apps
(app_key,title,launch_url,image_url,enabled,hub_section,featured,display_order)
VALUES ('addition-ecrite-multiple','Addition de plusieurs nombres',
'https://mr-tat.github.io/Mathas-Connect/apps/addition-plusieurs/',
'https://mr-tat.github.io/Mathas-Connect/assets/miniatures/addition-ecrite-multiple.webp',
false,'calculs_ecrits',false,40)
ON CONFLICT (app_key) DO NOTHING;
INSERT INTO public.connect_hub_preset_entries
(preset_slug,app_key,section,display_order,visible,featured)
SELECT slug,'addition-ecrite-multiple','calculs_ecrits',40,false,false
FROM (VALUES ('observation'),('phase1'),('phase2'),('2eco')) AS slugs(slug)
ON CONFLICT(preset_slug,app_key) DO NOTHING;
-- Aucun XP n'est créditable : les règles et la fonction Edge ne sont pas activées.
COMMIT;
