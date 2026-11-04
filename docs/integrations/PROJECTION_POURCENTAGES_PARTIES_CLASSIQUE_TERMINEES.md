# Projection V2 — pourcentages de réussite (périmètre réel)

## Activé : taux sur les parties Classique terminées et enregistrées

Par application : **100 × (total des réponses justes) / (total des questions des parties Classique terminées)**. Le taux **Global** additionne tous les numérateurs et dénominateurs des applications sélectionnées dans les réglages de %, puis effectue **une seule division**. Il n'est pas la moyenne des pourcentages des jeux.

Données : `public.connect_projection_score_events` (événements dédupliqués issus des jeux, `game_score`, `game_total`), uniquement pour les élèves actuellement inscrits, hors profil professeur. On ignore les événements incohérents, les parties à arrêt anticipé et les applications sans résultat valable. Le résultat absent est **— %**, jamais 0 % par défaut. Chaque classe comparée ne reçoit que ses propres agrégats.

La fonction `connect_projection_completed_attempt_counts_v1` est réservée à `service_role`. L'Edge Function `connect-projection-v2` valide le JWT, le statut de professeur et la permission de gérer **chacune** des classes avant de demander ces agrégats SQL. Aucun score individuel ni identité n'est renvoyé dans les données de pourcentages.

## Limite actuellement incontournable

**Les exercices d'une partie interrompue ne sont pas comptés.** Les jeux actuels ne journalisent pas de manière fiable chaque exercice commencé, juste ou faux, à l'intérieur d'une partie non terminée. Ce taux est donc exact **pour les exercices des parties Classique terminées**, mais ne mesure **pas** encore tous les exercices que l'élève a commencés.

Les modes 3 vies et Mort subite sont exclus : leur `game_total` peut comprendre des questions non proposées. Un pourcentage déduit de ce total serait faux. Le tableau porte donc la mention « Parties Classique terminées uniquement · abandons exclus ».

L'étape nécessaire pour des taux exhaustifs est une télémétrie d'événements par exercice (identifiant unique, élève et application validés par Connect, started/correct côté serveur, déduplication, support hors ligne) dans chaque moteur. Ce travail ne doit pas être confondu avec l'activation de l'agrégat actuel.

## Déploiement et repli

1. Tests modèles, SQL-contracts et navigateur simulé sur des profils fictifs.
2. Exécuter le SQL de `supabase/release-candidates/20261104_projection_completed_games_success_percentage.sql` dans une migration contrôlée.
3. Déployer les fichiers `index.ts`, `exploits.mjs` et `percentages.mjs` de `supabase/functions/connect-projection-v2/`, **JWT activé**.
4. Vérifier la fonction SQL, ses droits, les agrégats, puis le client GitHub Pages.
5. Sans agrégat SQL, l'API renvoie `percentages: null`, et le tableau reste lisible avec `— %`. Le classement et les trophées ne dépendent pas du calcul.
6. La réinitialisation des scores projetés ne modifie **jamais** les résultats, XP, trophées ou statistiques de réussite.

Date de mise au point : 4 novembre 2026.
