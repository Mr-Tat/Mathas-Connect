-- HUB Toutes : réglages indépendants du catalogue scolaire et des contrats XP.
-- Aucune suppression ni modification des résultats, profils ou permissions des classes.
create table if not exists public.connect_hub_all_settings (
  app_key text primary key references public.connect_apps(app_key) on delete restrict,
  all_order integer not null default 1000 check (all_order between 0 and 100000),
  stage text not null default 'test' check (stage in ('test','published')),
  updated_at timestamptz not null default now()
);
alter table public.connect_hub_all_settings enable row level security;
revoke all on table public.connect_hub_all_settings from anon, authenticated;
insert into public.connect_hub_all_settings(app_key,all_order,stage)
select a.app_key,a.display_order,
 case when exists(select 1 from public.connect_hub_preset_entries p
   where p.app_key=a.app_key and p.visible=true) then 'published' else 'test' end
from public.connect_apps a where a.app_key <> 'connect-lab'
on conflict (app_key) do nothing;
