-- Activité 3 : nouveau barème 3/2/1 (Mort subite x2), XP 75 % avec aide.
-- Les preuves de version 1 en attente restent valables et gardent leur ancien barème.
-- Les droits existants ne sont jamais déduits : connect_abaque_award_v1 conserve GREATEST.
-- Aucun UPDATE, DELETE ou RESET des acquis, trophées, scores ou progressions.
DO $migration$
DECLARE
 definition text;
 old_fragment text;
 new_fragment text;
BEGIN
 SELECT pg_get_functiondef(p.oid) INTO definition
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname='connect_abaque_record_v1';
 IF definition IS NULL THEN RAISE EXCEPTION 'abaque_autonomie_missing_record_function'; END IF;

 old_fragment:='threshold integer;trophy text;';
 new_fragment:='threshold integer;trophy text;assisted boolean;';
 IF position(old_fragment IN definition)=0 THEN RAISE EXCEPTION 'abaque_autonomie_declaration_drift'; END IF;
 definition:=replace(definition,old_fragment,new_fragment);

 old_fragment:='p_result->>''ruleset'' IS DISTINCT FROM ''1''';
 new_fragment:='(p_result->>''ruleset'' IS NULL OR p_result->>''ruleset'' NOT IN (''1'',''2''))';
 IF position(old_fragment IN definition)=0 THEN RAISE EXCEPTION 'abaque_autonomie_ruleset_drift'; END IF;
 definition:=replace(definition,old_fragment,new_fragment);

 old_fragment:='eligible:=(p_result->>''eligible'')::boolean;';
 new_fragment:='eligible:=(p_result->>''eligible'')::boolean;
 IF p_result->>''ruleset''=''2'' AND (p_result->>''assisted'' IS NULL OR p_result->>''assisted'' NOT IN (''true'',''false'')) THEN
  RAISE EXCEPTION ''invalid_result'';
 END IF;
 assisted:=p_result->>''ruleset''=''2'' AND coalesce((p_result->>''assisted'')::boolean,false);';
 IF position(old_fragment IN definition)=0 THEN RAISE EXCEPTION 'abaque_autonomie_assisted_drift'; END IF;
 definition:=replace(definition,old_fragment,new_fragment);

 old_fragment:='IF kind=''one'' AND first_good>=3 THEN PERFORM public.connect_abaque_award_v1(pupil,''one:pass'',12); END IF;';
 new_fragment:='IF kind=''one'' AND first_good>=3 THEN PERFORM public.connect_abaque_award_v1(pupil,''one:pass'',CASE WHEN assisted THEN 9 ELSE 12 END); END IF;';
 IF position(old_fragment IN definition)=0 THEN RAISE EXCEPTION 'abaque_autonomie_one_pass_drift'; END IF;
 definition:=replace(definition,old_fragment,new_fragment);

 old_fragment:='IF kind=''one'' AND first_good=4 THEN PERFORM public.connect_abaque_award_v1(pupil,''one:perfect'',8); END IF;';
 new_fragment:='IF kind=''one'' AND first_good=4 THEN PERFORM public.connect_abaque_award_v1(pupil,''one:perfect'',CASE WHEN assisted THEN 6 ELSE 8 END); END IF;';
 IF position(old_fragment IN definition)=0 THEN RAISE EXCEPTION 'abaque_autonomie_one_perfect_drift'; END IF;
 definition:=replace(definition,old_fragment,new_fragment);

 old_fragment:='IF kind=''three'' AND first_good>=10 THEN PERFORM public.connect_abaque_award_v1(pupil,''three:pass'',18); END IF;';
 new_fragment:='IF kind=''three'' AND first_good>=10 THEN PERFORM public.connect_abaque_award_v1(pupil,''three:pass'',CASE WHEN assisted THEN 14 ELSE 18 END); END IF;';
 IF position(old_fragment IN definition)=0 THEN RAISE EXCEPTION 'abaque_autonomie_three_pass_drift'; END IF;
 definition:=replace(definition,old_fragment,new_fragment);

 old_fragment:='IF kind=''three'' AND first_good=12 THEN PERFORM public.connect_abaque_award_v1(pupil,''three:perfect'',14); END IF;';
 new_fragment:='IF kind=''three'' AND first_good=12 THEN PERFORM public.connect_abaque_award_v1(pupil,''three:perfect'',CASE WHEN assisted THEN 10 ELSE 14 END); END IF;';
 IF position(old_fragment IN definition)=0 THEN RAISE EXCEPTION 'abaque_autonomie_three_perfect_drift'; END IF;
 definition:=replace(definition,old_fragment,new_fragment);

 old_fragment:='IF kind=''five'' AND first_good>=16 THEN PERFORM public.connect_abaque_award_v1(pupil,''five:pass'',28); END IF;';
 new_fragment:='IF kind=''five'' AND first_good>=16 THEN PERFORM public.connect_abaque_award_v1(pupil,''five:pass'',CASE WHEN assisted THEN 21 ELSE 28 END); END IF;';
 IF position(old_fragment IN definition)=0 THEN RAISE EXCEPTION 'abaque_autonomie_five_pass_drift'; END IF;
 definition:=replace(definition,old_fragment,new_fragment);

 old_fragment:='IF kind=''five'' AND first_good=20 THEN PERFORM public.connect_abaque_award_v1(pupil,''five:perfect'',12); END IF;';
 new_fragment:='IF kind=''five'' AND first_good=20 THEN PERFORM public.connect_abaque_award_v1(pupil,''five:perfect'',CASE WHEN assisted THEN 9 ELSE 12 END); END IF;';
 IF position(old_fragment IN definition)=0 THEN RAISE EXCEPTION 'abaque_autonomie_five_perfect_drift'; END IF;
 definition:=replace(definition,old_fragment,new_fragment);

 old_fragment:='IF eligible AND first_good>=15 THEN PERFORM public.connect_abaque_award_v1(pupil,''record:15'',24); END IF;';
 new_fragment:='IF eligible AND first_good>=15 THEN PERFORM public.connect_abaque_award_v1(pupil,''record:15'',CASE WHEN assisted THEN 18 ELSE 24 END); END IF;';
 IF position(old_fragment IN definition)=0 THEN RAISE EXCEPTION 'abaque_autonomie_record_15_drift'; END IF;
 definition:=replace(definition,old_fragment,new_fragment);

 old_fragment:='IF eligible AND first_good>=30 THEN PERFORM public.connect_abaque_award_v1(pupil,''record:30'',24); END IF;';
 new_fragment:='IF eligible AND first_good>=30 THEN PERFORM public.connect_abaque_award_v1(pupil,''record:30'',CASE WHEN assisted THEN 18 ELSE 24 END); END IF;';
 IF position(old_fragment IN definition)=0 THEN RAISE EXCEPTION 'abaque_autonomie_record_30_drift'; END IF;
 definition:=replace(definition,old_fragment,new_fragment);

 old_fragment:='IF eligible AND first_good>=50 THEN PERFORM public.connect_abaque_award_v1(pupil,''record:50'',24); END IF;';
 new_fragment:='IF eligible AND first_good>=50 THEN PERFORM public.connect_abaque_award_v1(pupil,''record:50'',CASE WHEN assisted THEN 18 ELSE 24 END); END IF;';
 IF position(old_fragment IN definition)=0 THEN RAISE EXCEPTION 'abaque_autonomie_record_50_drift'; END IF;
 definition:=replace(definition,old_fragment,new_fragment);

 -- Remplacer uniquement le corps métier LIVE, après vérification de toutes les ancres.
 EXECUTE definition;
END
$migration$;
