\set ON_ERROR_STOP on
DO $test$
DECLARE
 app_enabled boolean; present integer; rules integer; total_points integer;
BEGIN
 SELECT enabled INTO app_enabled FROM public.connect_apps WHERE app_key='addition-ecrite-multiple';
 IF app_enabled IS DISTINCT FROM false THEN RAISE EXCEPTION 'new_app_enabled'; END IF;
 SELECT count(*) INTO present FROM public.connect_hub_preset_entries WHERE app_key='addition-ecrite-multiple' AND visible=false AND featured=false;
 IF present<>4 THEN RAISE EXCEPTION 'new_app_preset_visibility'; END IF;
 SELECT count(*),sum(points) INTO rules,total_points FROM public.connect_xp_award_rules WHERE app_key='addition-ecrite-multiple';
 IF rules<>9 OR total_points<>158 THEN RAISE EXCEPTION 'new_app_xp_rules'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.connect_apps WHERE app_key='addition-ecrite-simple' AND enabled=true AND featured=true AND display_order=1)
 THEN RAISE EXCEPTION 'existing_app_modified'; END IF;
 SELECT count(*) INTO present FROM public.connect_hub_preset_entries WHERE app_key='addition-ecrite-simple' AND visible=true;
 IF present<>4 THEN RAISE EXCEPTION 'existing_app_preset_changed'; END IF;
 SELECT count(*) INTO present FROM public.connect_xp_award_rules WHERE app_key='addition-ecrite-simple' AND award_key='classic:4:perfect' AND points=22;
 IF present<>1 THEN RAISE EXCEPTION 'existing_app_awards_changed'; END IF;
END $test$;
