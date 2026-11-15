-- Publication scolaire contrôlée de l'Abaque connecté, novembre 2026.
-- PRÉSÉREQUIS : Edge connect-abaque déployée avec la politique acceptant le secret
-- CONNECT_ABAQUE_ACCESS=open, et vérification authentifiée sur un profil fictif TEST.
-- Ne jamais exécuter tant que le service renvoie encore un mode pilote/fermé.
-- Portée : Observation, Phase 1, Phase 2 A, Phase 2 B, 2 ECO (cinq presets officiels).
-- Ne modifie ni élève, ni progression, ni XP, ni trophée, ni autre application.
BEGIN;
DO $guard$
DECLARE actual integer;
BEGIN
 SELECT count(*) INTO actual FROM public.connect_classes
 WHERE name IN ('Observation','Phase 1','Phase 2 A','Phase 2 B','2 ECO');
 IF actual<>5 THEN RAISE EXCEPTION 'abaque_school_classes_mismatch: %',actual; END IF;
 SELECT count(*) INTO actual FROM public.connect_hub_presets
 WHERE slug IN ('observation','phase1','phase2','phase2b','2eco');
 IF actual<>5 THEN RAISE EXCEPTION 'abaque_school_presets_mismatch: %',actual; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.connect_apps WHERE app_key='abaque-longueurs'
 AND enabled AND launch_url='https://mr-tat.github.io/Mathas-Connect/apps/GRAN-abaque-m-1/?connect=1')
 THEN RAISE EXCEPTION 'abaque_school_catalog_not_ready'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.connect_abaque_classes c
 JOIN public.connect_classes cl ON cl.id=c.class_id
 WHERE cl.name='Classe démo - TEST' AND c.enabled AND c.pilot_only)
 THEN RAISE EXCEPTION 'abaque_test_pilot_must_remain_enabled'; END IF;
END $guard$;
INSERT INTO public.connect_abaque_classes (class_id,enabled,pilot_only)
SELECT id,true,false FROM public.connect_classes
WHERE name IN ('Observation','Phase 1','Phase 2 A','Phase 2 B','2 ECO')
ON CONFLICT (class_id) DO UPDATE SET enabled=EXCLUDED.enabled,pilot_only=EXCLUDED.pilot_only;
INSERT INTO public.connect_hub_preset_entries (preset_slug,app_key,section,display_order,visible,featured)
SELECT slug,'abaque-longueurs','outils',70,true,false FROM public.connect_hub_presets
WHERE slug IN ('observation','phase1','phase2','phase2b','2eco')
ON CONFLICT (preset_slug,app_key) DO UPDATE SET
 section=EXCLUDED.section,display_order=EXCLUDED.display_order,
 visible=EXCLUDED.visible,featured=EXCLUDED.featured;
DO $guard$
DECLARE actual integer;
BEGIN
 SELECT count(*) INTO actual FROM public.connect_abaque_classes ac JOIN public.connect_classes c ON c.id=ac.class_id
 WHERE c.name IN ('Observation','Phase 1','Phase 2 A','Phase 2 B','2 ECO') AND ac.enabled AND NOT ac.pilot_only;
 IF actual<>5 THEN RAISE EXCEPTION 'abaque_school_activation_incomplete: %',actual; END IF;
 SELECT count(*) INTO actual FROM public.connect_hub_preset_entries
 WHERE app_key='abaque-longueurs' AND preset_slug IN ('observation','phase1','phase2','phase2b','2eco')
 AND section='outils' AND visible AND NOT featured;
 IF actual<>5 THEN RAISE EXCEPTION 'abaque_school_visibility_incomplete: %',actual; END IF;
END $guard$;
COMMIT;

-- Retour arrière conservateur (exécuter séparément en cas d'incident) :
-- BEGIN;
-- UPDATE public.connect_hub_preset_entries SET visible=false
--  WHERE app_key='abaque-longueurs' AND preset_slug IN ('observation','phase1','phase2','phase2b','2eco');
-- UPDATE public.connect_abaque_classes SET enabled=false
--  WHERE class_id IN (SELECT id FROM public.connect_classes
--  WHERE name IN ('Observation','Phase 1','Phase 2 A','Phase 2 B','2 ECO'));
-- COMMIT;
