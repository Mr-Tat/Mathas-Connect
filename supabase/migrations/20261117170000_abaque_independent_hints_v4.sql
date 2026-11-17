-- Étendre uniquement l'acceptation des preuves V4. Les versions V1/V2/V3 restent immuables.
-- L'Edge valide les calculs et les aides avant de fournir un jugement certifié.
DO $abaque_v4$
DECLARE source_code text; updated_code text;
BEGIN
 SELECT pg_get_functiondef('public.connect_abaque_record_v1(uuid,uuid,boolean,uuid,uuid,bigint,bigint,jsonb)'::regprocedure)
 INTO source_code;
 IF source_code IS NULL
   OR (length(source_code)-length(replace(source_code,'NOT IN (''1'',''2'',''3'')','')))/length('NOT IN (''1'',''2'',''3'')')<>1
   OR (length(source_code)-length(replace(source_code,'NOT IN (''2'',''3'')','')))/length('NOT IN (''2'',''3'')')<>2
   OR (length(source_code)-length(replace(source_code,'p_result->>''ruleset''=''3'' THEN','')))/length('p_result->>''ruleset''=''3'' THEN')<>2
 THEN RAISE EXCEPTION 'Abaque V4: définition serveur inattendue, migration annulée'; END IF;
 updated_code:=replace(source_code,'NOT IN (''1'',''2'',''3'')','NOT IN (''1'',''2'',''3'',''4'')');
 updated_code:=replace(updated_code,'NOT IN (''2'',''3'')','NOT IN (''2'',''3'',''4'')');
 updated_code:=replace(updated_code,'IN (''2'',''3'')','IN (''2'',''3'',''4'')');
 updated_code:=replace(updated_code,'p_result->>''ruleset''=''3'' THEN','p_result->>''ruleset'' IN (''3'',''4'') THEN');
 IF updated_code=source_code THEN RAISE EXCEPTION 'Abaque V4: aucun changement détecté'; END IF;
 EXECUTE updated_code;
END $abaque_v4$;
