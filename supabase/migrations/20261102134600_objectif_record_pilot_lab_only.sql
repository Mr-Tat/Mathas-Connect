-- Pilote "Objectif record" exclusivement dans la classe TEST.
-- Les XP ci-dessous sont une comptabilite d'essai, jamais des credits Connect.
create table if not exists public.connect_record_pilot_states (
  student_id uuid not null references public.connect_students(id) on delete cascade,
  class_id uuid not null
    check (class_id = '4bf3400d-a315-4ea4-a2f3-afaca24dc9b9'::uuid),
  app_key text not null check (app_key in (
    'addition-ecrite-simple','addition-ecrite-multiple',
    'soustraction-ecrite-simple','multiplication-ecrite-simple',
    'melange-calculs-ecrits')),
  revision bigint not null default 0 check (revision >= 0),
  state_data jsonb not null default '{"events":[],"earned":{},"best":0,"trophies":[]}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint connect_record_pilot_states_pk primary key (student_id,app_key),
  constraint connect_record_pilot_states_shape check (jsonb_typeof(state_data) = 'object')
);
alter table public.connect_record_pilot_states enable row level security;
revoke all on public.connect_record_pilot_states from public, anon, authenticated;
grant select,insert,update on public.connect_record_pilot_states to service_role;
comment on table public.connect_record_pilot_states is
  'Classe TEST uniquement. Jalons/XP de simulation persistants, jamais connect_xp_credits ni connect_states.';
