-- Multiplication collective : distinguer la séance pédagogique de la connexion Math'as Connect.
-- Le professeur maintient une présence par onglet ; fermeture signalée avec délai de reprise.
-- Les lignes existantes restent intactes (ancienne séance à expiration naturelle).
alter table public.connect_guided_multiplication_sessions
 add column if not exists host_client_id uuid,
 add column if not exists host_page_id uuid,
 add column if not exists host_seen_at timestamptz,
 add column if not exists close_requested_at timestamptz;

comment on column public.connect_guided_multiplication_sessions.host_client_id is 'Identifiant éphémère de l’onglet professeur : pas une identité d’élève ni un secret d’authentification.';
comment on column public.connect_guided_multiplication_sessions.host_page_id is 'Identifiant neuf à chaque chargement : une fermeture tardive ne peut pas tuer une page fraîchement rechargée.';
comment on column public.connect_guided_multiplication_sessions.host_seen_at is 'Dernière présence du professeur : une séance orpheline expire même si le navigateur n’a pas pu signaler sa fermeture.';
comment on column public.connect_guided_multiplication_sessions.close_requested_at is 'Fermeture de page signalée : délai de grâce pour ne pas tuer une simple actualisation de la page.';
