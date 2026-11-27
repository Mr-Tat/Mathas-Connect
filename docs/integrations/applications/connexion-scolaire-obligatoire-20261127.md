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
- **Décision actualisée du professeur (27/11)** : Observation visible est légitime. Phase 1 peut être activée par le professeur. Aucun changement des presets de production ; le test doit respecter les choix dynamiques.
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
| CI de branche et Chromium de non-régression | PARTIEL | Les tests historiques incompatibles ont été corrigés ; ancienne assertion de visibilité obsolète, corrigée selon la décision du 27/11 ; contrôler le SHA final et les autres suites navigateur |
| Recette réelle professeur et élève **fictifs approuvés** avec coupure, reprise, autre appareil et 2 comptes | NON EXÉCUTÉ | Nécessaire avant publication aux classes |
| Fusion PR / Pages / vérification URL servie | NON EXÉCUTÉ | PR à garder en brouillon tant que portes bloquantes ouvertes |
| Nouvelle migration SQL / Edge | SANS OBJET à ce stade | Aucune modification backend dans cette branche |

## Prochaines actions / portes de livraison

1. Analyser chaque échec CI sur SHA actuel ; distinguer les tests historiques de mode libre scolaire devenus obsolètes et les vraies régressions (abaque, mélangés, projection, guidage, LAB).
2. Recetter les moteurs autonomes et scolaires, le cas réseau coupé pendant un exercice, la reprise après fermeture, la protection contre le compte A → B et les changements de parcours. Examiner les files des 4 calculs et de Mélange, sans accepter de crédit XP sur anciennes preuves locales non certifiées.
3. Tester les verrous classe du professeur en temps réel, notamment l'activité 2 abaque ; contrôler côté serveur les tentatives falsifiées, Monsieur T joueur authentifié et un élève fictif bloqué.
4. Une fois les vérifications satisfaisantes seulement : fusion contrôlée, Actions/Pages, URL réellement servie, déploiements Edge/SQL seulement si changés, puis recette hébergée. Ne jamais réinitialiser XP, coupes ni résultats réels.

**Risque** : une source autonome indépendante ou un ancien lanceur pointant hors du HUB Connect ne doit pas être réécrit automatiquement ; aucun résultat libre ne peut être importé à Connect. Aucune donnée élève réelle consultée, modifiée ou réinitialisée par cette PR.

## Reprise technique complémentaire du 27/11 — contrôles encore ouverts

- Corrections GitHub sur la branche PR #366 : `7bbda8e9` (bancs PostgreSQL Mélange, test navigateur Abaque, parcours de réinitialisation professeur), `fd2d1690` (diagnostic Chromium), `9353ff6a` (installation navigateur sans dépôt apt tiers cassé), `3a186f2c` (fixture Mélange conditionnée aux bancs qui possèdent ses tables), `83eac585` (verrou URL des cartes avant profil approuvé, y compris clic droit), `b52ec2b0` (réinitialisation individuelle : portée jamais changée silencieusement en classe), `e28bdcaa` (tests de visibilité librement réglable et d'URL scolaires).
- Cause des nouveaux échecs transversaux constatés et corrigés dans les tests : versions de script volontairement actualisées, entrées par les autorisations réellement affichées et anciennes assertions fixes « Abaque exclu Observation/Phase 1 » désormais interdites. Les corrections SQL ne visent **que la base fictive jetable** ; aucune donnée scolaire n'a été interrogée ou modifiée.
- Supabase LIVE : projet `awmhpfofacaglewammxt` **ACTIVE_HEALTHY**, 15 fonctions Edge, services protégés actifs avec contrôle JWT (connect-api v36, connect-results v52, connect-abaque v13, connect-milieu v6) et 102 migrations. Pas de nouvelle migration ni de publication Edge dans la PR.
- Abaque CSS : PR source #2 et Connect #365 fusionnées ; Pages `main` réussi sur `39d1e704`, workflow #45975842460. Cela **ne prouve pas** le rendu de la page en authentification réelle sur un navigateur hébergé.
- **Livraison : NON** tant que CI sur le SHA final et vraie recette Auth (professeur/élève fictifs approuvés, révocation, classe, reprise ACK et coupure réseau) ne sont pas validées. Garder la PR en brouillon, sans activation de classes ni résultat fictif attribué à un vrai élève.

## Reprise suivante — départs scolaires et visibilité (27/11/2026)

- CI `d09231e3` : **42/43**. Addition multiple Auth locale passée. Mélange : test essayant de cliquer une table obligatoire correctement désactivée. `10eb217f` vérifie actif + désactivé sans clic forcé ; l'étape suivante a révélé une image publique externe dans la recette professeur. La recette bloque désormais localement uniquement les images de trois origines publiques explicites ; API/scripts externes restent interdits.
- `8ffc99ee` : contrôle de connexion à chaque point d'entrée natif (normal/HARD), moteur autonome inchangé, scénarios coupure avant/après départ.
- `bacaa094` + `ce297360` : ticket serveur durable `connect_school_start_tickets` (migration `20261127131500_school_start_tickets.sql`), lié à UUID événement, élève, sujet Auth, classe, app, époque, mode, niveau, taille, opérations. Nouveau résultat `game-record-v2` vérifie le ticket avant RPC atomique existante ; même ID dans la file, même ACK idempotent. Un appel par lancement, aucun par frappe. Le ticket certifie le départ, non chaque calcul du journal navigateur.
- Visibilité : nouveau départ élève refusé si le professeur masque le jeu, même par URL directe ; partie déjà autorisée peut terminer/synchroniser. TEST conserve son accès isolé authentifié ; Monsieur T authentifié peut prévisualiser une app masquée. `4c8ec9a9` applique la même règle aux deux additions (normal et étendu). Ne pas toucher aux réglages réels. Vérifier la cohérence de cette prévisualisation sur les autres apps avant généralisation.
- **Blocage de publication :** `MIXED_REQUIRE_START_TICKET=false` est une transition, pas un état final sécurisé. Les nouveaux clients utilisent uniquement `game-record-v2` sans repli ; les anciennes pages et files légitimes n'ont pas de ticket. Ne jamais en fabriquer rétroactivement. Les tests Edge compilent aussi la variante stricte (refus ancienne route, ticket absent ou discordant). Avant livraison : décision de fenêtre de transition, migration additive, Edge compatible, Pages vérifiées, exigence stricte puis vérification anciennes URLs/caches/files. Tant que l'ancienne route reste ouverte, pas de garantie d'absence de contournement.
- **Blocage confirmé LIVE par métadonnées SQL :** les 7 RPC de fin scolaire des quatre calculs écrits rejettent encore `proof_expired` après 90 minutes en classique ou 8 heures en étendu. Distinguer expiration de l'émission/réutilisation de preuve et envoi d'une fin déjà autorisée. Préserver identité, révision/époque, réponses, droits et idempotence ; tester en PostgreSQL isolé (preuve expirée, collision, reset, révocation).
- **Méthode :** grouper les corrections indépendantes en un changement atomique de ref autant que possible ; tests ciblés pendant développement, CI complète sur le candidat final. Distinguer fixture, moteur, image décorative et service indisponible. Ne pas abaisser les assertions fonctionnelles ni remplacer Auth/Edge/SQL par des mocks.
- Aucune lecture de résultat réel, écriture de données, migration ou publication Edge/Pages effectuées en production. PR en brouillon. Contrôler les workflows sur le dernier SHA effectif, pas sur un SHA antérieur.

## Stabilisation — conservation des preuves et recette professeur

- CI sur a96161a3 : 41/43. Milieu : téléchargement apt Microsoft 403 pendant installation Chromium, pas un défaut pédagogique ; installation Chromium sans réinstaller les bibliothèques préinstallées du runner. Mélange : vraie recette Auth/Edge/SQL passe départ autorisé, refus hors ligne, masquage en cours, ACK durable et refus URL directe masquée. Échec suivant sur le sélecteur du tableau professeur, désormais dupliqué par le tableau flottant ; cibler le tableau principal sans supprimer les assertions.
- 66a60f4a + a8dfc49e : trois migrations additives préparées pour les sept RPC de fin des quatre calculs écrits. Suppression du seul refus fondé sur expiration lors de la fin d'une preuve déjà émise ; contrôles d'identité, classe, révision/époque, calculs, idempotence et privilèges conservés. Expiration des nouvelles émissions inchangée. Tests SQL sur preuves expirées depuis une semaine, collisions et reset. Conservation des résultats terminés côté navigateur, reprise des additions étendues par le serveur, récupération ACK perdu. Les tests restent à valider sur le SHA final.
- Avant publication : vérifier les versions des imports/cache ; valider CI et recette hébergée authentifiée ; planifier la fermeture de game-record historique du Mélange sans fabriquer de tickets rétroactifs. Ne pas fusionner ni déployer avant validation. Aucune donnée réelle modifiée, aucun changement LIVE effectué.
