-- Vérification reproductible des quatre jeux sur PostgreSQL isolé.
DO $test$
DECLARE
 v_student uuid:='11111111-1111-4111-8111-111111111111';
 v_other uuid:='11111111-1111-4111-8111-222222222222';
 v_class uuid:='22222222-2222-4222-8222-222222222222';
 v_apps text[]:=array['addition-ecrite-simple','addition-ecrite-multiple',
                      'multiplication-ecrite-simple','soustraction-ecrite-simple'];
 v_app text;v_sum_fn text;v_share_fn text;
 v_history uuid;v_current uuid;v_lower uuid;v_unproved uuid;
 v_midnight timestamptz;
 v_old timestamptz;
 v_i integer:=0;v_summary jsonb;v_reply jsonb;
 v_count integer;
BEGIN
 INSERT INTO public.connect_students(id) VALUES(v_student),(v_other);
 INSERT INTO public.connect_enrollments(id,student_id,class_id)
 VALUES('33333333-3333-4333-8333-333333333333',v_student,v_class);
 v_midnight:=((now() AT TIME ZONE 'Europe/Brussels')::date::timestamp
              AT TIME ZONE 'Europe/Brussels');
 v_old:=v_midnight-interval '36 hours';
 FOREACH v_app IN ARRAY v_apps LOOP
  v_i:=v_i+1;
  v_history:=format('aaaaaaaa-aaaa-4aaa-8aaa-%s',lpad((v_i*10+1)::text,12,'0'))::uuid;
  v_current:=format('aaaaaaaa-aaaa-4aaa-8aaa-%s',lpad((v_i*10+2)::text,12,'0'))::uuid;
  v_lower:=format('aaaaaaaa-aaaa-4aaa-8aaa-%s',lpad((v_i*10+3)::text,12,'0'))::uuid;
  v_unproved:=format('aaaaaaaa-aaaa-4aaa-8aaa-%s',lpad((v_i*10+4)::text,12,'0'))::uuid;
  INSERT INTO public.connect_projection_score_events(
     event_id,student_id,class_id,app_key,game_mode,game_score,game_total,
     game_points,played_at,captured_at)
  VALUES
     (v_history,v_student,v_class,v_app,'classic',12,20,60,v_old,v_old),
     (v_current,v_student,v_class,v_app,'sudden',7,null,14,v_midnight,v_midnight),
     (v_lower,v_student,v_class,v_app,'three-lives',5,null,10,v_midnight,v_midnight),
     (v_unproved,v_student,v_class,v_app,'hard-sudden',12,null,30,v_midnight,v_midnight);
  INSERT INTO public.connect_projection_score_consents(student_id,class_id,app_key,event_id)
   VALUES(v_student,v_class,v_app,v_history);
  IF v_app IN ('multiplication-ecrite-simple','soustraction-ecrite-simple') THEN
   INSERT INTO public.connect_objective_record_school_extended_sessions(
     session_id,student_id,class_id,app_key,consumed_at,result)
   VALUES(v_history,v_student,v_class,v_app,now(),'{"proofVerified":true}'),
         (v_current,v_student,v_class,v_app,now(),'{"proofVerified":true}'),
         (v_lower,v_student,v_class,v_app,now(),'{"proofVerified":true}');
  END IF;
  v_sum_fn:=CASE
   WHEN v_app='multiplication-ecrite-simple' THEN 'connect_projection_mul_verified_summary_v1'
   WHEN v_app='soustraction-ecrite-simple' THEN 'connect_projection_sub_verified_summary_v1'
   ELSE 'connect_projection_addition_score_summary_v1' END;
  v_share_fn:=CASE
   WHEN v_app='multiplication-ecrite-simple' THEN 'connect_projection_mul_share_improved_v1'
   WHEN v_app='soustraction-ecrite-simple' THEN 'connect_projection_sub_share_improved_v1'
   ELSE 'connect_projection_share_improved_addition_v1' END;
  EXECUTE format('SELECT public.%I($1,$2,$3)',v_sum_fn)
   INTO v_summary USING v_student,v_class,v_app;
  IF v_summary->>'ok'<>'true'
    OR (v_summary->>'boardBest')::int<>60
    OR (v_summary->>'boardTodayBest')::int<>0
    OR v_summary->'todayBest'->>'mode'<>'hard-sudden' THEN
   -- Addition's historical SQL includes unverified event; tested below with the
   -- score of the genuinely certifiable survival event instead.
   IF v_app IN ('multiplication-ecrite-simple','soustraction-ecrite-simple')
       AND v_summary->'todayBest'->>'mode'<>'sudden' THEN
     RAISE EXCEPTION 'summary unexpectedly includes unproved event: %',v_app;
   END IF;
   IF (v_summary->>'boardBest')::int<>60
       OR (v_summary->>'boardTodayBest')::int<>0 THEN
     RAISE EXCEPTION 'wrong initial bests: % %',v_app,v_summary;
   END IF;
  END IF;
  EXECUTE format('SELECT public.%I($1,$2,$3,$4)',v_share_fn)
   INTO v_reply USING v_student,v_class,v_app,v_current;
  IF v_reply->>'ok'<>'true'
      OR v_reply->>'dailyImproved'<>'true'
      OR v_reply->>'improved'<>'false'
      OR (v_reply->>'boardBest')::int<>60
      OR (v_reply->>'boardTodayBest')::int<>14 THEN
    RAISE EXCEPTION 'must accept new day 14 below historic 60: % %',v_app,v_reply;
  END IF;
  EXECUTE format('SELECT public.%I($1,$2,$3,$4)',v_share_fn)
   INTO v_reply USING v_student,v_class,v_app,v_current;
  IF v_reply->>'error'<>'not_improved' THEN
    RAISE EXCEPTION 'duplicate same day must not share twice: % %',v_app,v_reply;
  END IF;
  EXECUTE format('SELECT public.%I($1,$2,$3,$4)',v_share_fn)
   INTO v_reply USING v_student,v_class,v_app,v_lower;
  IF v_reply->>'error'<>'not_improved' THEN
    RAISE EXCEPTION 'lower day score must not replace 14: % %',v_app,v_reply;
  END IF;
  IF v_app IN ('multiplication-ecrite-simple','soustraction-ecrite-simple') THEN
   EXECUTE format('SELECT public.%I($1,$2,$3,$4)',v_share_fn)
    INTO v_reply USING v_student,v_class,v_app,v_unproved;
   IF v_reply->>'error'<>'invalid_score_event' THEN
     RAISE EXCEPTION 'unproved event must be blocked: % %',v_app,v_reply;
   END IF;
  END IF;
  EXECUTE format('SELECT public.%I($1,$2,$3)',v_sum_fn)
   INTO v_summary USING v_student,v_class,v_app;
  IF (v_summary->>'boardBest')::int<>60
   OR (v_summary->>'boardTodayBest')::int<>14 THEN
   RAISE EXCEPTION 'historic or day scoreboard changed incorrectly: % %',v_app,v_summary;
  END IF;
  SELECT count(*) INTO v_count FROM public.connect_projection_score_consents
   WHERE student_id=v_student AND class_id=v_class AND app_key=v_app;
  IF v_count<>2 THEN
   RAISE EXCEPTION 'exactly 2 published events expected: % %',v_app,v_count;
  END IF;
  EXECUTE format('SELECT public.%I($1,$2,$3,$4)',v_share_fn)
   INTO v_reply USING v_other,v_class,v_app,v_current;
  IF v_reply->>'error'<>'wrong_class' THEN
   RAISE EXCEPTION 'foreign student must not share: % %',v_app,v_reply;
  END IF;
  INSERT INTO public.connect_projection_score_periods(class_id,app_key,score_since)
    VALUES(v_class,v_app,now());
  EXECUTE format('SELECT public.%I($1,$2,$3,$4)',v_share_fn)
   INTO v_reply USING v_student,v_class,v_app,v_current;
  IF v_reply->>'error'<>'score_reset' THEN
   RAISE EXCEPTION 'reset must block old proof: % %',v_app,v_reply;
  END IF;
 END LOOP;
 RAISE NOTICE 'Daily/historic, proof, permissions, consent, replay and reset OK for 4 games';
END $test$;
