-- LOCAL ONLY extra tables read by the existing connect-api and professor UI.
ALTER TABLE public.connect_students ADD COLUMN avatar_kind text DEFAULT 'letter',ADD COLUMN avatar_value text DEFAULT 'E',ADD COLUMN avatar_color text DEFAULT 'ocean',ADD COLUMN public_alias text,ADD COLUMN projection_opt_in boolean DEFAULT false;
CREATE TABLE public.connect_devices(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),auth_user_id uuid NOT NULL,student_id uuid NOT NULL,state text NOT NULL);
CREATE TABLE public.connect_teachers(auth_user_id uuid PRIMARY KEY);
CREATE TABLE public.connect_teacher_players(teacher_id uuid PRIMARY KEY,student_id uuid NOT NULL);
CREATE TABLE public.connect_school_years(id uuid PRIMARY KEY,label text NOT NULL,starts_on date,ends_on date);
CREATE TABLE public.connect_classes(id uuid PRIMARY KEY,name text NOT NULL,year_id uuid,created_at timestamptz DEFAULT now());
CREATE TABLE public.connect_join_requests(id uuid PRIMARY KEY,class_id uuid,first_name text,last_initial text,verify_code text,expires_at timestamptz,state text,created_at timestamptz);
SELECT format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;',tablename) FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'connect_%' \gexec
GRANT USAGE ON SCHEMA public TO service_role,authenticated,anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
NOTIFY pgrst,'reload schema';
