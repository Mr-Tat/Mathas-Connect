-- Both additions obey the exact 474 XP non-repeat cap. 3 vies can never
-- grant the same milestone twice or inflate a later full Mort subite credit.
DO $t$
DECLARE
 student uuid:='11111111-1111-4111-8111-111111111111';
 app text;ack jsonb;
BEGIN
 FOR app IN SELECT app_key FROM public.connect_apps LOOP
  INSERT INTO public.connect_states(student_id,app_key,state_data)
    VALUES(student,app,'{"threeLives":[5,0,0]}'::jsonb);
  ack:=public.connect_xp_sync_v2(student,app,false);
  IF (ack->>'appXp')::integer<>5 OR (ack->>'delta')::integer<>5
   THEN RAISE EXCEPTION 'three_5_not_half_%: %',app,ack;END IF;
  UPDATE public.connect_states SET state_data='{"threeLives":[10,0,0]}'::jsonb
   WHERE student_id=student AND app_key=app;
  ack:=public.connect_xp_sync_v2(student,app,false);
  IF (ack->>'appXp')::integer<>10 OR (ack->>'delta')::integer<>5
   THEN RAISE EXCEPTION 'three_10_not_half_%: %',app,ack;END IF;
  UPDATE public.connect_states SET state_data='{"threeLives":[10,0,0],"sudden":[5,0,0]}'::jsonb
   WHERE student_id=student AND app_key=app;
  ack:=public.connect_xp_sync_v2(student,app,false);
  IF (ack->>'appXp')::integer<>15 OR (ack->>'delta')::integer<>5
   THEN RAISE EXCEPTION 'full_credit_did_not_supersede_half_%: %',app,ack;END IF;
  UPDATE public.connect_states SET state_data='{"threeLives":[10,0,0],"sudden":[10,0,0]}'::jsonb
   WHERE student_id=student AND app_key=app;
  ack:=public.connect_xp_sync_v2(student,app,false);
  IF (ack->>'appXp')::integer<>20 OR (ack->>'delta')::integer<>5
   THEN RAISE EXCEPTION 'full_sudden_10_wrong_%: %',app,ack;END IF;
  UPDATE public.connect_states SET state_data=
   '{"classic":[{"4":4,"10":10,"20":20},{"4":4,"10":10,"20":20},{"4":4,"10":10,"20":20}],
     "threeLives":[10,10,10],"sudden":[10,10,10],"hard":[7,7,7]}'::jsonb
   WHERE student_id=student AND app_key=app;
  ack:=public.connect_xp_sync_v2(student,app,false);
  IF (ack->>'appXp')::integer<>474
   THEN RAISE EXCEPTION 'original_474_max_inflated_%: %',app,ack;END IF;
  ack:=public.connect_xp_sync_v2(student,app,false);
  IF (ack->>'appXp')::integer<>474 OR (ack->>'delta')::integer<>0
   THEN RAISE EXCEPTION 'duplicate_half_xp_%: %',app,ack;END IF;
 END LOOP;
 RAISE NOTICE 'TWO school additions: partial half XP, supersession and 474 cap PASS';
END $t$;
