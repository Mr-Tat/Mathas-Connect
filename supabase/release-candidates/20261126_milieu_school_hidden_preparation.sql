-- Preparation only: no pupil sees the app until the professor makes its preset visible.
BEGIN;
DO $guard$
BEGIN
 IF (SELECT count(*) FROM public.connect_classes WHERE name IN ('Observation','Phase 1','Phase 2 A','Phase 2 B','2 ECO'))<>5 THEN RAISE EXCEPTION 'milieu_school_classes_mismatch'; END IF;
 IF (SELECT count(*) FROM public.connect_hub_presets WHERE slug IN ('observation','phase1','phase2','phase2b','2eco'))<>5 THEN RAISE EXCEPTION 'milieu_school_presets_mismatch'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.connect_apps WHERE app_key='milieu-segment' AND enabled) THEN RAISE EXCEPTION 'milieu_catalog_not_ready'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.connect_milieu_classes WHERE class_id='4bf3400d-a315-4ea4-a2f3-afaca24dc9b9' AND enabled AND preset_slug IS NULL) THEN RAISE EXCEPTION 'milieu_test_pilot_must_remain_enabled'; END IF;
 IF EXISTS(SELECT 1 FROM public.connect_hub_preset_entries WHERE app_key='milieu-segment' AND visible) THEN RAISE EXCEPTION 'milieu_visibility_requires_review'; END IF;
END $guard$;
INSERT INTO public.connect_milieu_classes(class_id,enabled,max_activity,preset_slug)
SELECT c.id,true,4,v.slug FROM public.connect_classes c JOIN
(VALUES ('Observation','observation'),('Phase 1','phase1'),('Phase 2 A','phase2'),('Phase 2 B','phase2b'),('2 ECO','2eco')) v(name,slug) ON v.name=c.name
ON CONFLICT(class_id) DO NOTHING;
INSERT INTO public.connect_hub_preset_entries(preset_slug,app_key,section,display_order,visible,featured)
SELECT slug,'milieu-segment','outil',75,false,false FROM public.connect_hub_presets
WHERE slug IN ('observation','phase1','phase2','phase2b','2eco')
ON CONFLICT(preset_slug,app_key) DO NOTHING;
COMMIT;
