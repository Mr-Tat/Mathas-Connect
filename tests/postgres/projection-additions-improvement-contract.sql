-- Test PostgreSQL jetable : aucun profil élève réel.
\ir projection-score-ledger-contract.sql
\ir ../../supabase/release-candidates/20261031_projection_v2_explicit_score_consent.sql

ALTER TABLE public.connect_students ADD COLUMN archived_at timestamptz;
CREATE TABLE public.connect_teacher_players(teacher_id uuid,student_id uuid);
CREATE TABLE public.connect_class_permissions(
 class_id uuid, teacher_id uuid, can_manage boolean NOT NULL DEFAULT false);
INSERT INTO public.connect_apps(app_key) VALUES ('addition-ecrite-multiple');

INSERT INTO public.connect_projection_score_events(
 student_id,class_id,app_key,event_id,game_mode,game_score,game_total,game_points,played_at
) VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111',
 'addition-ecrite-simple','aaaaaaaa-4444-4444-8444-aaaaaaaaaaaa','classic',4,4,20,now()),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111',
 'addition-ecrite-simple','aaaaaaaa-5555-4555-8555-aaaaaaaaaaaa','three-lives',9,NULL,20,now()),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111',
 'addition-ecrite-simple','aaaaaaaa-6666-4666-8666-aaaaaaaaaaaa','sudden',8,NULL,19,now()),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111',
 'addition-ecrite-simple','aaaaaaaa-7777-4777-8777-aaaaaaaaaaaa','hard-sudden',12,NULL,50,now()),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111',
 'addition-ecrite-multiple','aaaaaaaa-8888-4888-8888-aaaaaaaaaaaa','hard-three-lives',7,NULL,25,now());

\ir ../../supabase/release-candidates/20261103_projection_additions_improved_only.sql

DO $assert$
DECLARE
 who constant uuid:='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 classroom constant uuid:='11111111-1111-4111-8111-111111111111';
 first_event constant uuid:='aaaaaaaa-4444-4444-8444-aaaaaaaaaaaa';
 same_event constant uuid:='aaaaaaaa-5555-4555-8555-aaaaaaaaaaaa';
 smaller constant uuid:='aaaaaaaa-6666-4666-8666-aaaaaaaaaaaa';
 bigger constant uuid:='aaaaaaaa-7777-4777-8777-aaaaaaaaaaaa';
 multiple constant uuid:='aaaaaaaa-8888-4888-8888-aaaaaaaaaaaa';
 reply jsonb; overview jsonb;
BEGIN
 reply:=public.connect_projection_share_improved_addition_v1(who,classroom,'addition-ecrite-simple',first_event);
 IF reply->>'ok' IS DISTINCT FROM 'true' OR (reply->>'boardBest')::int<>20
 THEN RAISE EXCEPTION 'First score failed to publish: %',reply;END IF;

 reply:=public.connect_projection_share_improved_addition_v1(who,classroom,'addition-ecrite-simple',first_event);
 IF reply->>'error' IS DISTINCT FROM 'not_improved'
 THEN RAISE EXCEPTION 'Duplicate publication was accepted';END IF;

 reply:=public.connect_projection_share_improved_addition_v1(who,classroom,'addition-ecrite-simple',same_event);
 IF reply->>'error' IS DISTINCT FROM 'not_improved'
 THEN RAISE EXCEPTION 'Equal points were accepted';END IF;

 reply:=public.connect_projection_share_improved_addition_v1(who,classroom,'addition-ecrite-simple',smaller);
 IF reply->>'error' IS DISTINCT FROM 'not_improved'
 THEN RAISE EXCEPTION 'Fewer points were accepted';END IF;

 reply:=public.connect_projection_share_improved_addition_v1(who,classroom,'addition-ecrite-simple',bigger);
 IF reply->>'ok' IS DISTINCT FROM 'true' OR (reply->>'boardBest')::int<>50
 THEN RAISE EXCEPTION 'Higher points were rejected';END IF;

 reply:=public.connect_projection_share_improved_addition_v1(who,classroom,'addition-ecrite-simple',
 'aaaaaaaa-eeee-4eee-8eee-aaaaaaaaaaaa');
 IF reply->>'error' IS DISTINCT FROM 'event_not_found'
 THEN RAISE EXCEPTION 'Unverified event was published';END IF;

 reply:=public.connect_projection_share_improved_addition_v1(who,classroom,'addition-ecrite-multiple',multiple);
 IF reply->>'ok' IS DISTINCT FROM 'true' OR (reply->>'boardBest')::int<>25
 THEN RAISE EXCEPTION 'Addition multiple record was not independent';END IF;

 overview:=public.connect_projection_addition_score_summary_v1(who,classroom,'addition-ecrite-simple');
 IF (overview->>'boardBest')::int<>50
 OR (overview->'todayBest'->>'points')::int<>50
 OR jsonb_array_length(overview->'bestThree')<>3
 OR (overview->'bestThree'->0->>'points')::int<>50
 OR jsonb_array_length(overview->'events')<4
 THEN RAISE EXCEPTION 'Personal history / today / top three incorrect: %',overview;END IF;

 IF (SELECT count(*) FROM public.connect_projection_score_consents
  WHERE student_id=who AND class_id=classroom AND app_key='addition-ecrite-simple')<>2
 THEN RAISE EXCEPTION 'Equal or lower score created an extra consent';END IF;

 IF has_function_privilege('anon',
  'public.connect_projection_share_improved_addition_v1(uuid,uuid,text,uuid)','EXECUTE')
 OR has_function_privilege('authenticated',
  'public.connect_projection_addition_score_summary_v1(uuid,uuid,text)','EXECUTE')
 OR NOT has_function_privilege('service_role',
  'public.connect_projection_share_improved_addition_v1(uuid,uuid,text,uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'Unsafe RPC permissions';END IF;

 -- Le reset du tableau interdit le renvoi des anciens événements mais
 -- conserve les points personnels, records et XP.
 UPDATE public.connect_projection_score_periods SET score_since=now()+interval '1 minute'
 WHERE class_id=classroom AND app_key='addition-ecrite-simple';
 reply:=public.connect_projection_share_improved_addition_v1(who,classroom,'addition-ecrite-simple',bigger);
 IF reply->>'error' IS DISTINCT FROM 'score_reset'
 THEN RAISE EXCEPTION 'Previous-period score was accepted after reset';END IF;

 IF (SELECT count(*) FROM public.connect_projection_score_events WHERE student_id=who)<6
 THEN RAISE EXCEPTION 'An old school result was lost';END IF;
END $assert$;
SELECT 'OK: two additions; all modes, strictly higher points, historical scores, reset and RLS grants' AS result;
