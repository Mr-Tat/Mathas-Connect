-- Abaque Connect : les coupes Mort subite sont attribuées après 3, 5 et 8 PAGES.
-- Chaque page contient exactement cinq conversions : 15, 25, 40 conversions.
-- Les XP sont indépendants : paliers 15, 30, 50 (3, 6 et 10 pages).
-- Aucun acquis existant n'est effacé ; la correction s'applique aux prochains résultats.
DO $$
DECLARE
  definitions integer;
  definition text;
  old_thresholds text := '(VALUES (3,''abaque:sudden-bronze''),(5,''abaque:sudden-silver''),(8,''abaque:sudden-gold'')) AS cups(pages,trophy_key)';
  new_thresholds text := '(VALUES (15,''abaque:sudden-bronze''),(25,''abaque:sudden-silver''),(40,''abaque:sudden-gold'')) AS cups(conversions,trophy_key)';
BEGIN
  SELECT count(*),max(pg_get_functiondef(p.oid))
  INTO definitions,definition
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname='connect_abaque_record_v1';
  IF definitions<>1 THEN
    RAISE EXCEPTION 'abaque_record_function_missing_or_ambiguous: %', definitions;
  END IF;
  IF position(new_thresholds IN definition)>0 THEN
    NULL; -- idempotent
  ELSIF position(old_thresholds IN definition)>0
    AND length(definition)-length(replace(definition,old_thresholds,''))=length(old_thresholds) THEN
    EXECUTE replace(definition,old_thresholds,new_thresholds);
  ELSE
    RAISE EXCEPTION 'abaque_sudden_trophy_contract_drift';
  END IF;
END
$$;
