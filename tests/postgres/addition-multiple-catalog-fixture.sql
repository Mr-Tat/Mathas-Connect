-- Disposable schema reconstructed from read-only production metadata, 2026-10-29.
-- No real students, classes, XP or production connections.
CREATE TABLE public.connect_apps (
 app_key text PRIMARY KEY CHECK (app_key ~ '^[a-z0-9][a-z0-9._-]{1,79}$'),
 title text NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
 launch_url text NOT NULL CHECK (launch_url ~ '^https://[^[:space:]]+$'),
 image_url text CHECK (image_url IS NULL OR image_url ~ '^https://[^[:space:]]+$'),
 enabled boolean NOT NULL DEFAULT false,
 hub_section text NOT NULL CHECK (hub_section ~ '^[a-z0-9_-]{1,40}$'),
 featured boolean NOT NULL DEFAULT false,
 display_order integer NOT NULL DEFAULT 0
);
CREATE TABLE public.connect_hub_presets (slug text PRIMARY KEY);
CREATE TABLE public.connect_hub_preset_entries (
 preset_slug text NOT NULL REFERENCES public.connect_hub_presets(slug) ON DELETE CASCADE,
 app_key text NOT NULL REFERENCES public.connect_apps(app_key) ON DELETE CASCADE,
 section text NOT NULL CHECK (section ~ '^[a-z0-9_-]{2,40}$'),
 display_order integer NOT NULL DEFAULT 0,
 visible boolean NOT NULL DEFAULT true,
 featured boolean NOT NULL DEFAULT false,
 PRIMARY KEY (preset_slug,app_key)
);
CREATE TABLE public.connect_xp_award_rules (
 app_key text NOT NULL REFERENCES public.connect_apps(app_key) ON DELETE CASCADE,
 award_key text NOT NULL,points integer NOT NULL CHECK (points BETWEEN 0 AND 500),
 ruleset_version integer NOT NULL DEFAULT 2,PRIMARY KEY(app_key,award_key)
);
INSERT INTO public.connect_apps(app_key,title,launch_url,enabled,hub_section,featured,display_order)
VALUES ('addition-ecrite-simple','Addition écrite simple','https://example.test/simple',true,'calculs_ecrits',true,1);
INSERT INTO public.connect_hub_presets(slug) VALUES ('observation'),('phase1'),('phase2'),('2eco');
INSERT INTO public.connect_hub_preset_entries(preset_slug,app_key,section,display_order,visible,featured)
SELECT slug,'addition-ecrite-simple','calculs_ecrits',1,true,true FROM public.connect_hub_presets;
INSERT INTO public.connect_xp_award_rules(app_key,award_key,points)
VALUES ('addition-ecrite-simple','classic:4:perfect',22);
