-- Abaque Connect : la migration 204 XP a introduit les paliers record:15/30/50
-- dans le code PL/pgSQL, sans adapter l'ancienne contrainte de table.
-- Avant ce correctif, l'attribution du premier palier provoque 23514 et annule
-- l'enregistrement de toute la partie. Conserver les anciennes clés pour ne
-- jamais invalider un acquis historique ; aucun crédit existant n'est réécrit.
DO $$
DECLARE
 current_constraint text;
BEGIN
 SELECT pg_get_constraintdef(oid) INTO current_constraint
 FROM pg_constraint
 WHERE conrelid='public.connect_abaque_rights'::regclass
   AND conname='connect_abaque_rights_milestone_check';
 IF current_constraint IS NULL THEN
   RAISE EXCEPTION 'abaque_rights_milestone_constraint_missing';
 END IF;
 IF position('record:15' IN current_constraint)>0
    AND position('record:30' IN current_constraint)>0
    AND position('record:50' IN current_constraint)>0 THEN
   NULL; -- already applied
 ELSIF position('record:5' IN current_constraint)>0
    AND position('record:10' IN current_constraint)>0
    AND position('record:15' IN current_constraint)=0 THEN
   ALTER TABLE public.connect_abaque_rights
     DROP CONSTRAINT connect_abaque_rights_milestone_check;
   ALTER TABLE public.connect_abaque_rights
     ADD CONSTRAINT connect_abaque_rights_milestone_check CHECK (
       milestone IN (
         'build:1','build:2','build:perfect',
         'moves:1','moves:2','moves:perfect',
         'one:pass','one:perfect',
         'three:pass','three:perfect',
         'five:pass','five:perfect',
         'record:5','record:10',
         'record:15','record:30','record:50'
       )
     );
 ELSE
   RAISE EXCEPTION 'abaque_rights_milestone_constraint_drift';
 END IF;
END
$$;
