-- Abaque V3 : la virgule de 1 page n'est pas une aide payante ; le jugement
-- Edge certifie assisted / cleanPerfect / cleanRecord pour les coupes et XP.
-- Aucun trophée existant n'est révoqué ; les nouveaux trophées nécessitent l'autonomie.
-- Compatibilité des preuves V1 et V2 conservée, sans nouveau recalcul rétroactif.
DO $migration$
DECLARE definition text; old_fragment text; new_fragment text;
BEGIN
 SELECT pg_get_functiondef(p.oid) INTO definition FROM pg_proc p
 JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname='connect_abaque_record_v1';
 IF definition IS NULL THEN RAISE EXCEPTION 'abaque_v3_missing_record_function'; END IF;

 old_fragment:='p_result->>''ruleset'' NOT IN (''1'',''2'')';
 new_fragment:='p_result->>''ruleset'' NOT IN (''1'',''2'',''3'')';
 IF position(old_fragment IN definition)=0 THEN RAISE EXCEPTION 'abaque_v3_anchor_0_missing'; END IF;
 definition:=replace(definition,old_fragment,new_fragment);

 old_fragment:='IF p_result->>''ruleset''=''2'' AND (p_result->>''assisted''';
 new_fragment:='IF p_result->>''ruleset'' IN (''2'',''3'') AND (p_result->>''assisted''';
 IF position(old_fragment IN definition)=0 THEN RAISE EXCEPTION 'abaque_v3_anchor_1_missing'; END IF;
 definition:=replace(definition,old_fragment,new_fragment);

 old_fragment:='assisted:=p_result->>''ruleset''=''2'' AND coalesce((p_result->>''assisted'')::boolean,false);';
 new_fragment:='assisted:=p_result->>''ruleset'' IN (''2'',''3'') AND coalesce((p_result->>''assisted'')::boolean,false);';
 IF position(old_fragment IN definition)=0 THEN RAISE EXCEPTION 'abaque_v3_anchor_2_missing'; END IF;
 definition:=replace(definition,old_fragment,new_fragment);

 old_fragment:='IF p_result->>''ruleset''<>''2'' OR kind NOT IN (''one'',''three'',''five'')';
 new_fragment:='IF p_result->>''ruleset'' NOT IN (''2'',''3'') OR kind NOT IN (''one'',''three'',''five'')';
 IF position(old_fragment IN definition)=0 THEN RAISE EXCEPTION 'abaque_v3_anchor_3_missing'; END IF;
 definition:=replace(definition,old_fragment,new_fragment);

 old_fragment:='IF p_result->>''ruleset''=''2''
    AND jsonb_typeof(p_result->''resultDots'')=''array''';
 new_fragment:='IF p_result->>''ruleset'' IN (''2'',''3'')
    AND jsonb_typeof(p_result->''resultDots'')=''array''';
 IF position(old_fragment IN definition)=0 THEN RAISE EXCEPTION 'abaque_v3_anchor_4_missing'; END IF;
 definition:=replace(definition,old_fragment,new_fragment);

 old_fragment:='   IF (SELECT count(*) FROM public.connect_abaque_rights WHERE student_id=pupil AND milestone IN (''one:perfect'',''three:perfect'',''five:perfect''))=3 THEN';
 new_fragment:='   IF coalesce(native#>>''{cleanPerfect,one}'',''false'')=''true''
      AND coalesce(native#>>''{cleanPerfect,three}'',''false'')=''true''
      AND coalesce(native#>>''{cleanPerfect,five}'',''false'')=''true'' THEN';
 IF position(old_fragment IN definition)=0 THEN RAISE EXCEPTION 'abaque_v3_anchor_5_missing'; END IF;
 definition:=replace(definition,old_fragment,new_fragment);

 old_fragment:='IF first_good>=threshold THEN
      INSERT INTO public.connect_trophy_achievements';
 new_fragment:='IF first_good>=threshold AND p_result->>''cleanRecord''=''true'' THEN
      INSERT INTO public.connect_trophy_achievements';
 IF position(old_fragment IN definition)=0 THEN RAISE EXCEPTION 'abaque_v3_anchor_6_missing'; END IF;
 definition:=replace(definition,old_fragment,new_fragment);

 old_fragment:='   IF kind=''one'' AND first_good>=3 THEN';
 new_fragment:='   IF p_result->>''cleanPerfect''=''true'' THEN
    native:=native||jsonb_build_object(''cleanPerfect'',coalesce(native->''cleanPerfect'',''{}''::jsonb)||jsonb_build_object(kind,true));
   END IF;
   IF kind=''one'' AND first_good>=3 THEN';
 IF position(old_fragment IN definition)=0 THEN RAISE EXCEPTION 'abaque_v3_anchor_7_missing'; END IF;
 definition:=replace(definition,old_fragment,new_fragment);

 old_fragment:=' IF p_result ? ''resultDots'' THEN';
 new_fragment:=' -- Les deux attestations d''autonomie V3 sont certifiées par l''Edge et
 -- ne peuvent pas être déduites des anciens XP ou des meilleurs scores.
 IF p_result->>''ruleset''=''3'' THEN
  IF p_result->>''cleanPerfect'' NOT IN (''true'',''false'')
   OR p_result->>''cleanRecord'' NOT IN (''true'',''false'')
   OR (p_result->>''cleanPerfect'')::boolean IS DISTINCT FROM
     (kind IN (''one'',''three'',''five'') AND first_good=total AND NOT assisted)
   OR (p_result->>''cleanRecord'')::boolean IS DISTINCT FROM
     (kind=''sudden'' AND NOT assisted)
  THEN RAISE EXCEPTION ''invalid_result''; END IF;
 END IF;
 IF p_result ? ''resultDots'' THEN';
 IF position(old_fragment IN definition)=0 THEN RAISE EXCEPTION 'abaque_v3_validation_missing'; END IF;
 definition:=replace(definition,old_fragment,new_fragment);

 EXECUTE definition;
END
$migration$;
