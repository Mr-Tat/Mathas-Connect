-- Disposable PostgreSQL only: school identity is fictitious and never
-- comes from a real pupil account.
CREATE TABLE public.connect_classes(id uuid PRIMARY KEY);
INSERT INTO public.connect_classes(id) VALUES
 ('8fe170fa-9e8f-4e80-885a-b0ba68026f64'),
 ('71f5f4a5-3f25-4ec7-ac29-c33d2e6b395e');
INSERT INTO public.connect_enrollments(student_id,class_id) VALUES
 ('11111111-1111-4111-8111-111111111111','8fe170fa-9e8f-4e80-885a-b0ba68026f64');
