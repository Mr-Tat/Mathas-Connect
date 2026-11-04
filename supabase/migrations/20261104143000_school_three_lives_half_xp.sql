-- 2026-11-04: shared survival XP, 3-vies at 50%, Mort subite up to 100%.
-- Historical 10-XP milestones remain credited; additive rules only.
BEGIN;
-- Keep original 10-XP rules for historical complete milestones;
-- introduce two explicit 5-XP halves with the same 10-XP ceiling.
INSERT INTO public.connect_xp_award_rules(app_key,award_key,points,ruleset_version)
SELECT base.app_key,base.award_key||':'||half.suffix,
 CASE WHEN half.suffix='half' THEN floor(base.points/2.0)::integer ELSE ceil(base.points/2.0)::integer END,
 base.ruleset_version
FROM public.connect_xp_award_rules base
CROSS JOIN (VALUES ('half'),('complement')) AS half(suffix)
WHERE base.app_key IN ('addition-ecrite-simple','addition-ecrite-multiple')
 AND base.award_key IN ('sudden:5','sudden:10','hard:3','hard:7')
ON CONFLICT (app_key,award_key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.connect_xp_sync_v2(p_student uuid, p_app text, p_force boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare s jsonb; i int; n int; score int; best int; k text; added int:=0; beforexp int:=0; afterxp int:=0; totalxp int:=0; levelnow int; priorlevel int:=1; rulesversion int:=2; replay int:=1; repeated boolean:=false; rec record; earned boolean; bonusxp int:=0; replay_started timestamptz; milestone_full text; milestone_half text; milestone_extra text;
begin
 if p_app NOT IN ('addition-ecrite-simple','multiplication-ecrite-simple','soustraction-ecrite-simple','addition-ecrite-multiple') then raise exception 'not_integrated';end if;
 perform 1 from public.connect_students where id=p_student and archived_at is null for update;
 if not found then raise exception 'inactive_student';end if;
 select coalesce(state_data,'{}'::jsonb) into s from public.connect_states where student_id=p_student and app_key=p_app;
 s:=coalesce(s,'{}'::jsonb);
 select coalesce(xp_credited,0) into beforexp from public.connect_xp_credits where student_id=p_student and app_key=p_app;
 beforexp:=coalesce(beforexp,0);
 select parcours_number,repeat_xp,started_at into replay,repeated,replay_started from public.connect_parcours_current where student_id=p_student and app_key=p_app;
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
  -- A 3-vies proof earns 5 XP for each survival tier; a genuine
  -- Mort subite proof can complete the same tier to 10 XP total.
  -- Historical full milestones remain untouched and fully credited.
  for rec in select mode_name, thresholds from
    (values ('sudden',array[5,10]),('hard',array[3,7])) AS modes(mode_name,thresholds)
  loop
   score:=coalesce((s#>>array[rec.mode_name,i::text])::int,0);
   best:=coalesce((s#>>array[case when rec.mode_name='sudden' then 'threeLives' else 'hardThree' end,i::text])::int,0);
   for n in select unnest(rec.thresholds) loop
    milestone_full:=rec.mode_name||':'||(i+1)||':'||n;
    milestone_half:=milestone_full||':half';
    milestone_extra:=milestone_full||':complement';
    if score>=n then
     if not exists(select 1 from public.connect_xp_milestones
        where student_id=p_student and app_key=p_app and milestone_key=milestone_full) then
      k:=case when exists(select 1 from public.connect_xp_milestones
        where student_id=p_student and app_key=p_app and milestone_key=milestone_half)
        then milestone_extra else milestone_full end;
      insert into public.connect_xp_milestones(student_id,app_key,milestone_key,evidence)
        values(p_student,p_app,k,jsonb_build_object('source','record','mode',rec.mode_name,'score',score))
        on conflict do nothing;
     end if;
    elsif best>=n then
     if not exists(select 1 from public.connect_xp_milestones
        where student_id=p_student and app_key=p_app and milestone_key=milestone_full) then
      insert into public.connect_xp_milestones(student_id,app_key,milestone_key,evidence)
        values(p_student,p_app,milestone_half,jsonb_build_object('source','record','mode',rec.mode_name||'-three-lives','score',best))
        on conflict do nothing;
     end if;
    end if;
   end loop;
  end loop;
 end loop;
 select coalesce(sum(r.points),0) into afterxp
 from public.connect_xp_milestones m join public.connect_xp_award_rules r on r.app_key=m.app_key and (
 r.award_key = concat_ws(':',split_part(m.milestone_key,':',1),split_part(m.milestone_key,':',3),nullif(split_part(m.milestone_key,':',4),''))
 )
 where m.student_id=p_student and m.app_key=p_app;
 if afterxp>474 then raise exception 'xp_cap';end if;
 if repeated and replay>=2 then
  -- Only milestones acquired before the current parcours can generate
  -- replay XP. Fresh rights discovered in this parcours do not double-credit.
  for rec in select m.milestone_key,r.points from public.connect_xp_milestones m join public.connect_xp_award_rules r
    on r.app_key=m.app_key and r.award_key=concat_ws(':',split_part(m.milestone_key,':',1),split_part(m.milestone_key,':',3),nullif(split_part(m.milestone_key,':',4),''))
   where m.student_id=p_student and m.app_key=p_app and m.achieved_at<replay_started loop
   if split_part(rec.milestone_key,':',1) in ('sudden','hard') then continue; end if;
   earned:=false;i:=split_part(rec.milestone_key,':',2)::int-1;n:=split_part(rec.milestone_key,':',3)::int;
   if split_part(rec.milestone_key,':',1)='classic' then
     score:=coalesce((s#>>array['classic',i::text,n::text])::int,-1);
     if n=4 then earned:=score=4;
     elsif n in(10,20) then earned:=case when split_part(rec.milestone_key,':',4)='bonus' then score=n else score*5>=n*4 end;end if;
   end if;
   if earned then insert into public.connect_parcours_xp_bonus(student_id,app_key,parcours_number,milestone_key,points)
    values(p_student,p_app,replay,rec.milestone_key,rec.points) on conflict do nothing;end if;
  end loop;
  -- For already known survival tiers, replay in 3-vies earns the first 5,
  -- and real sudden death the complementary 5, independent of the
  -- mode used during the original parcours.
  for i in 0..2 loop
   for rec in select mode_name, thresholds from
     (values ('sudden',array[5,10]),('hard',array[3,7])) AS modes(mode_name,thresholds)
   loop
    score:=coalesce((s#>>array[rec.mode_name,i::text])::int,0);
    best:=coalesce((s#>>array[case when rec.mode_name='sudden' then 'threeLives' else 'hardThree' end,i::text])::int,0);
    for n in select unnest(rec.thresholds) loop
     milestone_full:=rec.mode_name||':'||(i+1)||':'||n;
     milestone_half:=milestone_full||':half';
     milestone_extra:=milestone_full||':complement';
     if exists (select 1 from public.connect_xp_milestones m where
       m.student_id=p_student and m.app_key=p_app and m.achieved_at<replay_started
       and m.milestone_key in (milestone_full,milestone_half,milestone_extra)) then
      if greatest(score,best)>=n then
       insert into public.connect_parcours_xp_bonus(student_id,app_key,parcours_number,milestone_key,points)
        values(p_student,p_app,replay,milestone_half,5) on conflict do nothing;
      end if;
      if score>=n then
       insert into public.connect_parcours_xp_bonus(student_id,app_key,parcours_number,milestone_key,points)
        values(p_student,p_app,replay,milestone_extra,5) on conflict do nothing;
      end if;
     end if;
    end loop;
   end loop;
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
 SELECT coalesce(jsonb_agg(milestone_key ORDER BY milestone_key),'[]'::jsonb) INTO replay_earned
 FROM (
  SELECT milestone_key FROM public.connect_parcours_xp_bonus
   WHERE student_id=p_student AND app_key=p_app AND parcours_number=parcours
  UNION
  SELECT m.milestone_key FROM public.connect_xp_milestones m
   JOIN public.connect_parcours_current c ON c.student_id=m.student_id AND c.app_key=m.app_key
   WHERE m.student_id=p_student AND m.app_key=p_app AND m.achieved_at>=c.started_at
 ) progress;
 END IF;
 RETURN jsonb_build_object('active',true,'total',total_points,'appXp',points,'level',lvl,
 'next',CASE WHEN lvl<7 THEN lvl*50 ELSE 300+(lvl-6)*100 END,'apps',apps,'milestones',earned,'currentMilestones',replay_earned,'parcours',parcours,'repeatXp',can_repeat,'max',474);
END $function$


CREATE OR REPLACE FUNCTION public.connect_objective_record_school_record_extended_v1(p_student uuid, p_class uuid, p_app text, p_event uuid, p_expected_revision bigint, p_reset_epoch bigint, p_mode text, p_level integer, p_score integer, p_attempted integer, p_hash text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
 v_row public.connect_states%ROWTYPE;
 v_state jsonb;v_rewards jsonb;v_i text:=(p_level-1)::text;
 v_shared text;v_mode_key text;
 v_previous integer;v_points integer;v_xp jsonb;
 v_event jsonb;v_ids jsonb;v_recent jsonb;v_when timestamptz:=now();
 v_day text;v_best_today integer;
BEGIN
 IF p_student IS NULL OR p_class IS NULL OR p_event IS NULL
  OR public.connect_objective_record_school_class_allowed_v1(p_class) IS DISTINCT FROM true
  OR p_app NOT IN ('addition-ecrite-simple','addition-ecrite-multiple') OR p_app IS NULL
  OR p_mode NOT IN ('sudden','three-lives','hard-sudden','hard-three-lives') OR p_mode IS NULL
  OR p_level NOT BETWEEN 1 AND 3 OR p_level IS NULL
  OR p_score IS NULL OR p_score<0 OR p_score>120
  OR p_attempted IS NULL OR p_attempted NOT BETWEEN 1 AND 120 OR p_score>p_attempted
  OR p_expected_revision IS NULL OR p_expected_revision<0
  OR p_reset_epoch IS NULL OR p_reset_epoch<0
  OR p_hash IS NULL OR length(p_hash)<>64
 THEN RAISE EXCEPTION 'invalid_result';END IF;
 PERFORM 1 FROM public.connect_students WHERE id=p_student AND archived_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'inactive_student';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.connect_enrollments
     WHERE student_id=p_student AND class_id=p_class AND left_at IS NULL)
  AND NOT EXISTS(SELECT 1 FROM public.connect_teacher_players tp
     JOIN public.connect_class_permissions cp ON cp.teacher_id=tp.teacher_id
     WHERE tp.student_id=p_student AND cp.class_id=p_class AND cp.can_manage=true)
 THEN RAISE EXCEPTION 'not_school_subject';END IF;
 INSERT INTO public.connect_states(student_id,app_key,schema_version,revision,reset_epoch,state_data)
 VALUES(p_student,p_app,1,0,0,'{}'::jsonb) ON CONFLICT DO NOTHING;
 SELECT * INTO STRICT v_row FROM public.connect_states
 WHERE student_id=p_student AND app_key=p_app FOR UPDATE;
 IF v_row.reset_epoch<>p_reset_epoch THEN RAISE EXCEPTION 'stale_reset_epoch';END IF;
 IF EXISTS(SELECT 1 FROM public.connect_objective_record_school_receipts
    WHERE student_id=p_student AND app_key=p_app AND event_id=p_event)
 THEN RAISE EXCEPTION 'proof_replay_collision';END IF;
 IF v_row.revision<>p_expected_revision THEN RAISE EXCEPTION 'revision_conflict';END IF;
 v_state:=coalesce(v_row.state_data,'{}'::jsonb);
 IF jsonb_typeof(v_state->'sudden') IS DISTINCT FROM 'array'
 THEN v_state:=jsonb_set(v_state,'{sudden}','[0,0,0]'::jsonb,true);END IF;
 IF jsonb_typeof(v_state->'hard') IS DISTINCT FROM 'array'
 THEN v_state:=jsonb_set(v_state,'{hard}','[0,0,0]'::jsonb,true);END IF;
 IF jsonb_typeof(v_state->'threeLives') IS DISTINCT FROM 'array'
 THEN v_state:=jsonb_set(v_state,'{threeLives}','[0,0,0]'::jsonb,true);END IF;
 IF jsonb_typeof(v_state->'hardThree') IS DISTINCT FROM 'array'
 THEN v_state:=jsonb_set(v_state,'{hardThree}','[0,0,0]'::jsonb,true);END IF;
 v_shared:=CASE WHEN p_mode LIKE 'hard-%' THEN 'hard' ELSE 'sudden' END;
 v_mode_key:=CASE p_mode WHEN 'three-lives' THEN 'threeLives'
   WHEN 'hard-three-lives' THEN 'hardThree' ELSE v_shared END;
 v_previous:=coalesce((v_state#>>ARRAY[v_mode_key,v_i])::integer,0);
 v_state:=jsonb_set(v_state,ARRAY[v_mode_key,v_i],
   to_jsonb(greatest(v_previous,p_score)),true);
 -- Preserve best threshold evidence independently of the chosen mode.
 -- 3-vies keeps an independent best score. It must not masquerade as
 -- a genuine Mort subite / HARD Mort subite run for full XP eligibility.
 -- The historical genuine-sudden best is maintained in v_shared only
 -- when p_mode is an actual sudden-death mode.
 v_points:=round(p_score * CASE WHEN p_mode LIKE 'hard-%'
    THEN 3.375::numeric*power(1.2::numeric,p_level-1)
    ELSE power(1.5::numeric,p_level-1) END
    * CASE WHEN p_mode IN ('sudden','hard-sudden') THEN 2 ELSE 1 END)::integer;
 -- Read the permanent ledger, not ephemeral local browser trophy claims.
 v_rewards:=coalesce(public.connect_trophy_rewards_v1(p_student,p_app),
  '{"version":3,"mastery":{"4":[false,false,false],"10":[false,false,false],"20":[false,false,false]},"sudden":[false,false,false],"hardAwards":{"bronze":[false,false,false],"silver":[false,false,false],"gold":[false,false,false]},"scoreOne":{"bronze":false,"silver":false,"gold":false},"unlockedGold":false}'::jsonb);
 IF p_mode='sudden' AND p_score>=25 THEN
  v_rewards:=jsonb_set(v_rewards,ARRAY['sudden',v_i],'true'::jsonb,false);
 END IF;
 IF p_mode='hard-sudden' THEN
  IF p_score>=3 THEN v_rewards:=jsonb_set(v_rewards,ARRAY['hardAwards','bronze',v_i],'true'::jsonb,false);END IF;
  IF p_score>=5 THEN v_rewards:=jsonb_set(v_rewards,ARRAY['hardAwards','silver',v_i],'true'::jsonb,false);END IF;
  IF p_score>=10 THEN v_rewards:=jsonb_set(v_rewards,ARRAY['hardAwards','gold',v_i],'true'::jsonb,false);END IF;
 END IF;
 IF v_points>=200 THEN v_rewards:=jsonb_set(v_rewards,'{scoreOne,bronze}','true'::jsonb,false);END IF;
 IF v_points>=400 THEN v_rewards:=jsonb_set(v_rewards,'{scoreOne,silver}','true'::jsonb,false);END IF;
 IF v_points>=600 THEN v_rewards:=jsonb_set(v_rewards,'{scoreOne,gold}','true'::jsonb,false);END IF;
 v_state:=jsonb_set(v_state,'{rewards}',v_rewards,true);
 v_ids:=jsonb_build_array(p_event::text)||
  CASE WHEN jsonb_typeof(v_state->'ids')='array' THEN v_state->'ids' ELSE '[]'::jsonb END;
 SELECT coalesce(jsonb_agg(value ORDER BY ord),'[]'::jsonb) INTO v_ids
 FROM jsonb_array_elements(v_ids) WITH ORDINALITY AS item(value,ord) WHERE ord<=50;
 v_state:=jsonb_set(v_state,'{ids}',v_ids,true);
 v_event:=jsonb_build_object('eventId',p_event::text,'mode',p_mode,'level',p_level,
  'score',p_score,'total',NULL,'points',v_points,
  'at',to_char(v_when AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
 v_recent:=jsonb_build_array(v_event)||
  CASE WHEN jsonb_typeof(v_state->'recent')='array' THEN v_state->'recent' ELSE '[]'::jsonb END;
 SELECT coalesce(jsonb_agg(value ORDER BY ord),'[]'::jsonb) INTO v_recent
 FROM jsonb_array_elements(v_recent) WITH ORDINALITY AS item(value,ord) WHERE ord<=3;
 v_state:=jsonb_set(v_state,'{recent}',v_recent,true);
 v_state:=jsonb_set(v_state,'{bestPoints}',
  to_jsonb(greatest(coalesce((v_state->>'bestPoints')::integer,0),v_points)),true);
 v_day:=(v_when AT TIME ZONE 'Europe/Brussels')::date::text;
 v_best_today:=CASE WHEN v_state#>>'{todayBest,day}'=v_day
 THEN coalesce((v_state#>>'{todayBest,points}')::integer,0) ELSE 0 END;
 v_state:=jsonb_set(v_state,'{todayBest}',
  jsonb_build_object('day',v_day,'points',greatest(v_best_today,v_points)),true);
 INSERT INTO public.connect_objective_record_school_receipts(student_id,app_key,event_id,event_hash)
 VALUES(p_student,p_app,p_event,p_hash);
 UPDATE public.connect_states SET state_data=v_state,revision=v_row.revision+1,
  updated_at=v_when WHERE student_id=p_student AND app_key=p_app;
 v_xp:=public.connect_xp_sync_v2(p_student,p_app,false);
 RETURN jsonb_build_object('ok',true,'duplicate',false,'proofVerified',true,
   'verifiedScore',p_score,'attempted',p_attempted,'mode',p_mode,
   'revision',v_row.revision+1,'resetEpoch',v_row.reset_epoch,
   'state',v_state,'xp',v_xp);
END $function$

COMMIT;
