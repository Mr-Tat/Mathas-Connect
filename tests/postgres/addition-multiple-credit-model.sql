-- Isolated integration model only. Never apply to production.
-- Reuses the existing XP preview and tests transactional, idempotent credits.
CREATE TABLE public.addmulti_test_states(
 student_id uuid NOT NULL,app_key text NOT NULL,revision integer NOT NULL DEFAULT 0,
 reset_epoch integer NOT NULL DEFAULT 0,state_data jsonb NOT NULL DEFAULT '{}'::jsonb,
 PRIMARY KEY(student_id,app_key)
);
CREATE TABLE public.addmulti_test_credits(
 student_id uuid NOT NULL,app_key text NOT NULL,xp integer NOT NULL DEFAULT 0,
 PRIMARY KEY(student_id,app_key)
);
CREATE TABLE public.addmulti_test_events(
 student_id uuid NOT NULL,app_key text NOT NULL,event_id uuid NOT NULL,
 PRIMARY KEY(student_id,app_key,event_id)
);
CREATE OR REPLACE FUNCTION public.addmulti_test_record(
 p_student uuid,p_app text,p_event uuid,p_revision integer,p_epoch integer,
 p_mode text,p_level integer,p_score integer,p_total integer
) RETURNS jsonb LANGUAGE plpgsql AS $fn$
DECLARE s public.addmulti_test_states%ROWTYPE; next_state jsonb; old_score integer;
 calculated integer; previous integer;
BEGIN
 IF p_app<>'addition-ecrite-multiple' OR p_event IS NULL OR p_student IS NULL
 OR p_level NOT BETWEEN 1 AND 3 OR p_score NOT BETWEEN 0 AND 100000 OR
 p_mode NOT IN ('classic','sudden','hard','hard-challenge')
 OR (p_mode='classic' AND (p_total NOT IN (4,10,20) OR p_score>p_total))
 OR (p_mode='hard-challenge' AND (p_total<>5 OR p_score>5))
 OR (p_mode IN ('sudden','hard') AND p_total IS NOT NULL)
 THEN RAISE EXCEPTION 'invalid_event'; END IF;
 INSERT INTO public.addmulti_test_states(student_id,app_key)
 VALUES(p_student,p_app) ON CONFLICT DO NOTHING;
 SELECT * INTO s FROM public.addmulti_test_states
 WHERE student_id=p_student AND app_key=p_app FOR UPDATE;
 IF s.reset_epoch<>p_epoch THEN RAISE EXCEPTION 'stale_reset_epoch'; END IF;
 IF EXISTS(SELECT 1 FROM public.addmulti_test_events WHERE student_id=p_student AND app_key=p_app AND event_id=p_event)
 THEN RETURN jsonb_build_object('duplicate',true,'revision',s.revision,'resetEpoch',s.reset_epoch);END IF;
 IF s.revision<>p_revision THEN RAISE EXCEPTION 'revision_conflict'; END IF;
 next_state:=s.state_data;
 IF jsonb_typeof(next_state->'classic')<>'array' THEN next_state:=jsonb_set(next_state,'{classic}','[{}, {}, {}]'::jsonb,true);END IF;
 IF jsonb_typeof(next_state->'sudden')<>'array' THEN next_state:=jsonb_set(next_state,'{sudden}','[0,0,0]'::jsonb,true);END IF;
 IF jsonb_typeof(next_state->'hard')<>'array' THEN next_state:=jsonb_set(next_state,'{hard}','[0,0,0]'::jsonb,true);END IF;
 IF p_mode='classic' THEN
   old_score:=COALESCE((next_state#>>ARRAY['classic',(p_level-1)::text,p_total::text])::integer,0);
   next_state:=jsonb_set(next_state,ARRAY['classic',(p_level-1)::text,p_total::text],to_jsonb(GREATEST(old_score,p_score)),true);
 ELSIF p_mode IN ('sudden','hard') THEN
   old_score:=COALESCE((next_state#>>ARRAY[p_mode,(p_level-1)::text])::integer,0);
   next_state:=jsonb_set(next_state,ARRAY[p_mode,(p_level-1)::text],to_jsonb(GREATEST(old_score,p_score)),true);
 END IF;
 calculated:=(public.connect_addition_multiple_xp_preview(next_state)->>'xp')::integer;
 SELECT xp INTO previous FROM public.addmulti_test_credits WHERE student_id=p_student AND app_key=p_app FOR UPDATE;
 previous:=COALESCE(previous,0);
 IF calculated<previous THEN RAISE EXCEPTION 'xp_regression';END IF;
 UPDATE public.addmulti_test_states SET state_data=next_state,revision=s.revision+1
 WHERE student_id=p_student AND app_key=p_app;
 INSERT INTO public.addmulti_test_credits(student_id,app_key,xp) VALUES(p_student,p_app,calculated)
 ON CONFLICT(student_id,app_key) DO UPDATE SET xp=excluded.xp;
 INSERT INTO public.addmulti_test_events(student_id,app_key,event_id) VALUES(p_student,p_app,p_event);
 RETURN jsonb_build_object('duplicate',false,'revision',s.revision+1,'resetEpoch',s.reset_epoch,'delta',calculated-previous,'appXp',calculated);
END $fn$;
