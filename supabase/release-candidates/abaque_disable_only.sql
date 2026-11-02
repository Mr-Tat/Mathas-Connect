-- Requires authorization if executed in production. Preserves every result.
BEGIN;
UPDATE public.connect_apps SET enabled=false WHERE app_key='abaque-longueurs';
UPDATE public.connect_lab_hub_visibility SET visible=false WHERE app_key='abaque-longueurs';
UPDATE public.connect_abaque_classes SET enabled=false;
COMMIT;
-- Also set CONNECT_ABAQUE_ACCESS=closed on the dedicated Edge.
