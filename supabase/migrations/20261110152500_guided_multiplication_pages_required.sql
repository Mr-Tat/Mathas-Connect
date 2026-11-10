-- Guidé collectif Multiplication : page montrée par le professeur et pages obligatoires.
-- Les opérations déjà ouvertes restent conservées. Pas de réponses élèves côté serveur.
alter table public.connect_guided_multiplication_sessions
 add column if not exists teacher_page_index integer not null default 0
   check (teacher_page_index >= 0),
 add column if not exists required_pages integer[] not null default '{}';

-- Conserver la page actuellement ouverte dans les anciennes séances.
update public.connect_guided_multiplication_sessions
 set teacher_page_index=page_index
 where teacher_page_index=0 and page_index>0;

comment on column public.connect_guided_multiplication_sessions.teacher_page_index is
 'Page actuellement montrée au tableau, indépendante de la dernière page ouverte.';
comment on column public.connect_guided_multiplication_sessions.required_pages is
 'Indices des pages que les élèves doivent réussir pour avancer ; aucune réponse élève stockée.';
