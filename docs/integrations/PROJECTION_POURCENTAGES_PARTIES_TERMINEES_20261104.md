# Projection V2 — pourcentages sur parties terminées

Statut : **[REPO candidat] — NON DÉPLOYÉ**. Ne pas annoncer les pourcentages LIVE tant que les deux déploiements ne sont pas terminés et vérifiés.

## Ce que l'on peut calculer de manière vérifiable

Les parties de calcul terminées et enregistrées dans `connect_states.recent` génèrent des événements uniques dans `connect_projection_score_events` (via le déclencheur existant `connect_projection_capture_scores_v1`).
Chaque événement contient un `game_score` (exercices justes) et un `game_total` (nombre d'exercices de la partie terminée). L'agrégat demandé est :

- Par jeu : `100 × SUM(game_score) / SUM(game_total)` sur les parties complètes admissibles.
- Global : même quotient, en sommant les applications cochées dans les réglages de % du professeur, **sans moyenne naïve**.
- `— %` lorsqu'aucun dénominateur fiable n'est disponible. Aucune extrapolation ni pourcentage inventé.

Le SQL exclut la Mort subite (dont le total peut contenir des exercices jamais présentés), les événements aberrants, les élèves qui ont quitté la classe et le profil professeur. Les résultats restent anonymes, agrégés par classe et application. Aucun XP, score individuel ou consentement de publication n'est modifié.

## Limite importante : parties interrompues

**Il ne s'agit PAS encore de la mesure exhaustive des exercices individuellement tentés.**
Les jeux ne journalisent actuellement pas chaque exercice commencé et terminé lors d'une partie interrompue. Les exercices de ces parties n'entrent donc pas dans le calcul. Le panneau l'explique explicitement.

Pour atteindre la mesure exacte souhaitée (y compris les abandons), prévoir ultérieurement une télémétrie idempotente côté exercice, auth Connect et validation serveur pour chaque moteur. Ne jamais remplacer ce manque de données par `game_total` d'une partie incomplète, ni par des XP, trophées ou scores de projection publiés.

## Ordre de mise en production — autorisation requise

1. Vérifier la branche/PR par CI et vérifier que les données des classes TEST ne sont pas mélangées aux classes réelles.
2. Faire valider au professeur l'activation de la fonction SQL **et** de la fonction Edge en production.
3. Appliquer seulement `supabase/release-candidates/20261104_projection_completed_games_success_percentage.sql` au projet Connect `awmhpfofacaglewammxt`. Ne jamais intervenir dans l'ancien Math'as.
4. Déployer `supabase/functions/connect-projection-v2/index.ts` et `percentages.mjs` comme un ensemble cohérent, sans changer son auth ni ses secrets.
5. Vérifier la session professeur LIVE, une classe avec données enregistrées, une classe sans événement (`— %`), le Global pondéré et une comparaison interclasses.
6. Si l'agrégat ne répond pas, l'Edge renvoie `percentages: null` sans bloquer les classements. Revenir au précédent Edge si nécessaire.
7. Retour arrière SQL facultatif après rollback Edge : `DROP FUNCTION IF EXISTS public.connect_projection_completed_attempt_counts_v1(uuid[]);`.

## Garanties existantes

- Le RPC n'est accordé qu'au rôle `service_role` ; l'Edge vérifie `getUser`, `connect_teachers`, `ownClasses` et les comparaisons autorisées **avant** sa lecture.
- Ne pas installer une tâche répétitive côté navigateur ; la lecture classe existe déjà toutes les 20 secondes.
- Aucun changement à l'inscription, aux scores nominaux, aux XP, aux trophées ou à la réinitialisation des scores.
