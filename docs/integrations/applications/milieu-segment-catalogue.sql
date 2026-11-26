-- Catalogue Toutes uniquement ; aucune entrée de classe ni droit officiel.
begin;
insert into public.connect_apps(app_key,title,launch_url,enabled,hub_section,featured,display_order,image_url) values ('milieu-segment','La moitié — Milieu d''un segment','https://mr-tat.github.io/Mathas-Connect/apps/DIV-Milieu-de-segment-1/?hub=toutes',true,'outil',false,75,'https://mr-tat.github.io/Mathas-Connect/assets/miniatures/milieu-segment.svg') on conflict(app_key) do nothing;
insert into public.connect_hub_all_settings(app_key,all_order,stage,section) values ('milieu-segment',75,'test','test') on conflict(app_key) do nothing;
commit;
