-- 3/4, 9/12 et 15/20 pour debloquer les 3 etapes de l'activite 3.
-- Autorisation professeur intacte : jamais de contournement de stage1_only/through_2.
-- Aucun reset, aucune suppression des droits XP, des trophées ou des preuves.
DO $migration$
DECLARE definition text; old_fragment text; new_fragment text;
BEGIN
 SELECT pg_get_functiondef(p.oid) INTO definition
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname='connect_abaque_record_v1';
 IF definition IS NULL THEN RAISE EXCEPTION 'abaque_t3_missing_record_function'; END IF;
 old_fragment:='IF NOT p_teacher AND (SELECT a.unlock_mode FROM public.connect_abaque_classes a WHERE a.class_id=p_class AND a.enabled)=''mastery_80'' AND ((kind=''moves'' AND jsonb_array_length(coalesce(native#>''{stage1,passes}'',''[]''))<2)
 OR (kind=''one'' AND jsonb_array_length(coalesce(native#>''{stage2,passes}'',''[]''))<2)
 OR (kind=''three'' AND coalesce(native#>>''{modes,one}'',''red'') NOT IN (''orange'',''green''))
 OR (kind=''five'' AND coalesce(native#>>''{modes,three}'',''red'') NOT IN (''orange'',''green''))
 OR (kind IN (''lives'',''sudden'') AND NOT (coalesce((native#>>''{modeScores,one}'')::int,0)>=4
  AND coalesce((native#>>''{modeScores,three}'')::int,0)>=10
  AND coalesce((native#>>''{modeScores,five}'')::int,0)>=16)))
 THEN RAISE EXCEPTION ''activity_locked''; END IF;';
 new_fragment:='IF NOT p_teacher AND (
  -- Les deux premieres activites gardent les deux series a 80 % quand la classe
  -- utilise le parcours pedagogique complet.
  ((SELECT a.unlock_mode FROM public.connect_abaque_classes a WHERE a.class_id=p_class AND a.enabled)=''mastery_80''
   AND ((kind=''moves'' AND jsonb_array_length(coalesce(native#>''{stage1,passes}'',''[]''))<2)
    OR (kind=''one'' AND jsonb_array_length(coalesce(native#>''{stage2,passes}'',''[]''))<2)))
  -- Quel que soit le deblocage PROF (all_open ou mastery_80), les 3 sous-niveaux
  -- exigent toujours 75 % dans les series precedentes.
  OR ((SELECT a.unlock_mode FROM public.connect_abaque_classes a WHERE a.class_id=p_class AND a.enabled)
      IN (''all_open'',''mastery_80'')
   AND ((kind=''three'' AND NOT (coalesce((native#>>''{modeScores,one}'')::int, CASE WHEN native#>>''{modes,one}'' IN (''orange'',''green'') THEN 3 ELSE 0 END)>=3))
     OR (kind=''five'' AND NOT (coalesce((native#>>''{modeScores,one}'')::int, CASE WHEN native#>>''{modes,one}'' IN (''orange'',''green'') THEN 3 ELSE 0 END)>=3 AND coalesce((native#>>''{modeScores,three}'')::int, CASE WHEN native#>>''{modes,three}'' IN (''orange'',''green'') THEN 9 ELSE 0 END)>=9))
     OR (kind IN (''lives'',''sudden'') AND NOT (coalesce((native#>>''{modeScores,one}'')::int, CASE WHEN native#>>''{modes,one}'' IN (''orange'',''green'') THEN 3 ELSE 0 END)>=3 AND coalesce((native#>>''{modeScores,three}'')::int, CASE WHEN native#>>''{modes,three}'' IN (''orange'',''green'') THEN 9 ELSE 0 END)>=9 AND coalesce((native#>>''{modeScores,five}'')::int, CASE WHEN native#>>''{modes,five}'' IN (''orange'',''green'') THEN 15 ELSE 0 END)>=15))))
 ) THEN RAISE EXCEPTION ''activity_locked''; END IF;';
 IF position(old_fragment IN definition)=0 THEN RAISE EXCEPTION 'abaque_t3_unlock_drift'; END IF;
 definition:=replace(definition,old_fragment,new_fragment);

 old_fragment:='grade:=CASE WHEN (scores->>kind)::int=total THEN ''green'' WHEN (scores->>kind)::int*5>=total*4 THEN ''orange'' ELSE ''red'' END;';
 new_fragment:='grade:=CASE WHEN (scores->>kind)::int=total THEN ''green'' WHEN (scores->>kind)::int*4>=total*3 THEN ''orange'' ELSE ''red'' END;';
 IF position(old_fragment IN definition)=0 THEN RAISE EXCEPTION 'abaque_t3_grade_drift'; END IF;
 definition:=replace(definition,old_fragment,new_fragment);

 EXECUTE definition;
END
$migration$;
