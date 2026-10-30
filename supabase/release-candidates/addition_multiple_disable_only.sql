-- EMERGENCY VISIBILITY STOP ONLY -- prepared, NEVER run automatically.
-- Does NOT delete student results, XP, trophies, audit history, apps or RPCs.
-- Use only with explicit permission and after confirming target project.
BEGIN;
UPDATE public.connect_hub_preset_entries
  SET visible=false,featured=false
  WHERE app_key='addition-ecrite-multiple'
    AND (visible IS DISTINCT FROM false OR featured IS DISTINCT FROM false);
UPDATE public.connect_apps
  SET enabled=false,featured=false
  WHERE app_key='addition-ecrite-multiple'
    AND (enabled IS DISTINCT FROM false OR featured IS DISTINCT FROM false);
DO $addition_multiple_emergency_stop$
BEGIN
 IF EXISTS(SELECT 1 FROM public.connect_apps
   WHERE app_key='addition-ecrite-multiple' AND (enabled IS DISTINCT FROM false OR featured IS DISTINCT FROM false))
 OR EXISTS(SELECT 1 FROM public.connect_hub_preset_entries
   WHERE app_key='addition-ecrite-multiple' AND (visible IS DISTINCT FROM false OR featured IS DISTINCT FROM false))
 THEN RAISE EXCEPTION 'addition_multiple_disablement_failed'; END IF;
END $addition_multiple_emergency_stop$;
COMMIT;
-- Important: this disables only catalog visibility/enablement. A deployed
-- game launcher may still be accessible by its direct URL. If client/server
-- write gates have later been opened, they require a separate reviewed
-- deployment rollback to close. Never drop stored XP/results.
