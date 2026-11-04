-- Disposable PostgreSQL 16 ONLY. No hosted students, classes, or scores.
CREATE OR REPLACE FUNCTION public.test_mul_first_attempts(p_questions jsonb,p_style text DEFAULT 'empty')
RETURNS jsonb LANGUAGE plpgsql AS $fn$
DECLARE
  out_answers jsonb:='[]'::jsonb;
  q jsonb;a numeric;m integer;product numeric;digits jsonb;carries jsonb;
  i integer;j integer;width integer;expected numeric;carry text;
BEGIN
  FOR i IN 0..jsonb_array_length(p_questions)-1 LOOP
    q:=p_questions->i;a:=(q->>'a')::numeric;m:=(q->>'m')::integer;
    product:=a*m;width:=length(q->>'a');
    digits:='[]'::jsonb;
    FOR j IN 0..length(product::text)-1 LOOP
      digits:=digits||to_jsonb(mod(trunc(product/power(10::numeric,j)),10)::text);
    END LOOP;
    carries:=jsonb_build_array('');
    FOR j IN 1..width-1 LOOP
      expected:=trunc(mod(a,power(10::numeric,j))*m/power(10::numeric,j));
      carry:=CASE WHEN p_style='correct' AND expected>0 THEN expected::text ELSE '' END;
      carries:=carries||to_jsonb(carry);
    END LOOP;
    out_answers:=out_answers||jsonb_build_array(jsonb_build_object(
      'id',q->>'id','digits',digits,'carries',carries));
  END LOOP;
  RETURN out_answers;
END $fn$;

DO $test$
DECLARE
  student uuid:='11111111-1111-4111-8111-111111111111';
  pilot uuid:='4bf3400d-a315-4ea4-a2f3-afaca24dc9b9';
  outsider uuid:='99999999-9999-4999-8999-999999999999';
  issued jsonb;answer jsonb;graded jsonb;replayed jsonb;
  sid uuid;q jsonb;a numeric;m integer;expected numeric;wrong text;
  mode text;num integer;lvl integer;check_count integer:=0;
BEGIN
  -- Complete FIRST tries, empty carries: 4 / 10 / 20 for all three levels.
  FOR lvl IN 1..3 LOOP
    FOREACH num IN ARRAY ARRAY[4,10,20] LOOP
      issued:=public.connect_objective_record_school_mul_issue_classic_v1(
        student,pilot,lvl,num,ARRAY[9]);
      IF issued->>'ok' <> 'true' OR jsonb_array_length(issued->'questions')<>num
      THEN RAISE EXCEPTION 'classic issue failed % %',lvl,num; END IF;
      sid:=(issued->>'sessionId')::uuid;
      answer:=public.test_mul_first_attempts(issued->'questions');
      graded:=public.connect_objective_record_school_mul_finish_classic_v1(
        student,pilot,sid,answer);
      IF graded->>'proofVerified'<>'true' OR (graded->>'verifiedScore')::int<>num
      THEN RAISE EXCEPTION 'empty optional carries penalized % % %',lvl,num,graded;END IF;
      replayed:=public.connect_objective_record_school_mul_finish_classic_v1(
        student,pilot,sid,answer);
      IF replayed->>'duplicate'<>'true' OR (replayed#>>'{xp,delta}')::integer<>0
      THEN RAISE EXCEPTION 'classic duplicate XP % %',lvl,num;END IF;
      check_count:=check_count+1;
    END LOOP;
  END LOOP;
  IF check_count<>9 THEN RAISE EXCEPTION 'missing classic variants';END IF;

  -- A written but incorrect carry is an error, even with perfect product digits.
  issued:=public.connect_objective_record_school_mul_issue_classic_v1(
    student,pilot,1,4,ARRAY[9]);
  sid:=(issued->>'sessionId')::uuid;
  answer:=public.test_mul_first_attempts(issued->'questions','correct');
  q:=issued#>'{questions,0}';a:=(q->>'a')::numeric;m:=(q->>'m')::integer;
  expected:=trunc(mod(a,10::numeric)*m/10::numeric);
  wrong:=CASE WHEN expected=0 THEN '1' ELSE '0' END;
  answer:=jsonb_set(answer,'{0,carries,1}',to_jsonb(wrong),false);
  graded:=public.connect_objective_record_school_mul_finish_classic_v1(student,pilot,sid,answer);
  IF (graded->>'verifiedScore')::integer<>3
  THEN RAISE EXCEPTION 'incorrect carry awarded points %',graded;END IF;

  -- Missing carry must NOT consume a life in 3-vies or end Mort subite.
  FOREACH mode IN ARRAY ARRAY['sudden','three-lives','hard-sudden','hard-three-lives'] LOOP
    issued:=public.connect_objective_record_school_mul_issue_extended_v1(
      student,pilot,mode,1,
      CASE WHEN mode LIKE 'hard-%' THEN ARRAY[2,3,4,5,6,7,8,9] ELSE ARRAY[9] END);
    IF jsonb_array_length(issued->'questions')<>120 THEN
      RAISE EXCEPTION 'extended issue %',mode;END IF;
    sid:=(issued->>'sessionId')::uuid;
    num:=CASE WHEN mode LIKE '%three-lives' THEN 4 ELSE 2 END;
    answer:=public.test_mul_first_attempts(
      (SELECT jsonb_agg(value ORDER BY ord)
       FROM jsonb_array_elements(issued->'questions') WITH ORDINALITY AS z(value,ord)
       WHERE ord<=num),'empty');
    -- Keep the first multiplication correct with blank reports, then produce
    -- exactly the required number of wrong first digit answers to end.
    FOR lvl IN 1..num-1 LOOP
      wrong:=CASE WHEN answer#>>ARRAY[lvl::text,'digits','0']='0' THEN '1' ELSE '0' END;
      answer:=jsonb_set(answer,ARRAY[lvl::text,'digits','0'],to_jsonb(wrong),false);
    END LOOP;
    graded:=public.connect_objective_record_school_mul_finish_extended_v1(
      student,pilot,sid,answer);
    IF graded->>'proofVerified'<>'true' OR (graded->>'verifiedScore')::int<>1
      OR (graded->>'attempted')::int<>num
    THEN RAISE EXCEPTION 'extended grading failed % %',mode,graded;END IF;
    replayed:=public.connect_objective_record_school_mul_finish_extended_v1(
      student,pilot,sid,answer);
    IF replayed->>'duplicate'<>'true' OR (replayed#>>'{xp,delta}')::int<>0
    THEN RAISE EXCEPTION 'extended duplicate XP %',mode;END IF;
    IF mode LIKE 'hard-%' AND (issued->>'width')::integer<>10
    THEN RAISE EXCEPTION 'HARD width %',mode;END IF;
  END LOOP;
  IF has_function_privilege('anon',
    'public.connect_objective_record_school_mul_finish_classic_v1(uuid,uuid,uuid,jsonb)',
    'EXECUTE') OR has_function_privilege('authenticated',
    'public.connect_objective_record_school_mul_finish_extended_v1(uuid,uuid,uuid,jsonb)',
    'EXECUTE') THEN RAISE EXCEPTION 'web role may grade'; END IF;
  BEGIN
    PERFORM public.connect_objective_record_school_mul_issue_classic_v1(
      outsider,pilot,1,4,ARRAY[9]);
    RAISE EXCEPTION 'unenrolled outsider admitted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM<>'not_school_subject' THEN RAISE; END IF;
  END;
  RAISE NOTICE 'PASS: 9 classic first attempts, invalid carry, 4 extended modes, XP replay, ACL';
END $test$;
