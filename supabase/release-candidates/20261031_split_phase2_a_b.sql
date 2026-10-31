-- Already applied to Supabase Connect as migration split_phase2_a_b_preserve_existing_class.
-- Idempotent, non-destructive: preserves the original Phase 2 UUID and all records.
DO $migration$
DECLARE
  original_class CONSTANT uuid := '1b021ed9-4846-4203-9c7b-4b5fa8d7adab';
  second_class uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.connect_classes WHERE id=original_class AND name IN ('Phase 2','Phase 2 A')) THEN
    RAISE EXCEPTION 'Unexpected original Phase 2 class';
  END IF;
  IF (SELECT count(*) FROM public.connect_classes WHERE name='Phase 2 B') > 1 THEN
    RAISE EXCEPTION 'Ambiguous Phase 2 B';
  END IF;
  UPDATE public.connect_classes SET name='Phase 2 A' WHERE id=original_class AND name='Phase 2';
  INSERT INTO public.connect_classes(id,year_id,name,created_by)
    SELECT gen_random_uuid(),year_id,'Phase 2 B',created_by
    FROM public.connect_classes WHERE id=original_class
    AND NOT EXISTS (SELECT 1 FROM public.connect_classes WHERE name='Phase 2 B');
  SELECT id INTO STRICT second_class FROM public.connect_classes WHERE name='Phase 2 B';
  INSERT INTO public.connect_class_permissions(class_id,teacher_id,can_manage,can_view_results,can_publish)
    SELECT second_class,teacher_id,can_manage,can_view_results,can_publish
    FROM public.connect_class_permissions WHERE class_id=original_class
    ON CONFLICT (class_id,teacher_id) DO NOTHING;
  UPDATE public.connect_hub_presets SET label='Phase 2 A' WHERE slug='phase2';
  INSERT INTO public.connect_hub_presets(slug,label,display_order)
    SELECT 'phase2b','Phase 2 B',display_order+1 FROM public.connect_hub_presets
    WHERE slug='phase2' ON CONFLICT (slug) DO NOTHING;
  INSERT INTO public.connect_hub_preset_entries(preset_slug,app_key,section,display_order,visible,featured)
    SELECT 'phase2b',app_key,section,display_order,visible,featured
    FROM public.connect_hub_preset_entries WHERE preset_slug='phase2'
    ON CONFLICT (preset_slug,app_key) DO NOTHING;
  IF NOT EXISTS (SELECT 1 FROM public.connect_class_permissions WHERE class_id=second_class AND can_manage) THEN
    RAISE EXCEPTION 'Missing teacher permissions for Phase 2 B';
  END IF;
END $migration$;