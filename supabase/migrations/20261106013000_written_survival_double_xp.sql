-- Nov 2026: double Objectif record XP in all four written calculation games.
-- A level now offers 40 XP in Mort subite, or up to 20 XP in 3 vies.
-- The HARD survival branch has the same 2x multiplier; classics are unchanged.
-- Snapshot prior permanent survival milestones so old completed games
-- do not gain XP simply because the reward table was edited.
CREATE TABLE IF NOT EXISTS public.connect_xp_survival_legacy_offsets_v1 (
 student_id uuid NOT NULL,
 app_key text NOT NULL,
 points integer NOT NULL CHECK(points>=0),
 PRIMARY KEY(student_id,app_key)
);
ALTER TABLE public.connect_xp_survival_legacy_offsets_v1 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.connect_xp_survival_legacy_offsets_v1 FROM PUBLIC,anon,authenticated;

INSERT INTO public.connect_xp_survival_legacy_offsets_v1(student_id,app_key,points)
SELECT m.student_id,m.app_key,sum(r.points)::integer
FROM public.connect_xp_milestones m
JOIN public.connect_xp_award_rules r ON r.app_key=m.app_key
 AND r.award_key=concat_ws(':',split_part(m.milestone_key,':',1),
   split_part(m.milestone_key,':',3),nullif(split_part(m.milestone_key,':',4),''))
WHERE m.app_key IN ('addition-ecrite-simple','addition-ecrite-multiple',
 'soustraction-ecrite-simple','multiplication-ecrite-simple')
 AND split_part(m.milestone_key,':',1) IN ('sudden','hard')
GROUP BY m.student_id,m.app_key
ON CONFLICT(student_id,app_key) DO NOTHING;

UPDATE public.connect_xp_award_rules
 SET points=points*2, ruleset_version=greatest(ruleset_version,3)
WHERE app_key IN ('addition-ecrite-simple','addition-ecrite-multiple',
 'soustraction-ecrite-simple','multiplication-ecrite-simple')
 AND (award_key LIKE 'sudden:%' OR award_key LIKE 'hard:%');

DO $rewrite$
DECLARE v_def text;v_name text;
BEGIN
 SELECT pg_get_functiondef(p.oid) INTO STRICT v_def
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname='connect_xp_sync_v2';
 IF position('if afterxp>474 then raise exception' in v_def)=0
    OR position('values(p_student,p_app,replay,milestone_half,5)' in v_def)=0
    OR position('values(p_student,p_app,replay,milestone_extra,5)' in v_def)=0
 THEN RAISE EXCEPTION 'Unknown XP sync revision; abort reward migration';END IF;
 v_def:=replace(v_def,'if afterxp>474 then raise exception',
  'select greatest(0,afterxp-coalesce((select points from public.connect_xp_survival_legacy_offsets_v1 where student_id=p_student and app_key=p_app),0)) into afterxp; if afterxp>594 then raise exception');
 v_def:=replace(v_def,'values(p_student,p_app,replay,milestone_half,5)',
                       'values(p_student,p_app,replay,milestone_half,10)');
 v_def:=replace(v_def,'values(p_student,p_app,replay,milestone_extra,5)',
                       'values(p_student,p_app,replay,milestone_extra,10)');
 v_def:=replace(v_def,'rulesversion int:=2','rulesversion int:=3');
 EXECUTE v_def;
 SELECT pg_get_functiondef(p.oid) INTO STRICT v_def
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname='connect_xp_read_v2';
 IF position('''max'',474' in v_def)=0 THEN
   RAISE EXCEPTION 'Unknown XP read max; abort reward migration';END IF;
 v_def:=replace(v_def,'''max'',474','''max'',594');
 EXECUTE v_def;
END $rewrite$;
