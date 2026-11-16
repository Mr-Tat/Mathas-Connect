-- Pastilles individuelles des trois formats de l'activité 3.
-- Les trophées, XP, scores, autorisations et preuves historiques restent inchangés.
-- Lecture du corps métier LIVE, pour préserver toutes les migrations précédentes.
DO $migration$
DECLARE definition text; old_fragment text; new_fragment text;
BEGIN
 SELECT pg_get_functiondef(p.oid) INTO definition
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname='connect_abaque_record_v1';
 IF definition IS NULL THEN RAISE EXCEPTION 'abaque_result_dots_missing_record_function'; END IF;

 old_fragment:='IF kind IN (''one'',''three'',''five'') THEN
   scores:=coalesce(native->''modeScores'',''{}''::jsonb);
   scores:=scores||jsonb_build_object(kind,greatest(coalesce((scores->>kind)::int,0),first_good));';
 new_fragment:='IF kind IN (''one'',''three'',''five'') THEN
   scores:=coalesce(native->''modeScores'',''{}''::jsonb);
   -- Conserver les détails uniquement pour la meilleure série (ou une égalité).
   -- Un ancien record sans preuve unitaire reste sans pastilles colorées.
   IF p_result->>''ruleset''=''2''
    AND jsonb_typeof(p_result->''resultDots'')=''array''
    AND first_good>=coalesce((scores->>kind)::bigint,-1)
   THEN
    native:=native||jsonb_build_object(''modeDots'',
      coalesce(native->''modeDots'',''{}''::jsonb)||
      jsonb_build_object(kind,p_result->''resultDots''));
   END IF;
   scores:=scores||jsonb_build_object(kind,greatest(coalesce((scores->>kind)::int,0),first_good));';
 IF position(old_fragment IN definition)=0 THEN RAISE EXCEPTION 'abaque_result_dots_classic_drift'; END IF;
 definition:=replace(definition,old_fragment,new_fragment);

 old_fragment:=' IF NOT p_teacher AND (';
 new_fragment:=' -- Une ancienne preuve hors ligne (V1 ou V2) peut ne pas porter ce nouveau détail.
 -- Si présent, il doit être issu de la preuve arithmétique validée par Edge.
 IF p_result ? ''resultDots'' THEN
  IF p_result->>''ruleset''<>''2'' OR kind NOT IN (''one'',''three'',''five'')
   OR jsonb_typeof(p_result->''resultDots'') IS DISTINCT FROM ''array''
  THEN RAISE EXCEPTION ''invalid_result''; END IF;
  IF jsonb_array_length(p_result->''resultDots'')<>total
   OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(p_result->''resultDots'') AS d(v)
    WHERE d.v NOT IN (''green'',''red'',''blue'',''purple''))
   OR (SELECT count(*) FROM jsonb_array_elements_text(p_result->''resultDots'') AS d(v)
    WHERE d.v<>''red'')<>first_good
  THEN RAISE EXCEPTION ''invalid_result''; END IF;
 END IF;
 IF NOT p_teacher AND (';
 IF position(old_fragment IN definition)=0 THEN RAISE EXCEPTION 'abaque_result_dots_validation_drift'; END IF;
 definition:=replace(definition,old_fragment,new_fragment);

 EXECUTE definition;
END
$migration$;
