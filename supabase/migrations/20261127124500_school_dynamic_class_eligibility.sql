-- A school class is an existing class, not a fixed list of curricular spaces.
-- TEST keeps its separate proof ledger. No visibility, settings or pupil data are modified.
CREATE OR REPLACE FUNCTION public.connect_objective_record_school_class_allowed_v1(p_class uuid)
 RETURNS boolean LANGUAGE sql STABLE SET search_path='' AS $check$
 SELECT p_class IS NOT NULL
  AND p_class <> '4bf3400d-a315-4ea4-a2f3-afaca24dc9b9'::uuid
  AND EXISTS(SELECT 1 FROM public.connect_classes WHERE id=p_class);
$check$;
REVOKE ALL ON FUNCTION public.connect_objective_record_school_class_allowed_v1(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.connect_objective_record_school_class_allowed_v1(uuid) TO service_role;
