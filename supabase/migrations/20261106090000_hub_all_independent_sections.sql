-- Rubrique indépendante de la page Toutes, sans changement des cinq HUB scolaires.
ALTER TABLE public.connect_hub_all_settings
 ADD COLUMN IF NOT EXISTS section text NOT NULL DEFAULT 'test'
 CHECK (section IN ('test','objectif','calculs_ecrits','depassement','revision','outil','jeux'));

UPDATE public.connect_hub_all_settings AS settings
 SET section=CASE WHEN settings.stage='test' THEN 'test'
                  WHEN apps.hub_section IN ('objectif','calculs_ecrits','depassement','revision','outil','jeux') THEN apps.hub_section
                  ELSE 'jeux' END
 FROM public.connect_apps AS apps
 WHERE settings.app_key=apps.app_key;
