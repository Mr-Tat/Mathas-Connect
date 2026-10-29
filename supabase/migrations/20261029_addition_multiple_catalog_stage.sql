-- STAGING ONLY. Ne pas exécuter sur la production avant validation explicite.
-- Ajout exclusivement additif : aucune modification des données des trois jeux.
BEGIN;
-- Refuser un catalogue déjà activé au lieu de laisser ON CONFLICT DO NOTHING
-- conserver par erreur une ancienne visibilité. Cette garde est lecture seule.
DO $addition_multiple_hidden_preflight$
BEGIN
 IF EXISTS (
   SELECT 1 FROM public.connect_apps
   WHERE app_key='addition-ecrite-multiple' AND (enabled IS DISTINCT FROM false OR featured IS DISTINCT FROM false)
 ) OR EXISTS (
   SELECT 1 FROM public.connect_hub_preset_entries
   WHERE app_key='addition-ecrite-multiple' AND (visible IS DISTINCT FROM false OR featured IS DISTINCT FROM false)
 ) THEN
   RAISE EXCEPTION 'addition_multiple_preexisting_publication';
 END IF;
END $addition_multiple_hidden_preflight$;
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
-- Les règles sont des données de configuration, pas un crédit XP. 
-- La fonction XP officielle n'autorise toujours pas cette app_key.
INSERT INTO public.connect_xp_award_rules(app_key,award_key,points) VALUES
('addition-ecrite-multiple','classic:4:perfect',22),
('addition-ecrite-multiple','classic:10:pass',30),
('addition-ecrite-multiple','classic:10:bonus',6),
('addition-ecrite-multiple','classic:20:pass',50),
('addition-ecrite-multiple','classic:20:bonus',10),
('addition-ecrite-multiple','sudden:5',10),
('addition-ecrite-multiple','sudden:10',10),
('addition-ecrite-multiple','hard:3',10),
('addition-ecrite-multiple','hard:7',10)
ON CONFLICT(app_key,award_key) DO NOTHING;
-- Aucune fonction XP, aucune écriture de résultats ou modification d'autres applications.
COMMIT;
