\set ON_ERROR_STOP on
-- Synthetic identities only. The deployed Edge must resolve student IDs from JWT.
INSERT INTO connect_students(id,display_name) VALUES('00000000-0000-4000-8000-000000000001','Fictif Mélange');
INSERT INTO connect_class_permissions(class_id,teacher_id,can_manage) VALUES('00000000-0000-4000-8000-000000000010','00000000-0000-4000-8000-000000000020',true);
INSERT INTO connect_enrollments(id,class_id,student_id) VALUES(gen_random_uuid(),'00000000-0000-4000-8000-000000000010','00000000-0000-4000-8000-000000000001');
INSERT INTO connect_xp_credits(student_id,app_key,xp_credited) VALUES('00000000-0000-4000-8000-000000000001','addition-ecrite-simple',22);
CREATE FUNCTION pg_temp.record_mixed(n integer,score integer DEFAULT NULL,mode text DEFAULT 'classic',lvl integer DEFAULT 1,ops jsonb DEFAULT '["add","sub","mul"]',journal jsonb DEFAULT NULL,master boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE student uuid:='00000000-0000-4000-8000-000000000001';rev bigint;epoch bigint; completed jsonb;firsts jsonb;result jsonb;
BEGIN
 SELECT revision,reset_epoch INTO rev,epoch FROM connect_states WHERE student_id=student AND app_key='melange-calculs-ecrits';
 SELECT jsonb_agg(CASE WHEN i%2=0 THEN 'add' ELSE 'sub' END),jsonb_agg(i<=coalesce(score,n)) INTO completed,firsts FROM generate_series(1,n) i;
 result:=connect_mixed_record_v1(student,gen_random_uuid(),coalesce(rev,0),coalesce(epoch,0),mode,lvl,coalesce(score,n),CASE WHEN mode='classic' THEN n ELSE NULL END,NULL,ops,coalesce(journal,completed),firsts,false,master);
 RETURN result;
END $$;
DO $$
DECLARE r jsonb;s jsonb;oldrev bigint;id uuid:=gen_random_uuid();student uuid:='00000000-0000-4000-8000-000000000001';app text:='melange-calculs-ecrits';n int;lvl int;sig text;
BEGIN
 FOR sig IN SELECT p.oid::regprocedure::text FROM pg_proc p JOIN pg_namespace ns ON ns.oid=p.pronamespace WHERE ns.nspname='public' AND p.proname LIKE 'connect_mixed_%' LOOP
  IF has_function_privilege('anon',sig,'EXECUTE') OR has_function_privilege('authenticated',sig,'EXECUTE') OR NOT has_function_privilege('service_role',sig,'EXECUTE') THEN RAISE EXCEPTION 'permissions %',sig;END IF;
 END LOOP;
 r:=pg_temp.record_mixed(4);IF r->>'appKey'<>app OR r->>'storageSubject'<>student::text OR r->>'eventId' IS NULL THEN RAISE EXCEPTION 'uncorrelated_ack';END IF;IF (r#>>'{xp,delta}')::int<>28 OR (r#>>'{xp,total}')::int<>50 THEN RAISE EXCEPTION 'first28 %',r;END IF;
 r:=pg_temp.record_mixed(10,8);IF (r#>>'{xp,delta}')::int<>38 THEN RAISE EXCEPTION 'pass10';END IF;
 r:=pg_temp.record_mixed(10);IF (r#>>'{xp,delta}')::int<>8 THEN RAISE EXCEPTION 'bonus10';END IF;
 r:=pg_temp.record_mixed(20,16);IF (r#>>'{xp,delta}')::int<>63 THEN RAISE EXCEPTION 'pass20';END IF;
 r:=pg_temp.record_mixed(20);IF (r#>>'{xp,delta}')::int<>13 THEN RAISE EXCEPTION 'bonus20';END IF;
 FOR lvl IN 1..3 LOOP
  -- reverse order for remaining levels
  FOREACH n IN ARRAY ARRAY[20,10,4] LOOP r:=pg_temp.record_mixed(n,NULL,'classic',lvl);END LOOP;
  r:=pg_temp.record_mixed(10,NULL,'sudden',lvl);r:=pg_temp.record_mixed(7,NULL,'hard',lvl);
 END LOOP;
 IF (r#>>'{xp,appXp}')::int<>594 OR (r#>>'{xp,total}')::int<>616 THEN RAISE EXCEPTION 'cap %',r;END IF;
 IF (SELECT count(*) FROM connect_xp_milestones WHERE app_key=app)<>27 THEN RAISE EXCEPTION '27rights';END IF;
 SELECT state_data,revision INTO s,oldrev FROM connect_states WHERE student_id=student AND app_key=app;
 IF s#>'{classic,0}'<>'{"4":4,"10":10,"20":20}'::jsonb THEN RAISE EXCEPTION 'independent series';END IF;
 -- Permanent deduplication survives the bounded display cache.
 r:=connect_mixed_record_v1(student,id,oldrev,0,'classic',1,4,4,NULL,'["add","sub","mul"]','["add","sub","add","sub"]','[true,true,true,true]',false,false);
 FOR n IN 1..55 LOOP r:=pg_temp.record_mixed(4);END LOOP;
 r:=connect_mixed_record_v1(student,id,oldrev,0,'classic',1,4,4,NULL,'["add","sub","mul"]','["add","sub","add","sub"]','[true,true,true,true]',false,false);
 IF (r->>'duplicate')::boolean IS NOT TRUE OR (r#>>'{xp,delta}')::int<>0 THEN RAISE EXCEPTION 'dedup after50';END IF;
 SELECT revision INTO oldrev FROM connect_states WHERE student_id=student AND app_key=app;
 BEGIN
  PERFORM connect_mixed_record_v1(student,gen_random_uuid(),oldrev,0,'classic',1,4,4,NULL,'["add","sub","mul"]','["add"]','[true]',false,false);
  RAISE EXCEPTION 'invalid proof accepted';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'invalid_proof' THEN RAISE;END IF;END;
 IF (SELECT revision FROM connect_states WHERE student_id=student AND app_key=app)<>oldrev THEN RAISE EXCEPTION 'partial proof write';END IF;
 BEGIN
  PERFORM connect_mixed_record_v1(student,gen_random_uuid(),0,0,'classic',1,4,4,NULL,'["add","sub","mul"]','["add","sub","add","sub"]','[true,true,true,true]',false,false);
  RAISE EXCEPTION 'CAS accepted';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'revision_conflict' THEN RAISE;END IF;END;
 r:=connect_mixed_restart_one_v1('00000000-0000-4000-8000-000000000020','00000000-0000-4000-8000-000000000010',student,app,false);
 r:=pg_temp.record_mixed(4);IF (r#>>'{xp,delta}')::int<>0 OR (r#>>'{xp,appXp}')::int<>594 THEN RAISE EXCEPTION 'no recollection';END IF;
 BEGIN
  PERFORM connect_mixed_record_v1(student,id,oldrev,0,'classic',1,4,4,NULL,'["add","sub","mul"]','["add","sub","add","sub"]','[true,true,true,true]',false,false);
  RAISE EXCEPTION 'stale epoch accepted';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'stale_reset_epoch' THEN RAISE;END IF;END;
 r:=connect_mixed_restart_one_v1('00000000-0000-4000-8000-000000000020','00000000-0000-4000-8000-000000000010',student,app,true);
 r:=pg_temp.record_mixed(4);IF (r#>>'{xp,delta}')::int<>28 THEN RAISE EXCEPTION 'authorized replay';END IF;
 r:=pg_temp.record_mixed(4);IF (r#>>'{xp,delta}')::int<>0 THEN RAISE EXCEPTION 'replay duplicate';END IF;
 IF (SELECT xp_credited FROM connect_xp_credits WHERE student_id=student AND app_key='addition-ecrite-simple')<>22 THEN RAISE EXCEPTION 'other game changed';END IF;
 IF (SELECT count(*) FROM connect_hub_preset_entries WHERE app_key=app AND NOT visible AND NOT featured)<>4 THEN RAISE EXCEPTION 'four hidden';END IF;
 IF NOT (SELECT visible FROM connect_hub_preset_entries WHERE preset_slug='phase1' AND app_key='addition-ecrite-multiple') THEN RAISE EXCEPTION 'existing phase1 changed';END IF;
 IF public.connect_xp_sync_v2(student,'addition-ecrite-simple',false)<>'{"untouched":true}'::jsonb THEN RAISE EXCEPTION 'existing RPC changed';END IF;
 IF (SELECT enabled FROM connect_apps WHERE app_key=app) THEN RAISE EXCEPTION 'enabled';END IF;
END $$;
-- New pupil: restricted start selection pays half; a lucky all-three draw pays full.
INSERT INTO connect_students(id,display_name) VALUES('00000000-0000-4000-8000-000000000002','Fictif sans variété');
DO $$
DECLARE r jsonb;student uuid:='00000000-0000-4000-8000-000000000002';
BEGIN
 r:=connect_mixed_record_v1(student,gen_random_uuid(),0,0,'classic',1,4,4,NULL,'["add"]','["add","add","add","add"]','[true,true,true,true]',false,false);
 IF (r#>>'{xp,delta}')::int<>14 THEN RAISE EXCEPTION 'solo half reward missing';END IF;
 r:=connect_mixed_record_v1(student,gen_random_uuid(),1,0,'classic',1,4,4,NULL,'["add","sub"]','["add","sub","add","sub"]','[true,true,true,true]',false,false);
 IF (r#>>'{xp,delta}')::int<>0 OR (r#>>'{xp,appXp}')::int<>14 THEN RAISE EXCEPTION 'two selected double half credit';END IF;
 r:=connect_mixed_record_v1(student,gen_random_uuid(),2,0,'sudden',1,10,NULL,NULL,'["add","sub","mul"]','["add","add","add","add","add","sub","sub","sub","sub","sub"]','[true,true,true,true,true,true,true,true,true,true]',false,false);
 IF (r#>>'{xp,delta}')::int<>24 THEN RAISE EXCEPTION 'lucky all-three draw not full rate %',r;END IF;
 r:=connect_mixed_record_v1(student,gen_random_uuid(),3,0,'classic',1,4,4,NULL,'["add","sub","mul"]','["add","sub","add","sub"]','[true,true,true,true]',true,true);
 IF (r#>>'{xp,delta}')::int<>0 THEN RAISE EXCEPTION 'master rewarded';END IF;
END $$;
INSERT INTO connect_enrollments(id,class_id,student_id) VALUES(gen_random_uuid(),'00000000-0000-4000-8000-000000000010','00000000-0000-4000-8000-000000000002');
DO $$
DECLARE r jsonb;student uuid:='00000000-0000-4000-8000-000000000002';rev bigint;epoch bigint;
BEGIN
 r:=connect_mixed_restart_one_v1('00000000-0000-4000-8000-000000000020','00000000-0000-4000-8000-000000000010',student,'melange-calculs-ecrits',true);
 SELECT revision,reset_epoch INTO rev,epoch FROM connect_states WHERE student_id=student AND app_key='melange-calculs-ecrits';
 r:=connect_mixed_record_v1(student,gen_random_uuid(),rev,epoch,'classic',1,4,4,NULL,'["add","sub","mul"]','["add","sub","add","sub"]','[true,true,true,true]',false,false);
 IF (r#>>'{xp,delta}')::int<>28 THEN RAISE EXCEPTION 'new topup doubled instead of old half replay plus complement %',r;END IF;
 r:=connect_mixed_record_v1(student,gen_random_uuid(),rev+1,epoch,'classic',1,4,4,NULL,'["add","sub","mul"]','["add","sub","add","sub"]','[true,true,true,true]',false,false);
 IF (r#>>'{xp,delta}')::int<>0 THEN RAISE EXCEPTION 'new milestone replayed within same parcours';END IF;
END $$;
INSERT INTO connect_students(id,display_name) VALUES('00000000-0000-4000-8000-000000000003','Fictif opérations corrigées');
DO $$ DECLARE r jsonb; BEGIN
 r:=connect_mixed_record_v1('00000000-0000-4000-8000-000000000003',gen_random_uuid(),0,0,'classic',1,8,10,NULL,'["add","sub","mul"]','["add","add","add","add","add","add","add","add","sub","mul"]','[true,true,true,true,true,true,true,true,false,false]',false,false);
 IF (r#>>'{xp,delta}')::int<>38 THEN RAISE EXCEPTION 'completed variety wrongly requires firstTry';END IF;
END $$;
-- Actual complete journals, including deliberately lucky all-add draws. Rates
-- depend only on the immutable START selection, not the operation lottery.
CREATE FUNCTION pg_temp.record_selection(p_student uuid,n integer,score integer DEFAULT NULL,mode text DEFAULT 'classic',lvl integer DEFAULT 1,ops jsonb DEFAULT '["add","sub","mul"]')
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE rev bigint;epoch bigint;completed jsonb;firsts jsonb;BEGIN
 SELECT revision,reset_epoch INTO rev,epoch FROM connect_states WHERE student_id=p_student AND app_key='melange-calculs-ecrits';
 SELECT jsonb_agg(ops->>0),jsonb_agg(i<=coalesce(score,n)) INTO completed,firsts FROM generate_series(1,n) i;
 RETURN connect_mixed_record_v1(p_student,gen_random_uuid(),coalesce(rev,0),coalesce(epoch,0),mode,lvl,coalesce(score,n),CASE WHEN mode='classic' THEN n ELSE NULL END,NULL,ops,completed,firsts,false,false);
END $$;
INSERT INTO connect_students(id,display_name) SELECT ('00000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'Fictif politique XP '||n FROM generate_series(101,106) n;
INSERT INTO connect_enrollments(id,class_id,student_id) SELECT gen_random_uuid(),'00000000-0000-4000-8000-000000000010',('00000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid FROM generate_series(101,106) n;
DO $$
DECLARE r jsonb;p uuid:='00000000-0000-4000-8000-000000000101';id uuid:=gen_random_uuid();rev bigint;epoch bigint;n int;lvl int;BEGIN
 r:=connect_mixed_record_v1(p,id,0,0,'classic',1,4,4,NULL,'["add"]','["add","add","add","add"]','[true,true,true,true]',false,false);
 IF (r#>>'{xp,delta}')::int<>14 OR (r#>>'{xp,rulesetVersion}')::int<>2 THEN RAISE EXCEPTION 'half first %',r;END IF;
 r:=connect_mixed_record_v1(p,id,0,0,'classic',1,4,4,NULL,'["add"]','["add","add","add","add"]','[true,true,true,true]',false,false);
 IF (r#>>'{xp,delta}')::int<>0 OR NOT (r->>'duplicate')::boolean THEN RAISE EXCEPTION 'half duplicate %',r;END IF;
 r:=pg_temp.record_selection(p,4,NULL,'classic',1,'["add","sub"]');IF (r#>>'{xp,delta}')::int<>0 THEN RAISE EXCEPTION 'two-selection double half';END IF;
 r:=pg_temp.record_selection(p,4);IF (r#>>'{xp,delta}')::int<>14 OR (r#>>'{xp,appXp}')::int<>28 THEN RAISE EXCEPTION 'half topup %',r;END IF;
 r:=pg_temp.record_selection(p,4);IF (r#>>'{xp,delta}')::int<>0 THEN RAISE EXCEPTION 'topup twice';END IF;
 r:=pg_temp.record_selection(p,4,NULL,'classic',1,'["add"]');IF (r#>>'{xp,delta}')::int<>0 OR (r#>>'{xp,appXp}')::int<>28 THEN RAISE EXCEPTION 'full downgraded';END IF;
 PERFORM connect_mixed_restart_one_v1('00000000-0000-4000-8000-000000000020','00000000-0000-4000-8000-000000000010',p,'melange-calculs-ecrits',false);
 r:=pg_temp.record_selection(p,4,NULL,'classic',1,'["add"]');IF (r#>>'{xp,delta}')::int<>0 THEN RAISE EXCEPTION 'half recollection without permission';END IF;
 r:=pg_temp.record_selection(p,4);IF (r#>>'{xp,delta}')::int<>0 THEN RAISE EXCEPTION 'full recollection without permission';END IF;
 -- A never-earned complement is still available after a reset with no replay.
 p:='00000000-0000-4000-8000-000000000102';r:=pg_temp.record_selection(p,4,NULL,'classic',1,'["add"]');
 PERFORM connect_mixed_restart_one_v1('00000000-0000-4000-8000-000000000020','00000000-0000-4000-8000-000000000010',p,'melange-calculs-ecrits',false);
 r:=pg_temp.record_selection(p,4);IF (r#>>'{xp,delta}')::int<>14 OR (r#>>'{xp,appXp}')::int<>28 THEN RAISE EXCEPTION 'unearned complement lost after reset %',r;END IF;
 -- Explicit replay may repeat OLD halves, never double a newly earned top-up.
 p:='00000000-0000-4000-8000-000000000103';r:=pg_temp.record_selection(p,4,NULL,'classic',1,'["add"]');
 PERFORM connect_mixed_restart_one_v1('00000000-0000-4000-8000-000000000020','00000000-0000-4000-8000-000000000010',p,'melange-calculs-ecrits',true);
 r:=pg_temp.record_selection(p,4);IF (r#>>'{xp,delta}')::int<>28 OR (r#>>'{xp,appXp}')::int<>42 THEN RAISE EXCEPTION 'new topup double replay %',r;END IF;
 IF (SELECT points FROM connect_parcours_xp_bonus WHERE student_id=p AND milestone_key='classic:1:4:perfect' AND parcours_number=2)<>14 THEN RAISE EXCEPTION 'only old half should repeat';END IF;
 r:=pg_temp.record_selection(p,4,NULL,'classic',2);IF (r#>>'{xp,delta}')::int<>28 THEN RAISE EXCEPTION 'new right doubled in replay';END IF;
 PERFORM connect_mixed_restart_one_v1('00000000-0000-4000-8000-000000000020','00000000-0000-4000-8000-000000000010',p,'melange-calculs-ecrits',true);
 r:=pg_temp.record_selection(p,4,NULL,'classic',1,'["add"]');IF (r#>>'{xp,delta}')::int<>14 THEN RAISE EXCEPTION 'old half replay';END IF;
 r:=pg_temp.record_selection(p,4);IF (r#>>'{xp,delta}')::int<>14 THEN RAISE EXCEPTION 'replay complement';END IF;
 r:=pg_temp.record_selection(p,4);IF (r#>>'{xp,delta}')::int<>0 THEN RAISE EXCEPTION 'replay complement duplicated';END IF;
 -- Integer rounding is cumulative: 32 + 6 = 38, then full complements 31 + 7.
 p:='00000000-0000-4000-8000-000000000104';r:=pg_temp.record_selection(p,20,16,'classic',1,'["add"]');IF (r#>>'{xp,delta}')::int<>32 THEN RAISE EXCEPTION 'half pass20';END IF;
 r:=pg_temp.record_selection(p,20,NULL,'classic',1,'["add"]');IF (r#>>'{xp,delta}')::int<>6 OR (r#>>'{xp,appXp}')::int<>38 THEN RAISE EXCEPTION 'half perfect20';END IF;
 r:=pg_temp.record_selection(p,20,16);IF (r#>>'{xp,delta}')::int<>31 THEN RAISE EXCEPTION 'pass20 complement';END IF;
 r:=pg_temp.record_selection(p,20);IF (r#>>'{xp,delta}')::int<>7 OR (r#>>'{xp,appXp}')::int<>76 THEN RAISE EXCEPTION 'perfect20 complement';END IF;
 p:='00000000-0000-4000-8000-000000000105';
 FOR lvl IN 1..3 LOOP
  FOREACH n IN ARRAY ARRAY[20,10,4] LOOP r:=pg_temp.record_selection(p,n,NULL,'classic',lvl,'["add"]');END LOOP;
  r:=pg_temp.record_selection(p,10,NULL,'sudden',lvl,'["add"]');r:=pg_temp.record_selection(p,7,NULL,'hard',lvl);
 END LOOP;
 IF (r#>>'{xp,appXp}')::int<>333 THEN RAISE EXCEPTION 'restricted normal plus native full HARD %',r;END IF;
 FOR lvl IN 1..3 LOOP
  FOREACH n IN ARRAY ARRAY[4,10,20] LOOP r:=pg_temp.record_selection(p,n,NULL,'classic',lvl);END LOOP;
  r:=pg_temp.record_selection(p,10,NULL,'sudden',lvl);
 END LOOP;
 IF (r#>>'{xp,appXp}')::int<>594 OR (SELECT count(*) FROM connect_xp_milestones WHERE student_id=p)<>27 THEN RAISE EXCEPTION 'topups cap %',r;END IF;
 p:='00000000-0000-4000-8000-000000000106';r:=pg_temp.record_selection(p,10,NULL,'sudden',1,'["add"]');IF (r#>>'{xp,delta}')::int<>12 THEN RAISE EXCEPTION 'half sudden';END IF;
 r:=pg_temp.record_selection(p,5,NULL,'sudden');IF (r#>>'{xp,delta}')::int<>6 THEN RAISE EXCEPTION 'sudden5 complement';END IF;
 r:=pg_temp.record_selection(p,10,NULL,'sudden');IF (r#>>'{xp,delta}')::int<>6 OR (r#>>'{xp,appXp}')::int<>24 THEN RAISE EXCEPTION 'sudden10 complement';END IF;
END $$;
SELECT 'PASS mixed SQL: 594 cap, 27 rights, half/full topups once, lucky all-three, reset/replay tranche isolation, integer rounding, two series orders, durable dedup, CAS, epochs, grants, hidden catalogue';
