-- Candidat uniquement : NE PAS APPLIQUER automatiquement en production.
-- Séances guidées des trois calculs écrits hors Multiplication.
-- Aucune réponse, identité d'élève, score, XP ou trophée dans cette table.
create table if not exists public.connect_guided_written_sessions (
 app_key text not null check (app_key in (
  'addition-ecrite-simple','addition-ecrite-multiple','soustraction-ecrite-simple')),
 class_id uuid not null,
 teacher_id uuid not null,
 session_id uuid not null,
 active boolean not null default true,
 level smallint not null check (level between 1 and 3),
 borrow_method text null check (borrow_method is null or borrow_method in ('addBottom','takeTop')),
 pages jsonb not null check (jsonb_typeof(pages)='array' and jsonb_array_length(pages) between 1 and 120),
 required_pages jsonb not null default '[]'::jsonb check (jsonb_typeof(required_pages)='array'),
 page_index integer not null default 0 check (page_index between 0 and 119),
 allow_skip boolean not null default false,
 revision bigint not null check (revision>0),
 updated_at timestamptz not null default now(),
 host_client_id uuid,
 host_page_id uuid,
 host_seen_at timestamptz,
 close_requested_at timestamptz,
 constraint connect_guided_written_sessions_pk primary key (app_key,class_id),
 constraint connect_guided_written_pages_coherent check (
  jsonb_array_length(required_pages)=jsonb_array_length(pages)
  and page_index<jsonb_array_length(pages)
 )
);
alter table public.connect_guided_written_sessions enable row level security;
-- Les élèves et professeurs lisent exclusivement via l'Edge et son auth.
-- Aucun accès direct Data API, même avec un JWT authentifié.
revoke all on table public.connect_guided_written_sessions from public, anon, authenticated;
grant select,insert,update,delete on table public.connect_guided_written_sessions to service_role;
comment on table public.connect_guided_written_sessions is
 'Guidé collectif 3 calculs écrits : pages communes, jamais de réponses individuelles.';
