\set ON_ERROR_STOP on
-- No transaction rollback: all records are invented in this disposable database.
DO $scenario$
DECLARE
 student1 uuid:='11111111-1111-4111-8111-111111111111';
 student2 uuid:='22222222-2222-4222-8222-222222222222';
 teacher uuid:='33333333-3333-4333-8333-333333333333';
 classroom uuid:='44444444-4444-4444-8444-444444444444';
 multi text:='addition-ecrite-multiple';
 previous text:='addition-ecrite-simple';
 response jsonb; results jsonb; n integer;
BEGIN
 INSERT INTO public.connect_students(id,display_name) VALUES(student1,'Élève test A'),(student2,'Élève test B');
 INSERT INTO public.connect_class_permissions(class_id,teacher_id,can_manage) VALUES(classroom,teacher,true);
 INSERT INTO public.connect_enrollments(id,class_id,student_id) VALUES
 ('55555555-5555-4555-8555-555555555551',classroom,student1),
 ('55555555-5555-4555-8555-555555555552',classroom,student2);
 INSERT INTO public.connect_states(student_id,app_key,schema_version,revision,state_data) VALUES
 (student1,multi,1,1,'{"classic":[{"4":4},{},{}],"sudden":[null,null,null],"hard":[null,null,null]}'::jsonb),
 (student2,multi,1,1,'{"classic":[{"10":8},{},{}]}'::jsonb),
 (student1,previous,1,7,'{"classic":[{"4":4},{},{}]}'::jsonb);
 -- Credit for existing game simulates a valid historical, immutable record.
 INSERT INTO public.connect_xp_credits(student_id,app_key,xp_credited) VALUES(student1,previous,22);
 -- Execute REAL candidate credit function, not a mock calculation.
 response:=public.connect_xp_sync_v2(student1,multi,false);
 IF (response->>'delta')::int<>22 OR (response->>'appXp')::int<>22 OR
    (response->>'total')::int<>44 THEN RAISE EXCEPTION 'actual_rpc_first_credit: %',response;END IF;
 response:=public.connect_xp_sync_v2(student1,multi,false);
 IF (response->>'delta')::int<>0 OR (response->>'appXp')::int<>22 THEN RAISE EXCEPTION 'actual_rpc_idempotence: %',response;END IF;
 response:=public.connect_xp_sync_v2(student2,multi,false);
 IF (response->>'appXp')::int<>30 OR (response->>'total')::int<>30 THEN RAISE EXCEPTION 'second_student_credit: %',response;END IF;
 -- Teacher results must reflect independent app/learner state and XP credits.
 SELECT jsonb_agg(jsonb_build_object('student',s.display_name,'app',st.app_key,
 'revision',st.revision,'classic',st.state_data->'classic','xp',xp.xp_credited) ORDER BY s.id)
 INTO results FROM public.connect_students s
 JOIN public.connect_states st ON st.student_id=s.id
 LEFT JOIN public.connect_xp_credits xp ON xp.student_id=st.student_id AND xp.app_key=st.app_key
 WHERE st.app_key=multi;
 IF jsonb_array_length(results)<>2 OR (results->0->>'xp')::int<>22 OR (results->1->>'xp')::int<>30 THEN
    RAISE EXCEPTION 'teacher_results_missing_or_mixed: %',results;
 END IF;
 response:=public.connect_xp_read_v2(student1,multi,true);
 IF (response->>'appXp')::int<>22 OR (response->>'total')::int<>44 OR
    (response->>'parcours')::int<>1 THEN RAISE EXCEPTION 'actual_rpc_read_wrong: %',response;END IF;
 -- One pupil restarts Addition multiple, without replay XP: other pupil and other app untouched.
 response:=public.connect_parcours_restart_one(teacher,classroom,student1,multi,false);
 IF (response->>'parcours')::int<>2 OR (SELECT reset_epoch FROM public.connect_states WHERE student_id=student1 AND app_key=multi)<>1
 THEN RAISE EXCEPTION 'teacher_restart_failed: %',response;END IF;
 IF (SELECT revision FROM public.connect_states WHERE student_id=student1 AND app_key=previous)<>7
    OR (SELECT revision FROM public.connect_states WHERE student_id=student2 AND app_key=multi)<>1
 THEN RAISE EXCEPTION 'restart_changed_unrelated_app_or_pupil';END IF;
 IF (SELECT archived_xp FROM public.connect_parcours_history WHERE student_id=student1 AND app_key=multi AND parcours_number=1)<>22
 THEN RAISE EXCEPTION 'missing_teacher_history'; END IF;
 -- Progress resets, but XP earned previously stays.
 response:=public.connect_xp_sync_v2(student1,multi,false);
 IF (response->>'delta')::int<>0 OR (response->>'appXp')::int<>22 THEN RAISE EXCEPTION 'restart_xp_changed: %',response;END IF;
 UPDATE public.connect_states SET revision=revision+1,state_data='{"classic":[{"4":4},{},{}]}'::jsonb,updated_at=now()
 WHERE student_id=student1 AND app_key=multi;
 response:=public.connect_xp_sync_v2(student1,multi,false);
 IF (response->>'delta')::int<>0 OR (response->>'appXp')::int<>22 THEN RAISE EXCEPTION 'disabled_replay_granted_xp: %',response;END IF;
 -- Enable repeat-XP explicitly on the next restarted parcours.
 response:=public.connect_parcours_restart_one(teacher,classroom,student1,multi,true);
 IF (response->>'parcours')::int<>3 THEN RAISE EXCEPTION 'repeat_reset_failed: %',response;END IF;
 UPDATE public.connect_states SET revision=revision+1,state_data='{"classic":[{"4":4},{},{}]}'::jsonb,updated_at=now()
 WHERE student_id=student1 AND app_key=multi;
 response:=public.connect_xp_sync_v2(student1,multi,false);
 IF (response->>'delta')::int<>22 OR (response->>'appXp')::int<>44 OR
   (response->>'total')::int<>66 THEN RAISE EXCEPTION 'explicit_repeat_credit_failed: %',response;END IF;
 response:=public.connect_xp_sync_v2(student1,multi,false);
 IF (response->>'delta')::int<>0 THEN RAISE EXCEPTION 'replay_not_idempotent: %',response;END IF;
 -- Regression: professor class-wide restart must preserve distinct app independence.
 response:=public.connect_parcours_restart_class(teacher,classroom,multi,false);
 IF (response->>'count')::int<>2 THEN RAISE EXCEPTION 'class_restart_failed: %',response;END IF;
 IF (SELECT count(*) FROM public.connect_parcours_history WHERE app_key=multi)<>4 THEN
 RAISE EXCEPTION 'class_history_incomplete';END IF;
 IF (SELECT xp_credited FROM public.connect_xp_credits WHERE student_id=student1 AND app_key=previous)<>22
 THEN RAISE EXCEPTION 'existing_app_xp_touched';END IF;
 RAISE NOTICE 'PASS actual SQL RPC: student separation, classroom results, 22/30 XP, 44/66 global, isolated reset, replay, idempotence';
END $scenario$;
