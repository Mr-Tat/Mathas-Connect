-- Generated as an OFFLINE release candidate on 2026-10-30.
-- DO NOT apply to hosted Supabase without explicit teacher permission.
-- One-time, fail-closed and transactional: no student state is changed.
-- Run this SQL in isolation after checking migration history: NEVER run
-- 'supabase db push' against the partial repository migration tree.
BEGIN;
DO $release_preflight$
DECLARE f text; actual text; spec record;
BEGIN
 -- Refuse to replace functions that changed after the last read-only review.
 FOR spec IN SELECT * FROM (VALUES
  ('connect_parcours_restart_class','uuid,uuid,text,boolean','62194222ad2e5cfaec4999cea3f5363c'),
  ('connect_parcours_restart_one','uuid,uuid,uuid,text,boolean','eec598806f7950112b21920689a45baa'),
  ('connect_xp_read_v2','uuid,text,boolean','c5b879034329e6e03b7547e9661f642e'),
  ('connect_xp_sync_v2','uuid,text,boolean','d3a11bdef68483ccffa4ffe2c2b13f35')
 ) AS v(name,signature,expected_md5) LOOP
  f := 'public.' || spec.name || '(' || spec.signature || ')';
  SELECT md5(pg_get_functiondef(to_regprocedure(f))) INTO actual;
  IF actual IS DISTINCT FROM spec.expected_md5 THEN
   RAISE EXCEPTION 'addition_multiple_stale_production_rpc: %',spec.name;
  END IF;
  IF has_function_privilege('anon',f,'EXECUTE')
     OR has_function_privilege('authenticated',f,'EXECUTE')
     OR NOT has_function_privilege('service_role',f,'EXECUTE') THEN
   RAISE EXCEPTION 'addition_multiple_preexisting_rpc_permissions: %',spec.name;
  END IF;
 END LOOP;
 -- Abort if the atomic function already exists: release must never overwrite
 -- an established implementation which may hold real student records.
 IF to_regprocedure('public.connect_addition_multiple_record_v1(uuid,uuid,bigint,bigint,text,integer,integer,integer,jsonb)') IS NOT NULL THEN
   RAISE EXCEPTION 'addition_multiple_atomic_rpc_already_exists';
 END IF;
END $release_preflight$;

-- Phase A: register disabled app in all four HUBs and rules only.
-- STAGING ONLY. Ne pas exécuter sur la production avant validation explicite.
-- Ajout exclusivement additif : aucune modification des données des trois jeux.

-- Refuser un catalogue déjà activé au lieu de laisser ON CONFLICT DO NOTHING
-- conserver par erreur une ancienne visibilité. Cette garde est lecture seule.
DO $addition_multiple_hidden_preflight$
BEGIN
 IF EXISTS (
   SELECT 1 FROM public.connect_apps
   WHERE app_key='addition-ecrite-multiple' AND (enabled IS DISTINCT FROM false OR featured IS DISTINCT FROM false)
 ) OR EXISTS (
   SELECT 1 FROM public.connect_hub_preset_entries
   WHERE app_key='addition-ecrite-multiple' AND (visible IS DISTINCT FROM false OR featured IS DISTINCT FROM false)
 ) THEN
   RAISE EXCEPTION 'addition_multiple_preexisting_publication';
 END IF;
END $addition_multiple_hidden_preflight$;
INSERT INTO public.connect_apps
(app_key,title,launch_url,image_url,enabled,hub_section,featured,display_order)
VALUES ('addition-ecrite-multiple','Addition de plusieurs nombres',
'https://mr-tat.github.io/Mathas-Connect/apps/addition-plusieurs/',
'https://mr-tat.github.io/Mathas-Connect/assets/miniatures/addition-ecrite-multiple.webp',
false,'calculs_ecrits',false,40)
ON CONFLICT (app_key) DO NOTHING;
INSERT INTO public.connect_hub_preset_entries
(preset_slug,app_key,section,display_order,visible,featured)
SELECT slug,'addition-ecrite-multiple','calculs_ecrits',40,false,false
FROM (VALUES ('observation'),('phase1'),('phase2'),('2eco')) AS slugs(slug)
ON CONFLICT(preset_slug,app_key) DO NOTHING;
-- Les règles sont des données de configuration, pas un crédit XP. 
-- La fonction XP officielle n'autorise toujours pas cette app_key.
INSERT INTO public.connect_xp_award_rules(app_key,award_key,points) VALUES
('addition-ecrite-multiple','classic:4:perfect',22),
('addition-ecrite-multiple','classic:10:pass',30),
('addition-ecrite-multiple','classic:10:bonus',6),
('addition-ecrite-multiple','classic:20:pass',50),
('addition-ecrite-multiple','classic:20:bonus',10),
('addition-ecrite-multiple','sudden:5',10),
('addition-ecrite-multiple','sudden:10',10),
('addition-ecrite-multiple','hard:3',10),
('addition-ecrite-multiple','hard:7',10)
ON CONFLICT(app_key,award_key) DO NOTHING;
-- Aucune fonction XP, aucune écriture de résultats ou modification d'autres applications.

-- Phase B: extend four approved official RPC allowlists, nothing else.
-- DRAFT ONLY: do not apply to production. Rebase against latest function definitions before release.
-- Extends only app allowlists; never rewrites existing student rows.

CREATE OR REPLACE FUNCTION public.connect_parcours_restart_class(p_teacher uuid, p_class uuid, p_app text, p_repeat_xp boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare member record; n integer:=0; details jsonb:='[]'::jsonb;
begin
 if p_app NOT IN ('addition-ecrite-simple','multiplication-ecrite-simple','soustraction-ecrite-simple','addition-ecrite-multiple') or p_teacher is null or p_class is null then raise exception 'invalid_params';end if;
 if not exists(select 1 from public.connect_class_permissions where teacher_id=p_teacher and class_id=p_class and can_manage=true) then raise exception 'forbidden';end if;
 for member in select s.id from public.connect_students s join public.connect_enrollments e on e.student_id=s.id
 where s.archived_at is null and e.class_id=p_class and e.left_at is null order by s.id loop
  details:=details||public.connect_parcours_restart_one(p_teacher,p_class,member.id,p_app,p_repeat_xp);
  n:=n+1;
 end loop;
 return jsonb_build_object('ok',true,'count',n,'classId',p_class,'xpReplay',coalesce(p_repeat_xp,false));
end $function$
;
CREATE OR REPLACE FUNCTION public.connect_parcours_restart_one(p_teacher uuid, p_class uuid, p_student uuid, p_app text, p_repeat_xp boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare previous_number integer:=1; previous_repeat boolean:=false; state_old jsonb:='{}'::jsonb;
 prev_xp integer:=0; next_number integer; old_rec record;
begin
 if p_app NOT IN ('addition-ecrite-simple','multiplication-ecrite-simple','soustraction-ecrite-simple','addition-ecrite-multiple') or p_teacher is null or p_student is null or p_class is null then raise exception 'invalid_params';end if;
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
 perform public.connect_xp_sync_v2(p_student,p_app,false);
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
CREATE OR REPLACE FUNCTION public.connect_xp_read_v2(p_student uuid, p_app text, p_include_milestones boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE st_changed timestamptz; xp_changed timestamptz; points integer; total_points integer; lvl integer; earned jsonb := '[]'::jsonb; apps jsonb; parcours integer:=1; can_repeat boolean:=false; replay_earned jsonb:='[]'::jsonb;
BEGIN
 IF p_app NOT IN ('addition-ecrite-simple','multiplication-ecrite-simple','soustraction-ecrite-simple','addition-ecrite-multiple') THEN RAISE EXCEPTION 'not_integrated'; END IF;
 PERFORM 1 FROM public.connect_students WHERE id=p_student AND archived_at IS NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'inactive_student'; END IF;
 SELECT updated_at INTO st_changed FROM public.connect_states WHERE student_id=p_student AND app_key=p_app;
 SELECT updated_at INTO xp_changed FROM public.connect_xp_credits WHERE student_id=p_student AND app_key=p_app;
 IF st_changed IS NOT NULL AND (xp_changed IS NULL OR xp_changed < st_changed) THEN
  PERFORM public.connect_xp_sync_v2(p_student,p_app,false);
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
 'next',CASE WHEN lvl<7 THEN lvl*50 ELSE 300+(lvl-6)*100 END,'apps',apps,'milestones',earned,'currentMilestones',replay_earned,'parcours',parcours,'repeatXp',can_repeat,'max',474);
END $function$
;
CREATE OR REPLACE FUNCTION public.connect_xp_sync_v2(p_student uuid, p_app text, p_force boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare s jsonb; i int; n int; score int; best int; k text; added int:=0; beforexp int:=0; afterxp int:=0; totalxp int:=0; levelnow int; priorlevel int:=1; rulesversion int:=2; replay int:=1; repeated boolean:=false; rec record; earned boolean; bonusxp int:=0;
begin
 if p_app NOT IN ('addition-ecrite-simple','multiplication-ecrite-simple','soustraction-ecrite-simple','addition-ecrite-multiple') then raise exception 'not_integrated';end if;
 perform 1 from public.connect_students where id=p_student and archived_at is null for update;
 if not found then raise exception 'inactive_student';end if;
 select coalesce(state_data,'{}'::jsonb) into s from public.connect_states where student_id=p_student and app_key=p_app;
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
    insert into public.connect_xp_milestones(student_id,app_key,milestone_key,evidence) values(p_student,p_app,k,jsonb_build_object('source','record','score',score)) on conflict do nothing;
   elsif n in (10,20) then
    if score*5>=n*4 then
     k='classic:'||(i+1)||':'||n||':pass';
     insert into public.connect_xp_milestones(student_id,app_key,milestone_key,evidence) values(p_student,p_app,k,jsonb_build_object('source','record','score',score)) on conflict do nothing;
    end if;
    if score=n then
     k='classic:'||(i+1)||':'||n||':bonus';
     insert into public.connect_xp_milestones(student_id,app_key,milestone_key,evidence) values(p_student,p_app,k,jsonb_build_object('source','record','score',score)) on conflict do nothing;
    end if;
   end if;
  end loop;
  score=coalesce((s#>>array['sudden',i::text])::int,0);
  for n in select unnest(array[5,10]) loop
   if score>=n then
    k='sudden:'||(i+1)||':'||n;
    insert into public.connect_xp_milestones(student_id,app_key,milestone_key,evidence) values(p_student,p_app,k,jsonb_build_object('source','record','score',score)) on conflict do nothing;
   end if;
  end loop;
  score=coalesce((s#>>array['hard',i::text])::int,0);
  for n in select unnest(array[3,7]) loop
   if score>=n then
    k='hard:'||(i+1)||':'||n;
    insert into public.connect_xp_milestones(student_id,app_key,milestone_key,evidence) values(p_student,p_app,k,jsonb_build_object('source','record','score',score)) on conflict do nothing;
   end if;
  end loop;
 end loop;
 select coalesce(sum(r.points),0) into afterxp
 from public.connect_xp_milestones m join public.connect_xp_award_rules r on r.app_key=m.app_key and (
 r.award_key = concat_ws(':',split_part(m.milestone_key,':',1),split_part(m.milestone_key,':',3),nullif(split_part(m.milestone_key,':',4),''))
 )
 where m.student_id=p_student and m.app_key=p_app;
 if afterxp>474 then raise exception 'xp_cap';end if;
 if repeated and replay>=2 then
  for rec in select m.milestone_key,r.points from public.connect_xp_milestones m join public.connect_xp_award_rules r
    on r.app_key=m.app_key and r.award_key=concat_ws(':',split_part(m.milestone_key,':',1),split_part(m.milestone_key,':',3),nullif(split_part(m.milestone_key,':',4),''))
   where m.student_id=p_student and m.app_key=p_app loop
    earned:=false;i:=split_part(rec.milestone_key,':',2)::int-1;n:=split_part(rec.milestone_key,':',3)::int;
    if split_part(rec.milestone_key,':',1)='classic' then
      score:=coalesce((s#>>array['classic',i::text,n::text])::int,-1);
      if n=4 then earned:=score=4;
      elsif n in(10,20) then earned:=case when split_part(rec.milestone_key,':',4)='bonus' then score=n else score*5>=n*4 end;end if;
    elsif split_part(rec.milestone_key,':',1)='sudden' then earned:=coalesce((s#>>array['sudden',i::text])::int,0)>=n;
    elsif split_part(rec.milestone_key,':',1)='hard' then earned:=coalesce((s#>>array['hard',i::text])::int,0)>=n;end if;
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
 return jsonb_build_object('appXp',afterxp,'delta',afterxp-beforexp,'total',totalxp,'level',levelnow,'previousLevel',priorlevel,'next',case when levelnow<7 then levelnow*50 else 300+(levelnow-6)*100 end,'active',true,'rulesetVersion',2);
end $function$
;

-- These SECURITY DEFINER RPCs must not be callable with a student's public JWT.
REVOKE ALL ON FUNCTION public.connect_parcours_restart_class(uuid,uuid,text,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.connect_parcours_restart_class(uuid,uuid,text,boolean) TO service_role;
-- These SECURITY DEFINER RPCs must not be callable with a student's public JWT.
REVOKE ALL ON FUNCTION public.connect_parcours_restart_one(uuid,uuid,uuid,text,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.connect_parcours_restart_one(uuid,uuid,uuid,text,boolean) TO service_role;
-- These SECURITY DEFINER RPCs must not be callable with a student's public JWT.
REVOKE ALL ON FUNCTION public.connect_xp_read_v2(uuid,text,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.connect_xp_read_v2(uuid,text,boolean) TO service_role;
-- These SECURITY DEFINER RPCs must not be callable with a student's public JWT.
REVOKE ALL ON FUNCTION public.connect_xp_sync_v2(uuid,text,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.connect_xp_sync_v2(uuid,text,boolean) TO service_role;

-- Phase C: create atomic XP + trophy RPC, service_role only.
-- Candidate ONLY. Atomic Addition multiple write + official XP credit.
-- Not deployed. Call exclusively through the authenticated Edge service role.

CREATE OR REPLACE FUNCTION public.connect_addition_multiple_record_v1(
 p_student uuid,p_event uuid,p_expected_revision bigint,p_reset_epoch bigint,
 p_mode text,p_level integer,p_score integer,p_total integer DEFAULT NULL,
 p_rewards jsonb DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp'
AS $atomic$
DECLARE
 v_app constant text:='addition-ecrite-multiple';
 v_state public.connect_states%ROWTYPE;
 v_next jsonb;v_ids jsonb;v_recent jsonb;v_event jsonb;
 v_old integer;v_xp jsonb;v_when timestamptz:=now();v_i integer;
 v_rewards jsonb;v_key text;v_path text[];v_old_flag boolean;v_new_flag boolean;
BEGIN
 IF p_student IS NULL OR p_event IS NULL OR p_expected_revision IS NULL OR p_expected_revision<0
 OR p_reset_epoch IS NULL OR p_reset_epoch<0
 OR p_level NOT BETWEEN 1 AND 3 OR p_score IS NULL OR p_score<0 OR p_score>100000
 OR p_mode IS NULL OR p_mode NOT IN ('classic','sudden','hard','hard-challenge')
 OR (p_mode='classic' AND (p_total IS NULL OR p_total NOT IN (4,10,20) OR p_score>p_total))
 OR (p_mode='hard-challenge' AND (p_total IS NULL OR p_total<>5 OR p_score>5))
 OR (p_mode IN ('sudden','hard') AND p_total IS NOT NULL)
 THEN RAISE EXCEPTION 'invalid_result';END IF;
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
 IF v_ids ? (p_event::text) THEN
   v_xp:=public.connect_xp_read_v2(p_student,v_app,false);
   RETURN jsonb_build_object('ok',true,'duplicate',true,'revision',v_state.revision,
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
 IF jsonb_typeof(v_next->'hardThree') IS DISTINCT FROM 'array'
 THEN v_next:=jsonb_set(v_next,'{hardThree}','[null,null,null]'::jsonb,true);END IF;
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
 ELSIF p_mode='hard-challenge' THEN
  v_old:=coalesce((v_next#>>ARRAY['hardThree',v_i::text])::int,0);
  v_next:=jsonb_set(v_next,ARRAY['hardThree',v_i::text],to_jsonb(greatest(v_old,p_score)),true);
 ELSE
  v_old:=coalesce((v_next#>>ARRAY[p_mode,v_i::text])::int,0);
  v_next:=jsonb_set(v_next,ARRAY[p_mode,v_i::text],to_jsonb(greatest(v_old,p_score)),true);
 END IF;
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
 v_event:=jsonb_build_object('eventId',p_event::text,'mode',p_mode,'level',p_level,
   'score',p_score,'total',p_total,'points',0,'at',to_char(v_when AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
 v_recent:=jsonb_build_array(v_event)||
    (CASE WHEN jsonb_typeof(v_next->'recent')='array' THEN v_next->'recent' ELSE '[]'::jsonb END);
 SELECT coalesce(jsonb_agg(value ORDER BY ord),'[]'::jsonb) INTO v_recent
 FROM jsonb_array_elements(v_recent) WITH ORDINALITY AS q(value,ord) WHERE ord<=3;
 v_next:=jsonb_set(v_next,'{recent}',v_recent,true);
 -- Exactly one database transaction: if XP sync raises, state/revision roll back too.
 UPDATE public.connect_states SET state_data=v_next,revision=v_state.revision+1,updated_at=v_when
 WHERE student_id=p_student AND app_key=v_app;
 v_xp:=public.connect_xp_sync_v2(p_student,v_app,false);
 RETURN jsonb_build_object('ok',true,'duplicate',false,'revision',v_state.revision+1,
  'resetEpoch',v_state.reset_epoch,'state',v_next,'xp',v_xp);
END $atomic$;
REVOKE ALL ON FUNCTION public.connect_addition_multiple_record_v1(uuid,uuid,bigint,bigint,text,integer,integer,integer,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.connect_addition_multiple_record_v1(uuid,uuid,bigint,bigint,text,integer,integer,integer,jsonb) TO service_role;

-- Supabase may grant EXECUTE directly to anon/authenticated in addition to
-- PUBLIC. Explicit revokes are required for all privileged RPCs.
REVOKE EXECUTE ON FUNCTION public.connect_addition_multiple_record_v1(uuid,uuid,bigint,bigint,text,integer,integer,integer,jsonb)
 FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.connect_parcours_restart_class(uuid,uuid,text,boolean)
 FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.connect_parcours_restart_one(uuid,uuid,uuid,text,boolean)
 FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.connect_xp_read_v2(uuid,text,boolean)
 FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.connect_xp_sync_v2(uuid,text,boolean)
 FROM PUBLIC, anon, authenticated;
DO $release_postcheck$
DECLARE spec text; visible_count integer; rules_count integer; rules_total integer;
BEGIN
 -- An enabled app or a visible/featured HUB entry is never acceptable here.
 IF NOT EXISTS (SELECT 1 FROM public.connect_apps
   WHERE app_key='addition-ecrite-multiple' AND enabled=false AND featured=false) THEN
    RAISE EXCEPTION 'addition_multiple_postcheck_disabled';
 END IF;
 SELECT count(*) INTO visible_count FROM public.connect_hub_preset_entries
 WHERE app_key='addition-ecrite-multiple'
 AND preset_slug IN ('observation','phase1','phase2','2eco')
 AND visible=false AND featured=false;
 IF visible_count<>4 THEN RAISE EXCEPTION 'addition_multiple_postcheck_four_hubs'; END IF;
 SELECT count(*),coalesce(sum(points),0) INTO rules_count,rules_total
 FROM public.connect_xp_award_rules WHERE app_key='addition-ecrite-multiple';
 IF rules_count<>9 OR rules_total<>158 THEN
  RAISE EXCEPTION 'addition_multiple_postcheck_xp_rules'; END IF;
 FOREACH spec IN ARRAY ARRAY[
  'public.connect_parcours_restart_class(uuid,uuid,text,boolean)',
  'public.connect_parcours_restart_one(uuid,uuid,uuid,text,boolean)',
  'public.connect_xp_read_v2(uuid,text,boolean)',
  'public.connect_xp_sync_v2(uuid,text,boolean)',
  'public.connect_addition_multiple_record_v1(uuid,uuid,bigint,bigint,text,integer,integer,integer,jsonb)'
 ] LOOP
  IF has_function_privilege('anon',spec,'EXECUTE')
   OR has_function_privilege('authenticated',spec,'EXECUTE')
   OR NOT has_function_privilege('service_role',spec,'EXECUTE')
  THEN RAISE EXCEPTION 'addition_multiple_postcheck_permissions: %',spec; END IF;
 END LOOP;
END $release_postcheck$;
COMMIT;
