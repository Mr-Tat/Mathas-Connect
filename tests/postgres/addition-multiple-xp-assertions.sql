\set ON_ERROR_STOP on
BEGIN;
SELECT CASE WHEN (public.connect_addition_multiple_xp_preview('{}'::jsonb)->>'xp')::integer=0 THEN true ELSE 1/0=0 END;
SELECT CASE WHEN (public.connect_addition_multiple_xp_preview('{"classic":[{"4":4,"10":10,"20":20},{"4":4,"10":10,"20":20},{"4":4,"10":10,"20":20}],"sudden":[10,10,10],"hard":[7,7,7],"hardThree":[5,5,5]}'::jsonb)->>'xp')::integer=474 THEN true ELSE 1/0=0 END;
SELECT CASE WHEN (public.connect_addition_multiple_xp_preview('{"classic":[{"10":8,"20":16}],"hardThree":[5,5,5]}'::jsonb)->>'xp')::integer=80 THEN true ELSE 1/0=0 END;
DO $test$ BEGIN
  BEGIN PERFORM public.connect_addition_multiple_xp_preview('{"classic":[{"4":5}]}'::jsonb); RAISE EXCEPTION 'invalid score accepted'; EXCEPTION WHEN SQLSTATE 'P0001' THEN IF SQLERRM='invalid score accepted' THEN RAISE; END IF;END;
END $test$;
ROLLBACK;
