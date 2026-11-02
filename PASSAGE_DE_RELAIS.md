# Reprise — GRAN-abaque-m-1 dans Math’as Connect

État vérifié le **2 novembre 2026 vers 17:04 UTC**. Synthèse destinée à une nouvelle conversation ChatGPT/Codex. Les références ci-dessous décrivent ce constat daté ; vérifier les versions et droits actuels en reprenant. Les annexes historiques peuvent décrire un état antérieur.

## 1. Objectif et priorité du professeur

La demande en cours est de mettre l’Abaque dans **Laboratoire → Tests en ligne**, avec véritable Auth Connect, XP calculés par le serveur, trophées permanents, sauvegarde/restauration et résultats professeur. Les essais concernent seulement des profils fictifs de **Classe démo - TEST**, UUID `4bf3400d-a315-4ea4-a2f3-afaca24dc9b9`.

Une démo isolée est déjà publiée. Le prochain résultat attendu est le pilote connecté utilisable, puis sa recette hébergée. Le professeur demande une progression concrète et visible, des tests proportionnés, et des vérifications d’accès avant de réclamer des identifiants. Il ne veut pas recommencer le moteur ni multiplier les validations déjà réussies sans raison.

Les quatre HUB scolaires ne doivent pas être ouverts par cette mission. Aucune donnée d’élève réel ne doit être lue ou modifiée pour tester.

## 2. Repères exacts et changement important de main

| Élément | Référence vérifiée |
| --- | --- |
| Dépôt moteur autonome | `Mr-Tat/abaque-m-1` |
| Dossier et nom de l’application | `GRAN-abaque-m-1` |
| Autonome HEAD/main | `69ed04ece90faae317dee8a2ce2d6c4224d0d763` |
| Dépôt d’intégration | `Mr-Tat/Mathas-Connect` |
| Branche candidate Abaque | `feat/abaque-longueurs-connect` |
| Candidat poussé et propre | `38bc8821ff0c6d11728b5c551e0024758362a2b8` |
| Dernier main intégré au candidat | `6e2039833acf0345539873121848e5fcb50af277` |
| Main observé pendant cette transmission | `d148b4373529b0f6321ee11af41d36b5b0de4127` |
| CI verte du candidat | https://github.com/Mr-Tat/Mathas-Connect/actions/runs/41477253078 |
| Application Connect | `apps/GRAN-abaque-m-1/` ; `app_key=abaque-longueurs` |
| Projet Supabase Connect | `awmhpfofacaglewammxt` |

**[LIVE vérifié] Le main a avancé après la CI du candidat.** Les PR #107 à #110, notamment, ont fait évoluer les cinq calculs écrits dans le Laboratoire : leurs cartes « Tests en ligne » ouvrent désormais les nouvelles versions pilotes, et leurs résultats fictifs ont un panneau dédié. Le main constaté et le candidat ne sont pas encore rapprochés.

Les changements depuis la base commune `6e20398` concernent `laboratoire.js`, `laboratoire.html`, `hub.js`, `essais/objectif-record-pilote.js`, `supabase/functions/connect-record-pilot/index.ts`, une nouvelle CI navigateur et plusieurs tests. Il y a des chevauchements avec l’intégration Abaque. **Ne pas remplacer ces fichiers par les anciennes copies du candidat.** Conserver `recordPilotSlugByApp`, le lancement des cinq pilotes dans TEST, leur séparation de données et leur panneau de résultats, tout en ajoutant la carte Abaque et ses contrôles. Leur Edge n’est pas à redéployer pour cette mission sans nécessité démontrée.

La CI verte de `38bc882` valide ce SHA précis, pas une fusion future. Première étape de code à prévoir : relire main actuel et intégrer ses changements dans une branche conservant le candidat, puis valider les conflits résolus et les régressions pertinentes. Cette transmission n’a effectué aucune fusion.

## 3. Ce qui est publié et ce qui reste candidat

**[LIVE vérifié / historique de livraison]** Le moteur autonome `69ed04e` et la démo Connect `486def4` ont été publiés sur leurs main après accord explicite. CI autonome main `41459977874`, Pages autonome `41459978168` : Success. Pour Connect, la livraison démo est contenue dans `1234854`, dont Pages `41460239794` est Success. Le main a évolué depuis ; cela ne permet pas d’attribuer automatiquement un nouveau statut Pages à chaque SHA.

Liens de démo déjà livrés :

- https://mr-tat.github.io/abaque-m-1/
- https://mr-tat.github.io/Mathas-Connect/apps/GRAN-abaque-m-1/

**[REPO vérifié]** Le mode intégré est préparé dans la branche candidate avec `?connect=1&class=<UUID>`. Dans le Laboratoire, la carte force cette URL et n’utilise pas le simulateur. Monsieur T utilise le paramètre `joueur=prof` et sa session professeur séparée.

**[STATUT DE MISSION]** Le lot candidat Abaque n’a pas été publié sur main par cette mission. Aucun SQL ni déploiement Edge de production pour ce lot n’a été exécuté ; aucune vraie recette navigateur authentifiée sur Supabase hébergé n’a été effectuée. L’état actuel du backend cible reste à auditer : ne pas déduire de l’absence d’accès qu’aucune table ou fonction n’existe.

Les anciennes publications de démo `6ac032c`, `96c9bc5`, `44aedae`, `56dc2f5`, puis les versions `69ed04e` / `486def4`, ont reçu leurs accords. Ne pas redemander ces accords résolus. Un accord sur un SHA de démo ne vaut pas accord général sur tout futur lot. La demande récente vise bien le pilote TEST ; respecter les autorisations actuelles et toute restriction effective des outils. Si une autorisation de production supplémentaire reste indispensable, préparer d’abord le lot concret et testé.

## 4. Deux dépôts distincts et nommage

**[DÉCISION professeur]** Chaque application conserve son dépôt autonome. Le moteur, l’accueil et les règles de jeu évoluent dans l’autonome ; Connect en reçoit une copie versionnée et conserve les adaptateurs Auth/serveur.

GRAN signifie Grandeurs ; abaque désigne l’outil ; m correspond aux longueurs/mètre ; 1 au premier parcours. Le dossier local et le chemin de copie sont renommés. Le nom distant GitHub est encore `Mr-Tat/abaque-m-1` : les tentatives d’API ont été refusées. Ne pas annoncer le dépôt distant renommé ni en créer un deuxième. Cette finition ne doit pas masquer le travail restant sur le pilote.

Conserver `app_key=abaque-longueurs`, les clés de stockage et les données existantes. `apps/abaque-longueurs/` conserve une redirection avec paramètres et fragment. Le script `scripts/sync-gran-abaque.mjs` vérifie/copie la démo depuis un commit autonome propre ; sa protection refuse d’écraser le bridge de la candidate authentifiée. Ne pas supprimer cette protection pour forcer une synchronisation.

## 5. Décisions fonctionnelles actuelles

Les décisions suivantes remplacent les descriptions plus anciennes du prompt initial.

- **Six coupes permanentes.** Construction : bronze pour 12/12. Déplacements : argent pour 8/8. Conversions classiques : or pour les trois formats parfaits 4/4, 12/12, 20/20, même réalisés à des moments différents.
- **Mort subite uniquement :** trois coupes supplémentaires à 3, 5 et 8 pages justes consécutives dans une même partie. Dans ce mode, une page contient une conversion. Pas de cumul entre parties pour ces seuils.
- Aucun trophée en 3 vies ; l’or classique est indépendant des deux modes record. Les anciennes médailles de points ne sont plus affichées comme récompenses de score.
- Les deux variantes record deviennent accessibles après au moins 80 % dans chacun des trois formats classiques : 4/4, au moins 10/12, au moins 16/20. La construction et les déplacements conservent leurs déblocages natifs par deux réussites.
- Les cases classiques affichent le résultat, par exemple `10/12`, sans le mot « Réussite ». Les coupes restent des icônes seules, sans condition d’obtention ajoutée sur les cartes. Le professeur prévoit de demander plus tard un affichage séparé des conditions : ne pas inventer cet écran.
- Coupes de Mort subite dans le coin inférieur droit du bouton, hors du cadre intérieur sombre ; XP séparés. Meilleur score et collection obtenue dans le haut de l’accueil. Papier quadrillé/texturé et cartes/boutons colorés, avec 3 vies mauve à gauche et Mort subite rouge à droite.
- Libellé `Reste N XP`, discret, graisse normale ; masqué sans session Connect approuvée, hors ligne et après déconnexion, même si une ancienne réponse arrive ensuite. Toute éventuelle mention « À gagner » doit rester discrète ; ne pas réintroduire de condition de réussite sur les coupes.
- La démo possède trois choix explicites dans la barre haute : Pas connecté / Connecté / Connecté — tout récupéré. Les valeurs de ces aperçus sont fictives et isolées. Cette simulation est désactivée sous `connect=1`.

**[DÉCISION professeur] Barème maximal 160 XP, déjà implémenté et testé :**

| Activité | Droits XP uniques |
| --- | --- |
| Construction | 8 première réussite ≥10/12 ; 6 deuxième ; 6 premier 12/12 |
| Déplacements | 8 première réussite ≥7/8 ; 6 deuxième ; 6 premier 8/8 |
| Classique 1 page | 20 pour 4/4 |
| Classique 3 pages | 18 pour ≥10/12, puis 10 complémentaires pour 12/12 |
| Classique 5 pages | 28 pour ≥16/20, puis 12 complémentaires pour 20/20 |
| Record, jalons 5 / 10 | 12 / 20 en Mort subite ; demi-droits 6 / 10 en 3 vies ; droits partagés, maximum 32 |

Les premières réponses déterminent les seuils ; les aides pédagogiques restent autorisées. Master, mode libre, abandon et simple restauration ne donnent aucun XP. Répétitions à zéro et compléments seulement. Les pages terminées en Mort subite peuvent valider leurs coupes lors d’un abandon, sans XP d’abandon. Reset : progression redémarrée, XP historiques et coupes permanentes conservés.

Ne pas redoubler le bonus de 20 % des points Mort subite : le moteur possède déjà la base de 30 contre 25. Les maxima classiques sans aide sont 100 / 324 / 580. Les formules natives, aides et records sont conservés par le contrat et les tests.

## 6. Architecture du candidat à reprendre

| Fichier ou dossier | Rôle |
| --- | --- |
| `apps/GRAN-abaque-m-1/` | Copie du moteur, accueil, assets et manifeste source |
| `connect/completion-contract.mjs` dans cette app | Preuves de fin et jugement des résultats, sans XP fournis par le client |
| `connect/native-bridge.js`, `bootstrap.mjs` | Hooks natifs et session Auth, chargement/hydratation serveur |
| `connect/offline-queue.mjs` | File persistante, idempotence, ACK et isolation identité/époque |
| `connect/laboratory-pilot.mjs` | Disponibilité serveur et autorisation explicite des profils fictifs |
| `professeur.html`, `connect/professeur.mjs` | Tableau professeur, consentement et reset limité à l’Abaque |
| `supabase/functions/connect-abaque/` | Edge dédiée, fermée par défaut, vérification Auth puis RPC privées |
| `supabase/functions/connect-api/index.ts` | Petite sélection du résumé Abaque sous drapeau, ancien chemin conservé ailleurs |
| `supabase/release-candidates/20261102_abaque_longueurs_v1.sql` | Tables et fonctions additives, droits fermés, état/reçus/XP/trophées atomiques |
| `scripts/abaque-release.mjs` | Préparation hors ligne de l’audit, installation gardée, activation TEST et manifeste |
| `supabase/release-candidates/abaque_disable_only.sql` | Arrêt non destructif de l’Abaque |
| `laboratoire.js/.html/.css`, `hub.js` | Carte en ligne et présentation HUB ; à rapprocher du nouveau main |

La carte en ligne peut apparaître en attente si l’application est absente du catalogue. Ses liens restent bloqués tant que le backend n’est pas prêt. Aucun faux état connecté ne prend le relais.

Après activation du pilote, le professeur confirme les profils fictifs puis utilise « Autoriser les profils fictifs ». L’Edge vérifie un sujet Auth réel non anonyme, le droit de gestion et la seule classe TEST. Les UUID actifs explicitement fournis et le seul Monsieur T du professeur peuvent entrer dans la liste autorisée. L’opération ne crée ni XP, ni résultat, ni approbation d’appareil. Les contrôles habituels d’appareil/inscription et la séparation des identités restent nécessaires.

Le serveur recalcule les récompenses et protège révision, époque de reset, identité, concurrence et replay. État + reçu + droits + XP + trophées sont atomiques. Aucun acquis de démo n’est importé dans Connect.

## 7. Accès : faits observés, pas suppositions pour le nouvel agent

**[LIVE vérifié, environnement de cette conversation]** Lecture/push Git fonctionnent, ainsi que les pages publiques GitHub. `gh api` REST et création de PR GraphQL ont reçu `Forbidden`. La branche candidate est poussée ; aucune PR n’a été créée par cette mission.

**[LIVE vérifié]** Supabase CLI officiel 3.0.0 fonctionne mais `functions list` pour le projet cible répond `Access token not provided`. Les requêtes HTTP Supabase ont aussi reçu un refus de tunnel 403. Au dernier contrôle : runtime révision 1, observations actuelles, aucun binding secret et aucun domaine personnalisé appliqué.

**[CONFIGURATION SAUVEGARDÉE]** Brouillon révision 16, installation et démarrage testés, dépôts aux commits `69ed04e` et `38bc882`. Il contient le besoin sécurisé `SUPABASE_ACCESS_TOKEN`, destination `api.supabase.com`, sans valeur liée. Domaines prévus : `api.github.com`, `api.supabase.com`, `awmhpfofacaglewammxt.supabase.co`, `esm.sh`, `mr-tat.github.io` et les deux domaines Playwright. Sauvegarder le brouillon n’applique pas la configuration. Le professeur doit renseigner le champ sécurisé, enregistrer et publier l’environnement.

Ces observations sont propres à l’ancienne instance. Le nouvel agent doit découvrir ses outils, vérifier les bindings et tester les opérations réelles avant de demander une autre configuration. Un Git fonctionnel ne garantit pas l’API ; une erreur de l’ancienne conversation ne prouve pas les droits de la nouvelle. Ne pas lire de fichiers de credentials pour découvrir leurs valeurs, ni demander de token dans le chat. Ne pas réutiliser un identifiant d’environnement de l’ancienne tâche.

## 8. Preuves acquises et tests à utiliser

**[CI distante vérifiée à nouveau pour cette transmission]** Run `41477253078`, commit `38bc882` : **Success**. Étapes contrats/moteur navigateur et PostgreSQL/Auth/Edge/Chromium toutes réussies. Cette preuve clôt les anciens échecs de CI liés au test du rechargement de carte.

**[CI locale sur le candidat]** 299 tests Node sans services, 10 scénarios PostgreSQL réels, 5 scénarios Auth/Edge/Chromium réels locaux. Les 12 scénarios navigateur ont chacun passé ; un délai local a nécessité une relance ciblée, puis la CI complète finale est verte. Le test du portail Laboratoire utilise Auth/transports simulés ; le composant d’autorisation possède en plus son scénario avec véritable Auth/Edge local et démontre les XP de Monsieur T séparés de ceux de l’élève. Aucune de ces preuves ne constitue une recette hébergée.

Les outils testés sont Node 22.22.0, Playwright 1.57.0, pg 8.16.3, esbuild 0.27.2, SDK Supabase 2.95.0 et CLI Supabase 3.0.0. Les références de setup sont dans `outils/`. Dans l’ancien environnement, préfixer chaque appel de test avec le PATH approprié ; le Node système 24 n’est pas le Node testé. Autoriser les processus enfants de l’exécuteur et vérifier les vrais sous-tests, pas seulement un résumé des fichiers parents.

```bash
cd /workspace/Mathas-Connect
export PATH=/workspace/.cloud-tools/node_modules/node/bin:$PATH
export CHROME_BIN=/usr/bin/chromium
node --test tests/abaque-contract.test.mjs tests/abaque-server-contract.test.mjs tests/laboratoire-objective-record.test.mjs
node --test tests/abaque-browser.browser.mjs
bash tests/local/run-abaque-local.sh
```

Les grosses suites Chromium doivent être exécutées séquentiellement dans cet environnement ; un lancement concurrent a causé des délais et une indisponibilité Auth locale. Le runner crée uniquement ses conteneurs/profils/clés fictifs, utilise un réseau Docker interne et nettoie ses ressources. Les processus ne survivent pas à une nouvelle tâche.

La régression 299 excluait trois fichiers HTTP hébergés (`laboratoire-live-readonly`, `laboratoire-pages-public`, `melange-public-catalogs-live`) et l’ancien runtime PostgreSQL Soustraction. Ces suites restent dans leurs workflows ; ne pas les désactiver. Les nouveaux tests du main d148b43 doivent aussi être respectés après rapprochement. Ne pas exiger artificiellement le même compte de 299 sur un main qui a avancé.

## 9. Prochaine séquence de livraison

1. Lire les instructions et vérifier les droits actuels, main, branche candidate et PR concurrentes. Préserver toute modification préexistante. Pas de worktree sans demande explicite.
2. Rapprocher le candidat avec les changements actuels du Laboratoire/HUB. Conserver les cinq nouveaux pilotes et leurs résultats, puis vérifier l’Abaque et les régressions touchées. Obtenir une CI sur le SHA effectivement destiné à la livraison.
3. Avec l’accès Supabase effectif, auditer en lecture seule le schéma, l’historique et les versions/configurations Edge. Lire des métadonnées, pas les résultats d’élèves. Les versions Edge et `verify_jwt` actuellement hébergés ne sont pas connus. Ne pas écraser une version concurrente de l’API commune.
4. Choisir une version de migration de 14 chiffres revue après cet audit. Le défaut local `20261102020000` est ancien et ne doit pas être appliqué aveuglément ; des migrations plus récentes existent dans le dépôt ; l’historique hébergé reste à lire. `scripts/abaque-release.mjs --version ...` refuse collisions et historique incompatible. Si l’espace Abaque existe déjà, examiner son état au lieu de rejouer l’installation initiale.
5. Préparer l’installation additive gardée par empreinte, désactivée et masquée, avec une seule ligne d’historique dans la même transaction. **Pas de `supabase db push` global ; pas de deuxième `apply_migration` après le SQL brut.** Déployer uniquement les Edge nécessaires et le frontend du lot autorisé, en gardant les autres jeux et catalogues scolaires intacts.
6. Activer seulement TEST avec `CONNECT_ABAQUE_ACCESS=pilot`. Une liste initiale vide est possible avec `fictiveConfirmed:true`, `studentIds:[]`, `deferProfileApproval:true` ; aucun profil ne peut jouer avant son autorisation explicite dans le Laboratoire. Sinon utiliser uniquement des UUID fictifs confirmés. Ne pas deviner des profils existants à partir de leurs noms.
7. Effectuer la vraie recette hébergée : professeur réel et profil fictif approuvé, jeu depuis la carte en ligne, XP restant serveur, activité au clavier, reçu/crédit/trophée, rechargement, second appareil, répétition/complément, perte réseau/reprise, révocation, Monsieur T séparé, résultats et reset Abaque seul. Vérifier l’absence d’ouverture scolaire. Consigner URL, SHA, migration, versions Edge et résultats, sans JWT ni données réelles.

Arrêt non destructif préparé : fermer le drapeau puis `abaque_disable_only.sql`, qui masque/désactive l’Abaque tout en conservant ses données et son historique. Aucun reset global ni suppression de résultats pour revenir en arrière.

## 10. Contenu du dossier et ordre de lecture

- `PROMPT_A_COLLER.md` : message de reprise prêt à envoyer.
- `ETAT_TECHNIQUE.json` : références et états explicites, sans valeur de secret.
- `sources/GRAN-abaque-m-1-69ed04e/` : autonome exact.
- `sources/Mathas-Connect-candidat-38bc882/` : candidat exact ayant la CI verte.
- `sources/Mathas-Connect-main-d148b43/` : main observé à la transmission.
- `patches/` : diff du candidat et diff du nouveau main, tous deux depuis la base commune. Ils documentent les écarts ; ne pas appliquer une ancienne copie sur main sans rapprochement.
- `outils/` : setup reproductible et notes d’environnement, à adapter aux capacités réellement disponibles.
- `historique/PROMPT_INITIAL.txt` : demande originale ; ses anciennes mentions de trois trophées ou d’interdiction de modifier l’autonome ont été remplacées par les décisions plus récentes ci-dessus.
- `visuels/` : captures de tests simulés, pas preuves de connexion hébergée.

Lire dans le candidat `AGENTS.md`, `docs/integrations/README.md`, `ABAQUE_LONGUEURS_DEPLOIEMENT.md`, `ABAQUE_LONGUEURS_ACCUEIL_20261102.md` et `NOMMAGE_GRAN_ABAQUE_M_1.md`. Le passage de flambeau archivé dans les sources a été figé avant la confirmation finale de CI et avant le nouveau main ; cette synthèse en donne la mise à jour. Le dossier ne contient aucune base de données, configuration de compte ou dépendance installée, et aucune des copies de sources n’est un nouveau dépôt à publier.
