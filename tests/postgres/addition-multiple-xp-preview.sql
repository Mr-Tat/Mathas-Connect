-- Pure isolated XP evaluation: NO student table access, NO credits, NO mutation.
-- NOT a production migration; execution only in disposable PostgreSQL CI.
CREATE OR REPLACE FUNCTION public.connect_addition_multiple_xp_preview(p_state jsonb)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  lvl integer; count_n integer; score_n integer;
  sudden_n integer; hard_n integer;
  points integer:=0; earned jsonb:='[]'::jsonb;
BEGIN
  IF p_state IS NULL OR jsonb_typeof(p_state)<>'object' THEN
    RAISE EXCEPTION 'invalid_state';
  END IF;
  FOR lvl IN 1..3 LOOP
    FOR count_n IN SELECT unnest(ARRAY[4,10,20]) LOOP
      BEGIN
        score_n:= (p_state #>> ARRAY['classic',(lvl-1)::text,count_n::text])::integer;
      EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
        RAISE EXCEPTION 'invalid_classic';
      END;
      IF score_n IS NOT NULL THEN
        IF score_n<0 OR score_n>count_n THEN RAISE EXCEPTION 'invalid_classic'; END IF;
        IF count_n=4 AND score_n=4 THEN
          earned:=earned||to_jsonb('classic:'||lvl||':4:perfect');points:=points+22;
        ELSIF count_n=10 THEN
          IF score_n>=8 THEN earned:=earned||to_jsonb('classic:'||lvl||':10:pass');points:=points+30;END IF;
          IF score_n=10 THEN earned:=earned||to_jsonb('classic:'||lvl||':10:bonus');points:=points+6;END IF;
        ELSIF count_n=20 THEN
          IF score_n>=16 THEN earned:=earned||to_jsonb('classic:'||lvl||':20:pass');points:=points+50;END IF;
          IF score_n=20 THEN earned:=earned||to_jsonb('classic:'||lvl||':20:bonus');points:=points+10;END IF;
        END IF;
      END IF;
    END LOOP;
    BEGIN
      sudden_n:=COALESCE((p_state#>>ARRAY['sudden',(lvl-1)::text])::integer,0);
      hard_n:=COALESCE((p_state#>>ARRAY['hard',(lvl-1)::text])::integer,0);
    EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
      RAISE EXCEPTION 'invalid_record';
    END;
    IF sudden_n<0 OR hard_n<0 OR sudden_n>100000 OR hard_n>100000 THEN RAISE EXCEPTION 'invalid_record';END IF;
    IF sudden_n>=5 THEN earned:=earned||to_jsonb('sudden:'||lvl||':5');points:=points+10;END IF;
    IF sudden_n>=10 THEN earned:=earned||to_jsonb('sudden:'||lvl||':10');points:=points+10;END IF;
    IF hard_n>=3 THEN earned:=earned||to_jsonb('hard:'||lvl||':3');points:=points+10;END IF;
    IF hard_n>=7 THEN earned:=earned||to_jsonb('hard:'||lvl||':7');points:=points+10;END IF;
  END LOOP;
  IF points>474 THEN RAISE EXCEPTION 'xp_cap';END IF;
  RETURN jsonb_build_object('xp',points,'milestones',earned);
END
$fn$;
