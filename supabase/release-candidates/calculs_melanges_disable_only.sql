-- Candidate rollback: keeps every result, award, receipt and archive.
BEGIN;
UPDATE public.connect_apps SET enabled=false,featured=false WHERE app_key='melange-calculs-ecrits';
UPDATE public.connect_hub_preset_entries SET visible=false,featured=false WHERE app_key='melange-calculs-ecrits';
COMMIT;
