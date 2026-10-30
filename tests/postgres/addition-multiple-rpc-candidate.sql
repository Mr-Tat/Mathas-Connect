-- DRAFT ONLY: do not apply to production. Rebase against latest function definitions before release.
-- Extends only app allowlists; never rewrites existing student rows.
BEGIN;
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
COMMIT;
