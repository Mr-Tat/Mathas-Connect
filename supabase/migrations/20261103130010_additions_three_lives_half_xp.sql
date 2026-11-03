-- XP 3 vies = 5 XP per threshold (5/10) only until the same threshold
-- is reached in Mort subite (10 XP). Thus 3 vies NEVER inflates the original
-- 474 XP ceiling, including for repeat parcours. Classic and other apps keep
-- their existing semantics. Preserve every recorded milestone and bonus row.
insert into public.connect_xp_award_rules(app_key,award_key,points,ruleset_version)
select a.app_key,k.award_key,5,2 from
 (values ('addition-ecrite-simple'),('addition-ecrite-multiple')) a(app_key)
 cross join (values('three-lives:5'),('three-lives:10')) k(award_key)
on conflict (app_key,award_key) do nothing;
DO $verify$ BEGIN
 IF (select count(*) from public.connect_xp_award_rules
     where app_key in ('addition-ecrite-simple','addition-ecrite-multiple')
       and award_key in ('three-lives:5','three-lives:10') and points=5)<>4
 THEN RAISE EXCEPTION 'unexpected_three_lives_xp_rules'; END IF;
END $verify$;

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

  -- Three-lives is a HALF-credit practice route for additions only. Existing
  -- full sudden milestones retain their 10 XP value and always supersede 5 XP.
  if p_app in ('addition-ecrite-simple','addition-ecrite-multiple') then
   score=coalesce((s#>>array['threeLives',i::text])::int,0);
   for n in select unnest(array[5,10]) loop
    if score>=n then
     k='three-lives:'||(i+1)||':'||n;
     insert into public.connect_xp_milestones(student_id,app_key,milestone_key,evidence)
       values(p_student,p_app,k,jsonb_build_object('source','server_proof_three_lives','score',score))
       on conflict do nothing;
    end if;
   end loop;
  end if;
  score=coalesce((s#>>array['hard',i::text])::int,0);
  for n in select unnest(array[3,7]) loop
   if score>=n then
    k='hard:'||(i+1)||':'||n;
    insert into public.connect_xp_milestones(student_id,app_key,milestone_key,evidence) values(p_student,p_app,k,jsonb_build_object('source','record','score',score)) on conflict do nothing;
   end if;
  end loop;
 end loop;
 select coalesce(sum(case when split_part(m.milestone_key,':',1)='three-lives'
   and exists(select 1 from public.connect_xp_milestones f
      where f.student_id=m.student_id and f.app_key=m.app_key
      and f.milestone_key='sudden:'||split_part(m.milestone_key,':',2)||':'||split_part(m.milestone_key,':',3))
   then 0 else r.points end),0) into afterxp
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
    elsif split_part(rec.milestone_key,':',1)='three-lives' then earned:=p_app in ('addition-ecrite-simple','addition-ecrite-multiple') and coalesce((s#>>array['threeLives',i::text])::int,0)>=n;
    elsif split_part(rec.milestone_key,':',1)='sudden' then earned:=coalesce((s#>>array['sudden',i::text])::int,0)>=n;
    elsif split_part(rec.milestone_key,':',1)='hard' then earned:=coalesce((s#>>array['hard',i::text])::int,0)>=n;end if;
    if earned then insert into public.connect_parcours_xp_bonus(student_id,app_key,parcours_number,milestone_key,points)
    values(p_student,p_app,replay,rec.milestone_key,rec.points) on conflict do nothing;end if;
  end loop;
 end if;
 select coalesce(sum(case when split_part(b.milestone_key,':',1)='three-lives'
   and exists(select 1 from public.connect_parcours_xp_bonus f
      where f.student_id=b.student_id and f.app_key=b.app_key
       and f.parcours_number=b.parcours_number
       and f.milestone_key='sudden:'||split_part(b.milestone_key,':',2)||':'||split_part(b.milestone_key,':',3))
   then 0 else b.points end),0) into bonusxp
  from public.connect_parcours_xp_bonus b
  where b.student_id=p_student and b.app_key=p_app;
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
end $function$;
