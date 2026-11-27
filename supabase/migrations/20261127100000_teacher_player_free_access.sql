-- Private capability derived from active dedicated teacher player and class permission.
-- NULL is used only by the legacy Mixed recorder after its Edge verifies the exact class.
CREATE OR REPLACE FUNCTION public.connect_teacher_player_free_v1(p_student uuid,p_class uuid)
RETURNS boolean LANGUAGE sql STABLE SET search_path TO '' AS $$
 SELECT EXISTS(SELECT 1 FROM public.connect_teacher_players t
 JOIN public.connect_students s ON s.id=t.student_id AND s.archived_at IS NULL
 JOIN public.connect_class_permissions cp ON cp.teacher_id=t.teacher_id AND cp.can_manage
 WHERE t.student_id=p_student AND (p_class IS NULL OR cp.class_id=p_class))
$$;
REVOKE ALL ON FUNCTION public.connect_teacher_player_free_v1(uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.connect_teacher_player_free_v1(uuid,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.connect_mixed_record_v1(p_student uuid, p_event uuid, p_expected_revision bigint, p_reset_epoch bigint, p_mode text, p_level integer, p_score integer, p_total integer DEFAULT NULL::integer, p_rewards jsonb DEFAULT NULL::jsonb, p_selected jsonb DEFAULT NULL::jsonb, p_completed jsonb DEFAULT NULL::jsonb, p_first jsonb DEFAULT NULL::jsonb, p_aid boolean DEFAULT NULL::boolean, p_master boolean DEFAULT NULL::boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
 v_app constant text:='melange-calculs-ecrits';
 v_state public.connect_states%ROWTYPE;
 v_next jsonb;v_ids jsonb;v_recent jsonb;v_event jsonb;
 v_old integer;v_xp jsonb;v_when timestamptz:=now();v_i integer;
 v_aids jsonb; v_aid_path text[]; v_proof jsonb; v_eligible jsonb; v_threshold integer; v_evidence_key text;
 v_rewards jsonb;v_key text;v_path text[];v_old_flag boolean;v_new_flag boolean;v_mode_key text;
 v_game_points integer;v_score_weight numeric;v_calc integer;
BEGIN
 IF p_student IS NULL OR p_event IS NULL OR p_expected_revision IS NULL OR p_expected_revision<0
 OR p_reset_epoch IS NULL OR p_reset_epoch<0
 OR p_level IS NULL OR p_level NOT BETWEEN 1 AND 3 OR p_score IS NULL OR p_score<0 OR p_score>1000
 OR p_mode IS NULL OR p_mode NOT IN ('classic','sudden','hard','three-lives','hard-three-lives')
 OR (p_mode='classic' AND (p_total IS NULL OR p_total NOT IN (4,10,20) OR p_score>p_total))
 OR (p_mode IN ('sudden','hard','three-lives','hard-three-lives') AND p_total IS NOT NULL)
 THEN RAISE EXCEPTION 'invalid_result';END IF;
 -- Exact bounded operation journal. Settings alone never earn an award.
 IF p_aid IS NULL OR p_master IS NULL
 OR jsonb_typeof(p_selected) IS DISTINCT FROM 'array'
 OR jsonb_typeof(p_completed) IS DISTINCT FROM 'array'
 OR jsonb_typeof(p_first) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'invalid_proof';END IF;
 IF jsonb_array_length(p_selected) NOT BETWEEN 1 AND 3
 OR jsonb_array_length(p_completed)>1000
 OR jsonb_array_length(p_first)<>jsonb_array_length(p_completed)
 OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(p_selected) a(op) WHERE op NOT IN ('add','sub','mul'))
 OR (SELECT count(DISTINCT op) FROM jsonb_array_elements_text(p_selected) a(op))<>jsonb_array_length(p_selected)
 OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(p_completed) a(op) WHERE op IS NULL OR NOT p_selected ? op)
 OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_first) a(v) WHERE jsonb_typeof(v)<>'boolean')
 OR (p_mode IN ('hard','hard-three-lives') AND jsonb_array_length(p_selected)<>3)
 OR (p_mode='classic' AND (jsonb_array_length(p_completed)<>p_total OR
     (SELECT count(*) FROM jsonb_array_elements(p_first) a(v) WHERE v='true'::jsonb)<>p_score))
 OR (p_mode IN ('sudden','hard') AND (jsonb_array_length(p_completed)<>p_score OR p_first @> '[false]'::jsonb))
 OR (p_mode IN ('three-lives','hard-three-lives') AND
      (jsonb_array_length(p_completed)<>p_score+3 OR
       (SELECT count(*) FROM jsonb_array_elements(p_first) a(v) WHERE v='true'::jsonb)<>p_score OR
       p_first->-1 IS DISTINCT FROM 'false'::jsonb))
 THEN RAISE EXCEPTION 'invalid_proof';END IF;
 -- Lock also synchronizes with XP and parcours reset. No unauthorised JWT
 -- may call this function; Edge resolves p_student from its authenticated token.
 PERFORM 1 FROM public.connect_students WHERE id=p_student AND archived_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'inactive_student';END IF;
 INSERT INTO public.connect_states(student_id,app_key,schema_version,revision,reset_epoch,state_data)
 VALUES(p_student,v_app,1,0,0,'{}'::jsonb) ON CONFLICT DO NOTHING;
 SELECT * INTO STRICT v_state FROM public.connect_states
 WHERE student_id=p_student AND app_key=v_app FOR UPDATE;
 IF v_state.reset_epoch<>p_reset_epoch THEN RAISE EXCEPTION 'stale_reset_epoch';END IF;
 v_next:=v_state.state_data;
 v_ids:=CASE WHEN jsonb_typeof(v_next->'ids')='array' THEN v_next->'ids' ELSE '[]'::jsonb END;
 -- Idempotency precedes revision CAS, covering a lost HTTP response.
 IF EXISTS(SELECT 1 FROM public.connect_mixed_receipts WHERE student_id=p_student AND event_id=p_event) THEN
   v_xp:=public.connect_mixed_xp_read_v1(p_student,v_app,false);
   RETURN jsonb_build_object('ok',true,'eventId',p_event::text,'appKey',v_app,'storageSubject',p_student::text,'duplicate',true,'revision',v_state.revision,
     'resetEpoch',v_state.reset_epoch,'state',v_next,
     'xp',v_xp||jsonb_build_object('delta',0));
 END IF;
 IF v_state.revision<>p_expected_revision THEN RAISE EXCEPTION 'revision_conflict';END IF;
 -- For certified survival, the SAME level must first have 8/10 or 16/20.
 -- Historical progress flags and Master Mode never grant a server exemption.
 IF NOT public.connect_teacher_player_free_v1(p_student,NULL) AND p_mode IN ('sudden','three-lives') AND NOT (
   coalesce((v_next#>>ARRAY['classic',(p_level-1)::text,'10'])::int,-1)>=8 OR
   coalesce((v_next#>>ARRAY['classic',(p_level-1)::text,'20'])::int,-1)>=16
 ) THEN RAISE EXCEPTION 'school_mode_locked'; END IF;
 IF NOT public.connect_teacher_player_free_v1(p_student,NULL) AND p_mode IN ('hard','hard-three-lives') AND (
   NOT (coalesce((v_next#>>'{progress,perfect1}')::boolean,false)
    AND coalesce((v_next#>>'{progress,perfect2}')::boolean,false)
    AND coalesce((v_next#>>'{progress,perfect3}')::boolean,false))
   OR (p_level>1 AND coalesce((v_next#>>ARRAY['hard',(p_level-2)::text])::int,0)<3)
 ) THEN RAISE EXCEPTION 'school_mode_locked'; END IF;
 IF jsonb_typeof(v_next->'classic') IS DISTINCT FROM 'array'
 THEN v_next:=jsonb_set(v_next,'{classic}','[{}, {}, {}]'::jsonb,true);END IF;
 IF jsonb_typeof(v_next->'sudden') IS DISTINCT FROM 'array'
 THEN v_next:=jsonb_set(v_next,'{sudden}','[null,null,null]'::jsonb,true);END IF;
 IF jsonb_typeof(v_next->'hard') IS DISTINCT FROM 'array'
 THEN v_next:=jsonb_set(v_next,'{hard}','[null,null,null]'::jsonb,true);END IF;
 IF jsonb_typeof(v_next->'progress') IS DISTINCT FROM 'object'
 THEN v_next:=jsonb_set(v_next,'{progress}','{}'::jsonb,true);END IF;
 v_i:=p_level-1;
 v_mode_key:=CASE p_mode WHEN 'three-lives' THEN 'threeLives' WHEN 'hard-three-lives' THEN 'hardThreeLives' ELSE p_mode END;
 IF p_mode IN ('three-lives','hard-three-lives') AND jsonb_typeof(v_next->v_mode_key) IS DISTINCT FROM 'array'
 THEN v_next:=jsonb_set(v_next,ARRAY[v_mode_key],'[0,0,0]'::jsonb,true);END IF;
 IF p_mode='classic' THEN
  v_old:=coalesce((v_next#>>ARRAY['classic',v_i::text,p_total::text])::int,0);
  v_next:=jsonb_set(v_next,ARRAY['classic',v_i::text,p_total::text],to_jsonb(greatest(v_old,p_score)),true);
  IF p_total>=10 AND p_score*5>=p_total*4 THEN
    v_next:=jsonb_set(v_next,ARRAY['progress','sudden'||p_level],to_jsonb(true),true);
    IF p_level=1 THEN v_next:=jsonb_set(v_next,'{progress,level2}',to_jsonb(true),true);END IF;
    IF p_level=2 THEN v_next:=jsonb_set(v_next,'{progress,level3}',to_jsonb(true),true);END IF;
  END IF;
  IF p_total>=10 AND p_score=p_total THEN
   v_next:=jsonb_set(v_next,ARRAY['progress','perfect'||p_level],to_jsonb(true),true);
  END IF;
  IF (v_next#>>'{progress,perfect1}')::boolean IS TRUE
     AND (v_next#>>'{progress,perfect2}')::boolean IS TRUE
     AND (v_next#>>'{progress,perfect3}')::boolean IS TRUE
  THEN v_next:=jsonb_set(v_next,'{progress,hard}',to_jsonb(true),true);END IF;
 ELSE
  v_old:=coalesce((v_next#>>ARRAY[v_mode_key,v_i::text])::int,0);
  v_next:=jsonb_set(v_next,ARRAY[v_mode_key,v_i::text],to_jsonb(greatest(v_old,p_score)),true);
 END IF;
 -- Preserve the aid marker of the native best, including a better equal-score no-aid attempt.
 v_aids:=coalesce(v_next->'recordAid','{"classic":[{},{},{}],"sudden":[null,null,null],"hard":[null,null,null]}'::jsonb);
 IF p_mode IN ('three-lives','hard-three-lives') AND jsonb_typeof(v_aids->v_mode_key) IS DISTINCT FROM 'array'
 THEN v_aids:=jsonb_set(v_aids,ARRAY[v_mode_key],'[null,null,null]'::jsonb,true);END IF;
 v_aid_path:=CASE WHEN p_mode='classic' THEN ARRAY['classic',(p_level-1)::text,p_total::text] ELSE ARRAY[v_mode_key,(p_level-1)::text] END;
 IF v_aids#>v_aid_path IS NULL OR v_aids#>v_aid_path='null'::jsonb OR p_score>v_old OR (p_score=v_old AND NOT p_aid) THEN
  v_aids:=jsonb_set(v_aids,v_aid_path,to_jsonb(p_aid),true);
 END IF;
 v_next:=jsonb_set(v_next,'{recordAid}',v_aids,true);
 -- Teacher-approved START selection controls the rate. A lucky draw with all
 -- three selected is full rate; completed journals remain mandatory evidence.
 -- Independent trees prevent a higher half-rate score erasing full-rate proof.
 v_evidence_key:=CASE jsonb_array_length(p_selected) WHEN 3 THEN 'eligible' WHEN 2 THEN 'halfEligible' ELSE 'quarterEligible' END;
 v_eligible:=coalesce(v_next->v_evidence_key,'{"classic":[{},{},{}],"sudden":[0,0,0],"hard":[0,0,0],"thresholds":{"sudden":[{},{},{}],"hard":[{},{},{}]}}'::jsonb);
 IF p_mode IN ('three-lives','hard-three-lives') THEN
   IF jsonb_typeof(v_eligible->v_mode_key) IS DISTINCT FROM 'array'
    THEN v_eligible:=jsonb_set(v_eligible,ARRAY[v_mode_key],'[0,0,0]'::jsonb,true);END IF;
   IF jsonb_typeof(v_eligible#>ARRAY['thresholds',v_mode_key]) IS DISTINCT FROM 'array'
    THEN v_eligible:=jsonb_set(v_eligible,ARRAY['thresholds',v_mode_key],'[{}, {}, {}]'::jsonb,true);END IF;
 END IF;
 IF NOT p_master THEN
  IF p_mode='classic' THEN
    v_old:=coalesce((v_eligible#>>ARRAY['classic',(p_level-1)::text,p_total::text])::int,0);
    v_eligible:=jsonb_set(v_eligible,ARRAY['classic',(p_level-1)::text,p_total::text],to_jsonb(greatest(v_old,p_score)),true);
  ELSE
   FOR v_threshold IN SELECT unnest(CASE WHEN p_mode IN ('hard','hard-three-lives') THEN ARRAY[3,7] ELSE ARRAY[5,10] END) LOOP
    IF p_score>=v_threshold THEN
     v_old:=coalesce((v_eligible#>>ARRAY[v_mode_key,(p_level-1)::text])::int,0);
     v_eligible:=jsonb_set(v_eligible,ARRAY[v_mode_key,(p_level-1)::text],to_jsonb(greatest(v_old,v_threshold)),true);
     v_eligible:=jsonb_set(v_eligible,ARRAY['thresholds',v_mode_key,(p_level-1)::text,v_threshold::text],'true'::jsonb,true);
    END IF;
   END LOOP;
  END IF;
 END IF;
 v_next:=jsonb_set(v_next,ARRAY[v_evidence_key],v_eligible,true);
 v_proof:=jsonb_build_object('operationsSelectedAtStart',p_selected,'operationsCompleted',p_completed,'firstTry',p_first,'aidUsed',p_aid,'masterMode',p_master);
 -- Preserve native V3 trophies in this SAME result+XP transaction.
 -- Only validated boolean awards are admitted; server merges monotonically.
 IF p_rewards IS NOT NULL THEN
  IF jsonb_typeof(p_rewards) IS DISTINCT FROM 'object' OR p_rewards->>'version' IS DISTINCT FROM '3'
    OR jsonb_typeof(p_rewards->'mastery') IS DISTINCT FROM 'object'
    OR jsonb_typeof(p_rewards->'hardAwards') IS DISTINCT FROM 'object'
    OR jsonb_typeof(p_rewards->'scoreOne') IS DISTINCT FROM 'object'
    OR jsonb_typeof(p_rewards->'unlockedGold') IS DISTINCT FROM 'boolean'
  THEN RAISE EXCEPTION 'invalid_rewards'; END IF;
  v_rewards:='{"version":3,"mastery":{"4":[false,false,false],"10":[false,false,false],"20":[false,false,false]},"sudden":[false,false,false],"hardAwards":{"bronze":[false,false,false],"silver":[false,false,false],"gold":[false,false,false]},"scoreOne":{"bronze":false,"silver":false,"gold":false},"unlockedGold":false}'::jsonb;
  FOREACH v_key IN ARRAY ARRAY['4','10','20','sudden','bronze','silver','gold'] LOOP
   IF v_key IN ('4','10','20') THEN v_path:=ARRAY['mastery',v_key];
   ELSIF v_key='sudden' THEN v_path:=ARRAY['sudden'];
   ELSE v_path:=ARRAY['hardAwards',v_key];END IF;
   IF jsonb_typeof(p_rewards#>v_path) IS DISTINCT FROM 'array'
   THEN RAISE EXCEPTION 'invalid_rewards';END IF;
   IF jsonb_array_length(p_rewards#>v_path)<>3
      OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_rewards#>v_path) AS a(value)
                WHERE jsonb_typeof(a.value) IS DISTINCT FROM 'boolean')
   THEN RAISE EXCEPTION 'invalid_rewards';END IF;
   FOR v_i IN 0..2 LOOP
    v_new_flag:=(p_rewards#>>array_append(v_path,v_i::text))::boolean;
    v_old_flag:=coalesce((v_next#>>(ARRAY['rewards']||array_append(v_path,v_i::text)))::boolean,false);
    v_rewards:=jsonb_set(v_rewards,array_append(v_path,v_i::text),
        to_jsonb(v_old_flag OR v_new_flag),false);
   END LOOP;
  END LOOP;
  FOREACH v_key IN ARRAY ARRAY['bronze','silver','gold'] LOOP
    v_path:=ARRAY['scoreOne',v_key];
    IF jsonb_typeof(p_rewards#>v_path) IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'invalid_rewards';END IF;
    v_new_flag:=(p_rewards#>>v_path)::boolean;
    v_old_flag:=coalesce((v_next#>>(ARRAY['rewards']||v_path))::boolean,false);
    v_rewards:=jsonb_set(v_rewards,v_path,to_jsonb(v_old_flag OR v_new_flag),false);
  END LOOP;
  v_rewards:=jsonb_set(v_rewards,'{unlockedGold}',to_jsonb(
    coalesce((v_next#>>'{rewards,unlockedGold}')::boolean,false)
       OR (p_rewards->>'unlockedGold')::boolean),false);
  v_next:=jsonb_set(v_next,'{rewards}',v_rewards,true);
 END IF;
 v_ids:=jsonb_build_array(p_event::text)||v_ids;
 SELECT coalesce(jsonb_agg(value ORDER BY ord),'[]'::jsonb) INTO v_ids
 FROM jsonb_array_elements(v_ids) WITH ORDINALITY AS q(value,ord) WHERE ord<=50;
 v_next:=jsonb_set(v_next,'{ids}',v_ids,true);
 -- Le score de projection reprend le vrai barème en points du moteur natif.
 -- Les 3 vies comptent pour la moitié, sans trophée Mort subite.
 v_score_weight:=p_score;
 IF p_mode IN ('sudden','hard','three-lives','hard-three-lives') THEN
  v_score_weight:=0;
  FOR v_calc IN 0..p_score-1 LOOP
   v_score_weight:=v_score_weight+least(4::numeric,power(1.035::numeric,v_calc));
  END LOOP;
 END IF;
 v_game_points:=round(5::numeric*v_score_weight
   *CASE WHEN p_mode IN ('hard','hard-three-lives')
        THEN CASE p_level WHEN 1 THEN 1.6::numeric WHEN 2 THEN 1.8::numeric ELSE 2::numeric END
        ELSE CASE p_level WHEN 1 THEN 1::numeric WHEN 2 THEN 1.2::numeric ELSE 1.4::numeric END END
   *CASE WHEN p_mode IN ('sudden','hard') THEN 1.6::numeric
         WHEN p_mode IN ('three-lives','hard-three-lives') THEN 0.8::numeric
         WHEN p_total=20 THEN 1.6::numeric
         WHEN p_total=10 THEN 1.3::numeric ELSE 1::numeric END)::integer;
 v_event:=v_proof||jsonb_build_object('eventId',p_event::text,'mode',p_mode,'level',p_level,
   'score',p_score,'total',p_total,'points',v_game_points,'at',to_char(v_when AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
 v_recent:=jsonb_build_array(v_event)||
    (CASE WHEN jsonb_typeof(v_next->'recent')='array' THEN v_next->'recent' ELSE '[]'::jsonb END);
 SELECT coalesce(jsonb_agg(value ORDER BY ord),'[]'::jsonb) INTO v_recent
 FROM jsonb_array_elements(v_recent) WITH ORDINALITY AS q(value,ord) WHERE ord<=3;
 v_next:=jsonb_set(v_next,'{recent}',v_recent,true);
 -- Exactly one database transaction: if XP sync raises, state/revision roll back too.
 UPDATE public.connect_states SET state_data=v_next,revision=v_state.revision+1,updated_at=v_when
 WHERE student_id=p_student AND app_key=v_app;
 INSERT INTO public.connect_mixed_receipts(student_id,event_id,reset_epoch) VALUES(p_student,p_event,p_reset_epoch);
 v_xp:=public.connect_mixed_xp_sync_v1(p_student,v_app,false);
 RETURN jsonb_build_object('ok',true,'eventId',p_event::text,'appKey',v_app,'storageSubject',p_student::text,'duplicate',false,'revision',v_state.revision+1,
  'resetEpoch',v_state.reset_epoch,'state',v_next,'xp',v_xp);
end $function$
;

CREATE OR REPLACE FUNCTION public.connect_objective_record_school_issue_extended_v1(p_student uuid, p_class uuid, p_app text, p_mode text, p_level integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
 v_rev bigint:=0;v_epoch bigint:=0;v_previous record;
 v_width integer;v_terms_count integer;v_total constant integer:=120;
 v_i integer;v_j integer;v_len integer;v_num numeric;v_base numeric;
 v_addends jsonb;v_questions jsonb:='[]'::jsonb;
 v_session uuid;v_expires timestamptz;
BEGIN
 IF p_student IS NULL OR p_class IS NULL
  OR public.connect_objective_record_school_class_allowed_v1(p_class) IS DISTINCT FROM true
 THEN RAISE EXCEPTION 'school_class_not_allowed';END IF;
 IF p_app NOT IN ('addition-ecrite-simple','addition-ecrite-multiple')
  OR p_app IS NULL
  OR p_mode NOT IN ('sudden','three-lives','hard-sudden','hard-three-lives')
  OR p_mode IS NULL OR p_level NOT BETWEEN 1 AND 3 OR p_level IS NULL
 THEN RAISE EXCEPTION 'invalid_proof_configuration';END IF;
 PERFORM 1 FROM public.connect_students WHERE id=p_student AND archived_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'inactive_student';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.connect_enrollments
    WHERE student_id=p_student AND class_id=p_class AND left_at IS NULL)
 AND NOT EXISTS(SELECT 1 FROM public.connect_teacher_players tp
    JOIN public.connect_class_permissions cp ON cp.teacher_id=tp.teacher_id
    WHERE tp.student_id=p_student AND cp.class_id=p_class AND cp.can_manage=true)
 THEN RAISE EXCEPTION 'not_school_subject';END IF;
 v_width:=CASE WHEN p_mode LIKE 'hard-%' THEN
   CASE WHEN p_app='addition-ecrite-simple' THEN CASE p_level WHEN 1 THEN 10 WHEN 2 THEN 12 ELSE 16 END
   ELSE CASE p_level WHEN 1 THEN 9 WHEN 2 THEN 12 ELSE 14 END END
 ELSE CASE WHEN p_app='addition-ecrite-simple' THEN CASE p_level WHEN 1 THEN 3 WHEN 2 THEN 5 ELSE 7 END
   ELSE p_level+4 END END;
 SELECT coalesce(revision,0),coalesce(reset_epoch,0) INTO v_rev,v_epoch
  FROM public.connect_states WHERE student_id=p_student AND app_key=p_app;
 v_rev:=coalesce(v_rev,0);v_epoch:=coalesce(v_epoch,0);
 IF NOT public.connect_teacher_player_free_v1(p_student,p_class) AND p_mode IN ('three-lives','sudden')
  AND NOT public.connect_written_record_80_gate_v1(p_student,p_app,p_level)
  THEN RAISE EXCEPTION 'school_mode_locked'; END IF;
  SELECT * INTO v_previous FROM public.connect_objective_record_school_extended_sessions
 WHERE student_id=p_student AND class_id=p_class AND app_key=p_app
  AND mode=p_mode AND level=p_level AND consumed_at IS NULL
  AND expires_at>now() AND expected_revision=v_rev AND reset_epoch=v_epoch
 ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
 IF FOUND THEN RETURN jsonb_build_object('ok',true,'sessionId',v_previous.session_id,
    'questions',v_previous.questions,'level',p_level,'width',v_width,
    'mode',p_mode,'limit',v_total,'revision',v_rev,'resetEpoch',v_epoch,
    'expiresAt',v_previous.expires_at,'reused',true);END IF;
 FOR v_i IN 1..v_total LOOP
  v_terms_count:=CASE
    WHEN p_mode LIKE 'hard-%' AND p_app='addition-ecrite-simple' THEN 2
    WHEN p_mode LIKE 'hard-%' AND p_app='addition-ecrite-multiple' THEN CASE WHEN p_level=3 THEN 7 ELSE 6 END
    WHEN p_app='addition-ecrite-simple' THEN 2
    ELSE p_level+2+floor(random()*2)::integer END;
  v_addends:='[]'::jsonb;
  FOR v_j IN 1..v_terms_count LOOP
   v_len:=v_width-CASE WHEN v_j>2 AND random()<.48 THEN 1
                       WHEN v_j=2 AND p_app='addition-ecrite-simple' AND random()<.15 THEN 1
                       ELSE 0 END;
   v_base:=power(10::numeric,v_len-1);
   v_num:=v_base+floor(random()*9*v_base);
   v_addends:=v_addends||jsonb_build_array(v_num::text);
  END LOOP;
  v_questions:=v_questions||jsonb_build_array(jsonb_build_object(
   'id','q'||v_i,'op','add','width',v_width,'addends',v_addends));
 END LOOP;
 INSERT INTO public.connect_objective_record_school_extended_sessions(
  student_id,class_id,app_key,mode,level,width,total,expected_revision,
  reset_epoch,questions,expires_at)
 VALUES(p_student,p_class,p_app,p_mode,p_level,v_width,v_total,v_rev,v_epoch,
  v_questions,now()+interval '8 hours')
 RETURNING session_id,expires_at INTO v_session,v_expires;
 RETURN jsonb_build_object('ok',true,'sessionId',v_session,
  'questions',v_questions,'level',p_level,'width',v_width,
  'mode',p_mode,'limit',v_total,'revision',v_rev,'resetEpoch',v_epoch,
  'expiresAt',v_expires,'reused',false);
END $function$
;

CREATE OR REPLACE FUNCTION public.connect_objective_record_school_mul_issue_classic_v1(p_student uuid, p_class uuid, p_level integer, p_total integer, p_multipliers integer[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
 v_app constant text:='multiplication-ecrite-simple';
 v_rev bigint;v_epoch bigint;v_existing record;v_locked integer[];v_state jsonb;
 v_q jsonb:='[]'::jsonb;v_a integer;v_m integer;v_i integer;v_deck integer[];v_deck_at integer:=0;v_last_m integer;v_swap_m integer;
 v_width integer;v_len integer;v_base integer;
 v_id uuid;v_expires timestamptz;
BEGIN
 IF p_student IS NULL OR p_class IS NULL OR
    (p_class <> '4bf3400d-a315-4ea4-a2f3-afaca24dc9b9'::uuid
      AND public.connect_objective_record_school_class_allowed_v1(p_class) IS DISTINCT FROM true)
 THEN RAISE EXCEPTION 'school_class_not_allowed';END IF;
 IF p_level NOT IN (1,2,3) OR p_total NOT IN (4,10,20)
  OR p_level IS NULL OR p_total IS NULL OR p_multipliers IS NULL
  OR cardinality(p_multipliers) NOT BETWEEN 1 AND 8
  OR (SELECT count(DISTINCT n) FROM unnest(p_multipliers) n)<>cardinality(p_multipliers)
  OR EXISTS(SELECT 1 FROM unnest(p_multipliers) n WHERE n NOT BETWEEN 2 AND 9)
 THEN RAISE EXCEPTION 'invalid_proof_configuration';END IF;
 PERFORM 1 FROM public.connect_students WHERE id=p_student AND archived_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'inactive_student';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.connect_enrollments e
   WHERE e.student_id=p_student AND e.class_id=p_class AND e.left_at IS NULL)
 AND NOT EXISTS(SELECT 1 FROM public.connect_teacher_players tp
   JOIN public.connect_class_permissions cp ON cp.teacher_id=tp.teacher_id
   WHERE tp.student_id=p_student AND cp.class_id=p_class AND cp.can_manage=true)
 THEN RAISE EXCEPTION 'not_school_subject';END IF;
 SELECT multipliers INTO v_locked FROM public.connect_multiplier_locks
 WHERE class_id=p_class AND scope_key IN (p_student::text,'class')
 ORDER BY CASE WHEN scope_key=p_student::text THEN 0 ELSE 1 END LIMIT 1;
 IF v_locked IS NOT NULL AND NOT(v_locked <@ p_multipliers)
 THEN RAISE EXCEPTION 'multipliers_not_allowed';END IF;
 SELECT coalesce(revision,0),coalesce(reset_epoch,0),state_data INTO v_rev,v_epoch,v_state
 FROM public.connect_states WHERE student_id=p_student AND app_key=v_app;
 IF NOT public.connect_teacher_player_free_v1(p_student,p_class) AND p_class <> '4bf3400d-a315-4ea4-a2f3-afaca24dc9b9'::uuid AND p_level>1
  AND coalesce((v_state#>>ARRAY['progress','level'||p_level])::boolean,false)=false
 THEN RAISE EXCEPTION 'school_mode_locked';END IF;
 v_rev:=coalesce(v_rev,0);v_epoch:=coalesce(v_epoch,0);
 SELECT * INTO v_existing FROM public.connect_objective_record_school_proof_sessions
 WHERE student_id=p_student AND class_id=p_class AND app_key=v_app
  AND expected_revision=v_rev AND reset_epoch=v_epoch AND level=p_level AND total=p_total
  AND consumed_at IS NULL AND expires_at>now()
  AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(questions) q
    WHERE (q->>'m')::integer <> ALL(p_multipliers))
 ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
 IF FOUND THEN RETURN jsonb_build_object('ok',true,'sessionId',v_existing.session_id,
    'revision',v_rev,'resetEpoch',v_epoch,'level',p_level,'total',p_total,
    'questions',v_existing.questions,'expiresAt',v_existing.expires_at,'reused',true);
 END IF;
 v_width:=CASE p_level WHEN 1 THEN 3 WHEN 2 THEN 5 ELSE 7 END;
 FOR v_i IN 1..p_total LOOP
  v_len:=v_width-CASE WHEN random()<0.15 THEN 1 ELSE 0 END;
  v_base:=power(10::numeric,v_len-1)::integer;
  v_a:=v_base+floor(random()*9*v_base)::integer;
  -- Tirer chaque multiplicateur une fois par paquet mélangé, sans doublon consécutif.
   IF v_deck IS NULL OR v_deck_at>=cardinality(v_deck) THEN
    SELECT array_agg(t.n ORDER BY random()) INTO v_deck FROM unnest(p_multipliers) AS t(n);
    IF cardinality(v_deck)>1 AND v_last_m IS NOT NULL AND v_deck[1]=v_last_m THEN
     v_swap_m:=v_deck[1];v_deck[1]:=v_deck[2];v_deck[2]:=v_swap_m;
    END IF;
    v_deck_at:=0;
   END IF;
   v_deck_at:=v_deck_at+1;
   v_m:=v_deck[v_deck_at];v_last_m:=v_m;
  v_q:=v_q||jsonb_build_array(jsonb_build_object(
    'id','q'||v_i,'op','mul','a',v_a::text,'m',v_m,'width',v_len));
 END LOOP;
 INSERT INTO public.connect_objective_record_school_proof_sessions(
 student_id,class_id,app_key,expected_revision,reset_epoch,level,total,questions,expires_at)
 VALUES(p_student,p_class,v_app,v_rev,v_epoch,p_level,p_total,v_q,now()+interval '90 minutes')
 RETURNING session_id,expires_at INTO v_id,v_expires;
 RETURN jsonb_build_object('ok',true,'sessionId',v_id,'revision',v_rev,
  'resetEpoch',v_epoch,'level',p_level,'total',p_total,
  'questions',v_q,'expiresAt',v_expires,'reused',false);
END $function$
;

CREATE OR REPLACE FUNCTION public.connect_objective_record_school_mul_issue_extended_v1(p_student uuid, p_class uuid, p_mode text, p_level integer, p_multipliers integer[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
 v_app constant text:='multiplication-ecrite-simple';
 v_total constant integer:=120;
 v_rev bigint;v_epoch bigint;v_existing record;v_locked integer[];
 v_questions jsonb:='[]'::jsonb;v_a numeric;v_m integer;v_i integer;v_deck integer[];v_deck_at integer:=0;v_last_m integer;v_swap_m integer;
 v_width integer;v_len integer;v_base numeric;
 v_id uuid;v_expires timestamptz;v_state jsonb;
BEGIN
 IF p_student IS NULL OR p_class IS NULL OR
    (p_class <> '4bf3400d-a315-4ea4-a2f3-afaca24dc9b9'::uuid
     AND public.connect_objective_record_school_class_allowed_v1(p_class) IS DISTINCT FROM true)
 THEN RAISE EXCEPTION 'school_class_not_allowed';END IF;
 IF p_mode NOT IN ('three-lives','sudden','hard-three-lives','hard-sudden')
  OR p_mode IS NULL OR p_level NOT IN (1,2,3) OR p_level IS NULL
  OR p_multipliers IS NULL OR cardinality(p_multipliers) NOT BETWEEN 1 AND 8
  OR (SELECT count(DISTINCT n) FROM unnest(p_multipliers) n)<>cardinality(p_multipliers)
  OR EXISTS(SELECT 1 FROM unnest(p_multipliers) n WHERE n NOT BETWEEN 2 AND 9)
  OR (p_mode LIKE 'hard-%' AND p_multipliers<>ARRAY[2,3,4,5,6,7,8,9])
 THEN RAISE EXCEPTION 'invalid_proof_configuration';END IF;
 PERFORM 1 FROM public.connect_students WHERE id=p_student AND archived_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'inactive_student';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.connect_enrollments e
   WHERE e.student_id=p_student AND e.class_id=p_class AND e.left_at IS NULL)
 AND NOT EXISTS(SELECT 1 FROM public.connect_teacher_players tp
   JOIN public.connect_class_permissions cp ON cp.teacher_id=tp.teacher_id
   WHERE tp.student_id=p_student AND cp.class_id=p_class AND cp.can_manage=true)
 THEN RAISE EXCEPTION 'not_school_subject';END IF;
 SELECT multipliers INTO v_locked FROM public.connect_multiplier_locks
 WHERE class_id=p_class AND scope_key IN(p_student::text,'class')
 ORDER BY CASE WHEN scope_key=p_student::text THEN 0 ELSE 1 END LIMIT 1;
 IF v_locked IS NOT NULL AND NOT(v_locked <@ p_multipliers)
 THEN RAISE EXCEPTION 'multipliers_not_allowed';END IF;
 SELECT coalesce(revision,0),coalesce(reset_epoch,0),state_data INTO v_rev,v_epoch,v_state
 FROM public.connect_states WHERE student_id=p_student AND app_key=v_app;
 v_rev:=coalesce(v_rev,0);v_epoch:=coalesce(v_epoch,0);v_state:=coalesce(v_state,'{}'::jsonb);
 -- Existing school modes stay locked until authentic Connect results unlock them.
 -- Keep the TEST class available for isolated certification scenarios.
 IF NOT public.connect_teacher_player_free_v1(p_student,p_class) AND p_class <> '4bf3400d-a315-4ea4-a2f3-afaca24dc9b9'::uuid THEN
  IF p_mode LIKE 'hard-%' THEN
   IF (v_state#>>'{progress,hard}')::boolean IS DISTINCT FROM true
   OR (p_level>1 AND coalesce((v_state#>>ARRAY['hard',(p_level-2)::text])::integer,0)<3)
   THEN RAISE EXCEPTION 'school_mode_locked';END IF;
  ELSE
   IF (v_state#>>ARRAY['progress','sudden'||p_level])::boolean IS DISTINCT FROM true
   THEN RAISE EXCEPTION 'school_mode_locked';END IF;
  END IF;
 END IF;
 IF NOT public.connect_teacher_player_free_v1(p_student,p_class) AND p_mode IN ('three-lives','sudden')
  AND NOT public.connect_written_record_80_gate_v1(p_student,v_app,p_level)
  THEN RAISE EXCEPTION 'school_mode_locked'; END IF;
  SELECT * INTO v_existing FROM public.connect_objective_record_school_extended_sessions
 WHERE student_id=p_student AND class_id=p_class AND app_key=v_app
  AND mode=p_mode AND level=p_level AND consumed_at IS NULL
  AND expected_revision=v_rev AND reset_epoch=v_epoch AND expires_at>now()
  AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(questions) q
    WHERE (q->>'m')::integer <> ALL(p_multipliers))
 ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
 IF FOUND THEN RETURN jsonb_build_object('ok',true,'sessionId',v_existing.session_id,
   'questions',v_existing.questions,'level',p_level,'width',v_existing.width,
   'mode',p_mode,'limit',v_total,'revision',v_rev,'resetEpoch',v_epoch,
   'expiresAt',v_existing.expires_at,'reused',true);
 END IF;
 v_width:=CASE WHEN p_mode LIKE 'hard-%' THEN
  CASE p_level WHEN 1 THEN 10 WHEN 2 THEN 12 ELSE 16 END
 ELSE CASE p_level WHEN 1 THEN 3 WHEN 2 THEN 5 ELSE 7 END END;
 FOR v_i IN 1..v_total LOOP
  v_len:=v_width-CASE WHEN random()<0.15 THEN 1 ELSE 0 END;
  v_base:=power(10::numeric,v_len-1);
  v_a:=v_base+floor(random()*9*v_base);
  -- Tirer chaque multiplicateur une fois par paquet mélangé, sans doublon consécutif.
   IF v_deck IS NULL OR v_deck_at>=cardinality(v_deck) THEN
    SELECT array_agg(t.n ORDER BY random()) INTO v_deck FROM unnest(p_multipliers) AS t(n);
    IF cardinality(v_deck)>1 AND v_last_m IS NOT NULL AND v_deck[1]=v_last_m THEN
     v_swap_m:=v_deck[1];v_deck[1]:=v_deck[2];v_deck[2]:=v_swap_m;
    END IF;
    v_deck_at:=0;
   END IF;
   v_deck_at:=v_deck_at+1;
   v_m:=v_deck[v_deck_at];v_last_m:=v_m;
  v_questions:=v_questions||jsonb_build_array(jsonb_build_object(
    'id','q'||v_i,'op','mul','a',v_a::text,'m',v_m,'width',v_len));
 END LOOP;
 INSERT INTO public.connect_objective_record_school_extended_sessions(
 student_id,class_id,app_key,mode,level,width,total,expected_revision,
 reset_epoch,questions,expires_at)
 VALUES(p_student,p_class,v_app,p_mode,p_level,v_width,v_total,v_rev,
  v_epoch,v_questions,now()+interval '8 hours')
 RETURNING session_id,expires_at INTO v_id,v_expires;
 RETURN jsonb_build_object('ok',true,'sessionId',v_id,'questions',v_questions,
  'level',p_level,'width',v_width,'mode',p_mode,'limit',v_total,
  'revision',v_rev,'resetEpoch',v_epoch,'expiresAt',v_expires,'reused',false);
END $function$
;

CREATE OR REPLACE FUNCTION public.connect_objective_record_school_sub_issue_extended_v1(p_student uuid, p_class uuid, p_mode text, p_level integer, p_method text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
 v_app constant text:='soustraction-ecrite-simple';
 v_total constant integer:=120;
 v_rev bigint;v_epoch bigint;v_existing record;
 v_questions jsonb:='[]'::jsonb;v_a numeric;v_b numeric;v_i integer;
 v_width integer;v_len integer;v_base numeric;
 v_id uuid;v_expires timestamptz;v_state jsonb;
BEGIN
 IF p_student IS NULL OR p_class IS NULL OR
    (p_class <> '4bf3400d-a315-4ea4-a2f3-afaca24dc9b9'::uuid
     AND public.connect_objective_record_school_class_allowed_v1(p_class) IS DISTINCT FROM true)
 THEN RAISE EXCEPTION 'school_class_not_allowed';END IF;
 IF p_mode NOT IN ('three-lives','sudden','hard-three-lives','hard-sudden')
  OR p_mode IS NULL OR p_level NOT IN (1,2,3) OR p_level IS NULL
  OR p_method NOT IN ('addBottom','takeTop') OR p_method IS NULL
 THEN RAISE EXCEPTION 'invalid_proof_configuration';END IF;
 PERFORM 1 FROM public.connect_students WHERE id=p_student AND archived_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'inactive_student';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.connect_enrollments e
   WHERE e.student_id=p_student AND e.class_id=p_class AND e.left_at IS NULL)
 AND NOT EXISTS(SELECT 1 FROM public.connect_teacher_players tp
   JOIN public.connect_class_permissions cp ON cp.teacher_id=tp.teacher_id
   WHERE tp.student_id=p_student AND cp.class_id=p_class AND cp.can_manage=true)
 THEN RAISE EXCEPTION 'not_school_subject';END IF;
 SELECT coalesce(revision,0),coalesce(reset_epoch,0),state_data INTO v_rev,v_epoch,v_state
 FROM public.connect_states WHERE student_id=p_student AND app_key=v_app;
 v_rev:=coalesce(v_rev,0);v_epoch:=coalesce(v_epoch,0);
 v_state:=coalesce(v_state,'{}'::jsonb);
 IF NOT public.connect_teacher_player_free_v1(p_student,p_class) AND p_class <> '4bf3400d-a315-4ea4-a2f3-afaca24dc9b9'::uuid THEN
  IF p_mode LIKE 'hard-%' THEN
   IF (v_state#>>'{progress,hard}')::boolean IS DISTINCT FROM true
   THEN RAISE EXCEPTION 'school_mode_locked';END IF;
  ELSE
   IF (v_state#>>ARRAY['progress','sudden'||p_level])::boolean IS DISTINCT FROM true
   THEN RAISE EXCEPTION 'school_mode_locked';END IF;
  END IF;
 END IF;
 IF NOT public.connect_teacher_player_free_v1(p_student,p_class) AND p_mode IN ('three-lives','sudden')
  AND NOT public.connect_written_record_80_gate_v1(p_student,v_app,p_level)
  THEN RAISE EXCEPTION 'school_mode_locked'; END IF;
  SELECT * INTO v_existing FROM public.connect_objective_record_school_extended_sessions
 WHERE student_id=p_student AND class_id=p_class AND app_key=v_app
  AND mode=p_mode AND level=p_level AND consumed_at IS NULL
  AND expected_revision=v_rev AND reset_epoch=v_epoch AND expires_at>now()
  AND (questions->0->>'method')=p_method
 ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
 IF FOUND THEN RETURN jsonb_build_object('ok',true,'sessionId',v_existing.session_id,
   'questions',v_existing.questions,'level',p_level,'width',v_existing.width,
   'mode',p_mode,'method',p_method,'limit',v_total,'revision',v_rev,'resetEpoch',v_epoch,
   'expiresAt',v_existing.expires_at,'reused',true);END IF;
 v_width:=CASE WHEN p_mode LIKE 'hard-%' THEN
  CASE p_level WHEN 1 THEN 10 WHEN 2 THEN 12 ELSE 16 END
 ELSE CASE p_level WHEN 1 THEN 3 WHEN 2 THEN 5 ELSE 7 END END;
 FOR v_i IN 1..v_total LOOP
  v_len:=v_width-CASE WHEN random()<0.15 THEN 1 ELSE 0 END;
  v_base:=power(10::numeric,v_len-1);
  v_a:=v_base+floor(random()*9*v_base);
  v_b:=greatest(1,floor(random()*v_a));
  v_questions:=v_questions||jsonb_build_array(jsonb_build_object(
    'id','q'||v_i,'op','sub','a',v_a::text,'b',v_b::text,
    'method',p_method,'width',v_len));
 END LOOP;
 INSERT INTO public.connect_objective_record_school_extended_sessions(
 student_id,class_id,app_key,mode,level,width,total,expected_revision,
 reset_epoch,questions,expires_at)
 VALUES(p_student,p_class,v_app,p_mode,p_level,v_width,v_total,v_rev,
  v_epoch,v_questions,now()+interval '8 hours')
 RETURNING session_id,expires_at INTO v_id,v_expires;
 RETURN jsonb_build_object('ok',true,'sessionId',v_id,'questions',v_questions,
  'level',p_level,'width',v_width,'mode',p_mode,'method',p_method,'limit',v_total,
  'revision',v_rev,'resetEpoch',v_epoch,'expiresAt',v_expires,'reused',false);
END $function$
;