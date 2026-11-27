# Connexion scolaire obligatoire — passation PR #366 (27/11/2026)

**Décision professeur (prioritaire sur les anciens tests / guides)** :
- HUB de classe (incluant TEST et Toutes) : identité et appareil approuvés, droits de classe avant ouverture ; aucun démarrage Connect ou repli « Jouer librement » si connexion échoue. Une préférence locale, un paramètre `libre=1`, un `joueur=prof` ou un cache ne sont jamais une autorisation serveur.
- Hors classe : moteur autonome sans compte, sans XP / coupes / projection Connect. Aucun HUB Partage à créer à ce stade.
- Coupure après un début scolaire autorisé : finir la partie, conserver les événements durables sous l'identité, classe, app, époque et eventId ; retransmettre en idempotence après retour réseau, sans célébration officielle avant ACK. Aucune nouvelle activité scolaire hors ligne.
- Vérifications réseau aux événements pertinents seulement (entrée HUB, lancement, changement d'activité contrôlée, fin certifiée, retour HUB), pas de polling ni de requête à chaque réponse.

## Dépôts et périmètre

PR : https://github.com/Mr-Tat/Mathas-Connect/pull/366
Branche : `school-connect-required-20261127` (ne pas confondre avec `main`).
Backend de production : Supabase Math'as Connect `awmhpfofacaglewammxt`.
Adaptateurs : HUB, multiplication, soustraction, addition multiple, calculs mélangés, Objectif record, abaque et milieu. Addition simple scolaire : route Objectif record dans les classes, mais dépôt autonome `CE-Addition-simple` séparé ; ne pas modifier sa source sans audit.

## Travail sur la PR

- La première série de commits imposait déjà `requireConnect` depuis les cartes scolaires et supprimait les principaux boutons de secours libre.
- Correctif complémentaire : une URL porteuse d'une classe reste scolaire malgré `libre=1` ou une ancienne préférence locale. Le HUB efface un profil affiché si la session ou la vérification serveur échoue.
- Abaque : nouveau démarrage d'activité, de série ou redémarrage complet de l'activité 2 précédé d'une actualisation ciblée des droits côté serveur ; si réseau absent, le nouveau lancement est refusé tandis que les pages de l'activité déjà engagée restent accessibles. Les verrous internes 75 % et les modes professeur existants sont conservés.
- Milieu : nouvelle activité uniquement avec `begin` certifié ; résultat achevé non confirmé relancé automatiquement à la reconnexion / réouverture ; archivage local isolé d'une preuve devenue incompatible avec une nouvelle époque, sans crédit artificiel.
- Tests navigateur `tests/ce-free-launch.browser.mjs` réorientés vers les parcours autonomes sans SDK **et** les refus scolaires sans authentification. Ne pas supprimer les parcours guidés / classiques.

## Contrôles et publication (à renseigner sur SHA final)

| Vérification | État | Justificatif ou limite |
| --- | --- | --- |
| Consultation fiches socles, AGENTS, démarrage, suivi et diff PR/main | OK | Comparaison GitHub, branche non fusionnée à la reprise |
| Accès GitHub et Supabase Connect | OK | Connecteurs vérifiés, aucune modification SQL ou de données d'élèves |
| Edge live connect-abaque, connect-milieu, connect-results | OK (inventaire) | Fonctions actives avec JWT ; inventaire ne vaut pas parcours authentifié |
| Validité syntaxique des scripts inline Abaque et Milieu | OK (statique) | Analyse sans exécution du moteur |
| Contrat de verrouillage serveur | PARTIEL | RPC abaque contient identité, époque, vérification `activity_locked`; vrai scénario joueur à recetter |
| Reprise automatique et files tous jeux | PARTIEL | Code abaque et milieu inspecté/corrigé ; autres files et risques de sessions à tester |
| CI de branche et Chromium de non-régression | EN ATTENTE | Ne jamais conclure sur les succès d'une ancienne SHA |
| Recette réelle professeur et élève **fictifs approuvés** avec coupure, reprise, autre appareil et 2 comptes | NON EXÉCUTÉ | Nécessaire avant publication aux classes |
| Fusion PR / Pages / vérification URL servie | NON EXÉCUTÉ | PR à garder en brouillon tant que portes bloquantes ouvertes |
| Nouvelle migration SQL / Edge | SANS OBJET à ce stade | Aucune modification backend dans cette branche |

## Prochaines actions / portes de livraison

1. Analyser chaque échec CI sur SHA actuel ; distinguer les tests historiques de mode libre scolaire devenus obsolètes et les vraies régressions (abaque, mélangés, projection, guidage, LAB).
2. Recetter les moteurs autonomes et scolaires, le cas réseau coupé pendant un exercice, la reprise après fermeture, la protection contre le compte A → B et les changements de parcours. Examiner les files des 4 calculs et de Mélange, sans accepter de crédit XP sur anciennes preuves locales non certifiées.
3. Tester les verrous classe du professeur en temps réel, notamment l'activité 2 abaque ; contrôler côté serveur les tentatives falsifiées, Monsieur T joueur authentifié et un élève fictif bloqué.
4. Une fois les vérifications satisfaisantes seulement : fusion contrôlée, Actions/Pages, URL réellement servie, déploiements Edge/SQL seulement si changés, puis recette hébergée. Ne jamais réinitialiser XP, coupes ni résultats réels.

**Risque** : une source autonome indépendante ou un ancien lanceur pointant hors du HUB Connect ne doit pas être réécrit automatiquement ; aucun résultat libre ne peut être importé à Connect. Aucune donnée élève réelle consultée, modifiée ou réinitialisée par cette PR.
