-- Disposable PostgreSQL 16 fixture only. NEVER run against the hosted project.
BEGIN;
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE TABLE public.connect_students(id uuid PRIMARY KEY,archived_at timestamptz);
CREATE TABLE public.connect_apps(app_key text PRIMARY KEY);
CREATE TABLE public.connect_states(
 student_id uuid NOT NULL,app_key text NOT NULL,schema_version int NOT NULL DEFAULT 1,
 revision bigint NOT NULL DEFAULT 0,reset_epoch bigint NOT NULL DEFAULT 0,
 state_data jsonb NOT NULL DEFAULT '{}'::jsonb,updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(student_id,app_key)
);
CREATE TABLE public.connect_xp_credits(student_id uuid NOT NULL,app_key text NOT NULL,
 xp_credited int NOT NULL DEFAULT 0,PRIMARY KEY(student_id,app_key));
CREATE FUNCTION public.connect_xp_read_v2(p_student uuid,p_app text,p_include_milestones boolean)
 RETURNS jsonb LANGUAGE sql AS $mock$
 SELECT jsonb_build_object('appXp',coalesce((SELECT xp_credited FROM public.connect_xp_credits
  WHERE student_id=p_student AND app_key=p_app),0),'total',
  coalesce((SELECT sum(xp_credited) FROM public.connect_xp_credits WHERE student_id=p_student),0),
  'level',1);
$mock$;
CREATE FUNCTION public.connect_xp_sync_v2(p_student uuid,p_app text,p_force boolean)
 RETURNS jsonb LANGUAGE plpgsql AS $mock$
DECLARE v jsonb;v_before integer:=0;v_new integer:=0;v_total integer:=0;
BEGIN
 SELECT state_data INTO v FROM public.connect_states
  WHERE student_id=p_student AND app_key=p_app;
 IF (v#>>'{sudden,0}')::int=777 THEN RAISE EXCEPTION 'simulated_xp_failure';END IF;
 SELECT xp_credited INTO v_before FROM public.connect_xp_credits
  WHERE student_id=p_student AND app_key=p_app;
 v_before:=coalesce(v_before,0);
 v_new:=CASE WHEN (v#>>'{classic,0,4}')::int=4 THEN 22 ELSE 0 END;
 INSERT INTO public.connect_xp_credits VALUES(p_student,p_app,v_new)
 ON CONFLICT(student_id,app_key) DO UPDATE SET xp_credited=excluded.xp_credited;
 SELECT coalesce(sum(xp_credited),0) INTO v_total FROM public.connect_xp_credits WHERE student_id=p_student;
 RETURN jsonb_build_object('appXp',v_new,'total',v_total,'level',1,'delta',v_new-v_before);
END $mock$;
INSERT INTO public.connect_students(id) VALUES('11111111-1111-4111-8111-111111111111');
INSERT INTO public.connect_apps(app_key) VALUES('addition-ecrite-simple'),('soustraction-ecrite-simple'),
 ('multiplication-ecrite-simple'),('addition-ecrite-multiple');
COMMIT;
