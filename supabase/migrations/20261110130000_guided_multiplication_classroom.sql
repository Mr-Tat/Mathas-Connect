-- Tableau isolé pour le guidé collectif multiplication. Aucun résultat, score ni XP.
create table if not exists public.connect_guided_multiplication_sessions (
 class_id uuid primary key references public.connect_classes(id) on delete cascade,
 teacher_id uuid not null,
 session_id uuid not null,
 active boolean not null default true,
 level smallint not null check(level between 1 and 3),
 carry_method text not null check(carry_method in ('top','side')),
 multipliers smallint[] not null,
 pages jsonb not null check(jsonb_typeof(pages)='array'),
 page_index integer not null check(page_index>=0),
 allow_skip boolean not null default false,
 revision bigint not null check(revision>0),
 updated_at timestamptz not null default now()
);
alter table public.connect_guided_multiplication_sessions enable row level security;
revoke all on table public.connect_guided_multiplication_sessions from public,anon,authenticated;
comment on table public.connect_guided_multiplication_sessions is 'Séances collectives : mêmes opérations/pages par classe ; aucune réponse d’élève ni récompense.';
