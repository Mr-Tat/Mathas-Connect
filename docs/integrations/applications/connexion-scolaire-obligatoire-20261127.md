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

## Reprise vérifiée du 27 novembre 2026 — branche de la PR #366

- Connecteurs **GitHub (lecture/écriture)** et **Supabase Connect (lecture SQL et inventaire Edge)** vérifiés réellement ; projet `awmhpfofacaglewammxt` en état `ACTIVE_HEALTHY`. Aucun élève réel, aucune écriture SQL, migration, fonction Edge déployée ou changement de classe pendant cette reprise.
- **Commits ajoutés sur la même branche :**
  - [`a21b0cb`](https://github.com/Mr-Tat/Mathas-Connect/commit/a21b0cb7297b60927944aaa95d1e0a4c5dfcb699) : 11 fichiers de tests réalignés sur les nouvelles versions et la suppression du repli scolaire ; objet `window` simulé pour le moteur Node du Milieu.
  - [`ab0d7f8`](https://github.com/Mr-Tat/Mathas-Connect/commit/ab0d7f868e00a4e32b0f408e1f9c8bd934f94c07) : scénarios Chromium Abaque « scolaire sans session refusé » / « autonome libre », et test de reprise automatique ACK du Milieu sans clic fictif à travers la fenêtre de consentement.
  - [`2dda2eb`](https://github.com/Mr-Tat/Mathas-Connect/commit/2dda2eb9565a05d55757d5f9bc6a2041f8ebe0ae) : course asynchrone du contrôle scolaire Abaque, fixture élève fictif du tableau professeur Addition multiple, suppression des anciens scénarios `#freeLaunch` scolaires dans le navigateur Milieu.
- **Échecs CI requalifiés :** les anciennes assertions exigeant `hub.js?v=20261127-milieu-hub-v2`, `eleve.mjs?v=20261110-daily-share-v1`, `bootstrap?v=20261116-guest-mode-v1` ou un bouton libre scolaire n'étaient plus compatibles avec les décisions du professeur. Les assertions ont été remplacées par des vérifications des versions *effectivement attendues* et des refus scolaires ; aucune suppression générale de tests.
- **Écart de production confirmé par SQL en lecture seule** : `connect_hub_preset_entries` contient `abaque-longueurs` avec `observation.visible=true` ; `phase1.visible=false`, et `phase2`, `phase2b`, `2eco` à `true`. La règle pédagogique durable exclut **Observation et Phase 1**. La suite `tests/abaque-school-public.test.mjs` échoue à juste titre. **Ne pas neutraliser ce contrôle** ; le rétablissement des droits de la classe réelle est une action sensible demandant une autorisation appropriée. Aucune mise à jour de la ligne de production n'a été faite.
- **Limites restantes** : workflows GitHub encore à conclure sur le dernier SHA ; essais PostgreSQL/Chromium isolés distincts d'une vraie Auth ; aucun parcours hébergé complet avec deux profils fictifs approuvés et coupure/reconnexion ; revalidation systématique d'identité HUB lors d'un clic droit/nouvel onglet et files des divers calculs à recetter jusqu'au bout. Un lien externe n'est contrôlé qu'au niveau du HUB, pas dans le service tiers.
- **Livraison** : PR volontairement en brouillon, non fusionnée ; aucun nouveau déploiement Pages ni modification SQL/Edge. Ne pas proclamer « tout est vert » sur la base d'une CI antérieure.

## Contrôles et publication (à renseigner sur SHA final)

| Vérification | État | Justificatif ou limite |
| --- | --- | --- |
| Consultation fiches socles, AGENTS, démarrage, suivi et diff PR/main | OK | Comparaison GitHub, branche non fusionnée à la reprise |
| Accès GitHub et Supabase Connect | OK | Connecteurs vérifiés, aucune modification SQL ou de données d'élèves |
| Edge live connect-abaque, connect-milieu, connect-results | OK (inventaire) | Fonctions actives avec JWT ; inventaire ne vaut pas parcours authentifié |
| Validité syntaxique des scripts inline Abaque et Milieu | OK (statique) | Analyse sans exécution du moteur |
| Contrat de verrouillage serveur | PARTIEL | RPC abaque contient identité, époque, vérification `activity_locked`; vrai scénario joueur à recetter |
| Reprise automatique et files tous jeux | PARTIEL | Code abaque et milieu inspecté/corrigé ; autres files et risques de sessions à tester |
| CI de branche et Chromium de non-régression | PARTIEL | Les tests historiques incompatibles ont été corrigés ; échec réel encore présent sur visibilité de l'abaque en Observation ; contrôler le SHA final et les autres suites navigateur |
| Recette réelle professeur et élève **fictifs approuvés** avec coupure, reprise, autre appareil et 2 comptes | NON EXÉCUTÉ | Nécessaire avant publication aux classes |
| Fusion PR / Pages / vérification URL servie | NON EXÉCUTÉ | PR à garder en brouillon tant que portes bloquantes ouvertes |
| Nouvelle migration SQL / Edge | SANS OBJET à ce stade | Aucune modification backend dans cette branche |

## Prochaines actions / portes de livraison

1. Analyser chaque échec CI sur SHA actuel ; distinguer les tests historiques de mode libre scolaire devenus obsolètes et les vraies régressions (abaque, mélangés, projection, guidage, LAB).
2. Recetter les moteurs autonomes et scolaires, le cas réseau coupé pendant un exercice, la reprise après fermeture, la protection contre le compte A → B et les changements de parcours. Examiner les files des 4 calculs et de Mélange, sans accepter de crédit XP sur anciennes preuves locales non certifiées.
3. Tester les verrous classe du professeur en temps réel, notamment l'activité 2 abaque ; contrôler côté serveur les tentatives falsifiées, Monsieur T joueur authentifié et un élève fictif bloqué.
4. Une fois les vérifications satisfaisantes seulement : fusion contrôlée, Actions/Pages, URL réellement servie, déploiements Edge/SQL seulement si changés, puis recette hébergée. Ne jamais réinitialiser XP, coupes ni résultats réels.

**Risque** : une source autonome indépendante ou un ancien lanceur pointant hors du HUB Connect ne doit pas être réécrit automatiquement ; aucun résultat libre ne peut être importé à Connect. Aucune donnée élève réelle consultée, modifiée ou réinitialisée par cette PR.
