-- Run ONLY on a disposable PG16 fixture. All pupil/class UUIDs are fictitious.
CREATE OR REPLACE FUNCTION public.test_school_addition_answers(p_questions jsonb,p_level int,p_app text)
RETURNS jsonb LANGUAGE plpgsql AS $fn$
DECLARE
 answers jsonb:='[]'::jsonb; q jsonb; terms jsonb;
 i int;j int;k int;width int;total int;sum_val int;carry int;partial int;base int;
 digits jsonb;carries jsonb;
BEGIN
 width:=CASE WHEN p_app='addition-ecrite-simple'
   THEN CASE p_level WHEN 1 THEN 3 WHEN 2 THEN 5 ELSE 7 END ELSE p_level+4 END;
 FOR i IN 0..jsonb_array_length(p_questions)-1 LOOP
  q:=p_questions->i;
  terms:=CASE WHEN p_app='addition-ecrite-simple'
   THEN jsonb_build_array((q->>'a')::int,(q->>'b')::int) ELSE q->'addends' END;
  SELECT sum(value::int) INTO sum_val
    FROM jsonb_array_elements_text(terms) elem(value);
  digits:='[]'::jsonb;
  FOR j IN 0..length(sum_val::text)-1 LOOP
   digits:=digits||to_jsonb(((sum_val/(10^j)::int)%10)::text);
  END LOOP;
  carries:=jsonb_build_array('');
  FOR j IN 1..width-1 LOOP
   base:=(10^j)::int;partial:=0;
   FOR k IN 0..jsonb_array_length(terms)-1 LOOP
    partial:=partial+((terms->>k)::int % base);
   END LOOP;
   carry:=partial/base;
   carries:=carries||to_jsonb(CASE WHEN carry=0 THEN '' ELSE carry::text END);
  END LOOP;
  answers:=answers||jsonb_build_array(jsonb_build_object(
   'id',q->>'id','digits',digits,'carries',carries));
 END LOOP;
 RETURN answers;
END $fn$;

DO $test$
DECLARE
 student uuid:='11111111-1111-4111-8111-111111111111';
 first_class uuid:='8fe170fa-9e8f-4e80-885a-b0ba68026f64';
 other_class uuid:='71f5f4a5-3f25-4ec7-ac29-c33d2e6b395e';
 pilot uuid:='4bf3400d-a315-4ea4-a2f3-afaca24dc9b9';
 outsider uuid:='99999999-9999-4999-8999-999999999999';
 app text;lvl int;num int;
 issued jsonb;received jsonb;duplicate jsonb;answer jsonb;
 id uuid;result_id uuid;counter int:=0;
BEGIN
 FOR app IN SELECT unnest(ARRAY['addition-ecrite-simple','addition-ecrite-multiple']) LOOP
  FOR lvl IN 1..3 LOOP
   FOREACH num IN ARRAY ARRAY[4,10,20] LOOP
    IF app='addition-ecrite-simple' THEN
     issued:=public.connect_objective_record_school_issue_add_v1(student,first_class,lvl,num);
    ELSE
     issued:=public.connect_objective_record_school_issue_multi_v1(student,first_class,lvl,num);
    END IF;
    IF issued->>'ok'<>'true' OR jsonb_array_length(issued->'questions')<>num
      OR (issued->>'level')::int<>lvl
    THEN RAISE EXCEPTION 'school_issue_failed % % %',app,lvl,num;END IF;
    id:=(issued->>'sessionId')::uuid;
    IF (SELECT class_id FROM public.connect_objective_record_school_proof_sessions
      WHERE session_id=id) IS DISTINCT FROM first_class
    THEN RAISE EXCEPTION 'wrong_class_in_session';END IF;
    answer:=public.test_school_addition_answers(issued->'questions',lvl,app);
    IF app='addition-ecrite-simple' THEN
     received:=public.connect_objective_record_school_finish_add_v1(student,first_class,id,answer);
     duplicate:=public.connect_objective_record_school_finish_add_v1(student,first_class,id,answer);
    ELSE
     received:=public.connect_objective_record_school_finish_multi_v1(student,first_class,id,answer);
     duplicate:=public.connect_objective_record_school_finish_multi_v1(student,first_class,id,answer);
    END IF;
    IF received->>'ok'<>'true' OR received->>'proofVerified'<>'true'
      OR (received->>'verifiedScore')::int<>num
    THEN RAISE EXCEPTION 'school_grade_failed % % % %',app,lvl,num,received;END IF;
    IF duplicate->>'duplicate'<>'true' OR (duplicate#>>'{xp,delta}')::int<>0
    THEN RAISE EXCEPTION 'duplicate_awarded_again';END IF;
    counter:=counter+1;
   END LOOP;
  END LOOP;
 END LOOP;
 IF counter<>18 THEN RAISE EXCEPTION 'not_18_variants';END IF;
 IF (SELECT count(*) FROM public.connect_objective_record_school_proof_sessions)<>18
 THEN RAISE EXCEPTION 'school_sessions_lost';END IF;
 IF (SELECT count(*) FROM public.connect_objective_record_school_receipts
  WHERE app_key='addition-ecrite-simple')<>9
 THEN RAISE EXCEPTION 'simple_atomic_receipts_lost';END IF;
 -- The school ledger never accepts the TEST classroom, another school without
 -- enrollment, an unapproved student, or a cross-class finish.
 BEGIN
  PERFORM public.connect_objective_record_school_issue_add_v1(student,pilot,1,4);
  RAISE EXCEPTION 'test_class_accepted';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM<>'school_class_not_allowed' THEN RAISE;END IF;
 END;
 BEGIN
  PERFORM public.connect_objective_record_school_issue_multi_v1(student,other_class,1,4);
  RAISE EXCEPTION 'cross_class_accepted';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM<>'not_school_subject' THEN RAISE;END IF;
 END;
 BEGIN
  PERFORM public.connect_objective_record_school_issue_add_v1(outsider,first_class,1,4);
  RAISE EXCEPTION 'unenrolled_accepted';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM<>'not_school_subject' THEN RAISE;END IF;
 END;
 issued:=public.connect_objective_record_school_issue_add_v1(student,first_class,1,4);
 id:=(issued->>'sessionId')::uuid;
 answer:=public.test_school_addition_answers(issued->'questions',1,'addition-ecrite-simple');
 BEGIN
  PERFORM public.connect_objective_record_school_finish_add_v1(student,other_class,id,answer);
  RAISE EXCEPTION 'cross_class_finish_accepted';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM<>'proof_not_found' THEN RAISE;END IF;
 END;
 -- Incorrect first try cannot receive perfect score even if browser claims it.
 answer:=jsonb_set(answer,'{0,digits,0}',
  to_jsonb(CASE WHEN answer#>>'{0,digits,0}'='0' THEN '1' ELSE '0' END),false);
 received:=public.connect_objective_record_school_finish_add_v1(student,first_class,id,answer);
 IF (received->>'verifiedScore')::int<>3
 THEN RAISE EXCEPTION 'incorrect_first_try_credited';END IF;
 -- Direct web roles may NOT invoke proof or award functions.
 IF has_function_privilege('anon','public.connect_objective_record_school_finish_add_v1(uuid,uuid,uuid,jsonb)','EXECUTE')
   OR has_function_privilege('authenticated','public.connect_objective_record_school_finish_multi_v1(uuid,uuid,uuid,jsonb)','EXECUTE')
   OR has_table_privilege('anon','public.connect_objective_record_school_proof_sessions','SELECT')
 THEN RAISE EXCEPTION 'untrusted_role_can_grade';END IF;
 RAISE NOTICE 'School additions 18 variants, idempotency, wrong digits, class isolation, RLS PASS';
END $test$;
