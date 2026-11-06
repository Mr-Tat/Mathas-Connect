-- Real XP functions, fake school IDs, reversible test-only database.
DO $test$
DECLARE
 a uuid:='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 b uuid:='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
 c uuid:='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
 r jsonb; n integer; j jsonb;
BEGIN
 PERFORM public.connect_xp_sync_v2(a,'addition-ecrite-simple',false);
 SELECT xp_credited INTO n FROM public.connect_xp_credits WHERE student_id=a AND app_key='addition-ecrite-simple';
 IF n<>10 THEN RAISE EXCEPTION '3 vies 5 wins should credit 10, got %',n;END IF;
 IF NOT EXISTS(SELECT 1 FROM public.connect_xp_milestones WHERE student_id=a AND milestone_key='sudden:1:5:half')
 THEN RAISE EXCEPTION 'missing half milestone';END IF;

 UPDATE public.connect_states SET state_data=jsonb_set(state_data,'{threeLives,0}','10') WHERE student_id=a;
 PERFORM public.connect_xp_sync_v2(a,'addition-ecrite-simple',false);
 SELECT xp_credited INTO n FROM public.connect_xp_credits WHERE student_id=a AND app_key='addition-ecrite-simple';
 IF n<>20 THEN RAISE EXCEPTION '3 vies 10 wins should total 20, got %',n;END IF;

 UPDATE public.connect_states SET state_data=jsonb_set(state_data,'{sudden,0}','5') WHERE student_id=a;
 PERFORM public.connect_xp_sync_v2(a,'addition-ecrite-simple',false);
 SELECT xp_credited INTO n FROM public.connect_xp_credits WHERE student_id=a AND app_key='addition-ecrite-simple';
 IF n<>30 THEN RAISE EXCEPTION 'sudden top-up 10 should total 30, got %',n;END IF;

 UPDATE public.connect_states SET state_data=jsonb_set(state_data,'{sudden,0}','10') WHERE student_id=a;
 PERFORM public.connect_xp_sync_v2(a,'addition-ecrite-simple',false);
 r:=public.connect_xp_sync_v2(a,'addition-ecrite-simple',false);
 SELECT xp_credited INTO n FROM public.connect_xp_credits WHERE student_id=a AND app_key='addition-ecrite-simple';
 IF n<>40 OR (r->>'delta')::int<>0 THEN RAISE EXCEPTION 'no duplicate full credit: % / %',n,r;END IF;

 -- Reset with no repeat XP preserves the full previously earned right.
 UPDATE public.connect_states SET state_data='{}'::jsonb WHERE student_id=a;
 PERFORM public.connect_xp_sync_v2(a,'addition-ecrite-simple',false);
 SELECT xp_credited INTO n FROM public.connect_xp_credits WHERE student_id=a AND app_key='addition-ecrite-simple';
 IF n<>40 THEN RAISE EXCEPTION 'historical credit lost after reset: %',n;END IF;

 PERFORM public.connect_xp_sync_v2(b,'addition-ecrite-multiple',false);
 UPDATE public.connect_states SET state_data=jsonb_set(state_data,'{threeLives,0}','10') WHERE student_id=b;
 PERFORM public.connect_xp_sync_v2(b,'addition-ecrite-multiple',false);
 SELECT xp_credited INTO n FROM public.connect_xp_credits WHERE student_id=b AND app_key='addition-ecrite-multiple';
 IF n<>30 THEN RAISE EXCEPTION 'sudden-first tier fully earned, 3-vies unlocks only the next half tier: %',n;END IF;

 UPDATE public.connect_states SET state_data=jsonb_set(state_data,'{hardThree,0}','3') WHERE student_id=b;
 PERFORM public.connect_xp_sync_v2(b,'addition-ecrite-multiple',false);
 SELECT xp_credited INTO n FROM public.connect_xp_credits WHERE student_id=b AND app_key='addition-ecrite-multiple';
 IF n<>40 THEN RAISE EXCEPTION 'HARD 3-vies half credit: %',n;END IF;
 UPDATE public.connect_states SET state_data=jsonb_set(state_data,'{hard,0}','7') WHERE student_id=b;
 PERFORM public.connect_xp_sync_v2(b,'addition-ecrite-multiple',false);
 SELECT xp_credited INTO n FROM public.connect_xp_credits WHERE student_id=b AND app_key='addition-ecrite-multiple';
 IF n<>70 THEN RAISE EXCEPTION 'HARD complete top-up: %',n;END IF;

 -- Other applications cannot earn the new 3-vies half milestone.
 PERFORM public.connect_xp_sync_v2(c,'multiplication-ecrite-simple',false);
 SELECT xp_credited INTO n FROM public.connect_xp_credits WHERE student_id=c AND app_key='multiplication-ecrite-simple';
 IF n<>0 THEN RAISE EXCEPTION 'other apps unexpectedly altered: %',n;END IF;
 UPDATE public.connect_states SET state_data=jsonb_set(state_data,'{sudden,0}','5') WHERE student_id=c;
 PERFORM public.connect_xp_sync_v2(c,'multiplication-ecrite-simple',false);
 SELECT xp_credited INTO n FROM public.connect_xp_credits WHERE student_id=c AND app_key='multiplication-ecrite-simple';
 IF n<>20 THEN RAISE EXCEPTION 'other app original 20 XP contract changed: %',n;END IF;

 -- New replay: first half then top-up, but no repeat double-credit.
 UPDATE public.connect_xp_milestones SET achieved_at=now()-interval '1 day' WHERE student_id=a;
 UPDATE public.connect_parcours_current SET parcours_number=2, repeat_xp=true,started_at=now() WHERE student_id=a;
 UPDATE public.connect_states SET state_data='{"threeLives":[5,0,0],"sudden":[0,0,0]}' WHERE student_id=a;
 PERFORM public.connect_xp_sync_v2(a,'addition-ecrite-simple',false);
 SELECT xp_credited INTO n FROM public.connect_xp_credits WHERE student_id=a AND app_key='addition-ecrite-simple';
 IF n<>50 THEN RAISE EXCEPTION '3-vies replay half should +10: %',n;END IF;
 j:=public.connect_xp_read_v2(a,'addition-ecrite-simple',true);
 IF NOT (j->'currentMilestones' ? 'sudden:1:5:half') THEN RAISE EXCEPTION 'replay XP panel not showing half'; END IF;
 UPDATE public.connect_states SET state_data=jsonb_set(state_data,'{sudden,0}','5') WHERE student_id=a;
 PERFORM public.connect_xp_sync_v2(a,'addition-ecrite-simple',false);
 SELECT xp_credited INTO n FROM public.connect_xp_credits WHERE student_id=a AND app_key='addition-ecrite-simple';
 IF n<>60 THEN RAISE EXCEPTION 'replay sudden complement +10: %',n;END IF;
 RAISE NOTICE 'Half-XP school survival contract: all assertions passed';
END $test$;
