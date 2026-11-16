-- Four mutually exclusive classroom teaching modes for the Abaque.
-- Existing results, passes, XP, receipts and trophies are never rewritten.
-- Stage1 only remains the default, preserving the previous locked production setting.
ALTER TABLE public.connect_abaque_classes
 ADD COLUMN IF NOT EXISTS unlock_mode text NOT NULL DEFAULT 'stage1_only';

DO $migration$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint
  WHERE conname='connect_abaque_classes_unlock_mode_check'
    AND conrelid='public.connect_abaque_classes'::regclass) THEN
  ALTER TABLE public.connect_abaque_classes
   ADD CONSTRAINT connect_abaque_classes_unlock_mode_check
   CHECK (unlock_mode IN ('stage1_only','through_2','all_open','mastery_80'));
 END IF;
END $migration$;

-- Carry forward any teacher permissions that were set using the former two checkboxes.
UPDATE public.connect_abaque_classes
SET unlock_mode=CASE
 WHEN activity_3_allowed THEN 'all_open'
 WHEN activity_2_allowed THEN 'through_2'
 ELSE 'stage1_only' END
WHERE unlock_mode='stage1_only';

CREATE OR REPLACE FUNCTION public.connect_abaque_access_v1(p_class uuid,p_teacher boolean)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $function$
 SELECT jsonb_build_object(
  'activity2',coalesce(a.activity_2_allowed,false) OR p_teacher,
  'activity3',coalesce(a.activity_3_allowed,false) OR p_teacher,
  'teacherFree',p_teacher,
  'unlockMode',a.unlock_mode)
 FROM public.connect_abaque_classes a WHERE a.class_id=p_class AND a.enabled;
$function$;

-- New professor-only RPCs. An "all_open" choice is a classroom opening,
-- not a reward or an XP/trophy grant.
CREATE OR REPLACE FUNCTION public.connect_abaque_class_mode_get_v1(p_actor uuid,p_class uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $function$
DECLARE selected_mode text;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.connect_class_permissions
 WHERE class_id=p_class AND teacher_id=p_actor AND can_manage)
 THEN RAISE EXCEPTION 'professor_required'; END IF;
 SELECT unlock_mode INTO selected_mode
 FROM public.connect_abaque_classes WHERE class_id=p_class AND enabled FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'app_class_not_open'; END IF;
 RETURN jsonb_build_object('ok',true,'mode',selected_mode);
END $function$;

CREATE OR REPLACE FUNCTION public.connect_abaque_class_mode_set_v1(p_actor uuid,p_class uuid,p_mode text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $function$
DECLARE selected_mode text;
BEGIN
 IF p_mode IS NULL OR p_mode NOT IN ('stage1_only','through_2','all_open','mastery_80')
 THEN RAISE EXCEPTION 'invalid_request'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.connect_class_permissions
 WHERE class_id=p_class AND teacher_id=p_actor AND can_manage)
 THEN RAISE EXCEPTION 'professor_required'; END IF;
 UPDATE public.connect_abaque_classes SET unlock_mode=p_mode,
  activity_2_allowed=p_mode IN ('through_2','all_open','mastery_80'),
  activity_3_allowed=p_mode IN ('all_open','mastery_80')
 WHERE class_id=p_class AND enabled RETURNING unlock_mode INTO selected_mode;
 IF NOT FOUND THEN RAISE EXCEPTION 'app_class_not_open'; END IF;
 RETURN jsonb_build_object('ok',true,'mode',selected_mode);
END $function$;

-- Compatibility for any older, already-open teacher HUB tab:
-- a legacy checkbox update must not leave unlock_mode inconsistent with its flags.
CREATE OR REPLACE FUNCTION public.connect_abaque_class_gates_set_v1(
 p_actor uuid,p_class uuid,p_activity integer,p_allowed boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $function$
DECLARE b2 boolean;b3 boolean;
BEGIN
 IF p_activity IS NULL OR p_activity NOT IN (2,3) OR p_allowed IS NULL THEN RAISE EXCEPTION 'invalid_request'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.connect_class_permissions
 WHERE class_id=p_class AND teacher_id=p_actor AND can_manage) THEN RAISE EXCEPTION 'professor_required'; END IF;
 SELECT activity_2_allowed,activity_3_allowed INTO b2,b3
 FROM public.connect_abaque_classes WHERE class_id=p_class AND enabled FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'app_class_not_open'; END IF;
 b2:=CASE WHEN p_activity=2 THEN p_allowed ELSE b2 END;
 b3:=CASE WHEN p_activity=3 THEN p_allowed ELSE b3 END;
 UPDATE public.connect_abaque_classes
 SET activity_2_allowed=b2,activity_3_allowed=b3,
     unlock_mode=CASE WHEN b3 THEN 'all_open' WHEN b2 THEN 'through_2' ELSE 'stage1_only' END
 WHERE class_id=p_class AND enabled;
 RETURN jsonb_build_object('ok',true,'activity2',b2,'activity3',b3);
END $function$;

-- Keep the existing result judge and anti-double-credit logic in place.
-- The 80% pedagogical lock applies only when the professor selects that challenge.
-- The outer class gates still reject any result above the permitted stage.
DO $migration$
DECLARE definition text;
DECLARE original_fragment text:='IF NOT p_teacher AND ((kind=''moves'' AND jsonb_array_length';
DECLARE new_fragment text:='IF NOT p_teacher AND (SELECT a.unlock_mode FROM public.connect_abaque_classes a WHERE a.class_id=p_class AND a.enabled)=''mastery_80'' AND ((kind=''moves'' AND jsonb_array_length';
BEGIN
 SELECT pg_get_functiondef('public.connect_abaque_record_v1(uuid,uuid,boolean,uuid,uuid,bigint,bigint,jsonb)'::regprocedure)
 INTO definition;
 IF definition IS NULL OR length(definition)-length(replace(definition,original_fragment,''))<>length(original_fragment)
 THEN RAISE EXCEPTION 'abaque_record_contract_changed'; END IF;
 definition:=replace(definition,original_fragment,new_fragment);
 EXECUTE definition;
END $migration$;

REVOKE ALL ON FUNCTION public.connect_abaque_class_mode_get_v1(uuid,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.connect_abaque_class_mode_set_v1(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.connect_abaque_class_mode_get_v1(uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.connect_abaque_class_mode_set_v1(uuid,uuid,text) TO service_role;
