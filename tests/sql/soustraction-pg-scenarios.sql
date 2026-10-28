-- Assertions SQL exercées directement par PostgreSQL 16, sans réseau.
\set ON_ERROR_STOP on
DO $test$
DECLARE a text:='soustraction-ecrite-simple';
BEGIN
 IF (SELECT enabled FROM public.connect_apps WHERE app_key=a) IS DISTINCT FROM false
 THEN RAISE EXCEPTION 'catalog_not_disabled';END IF;
 IF (SELECT count(*) FROM public.connect_hub_preset_entries WHERE app_key=a AND visible=false AND featured=false)<>4
 THEN RAISE EXCEPTION 'presets_not_disabled';END IF;
 IF (SELECT count(*) FROM public.connect_xp_award_rules WHERE app_key=a)<>9
 THEN RAISE EXCEPTION 'wrong_rule_count';END IF;
 IF (SELECT sum(points) FROM public.connect_xp_award_rules WHERE app_key=a)<>158
 THEN RAISE EXCEPTION 'wrong_rule_sum';END IF;
 IF (SELECT count(*) FROM public.connect_apps WHERE enabled=true)<>2
 THEN RAISE EXCEPTION 'changed_existing_catalog';END IF;
 IF has_function_privilege('anon','public.connect_xp_sync_v2(uuid,text,boolean)','EXECUTE')
  OR has_function_privilege('authenticated','public.connect_xp_sync_v2(uuid,text,boolean)','EXECUTE')
  OR NOT has_function_privilege('service_role','public.connect_xp_sync_v2(uuid,text,boolean)','EXECUTE')
 THEN RAISE EXCEPTION 'xp_acl_changed'; END IF;
 IF has_function_privilege('anon','public.connect_parcours_restart_one(uuid,uuid,uuid,text,boolean)','EXECUTE')
  OR has_function_privilege('authenticated','public.connect_parcours_restart_class(uuid,uuid,text,boolean)','EXECUTE')
 THEN RAISE EXCEPTION 'restart_acl_changed';END IF;
END $test$;
-- Inscriptions simulées pour une première partie : 4/4, 8/10, 20/20,
-- Mort subite 5 en technique Compensation et HARD 3.
INSERT INTO public.connect_states(student_id,app_key,schema_version,revision,state_data) VALUES
('11111111-1111-4111-8111-111111111111','soustraction-ecrite-simple',1,1,
 '{"classic":[{"4":4,"10":8,"20":20},{},{}],"sudden":[5,null,null],"suddenMethods":{"addBottom":[5,null,null],"takeTop":[3,null,null]},"hard":[3,null,null]}'::jsonb);
DO $test$
DECLARE id uuid:='11111111-1111-4111-8111-111111111111'; out jsonb;
BEGIN
 out:=public.connect_xp_sync_v2(id,'soustraction-ecrite-simple',false);
 IF (out->>'appXp')::integer<>132 OR (out->>'total')::integer<>232 THEN
  RAISE EXCEPTION 'first_awards_wrong: %',out;END IF;
 out:=public.connect_xp_sync_v2(id,'soustraction-ecrite-simple',false);
 IF (out->>'delta')::integer<>0 THEN RAISE EXCEPTION 'duplicate_awards: %',out;END IF;
 IF (SELECT xp_credited FROM public.connect_xp_credits WHERE student_id=id AND app_key='addition-ecrite-simple')<>100
 THEN RAISE EXCEPTION 'addition_xp_modified';END IF;
 IF (SELECT count(*) FROM public.connect_xp_milestones WHERE student_id=id AND app_key='soustraction-ecrite-simple')<>6
 THEN RAISE EXCEPTION 'six_expected_milestones';END IF;
END $test$;
-- Deux techniques recordables, mais un seul jalon XP pour chaque niveau Mort subite.
UPDATE public.connect_states SET
 state_data='{"classic":[{"4":4,"10":10,"20":20},{"4":4,"10":10,"20":20},{"4":4,"10":10,"20":20}],"sudden":[10,10,10],"suddenMethods":{"addBottom":[5,5,5],"takeTop":[10,10,10]},"hard":[7,7,7]}'::jsonb,
 revision=revision+1,updated_at=now()
WHERE app_key='soustraction-ecrite-simple';
DO $test$
DECLARE id uuid:='11111111-1111-4111-8111-111111111111';out jsonb;
BEGIN
 out:=public.connect_xp_sync_v2(id,'soustraction-ecrite-simple',false);
 IF (out->>'appXp')::integer<>474 OR (out->>'total')::integer<>574 THEN
  RAISE EXCEPTION 'max_xp_wrong: %',out;END IF;
 IF (SELECT count(*) FROM public.connect_xp_milestones WHERE student_id=id AND app_key='soustraction-ecrite-simple')<>27
 THEN RAISE EXCEPTION 'wrong_total_milestones';END IF;
 IF (public.connect_xp_read_v2(id,'soustraction-ecrite-simple',true)->>'appXp')::integer<>474
 THEN RAISE EXCEPTION 'xp_read_wrong';END IF;
END $test$;
-- Parcours suivant : records effacés pour Soustraction seulement, historique archivé.
DO $test$
DECLARE id uuid:='11111111-1111-4111-8111-111111111111';cl uuid:='22222222-2222-4222-8222-222222222222';
 teacher uuid:='33333333-3333-4333-8333-333333333333';result jsonb;cnt int;
BEGIN
 BEGIN
  result:=public.connect_parcours_restart_one('44444444-4444-4444-8444-444444444444',cl,id,'soustraction-ecrite-simple',false);
  RAISE EXCEPTION 'unauthorized_teacher_accepted';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM<>'forbidden' THEN RAISE;END IF;
 END;
 result:=public.connect_parcours_restart_one(teacher,cl,id,'soustraction-ecrite-simple',false);
 IF (result->>'parcours')::integer<>2 OR (SELECT reset_epoch FROM public.connect_states WHERE student_id=id AND app_key='soustraction-ecrite-simple')<>1
 THEN RAISE EXCEPTION 'restart_wrong: %',result;END IF;
 IF (SELECT state_data FROM public.connect_states WHERE student_id=id AND app_key='soustraction-ecrite-simple')<>'{}'::jsonb
 THEN RAISE EXCEPTION 'state_not_reset';END IF;
 IF (SELECT archived_xp FROM public.connect_parcours_history WHERE student_id=id AND app_key='soustraction-ecrite-simple' AND parcours_number=1)<>474
 THEN RAISE EXCEPTION 'history_not_preserved';END IF;
 IF (SELECT state_data FROM public.connect_states WHERE student_id=id AND app_key='addition-ecrite-simple')<>'{"classic":[{"4":4},{},{}]}'::jsonb
 THEN RAISE EXCEPTION 'addition_modified_on_soustraction_restart';END IF;
END $test$;
-- Nouveau 4/4 sans repeat XP : seul le jalon déjà gagné existe.
UPDATE public.connect_states SET state_data='{"classic":[{"4":4},{},{}]}'::jsonb,
 revision=revision+1,updated_at=now() WHERE app_key='soustraction-ecrite-simple';
DO $test$
DECLARE out jsonb;
BEGIN
 out:=public.connect_xp_sync_v2('11111111-1111-4111-8111-111111111111','soustraction-ecrite-simple',false);
 IF (out->>'appXp')::integer<>474 THEN RAISE EXCEPTION 'xp_replayed_without_permission: %',out;END IF;
END $test$;
-- Rejouer AVEC option de XP : seuls les nouveaux jalons de ce parcours ajoutent des XP.
SELECT public.connect_parcours_restart_one('33333333-3333-4333-8333-333333333333',
 '22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111','soustraction-ecrite-simple',true);
UPDATE public.connect_states SET state_data='{"classic":[{"4":4},{},{}]}'::jsonb,
 revision=revision+1,updated_at=now() WHERE app_key='soustraction-ecrite-simple';
DO $test$
DECLARE id uuid:='11111111-1111-4111-8111-111111111111';out jsonb;
BEGIN
 out:=public.connect_xp_sync_v2(id,'soustraction-ecrite-simple',false);
 IF (out->>'appXp')::integer<>496 THEN RAISE EXCEPTION 'repeat_xp_wrong: %',out;END IF;
 out:=public.connect_xp_sync_v2(id,'soustraction-ecrite-simple',false);
 IF (out->>'delta')::integer<>0 THEN RAISE EXCEPTION 'repeat_xp_double_credit: %',out;END IF;
 IF (SELECT count(*) FROM public.connect_parcours_xp_bonus WHERE student_id=id AND app_key='soustraction-ecrite-simple' AND parcours_number=3)<>1
 THEN RAISE EXCEPTION 'wrong_replay_milestones';END IF;
END $test$;
SELECT 'SOUSTRACTION_POSTGRES_TESTS_OK' AS verdict;
