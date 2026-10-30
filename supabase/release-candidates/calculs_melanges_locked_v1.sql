-- OFFLINE CANDIDATE. Never run against hosted Supabase without a separate approval.
-- Additive new RPC names: does NOT replace existing applications' functions.
-- Shared existing RPC fingerprints/allowlists are therefore left untouched.
BEGIN;
DO $preflight$
BEGIN
 IF EXISTS(SELECT 1 FROM public.connect_states WHERE app_key='melange-calculs-ecrits')
 OR EXISTS(SELECT 1 FROM public.connect_xp_credits WHERE app_key='melange-calculs-ecrits')
 OR EXISTS(SELECT 1 FROM public.connect_xp_milestones WHERE app_key='melange-calculs-ecrits')
 OR EXISTS(SELECT 1 FROM public.connect_parcours_current WHERE app_key='melange-calculs-ecrits')
 OR EXISTS(SELECT 1 FROM public.connect_parcours_history WHERE app_key='melange-calculs-ecrits')
 OR EXISTS(SELECT 1 FROM public.connect_parcours_xp_bonus WHERE app_key='melange-calculs-ecrits')
 OR EXISTS(SELECT 1 FROM public.connect_apps WHERE app_key='melange-calculs-ecrits')
 OR EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname LIKE 'connect_mixed_%')
 OR to_regclass('public.connect_mixed_receipts') IS NOT NULL
 THEN RAISE EXCEPTION 'mixed_already_exists_review_required';END IF;
 IF to_regclass('public.connect_states') IS NULL OR to_regclass('public.connect_parcours_xp_bonus') IS NULL
 THEN RAISE EXCEPTION 'mixed_missing_schema';END IF;
END $preflight$;
INSERT INTO public.connect_apps(app_key,title,launch_url,image_url,enabled,hub_section,featured,display_order)
VALUES('melange-calculs-ecrits','Calculs écrits mélangés',
'https://mr-tat.github.io/Mathas-Connect/apps/calculs-melanges/',
'https://mr-tat.github.io/Mathas-Connect/assets/miniatures/melange-calculs-ecrits.webp',false,'calculs_ecrits',false,60);
INSERT INTO public.connect_hub_preset_entries(preset_slug,app_key,section,display_order,visible,featured)
SELECT s,'melange-calculs-ecrits','calculs_ecrits',60,false,false FROM unnest(ARRAY['observation','phase1','phase2','2eco']) s;
INSERT INTO public.connect_xp_award_rules(app_key,award_key,points) VALUES
('melange-calculs-ecrits','classic:4:perfect',28),
('melange-calculs-ecrits','classic:10:pass',38),
('melange-calculs-ecrits','classic:10:bonus',8),
('melange-calculs-ecrits','classic:20:pass',63),
('melange-calculs-ecrits','classic:20:bonus',13),
('melange-calculs-ecrits','sudden:5',12),
('melange-calculs-ecrits','sudden:10',12),
('melange-calculs-ecrits','hard:3',12),
('melange-calculs-ecrits','hard:7',12);
-- Deliberately independent from multiplication-simple's class/student locks.
CREATE TABLE public.connect_mixed_multiplier_locks(
 class_id uuid NOT NULL,scope_key text NOT NULL,multipliers integer[] NOT NULL,
 PRIMARY KEY(class_id,scope_key),CHECK(cardinality(multipliers) BETWEEN 1 AND 8 AND multipliers <@ ARRAY[2,3,4,5,6,7,8,9])
);
ALTER TABLE public.connect_mixed_multiplier_locks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.connect_mixed_multiplier_locks FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.connect_mixed_multiplier_locks TO service_role;
CREATE TABLE public.connect_mixed_receipts(
 student_id uuid NOT NULL REFERENCES public.connect_students(id) ON DELETE CASCADE,event_id uuid NOT NULL,
 reset_epoch bigint NOT NULL CHECK(reset_epoch>=0),created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(student_id,event_id)
);
ALTER TABLE public.connect_mixed_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.connect_mixed_receipts FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.connect_mixed_receipts TO service_role;
CREATE FUNCTION public.connect_mixed_restart_class_v1(p_teacher uuid, p_class uuid, p_app text, p_repeat_xp boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare member record; n integer:=0; details jsonb:='[]'::jsonb;
begin
 if p_app NOT IN ('melange-calculs-ecrits') or p_teacher is null or p_class is null then raise exception 'invalid_params';end if;
 if not exists(select 1 from public.connect_class_permissions where teacher_id=p_teacher and class_id=p_class and can_manage=true) then raise exception 'forbidden';end if;
 for member in select distinct s.id from public.connect_students s join public.connect_enrollments e on e.student_id=s.id
 where s.archived_at is null and e.class_id=p_class and e.left_at is null order by s.id loop
  details:=details||public.connect_mixed_restart_one_v1(p_teacher,p_class,member.id,p_app,p_repeat_xp);
  n:=n+1;
 end loop;
 return jsonb_build_object('ok',true,'count',n,'classId',p_class,'xpReplay',coalesce(p_repeat_xp,false));
end $function$
;
CREATE FUNCTION public.connect_mixed_restart_one_v1(p_teacher uuid, p_class uuid, p_student uuid, p_app text, p_repeat_xp boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare previous_number integer:=1; previous_repeat boolean:=false; state_old jsonb:='{}'::jsonb;
 prev_xp integer:=0; next_number integer; old_rec record;
begin
 if p_app NOT IN ('melange-calculs-ecrits') or p_teacher is null or p_student is null or p_class is null then raise exception 'invalid_params';end if;
 if not exists(select 1 from public.connect_class_permissions where teacher_id=p_teacher and class_id=p_class and can_manage=true) then raise exception 'forbidden';end if;
 perform 1 from public.connect_students s join public.connect_enrollments e on e.student_id=s.id
 where s.id=p_student and s.archived_at is null and e.class_id=p_class and e.left_at is null for update of s;
 if not found then raise exception 'student_not_enrolled';end if;
 select parcours_number,repeat_xp into old_rec from public.connect_parcours_current where student_id=p_student and app_key=p_app for update;
 if found then previous_number:=old_rec.parcours_number;previous_repeat:=old_rec.repeat_xp;end if;
 if previous_number>=10000 then raise exception 'too_many_parcours';end if;
 select state_data into state_old from public.connect_states where student_id=p_student and app_key=p_app for update;
 state_old:=coalesce(state_old,'{}'::jsonb);
 -- Créditer toute réussite enregistrée AVANT d'archiver et de recommencer.
 perform public.connect_mixed_xp_sync_v1(p_student,p_app,false);
 -- xp_credited inclut déjà les bonus de rejeu : ne surtout pas les additionner deux fois.
 select coalesce(sum(xp_credited),0) into prev_xp from public.connect_xp_credits where student_id=p_student and app_key=p_app;
 insert into public.connect_parcours_history(student_id,app_key,parcours_number,class_id,repeat_xp,state_data,archived_xp)
 values(p_student,p_app,previous_number,p_class,previous_repeat,state_old,coalesce(prev_xp,0));
 next_number:=previous_number+1;
 insert into public.connect_parcours_current(student_id,app_key,parcours_number,repeat_xp,started_at)
 values(p_student,p_app,next_number,coalesce(p_repeat_xp,false),now())
 on conflict(student_id,app_key) do update set parcours_number=excluded.parcours_number,repeat_xp=excluded.repeat_xp,started_at=excluded.started_at;
 insert into public.connect_states(student_id,app_key,schema_version,revision,reset_epoch,state_data,updated_at)
 values(p_student,p_app,1,1,1,'{}'::jsonb,now())
 on conflict(student_id,app_key) do update
 set revision=connect_states.revision+1,reset_epoch=connect_states.reset_epoch+1,
 state_data='{}'::jsonb,updated_at=now();
 return jsonb_build_object('ok',true,'studentId',p_student,'parcours',next_number,'xpReplay',coalesce(p_repeat_xp,false),'archived',previous_number);
end $function$
;
CREATE FUNCTION public.connect_mixed_xp_read_v1(p_student uuid, p_app text, p_include_milestones boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE st_changed timestamptz; xp_changed timestamptz; points integer; total_points integer; lvl integer; earned jsonb := '[]'::jsonb; apps jsonb; parcours integer:=1; can_repeat boolean:=false; replay_earned jsonb:='[]'::jsonb;
BEGIN
 IF p_app NOT IN ('melange-calculs-ecrits') THEN RAISE EXCEPTION 'not_integrated'; END IF;
 PERFORM 1 FROM public.connect_students WHERE id=p_student AND archived_at IS NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'inactive_student'; END IF;
 SELECT updated_at INTO st_changed FROM public.connect_states WHERE student_id=p_student AND app_key=p_app;
 SELECT updated_at INTO xp_changed FROM public.connect_xp_credits WHERE student_id=p_student AND app_key=p_app;
 IF st_changed IS NOT NULL AND (xp_changed IS NULL OR xp_changed < st_changed) THEN
  PERFORM public.connect_mixed_xp_sync_v1(p_student,p_app,false);
 END IF;
 SELECT coalesce(sum(xp_credited),0)::integer,coalesce(max(xp_credited) FILTER (WHERE app_key=p_app),0),
 coalesce(jsonb_agg(jsonb_build_object('app_key',app_key,'xp_credited',xp_credited)),'[]'::jsonb)
 INTO total_points,points,apps FROM public.connect_xp_credits WHERE student_id=p_student;
 lvl := CASE WHEN total_points<300 THEN 1+total_points/50 ELSE 7+(total_points-300)/100 END;
 select parcours_number,repeat_xp into parcours,can_repeat from public.connect_parcours_current where student_id=p_student and app_key=p_app;
 parcours:=coalesce(parcours,1);can_repeat:=coalesce(can_repeat,false);
 IF p_include_milestones THEN
 SELECT coalesce(jsonb_agg(milestone_key ORDER BY milestone_key),'[]'::jsonb) INTO earned
 FROM public.connect_xp_milestones WHERE student_id=p_student AND app_key=p_app;
 SELECT coalesce(jsonb_agg(milestone_key ORDER BY milestone_key),'[]'::jsonb) INTO replay_earned FROM public.connect_parcours_xp_bonus WHERE student_id=p_student AND app_key=p_app AND parcours_number=parcours;
 END IF;
 RETURN jsonb_build_object('active',true,'total',total_points,'appXp',points,'level',lvl,
 'next',CASE WHEN lvl<7 THEN lvl*50 ELSE 300+(lvl-6)*100 END,'apps',apps,'milestones',earned,'currentMilestones',replay_earned,'parcours',parcours,'repeatXp',can_repeat,'max',594);
END $function$
;
CREATE FUNCTION public.connect_mixed_xp_sync_v1(p_student uuid, p_app text, p_force boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare s jsonb; i int; n int; score int; best int; k text; added int:=0; beforexp int:=0; afterxp int:=0; totalxp int:=0; levelnow int; priorlevel int:=1; rulesversion int:=1; replay int:=1; repeated boolean:=false; rec record; earned boolean; bonusxp int:=0;
begin
 if p_app NOT IN ('melange-calculs-ecrits') then raise exception 'not_integrated';end if;
 perform 1 from public.connect_students where id=p_student and archived_at is null for update;
 if not found then raise exception 'inactive_student';end if;
 select coalesce(state_data->'eligible','{}'::jsonb) into s from public.connect_states where student_id=p_student and app_key=p_app;
 s:=coalesce(s,'{}'::jsonb);
 select coalesce(xp_credited,0) into beforexp from public.connect_xp_credits where student_id=p_student and app_key=p_app;
 beforexp:=coalesce(beforexp,0);
 select parcours_number,repeat_xp into replay,repeated from public.connect_parcours_current where student_id=p_student and app_key=p_app;
 replay:=coalesce(replay,1);repeated:=coalesce(repeated,false);
 for i in 0..2 loop
  for n in select unnest(array[4,10,20]) loop
   score=coalesce((s#>>array['classic',i::text,n::text])::int,-1);
   if n=4 and score=4 then
    k='classic:'||(i+1)||':4:perfect';
    insert into public.connect_xp_milestones(student_id,app_key,milestone_key,evidence) values(p_student,p_app,k,jsonb_build_object('source','record','score',score,'firstParcours',replay)) on conflict do nothing;
   elsif n in (10,20) then
    if score*5>=n*4 then
     k='classic:'||(i+1)||':'||n||':pass';
     insert into public.connect_xp_milestones(student_id,app_key,milestone_key,evidence) values(p_student,p_app,k,jsonb_build_object('source','record','score',score,'firstParcours',replay)) on conflict do nothing;
    end if;
    if score=n then
     k='classic:'||(i+1)||':'||n||':bonus';
     insert into public.connect_xp_milestones(student_id,app_key,milestone_key,evidence) values(p_student,p_app,k,jsonb_build_object('source','record','score',score,'firstParcours',replay)) on conflict do nothing;
    end if;
   end if;
  end loop;
  score=coalesce((s#>>array['sudden',i::text])::int,0);
  for n in select unnest(array[5,10]) loop
   if (s#>>array['thresholds','sudden',i::text,n::text])::boolean IS TRUE then
    k='sudden:'||(i+1)||':'||n;
    insert into public.connect_xp_milestones(student_id,app_key,milestone_key,evidence) values(p_student,p_app,k,jsonb_build_object('source','record','score',score,'firstParcours',replay)) on conflict do nothing;
   end if;
  end loop;
  score=coalesce((s#>>array['hard',i::text])::int,0);
  for n in select unnest(array[3,7]) loop
   if (s#>>array['thresholds','hard',i::text,n::text])::boolean IS TRUE then
    k='hard:'||(i+1)||':'||n;
    insert into public.connect_xp_milestones(student_id,app_key,milestone_key,evidence) values(p_student,p_app,k,jsonb_build_object('source','record','score',score,'firstParcours',replay)) on conflict do nothing;
   end if;
  end loop;
 end loop;
 select coalesce(sum(r.points),0) into afterxp
 from public.connect_xp_milestones m join public.connect_xp_award_rules r on r.app_key=m.app_key and (
 r.award_key = concat_ws(':',split_part(m.milestone_key,':',1),split_part(m.milestone_key,':',3),nullif(split_part(m.milestone_key,':',4),''))
 )
 where m.student_id=p_student and m.app_key=p_app;
 if afterxp>594 then raise exception 'xp_cap';end if;
 if repeated and replay>=2 then
  for rec in select m.milestone_key,r.points from public.connect_xp_milestones m join public.connect_xp_award_rules r
    on r.app_key=m.app_key and r.award_key=concat_ws(':',split_part(m.milestone_key,':',1),split_part(m.milestone_key,':',3),nullif(split_part(m.milestone_key,':',4),''))
   where m.student_id=p_student and m.app_key=p_app
     and coalesce((m.evidence->>'firstParcours')::int,1)<replay loop
    earned:=false;i:=split_part(rec.milestone_key,':',2)::int-1;n:=split_part(rec.milestone_key,':',3)::int;
    if split_part(rec.milestone_key,':',1)='classic' then
      score:=coalesce((s#>>array['classic',i::text,n::text])::int,-1);
      if n=4 then earned:=score=4;
      elsif n in(10,20) then earned:=case when split_part(rec.milestone_key,':',4)='bonus' then score=n else score*5>=n*4 end;end if;
    elsif split_part(rec.milestone_key,':',1)='sudden' then earned:=(s#>>array['thresholds','sudden',i::text,n::text])::boolean IS TRUE;
    elsif split_part(rec.milestone_key,':',1)='hard' then earned:=(s#>>array['thresholds','hard',i::text,n::text])::boolean IS TRUE;end if;
    if earned then insert into public.connect_parcours_xp_bonus(student_id,app_key,parcours_number,milestone_key,points)
    values(p_student,p_app,replay,rec.milestone_key,rec.points) on conflict do nothing;end if;
  end loop;
 end if;
 select coalesce(sum(points),0) into bonusxp from public.connect_parcours_xp_bonus where student_id=p_student and app_key=p_app;
 afterxp:=afterxp+bonusxp;
 insert into public.connect_xp_credits(student_id,app_key,xp_credited,evidence,ruleset_version,updated_at)
 values(p_student,p_app,afterxp,jsonb_build_object('milestones',true,'count',(select count(*) from public.connect_xp_milestones where student_id=p_student and app_key=p_app)),rulesversion,now())
 on conflict(student_id,app_key) do update set xp_credited=excluded.xp_credited,evidence=excluded.evidence,ruleset_version=excluded.ruleset_version,updated_at=now();
 select coalesce(sum(xp_credited),0) into totalxp from public.connect_xp_credits where student_id=p_student;
 levelnow=case when totalxp<300 then 1+(totalxp/50) else 7+((totalxp-300)/100) end;
 select coalesce(highest_level_reached,1) into priorlevel from public.connect_level_profiles where student_id=p_student;
 priorlevel=coalesce(priorlevel,1);
 insert into public.connect_level_profiles(student_id,highest_level_reached,level_ruleset_version,updated_at)
 values(p_student,levelnow,2,now())
 on conflict(student_id) do update set highest_level_reached=excluded.highest_level_reached,level_ruleset_version=2,updated_at=now();
 return jsonb_build_object('appXp',afterxp,'delta',afterxp-beforexp,'total',totalxp,'level',levelnow,'previousLevel',priorlevel,'next',case when levelnow<7 then levelnow*50 else 300+(levelnow-6)*100 end,'active',true,'rulesetVersion',1);
end $function$
;

CREATE FUNCTION public.connect_mixed_record_v1(
 p_student uuid,p_event uuid,p_expected_revision bigint,p_reset_epoch bigint,
 p_mode text,p_level integer,p_score integer,p_total integer DEFAULT NULL,
 p_rewards jsonb DEFAULT NULL,
 p_selected jsonb DEFAULT NULL,p_completed jsonb DEFAULT NULL,p_first jsonb DEFAULT NULL,
 p_aid boolean DEFAULT NULL,p_master boolean DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp'
AS $atomic$
DECLARE
 v_app constant text:='melange-calculs-ecrits';
 v_state public.connect_states%ROWTYPE;
 v_next jsonb;v_ids jsonb;v_recent jsonb;v_event jsonb;
 v_old integer;v_xp jsonb;v_when timestamptz:=now();v_i integer;
 v_aids jsonb; v_aid_path text[]; v_proof jsonb; v_eligible jsonb; v_distinct integer; v_threshold integer;
 v_rewards jsonb;v_key text;v_path text[];v_old_flag boolean;v_new_flag boolean;
BEGIN
 IF p_student IS NULL OR p_event IS NULL OR p_expected_revision IS NULL OR p_expected_revision<0
 OR p_reset_epoch IS NULL OR p_reset_epoch<0
 OR p_level IS NULL OR p_level NOT BETWEEN 1 AND 3 OR p_score IS NULL OR p_score<0 OR p_score>1000
 OR p_mode IS NULL OR p_mode NOT IN ('classic','sudden','hard')
 OR (p_mode='classic' AND (p_total IS NULL OR p_total NOT IN (4,10,20) OR p_score>p_total))
 OR (p_mode IN ('sudden','hard') AND p_total IS NOT NULL)
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
 OR (p_mode='hard' AND jsonb_array_length(p_selected)<>3)
 OR (p_mode='classic' AND (jsonb_array_length(p_completed)<>p_total OR
     (SELECT count(*) FROM jsonb_array_elements(p_first) a(v) WHERE v='true'::jsonb)<>p_score))
 OR (p_mode IN ('sudden','hard') AND (jsonb_array_length(p_completed)<>p_score OR p_first @> '[false]'::jsonb))
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
 IF jsonb_typeof(v_next->'classic') IS DISTINCT FROM 'array'
 THEN v_next:=jsonb_set(v_next,'{classic}','[{}, {}, {}]'::jsonb,true);END IF;
 IF jsonb_typeof(v_next->'sudden') IS DISTINCT FROM 'array'
 THEN v_next:=jsonb_set(v_next,'{sudden}','[null,null,null]'::jsonb,true);END IF;
 IF jsonb_typeof(v_next->'hard') IS DISTINCT FROM 'array'
 THEN v_next:=jsonb_set(v_next,'{hard}','[null,null,null]'::jsonb,true);END IF;
 IF jsonb_typeof(v_next->'progress') IS DISTINCT FROM 'object'
 THEN v_next:=jsonb_set(v_next,'{progress}','{}'::jsonb,true);END IF;
 v_i:=p_level-1;
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
  v_old:=coalesce((v_next#>>ARRAY[p_mode,v_i::text])::int,0);
  v_next:=jsonb_set(v_next,ARRAY[p_mode,v_i::text],to_jsonb(greatest(v_old,p_score)),true);
 END IF;
 -- Preserve the aid marker of the native best, including a better equal-score no-aid attempt.
 v_aids:=coalesce(v_next->'recordAid','{"classic":[{},{},{}],"sudden":[null,null,null],"hard":[null,null,null]}'::jsonb);
 v_aid_path:=CASE WHEN p_mode='classic' THEN ARRAY['classic',(p_level-1)::text,p_total::text] ELSE ARRAY[p_mode,(p_level-1)::text] END;
 IF v_aids#>v_aid_path IS NULL OR v_aids#>v_aid_path='null'::jsonb OR p_score>v_old OR (p_score=v_old AND NOT p_aid) THEN
  v_aids:=jsonb_set(v_aids,v_aid_path,to_jsonb(p_aid),true);
 END IF;
 v_next:=jsonb_set(v_next,'{recordAid}',v_aids,true);
 -- Independent XP record tree: a higher ineligible score cannot erase eligible evidence.
 v_eligible:=coalesce(v_next->'eligible','{"classic":[{},{},{}],"sudden":[0,0,0],"hard":[0,0,0],"thresholds":{"sudden":[{},{},{}],"hard":[{},{},{}]}}'::jsonb);
 IF NOT p_master AND jsonb_array_length(p_selected)=3 THEN
  IF p_mode='classic' THEN
   SELECT count(DISTINCT a.op) INTO v_distinct FROM jsonb_array_elements_text(p_completed) WITH ORDINALITY a(op,n)
    WHERE p_first->(a.n::int-1)='true'::jsonb;
   IF v_distinct>=2 THEN
    v_old:=coalesce((v_eligible#>>ARRAY['classic',(p_level-1)::text,p_total::text])::int,0);
    v_eligible:=jsonb_set(v_eligible,ARRAY['classic',(p_level-1)::text,p_total::text],to_jsonb(greatest(v_old,p_score)),true);
   END IF;
  ELSE
   FOR v_threshold IN SELECT unnest(CASE WHEN p_mode='hard' THEN ARRAY[3,7] ELSE ARRAY[5,10] END) LOOP
    SELECT count(DISTINCT a.op) INTO v_distinct FROM jsonb_array_elements_text(p_completed) WITH ORDINALITY a(op,n) WHERE a.n<=v_threshold;
    IF p_score>=v_threshold AND v_distinct>=2 THEN
     v_old:=coalesce((v_eligible#>>ARRAY[p_mode,(p_level-1)::text])::int,0);
     v_eligible:=jsonb_set(v_eligible,ARRAY[p_mode,(p_level-1)::text],to_jsonb(greatest(v_old,v_threshold)),true);
     v_eligible:=jsonb_set(v_eligible,ARRAY['thresholds',p_mode,(p_level-1)::text,v_threshold::text],'true'::jsonb,true);
    END IF;
   END LOOP;
  END IF;
 END IF;
 v_next:=jsonb_set(v_next,'{eligible}',v_eligible,true);
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
 v_event:=v_proof||jsonb_build_object('eventId',p_event::text,'mode',p_mode,'level',p_level,
   'score',p_score,'total',p_total,'points',0,'at',to_char(v_when AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
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
END $atomic$;
REVOKE ALL ON FUNCTION public.connect_mixed_restart_class_v1(uuid,uuid,text,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.connect_mixed_restart_class_v1(uuid,uuid,text,boolean) TO service_role;
REVOKE ALL ON FUNCTION public.connect_mixed_restart_one_v1(uuid,uuid,uuid,text,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.connect_mixed_restart_one_v1(uuid,uuid,uuid,text,boolean) TO service_role;
REVOKE ALL ON FUNCTION public.connect_mixed_xp_read_v1(uuid,text,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.connect_mixed_xp_read_v1(uuid,text,boolean) TO service_role;
REVOKE ALL ON FUNCTION public.connect_mixed_xp_sync_v1(uuid,text,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.connect_mixed_xp_sync_v1(uuid,text,boolean) TO service_role;
REVOKE ALL ON FUNCTION public.connect_mixed_record_v1(uuid,uuid,bigint,bigint,text,integer,integer,integer,jsonb,jsonb,jsonb,jsonb,boolean,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.connect_mixed_record_v1(uuid,uuid,bigint,bigint,text,integer,integer,integer,jsonb,jsonb,jsonb,jsonb,boolean,boolean) TO service_role;
DO $postcheck$
BEGIN
 IF (SELECT sum(points) FROM public.connect_xp_award_rules WHERE app_key='melange-calculs-ecrits')<>198
 OR (SELECT count(*) FROM public.connect_xp_award_rules WHERE app_key='melange-calculs-ecrits')<>9
 OR (SELECT count(*) FROM public.connect_hub_preset_entries WHERE app_key='melange-calculs-ecrits' AND NOT visible AND NOT featured)<>4
 OR EXISTS(SELECT 1 FROM public.connect_apps WHERE app_key='melange-calculs-ecrits' AND (enabled OR featured))
 THEN RAISE EXCEPTION 'mixed_postcheck';END IF;
END $postcheck$;
COMMIT;
