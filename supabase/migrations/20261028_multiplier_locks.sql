-- Multiplication Connect: réglages de multiplicateurs par classe et élève.
-- Stockage privé : uniquement le service role via connect-results, RLS activée.
create table if not exists public.connect_multiplier_locks (
 class_id uuid not null references public.connect_classes(id) on delete cascade,
 scope_key text not null,
 multipliers smallint[] not null,
 updated_at timestamptz not null default now(),
 primary key (class_id, scope_key),
 constraint connect_multiplier_scope_check check (scope_key='class' or scope_key ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),
 constraint connect_multiplier_values_check check (cardinality(multipliers) between 1 and 8 and multipliers <@ array[2,3,4,5,6,7,8,9]::smallint[])
);
alter table public.connect_multiplier_locks enable row level security;
revoke all on public.connect_multiplier_locks from anon, authenticated, public;
create index if not exists connect_multiplier_locks_updated_idx on public.connect_multiplier_locks(updated_at);
