-- Expiry limits issuing/reusing a challenge, not submitting its completed
-- proof after an outage. Preserve grading, membership, revision/epoch CAS,
-- replay hash, XP and ACL. Fail atomically on unexpected function definition.
DO $retention$
DECLARE signature text; fn regprocedure; original text; patched text;
 guard constant text := $guard$IF (v_session|v_s)\.expires_at\s*<=\s*now\(\)\s*THEN\s*RAISE EXCEPTION 'proof_expired';\s*END IF;$guard$;
BEGIN
 FOREACH signature IN ARRAY ARRAY['public.connect_objective_record_school_sub_finish_classic_v1(uuid,uuid,uuid,jsonb)',
 'public.connect_objective_record_school_sub_finish_extended_v1(uuid,uuid,uuid,jsonb)'] LOOP
  fn:=to_regprocedure(signature);
  IF fn IS NULL THEN RAISE EXCEPTION 'missing school finish function: %',signature; END IF;
  original:=pg_get_functiondef(fn);
  IF (SELECT count(*) FROM regexp_matches(original,guard,'g'))<>1 THEN
   RAISE EXCEPTION 'unexpected expiry guard in %',signature;
  END IF;
  patched:=regexp_replace(original,guard,'/* Issued proof remains finishable; identity, epoch and revision still checked. */');
  IF patched=original OR patched ~ guard THEN RAISE EXCEPTION 'expiry patch failed: %',signature; END IF;
  EXECUTE patched;
  IF has_function_privilege('anon',fn,'EXECUTE') OR has_function_privilege('authenticated',fn,'EXECUTE')
    OR NOT has_function_privilege('service_role',fn,'EXECUTE') THEN
   RAISE EXCEPTION 'unexpected finish ACL: %',signature;
  END IF;
 END LOOP;
END $retention$;
