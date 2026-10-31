-- Projection V2 - journal de scores indépendant des parcours (PostgreSQL 16).
-- Aucune modification des scores, XP, trophées ou états de jeu existants.
-- Exécuter après validation des assertions sur PostgreSQL jetable.

CREATE TABLE IF NOT EXISTS public.connect_projection_score_events (
  student_id uuid NOT NULL REFERENCES public.connect_students(id) ON DELETE RESTRICT,
  class_id uuid NOT NULL REFERENCES public.connect_classes(id) ON DELETE RESTRICT,
  app_key text NOT NULL REFERENCES public.connect_apps(app_key) ON DELETE RESTRICT,
  event_id uuid NOT NULL,
  game_mode text NOT NULL CHECK (length(game_mode) BETWEEN 2 AND 40),
  game_score integer NOT NULL CHECK (game_score>=0),
  game_total integer,
  game_points integer,
  played_at timestamptz NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (student_id,app_key,event_id),
  CHECK (game_total IS NULL OR game_total>=0),
  CHECK (game_points IS NULL OR game_points>=0)
);
CREATE INDEX IF NOT EXISTS connect_projection_score_events_class_app_date_idx
  ON public.connect_projection_score_events(class_id,app_key,played_at DESC);

CREATE TABLE IF NOT EXISTS public.connect_projection_score_periods (
  class_id uuid NOT NULL REFERENCES public.connect_classes(id) ON DELETE RESTRICT,
  app_key text NOT NULL REFERENCES public.connect_apps(app_key) ON DELETE RESTRICT,
  score_since timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  PRIMARY KEY (class_id,app_key)
);

CREATE TABLE IF NOT EXISTS public.connect_projection_settings (
  class_id uuid PRIMARY KEY REFERENCES public.connect_classes(id) ON DELETE RESTRICT,
  options jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(options)='object'),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.connect_projection_score_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connect_projection_score_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connect_projection_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.connect_projection_score_events FROM PUBLIC,anon,authenticated;
REVOKE ALL ON public.connect_projection_score_periods FROM PUBLIC,anon,authenticated;
REVOKE ALL ON public.connect_projection_settings FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.connect_projection_score_events TO service_role;
GRANT SELECT,INSERT,UPDATE ON public.connect_projection_score_periods TO service_role;
GRANT SELECT,INSERT,UPDATE ON public.connect_projection_settings TO service_role;

-- Capture uniquement les parties déjà enregistrées par le moteur connecté.
-- Refuse d'inférer la classe si une fiche est inscrite à plusieurs classes.
-- Une restauration/relecture du même event_id n'attribue jamais de nouveaux points.
-- Les erreurs de journalisation ne bloquent jamais la sauvegarde du vrai jeu.
CREATE OR REPLACE FUNCTION public.connect_projection_capture_scores_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE
  classes uuid[];
  class_value uuid;
  part jsonb;
  sid text;
  score_text text;
  points_text text;
  total_text text;
  at_text text;
  mode_text text;
  played timestamptz;
BEGIN
  BEGIN
    IF jsonb_typeof(NEW.state_data->'recent') IS DISTINCT FROM 'array' THEN RETURN NEW; END IF;
    SELECT array_agg(class_id ORDER BY joined_at DESC) INTO classes
      FROM public.connect_enrollments
      WHERE student_id=NEW.student_id AND left_at IS NULL;
    IF coalesce(cardinality(classes),0)<>1 THEN RETURN NEW; END IF;
    class_value:=classes[1];
    FOR part IN SELECT value FROM jsonb_array_elements(NEW.state_data->'recent') LOOP
      sid:=part->>'eventId';
      score_text:=part->>'score';
      points_text:=part->>'points';
      total_text:=part->>'total';
      at_text:=part->>'at';
      mode_text:=part->>'mode';
      IF sid IS NULL OR sid !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
         OR score_text IS NULL OR score_text !~ '^[0-9]{1,8}$'
         OR at_text IS NULL OR at_text !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T'
         OR mode_text IS NULL OR length(mode_text)>40 THEN
        CONTINUE;
      END IF;
      BEGIN
        played:=at_text::timestamptz;
        IF played>now()+interval '5 minutes' THEN CONTINUE; END IF;
        INSERT INTO public.connect_projection_score_events(
          student_id,class_id,app_key,event_id,game_mode,game_score,
          game_total,game_points,played_at
        ) VALUES(
          NEW.student_id,class_value,NEW.app_key,sid::uuid,mode_text,score_text::integer,
          CASE WHEN total_text ~ '^[0-9]{1,8}$' THEN total_text::integer ELSE NULL END,
          CASE WHEN points_text ~ '^[0-9]{1,8}$' THEN points_text::integer ELSE NULL END,
          played
        ) ON CONFLICT(student_id,app_key,event_id) DO NOTHING;
      EXCEPTION WHEN OTHERS THEN
        -- Ne jamais faire échouer l'enregistrement d'un vrai élève pour l'affichage.
        CONTINUE;
      END;
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    RETURN NEW;
  END;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.connect_projection_capture_scores_v1() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS connect_projection_capture_scores_v1 ON public.connect_states;
CREATE TRIGGER connect_projection_capture_scores_v1
AFTER INSERT OR UPDATE OF state_data ON public.connect_states
FOR EACH ROW EXECUTE FUNCTION public.connect_projection_capture_scores_v1();

-- Backfill borné aux trois dernières parties conservées et identifiées.
-- Ce n'est PAS un historique exhaustif et ce journal n'invente jamais des tentatives.
INSERT INTO public.connect_projection_score_events(
  student_id,class_id,app_key,event_id,game_mode,game_score,game_total,game_points,played_at
)
SELECT s.student_id,en.class_id,s.app_key,
       (part.value->>'eventId')::uuid,
       part.value->>'mode',
       (part.value->>'score')::integer,
       CASE WHEN part.value->>'total' ~ '^[0-9]{1,8}$' THEN (part.value->>'total')::integer ELSE NULL END,
       CASE WHEN part.value->>'points' ~ '^[0-9]{1,8}$' THEN (part.value->>'points')::integer ELSE NULL END,
       (part.value->>'at')::timestamptz
FROM public.connect_states s
JOIN public.connect_enrollments en ON en.student_id=s.student_id AND en.left_at IS NULL
CROSS JOIN LATERAL jsonb_array_elements(
  CASE WHEN jsonb_typeof(s.state_data->'recent')='array' THEN s.state_data->'recent' ELSE '[]'::jsonb END
) AS part(value)
WHERE (part.value->>'eventId') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  AND (part.value->>'score') ~ '^[0-9]{1,8}$'
  AND (part.value->>'mode') IS NOT NULL
  AND length(part.value->>'mode') BETWEEN 2 AND 40
  AND (part.value->>'at') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T'
  AND NOT EXISTS (
    SELECT 1 FROM public.connect_enrollments duplicate
    WHERE duplicate.student_id=s.student_id AND duplicate.left_at IS NULL
      AND duplicate.class_id<>en.class_id
  )
ON CONFLICT(student_id,app_key,event_id) DO NOTHING;
