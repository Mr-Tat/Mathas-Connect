-- Schéma minimal volontairement fictif et jetable : aucune ressource LIVE.
CREATE TABLE public.connect_students(id uuid PRIMARY KEY, archived_at timestamptz);
CREATE TABLE public.connect_enrollments(
 id uuid PRIMARY KEY,student_id uuid,class_id uuid,left_at timestamptz);
CREATE TABLE public.connect_teacher_players(student_id uuid,teacher_id uuid);
CREATE TABLE public.connect_class_permissions(teacher_id uuid,class_id uuid,can_manage boolean);
CREATE TABLE public.connect_projection_score_events(
 event_id uuid PRIMARY KEY,student_id uuid NOT NULL,class_id uuid NOT NULL,
 app_key text NOT NULL,game_mode text NOT NULL,game_score integer NOT NULL,
 game_total integer,game_points integer NOT NULL,
 played_at timestamptz NOT NULL,captured_at timestamptz NOT NULL);
CREATE TABLE public.connect_projection_score_consents(
 student_id uuid NOT NULL,class_id uuid NOT NULL,app_key text NOT NULL,event_id uuid NOT NULL,
 UNIQUE(student_id,app_key,event_id));
CREATE TABLE public.connect_projection_score_periods(
 class_id uuid NOT NULL,app_key text NOT NULL,score_since timestamptz NOT NULL,
 UNIQUE(class_id,app_key));
CREATE TABLE public.connect_objective_record_school_proof_sessions(
 session_id uuid,student_id uuid,class_id uuid,app_key text,consumed_at timestamptz,result jsonb);
CREATE TABLE public.connect_objective_record_school_extended_sessions(
 session_id uuid,student_id uuid,class_id uuid,app_key text,consumed_at timestamptz,result jsonb);
