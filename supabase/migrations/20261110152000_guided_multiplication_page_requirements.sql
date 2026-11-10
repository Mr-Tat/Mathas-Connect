-- Le guidé collectif mémorise quelles pages exigent une réussite parfaite.
-- Pas de modification des calculs, scores, trophées ou comptes élèves.
alter table public.connect_guided_multiplication_sessions
 add column if not exists required_pages jsonb not null default '[]'::jsonb;

alter table public.connect_guided_multiplication_sessions
 add constraint connect_guided_mul_required_pages_is_array
 check (jsonb_typeof(required_pages)='array');

comment on column public.connect_guided_multiplication_sessions.required_pages is
 'Booléens par page, définis par le professeur : true impose les deux calculs réussis avant de passer à une page ultérieure. Aucun résultat élève enregistré.';
