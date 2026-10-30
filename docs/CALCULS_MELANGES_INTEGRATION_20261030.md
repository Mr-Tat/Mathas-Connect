# Calculs écrits mélangés — intégration isolée, 30 octobre 2026

Cette branche prépare `melange-calculs-ecrits` dans `apps/calculs-melanges/`. Elle ne constitue aucune autorisation de publication. Aucun accès à un élève réel, SQL hébergé, déploiement Edge, publication Pages ou fusion de main n'a été effectué.

## Sources et périmètre

Le ZIP de transfert a été lu avant l'implémentation, comme document de préparation ; les instructions de la mission restent prioritaires. Les lectures Git distantes ont confirmé :

- Connect/main : `91bcca7aba97d9fb00460a7e4ff56a0675f1459b`.
- Moteur : `Mr-Tat/Melange-calculs-ecrits-1`, HEAD `e11c88b4e449e8cdb17b0fee78c7daa6ea5bf279`, blob index `3d2ad6c8de9cdc67cd4464f4b43da2513d17c489`, V6.0.2.
- Miniatures : `Mr-Tat/Miniatures-Mathas`, HEAD `67b0c86e84b587f48bdbb4d57189e21d2610a005` ; aucune miniature Mélange trouvée. Le WebP fourni dans cette branche est provisoirement l'illustration native, moins de 200 Ko, **pas une miniature approuvée**.

Le dépôt moteur n'a pas été modifié. `source-manifest.json` conserve les empreintes SHA-256 des quatre fichiers originaux. Les trois images du moteur sont identiques. Le HTML copié reçoit les seuls ajouts décrits dans ce manifeste : hooks de début/verrouillage/fin, garde terminale, synchronisation ponctuelle du watcher de trophées existant, union des tables minimales Mélange et corrections de saisie du report latéral et des valeurs d’emprunt à deux chiffres. Aucune modification d'algorithme de génération, de difficulté ou de barème natif.

Les moteurs Addition, Soustraction et Multiplication existants sont inchangés. Les modifications communes concernent les allowlists, le rendu professeur du nouveau jeu et les routes Edge isolées. Trois fixtures de régression ont été adaptées à la nouvelle allowlist/au paramètre appKey, sans supprimer leurs assertions. `hub-catalog.json`, les anciennes migrations et les candidats Addition ne sont pas modifiés.

## Fonctionnement préparé

Le lancement libre ne charge pas le SDK et n'effectue aucune requête Connect. Les clés natives sont préfixées dans l'iframe : `mathas.calculs-melanges.game.<scope>.v1:`. Les scopes `libre`, `simulation` et `connect.<classe>.<sujet JWT>.<élève serveur>` sont distincts. Aucun cache historique non préfixé n'est importé.

Le pont WeakMap est appelé par le moteur après création d'une session, à chaque vrai verrouillage d'un calcul et après sauvegarde finale. Il capture sélection initiale, opérations effectivement terminées, première tentative, aide, Master, niveau, UUID immuable, révision et époque. Un finisher ne peut émettre qu'une fois. Ni entraînement ni challenge HARD dormant ne produisent d'événement connecté. Le watcher de trophées natif est exécuté ponctuellement avant le snapshot V3 ; aucun polling réseau ajouté.

Deux constats natifs supplémentaires ont été vérifiés : le bouton guidé normal porte déjà `hidden` dans la source originale ; il n'a pas été réactivé. Le report latéral pouvait réassigner la colonne 1 sur un nouveau focus, même lorsque le moteur demandait une retenue plus loin. La copie choisit désormais le report réellement attendu. L’emprunt direct demandait aussi parfois une valeur de 10 à 18, alors que sa saisie remplaçait chaque chiffre au lieu de les assembler. La copie accepte ces deux frappes sans changer la valeur attendue ni l’algorithme. Les tests clavier HARD couvrent ces chemins ; ces corrections ne touchent aucun autre jeu.

L’indication d’aide du meilleur résultat est conservée séparément pour sa restauration ; à score égal, une réussite sans aide conserve la priorité native.

Les meilleurs scores Connect sont indépendants pour chaque `(niveau, longueur 4/10/20)`. La vue native garde son unique meilleur record par niveau, sans être utilisée comme preuve XP. L’état possède trois branches distinctes : `eligible`, `halfEligible` et `quarterEligible`, pour les taux 100 %, 50 % et 25 %. Un meilleur score réduit n’efface pas une preuve complète. Chaque seuil de mort subite reste indépendant ; le taux dépend de la sélection au départ, pas des types tirés.

La file persistante est bornée à 100 événements, isolée par classe/sujet JWT/élève serveur/app ; ACK strict avant suppression, une seule requête en vol, aucun polling, reprise sur `online`. Un conflit d'époque bloque le rejeu ; au prochain chargement de l'époque actuelle, les anciens événements sont archivés localement sous le même profil. Aucun XP optimiste. Les doublons ACK affichent toujours delta 0.

Le menu natif annonce « 0 et 1 sont toujours activés », mais le générateur original sélectionne effectivement dans son pool 2–9. Cette incohérence d’origine est conservée et signalée ; aucun nouveau calcul 0/1 n’a été inventé.

Les tables minimales sont indépendantes de Multiplication simple (`connect_mixed_multiplier_locks`), avec priorité élève puis classe. L'élève conserve les tables obligatoires et peut en ajouter. Le HARD natif utilise toutes les tables, et inclut donc ces minimums. Aucune portée globale entre applications n'est imposée silencieusement.

## XP 594 validés et remise à zéro

Barème de base 594 XP et règle de sélection validés explicitement par le professeur : trois opérations cochées au départ donnent 100 %, même lors d’un tirage chanceux ; deux donnent 50 % et une seule 25 %. Une réussite complète ultérieure verse seulement le complément manquant une fois. La politique XP est versionnée 3. Les aides gardent la convention actuelle, Master et entraînement donnent 0. Un journal de calculs réellement terminés reste indispensable : les seules cases cochées ne rapportent rien. Voir la [règle complète et ses arrondis](CALCULS_MELANGES_XP_SELECTION_20261030.md).

| Jalon par niveau | XP |
| --- | ---: |
| Classique 4/4 | 28 |
| Classique 8/10 | 38 |
| Bonus 10/10 | 8 (46 au total) |
| Classique 16/20 | 63 |
| Bonus 20/20 | 13 (76 au total) |
| Mort subite 5 puis 10 | 12 + 12 |
| HARD mort subite 3 puis 7 | 12 + 12 |

198 par niveau, 27 droits, 594 sans rejeu explicitement autorisé. Les demi-valeurs classiques sont 14, 19 puis +4, 32 puis +6 ; le parfait /20 donne ainsi exactement 38. Les compléments sont plafonnés au montant complet. Aucun multiplicateur global ni changement des autres jeux. `xpPoints`, `firstParcours`, `halfParcours` et `fullParcours` empêchent de doubler un nouveau complément pendant un parcours rejouable ; seules les tranches déjà acquises avant ce parcours peuvent être répétées.

Le reset élève/classe archive uniquement Mélange, augmente revision/reset_epoch et préserve les crédits. `repeatXp=false` interdit la recollection ; `true` est une permission explicite du professeur. Pour Mélange, la case de rejeu est décochée par défaut. Les événements de l'ancienne époque sont refusés, y compris ceux dont l'UUID est déjà connu.

## SQL / Edge et verrouillage

Le candidat `supabase/release-candidates/calculs_melanges_locked_v1.sql` est une transaction à usage unique. Il refuse un app_key ou namespace RPC déjà présent, puis crée une app désactivée, quatre presets invisibles/non featured, neuf règles totalisant 198, cinq RPC **nouvelles**, les reçus permanents d'idempotence et les minimums de tables. Il ne remplace aucune fonction partagée existante : pas de définition historique de RPC à réinjecter. Le schéma reçu de la cible a été comparé et testé localement avec 26 tables, 137 contraintes et les watchers exacts ; reconfirmer l’absence de dérive avant une installation autorisée.

`connect_mixed_record_v1` revalide le journal, verrouille l'élève/état, vérifie epoch/CAS et effectue résultat + trophées + droits XP + crédit + reçu dans une transaction. Des reçus durables couvrent les doublons au-delà des 50 identifiants d'affichage. Les nouvelles RPC sont SECURITY DEFINER, search_path fixé, REVOKE explicite PUBLIC/anon/authenticated et GRANT service_role uniquement. Les deux tables privées ont RLS activé.

L'Edge garde l'authentification native existante : JWT vérifié, appareil approuvé, inscription dans la classe, élève actif ; pour Monsieur T, professeur gestionnaire et profil joueur séparé. Le seul paramètre `joueur=prof` ne donne aucun droit. Les montants XP du navigateur ne sont jamais utilisés.

Trois verrous compilés restent **false** : `CONNECT_WRITE_READY`, `MIXED_SERVER_READY`, `MIXED_TEACHER_READY`. Les tests les ouvrent uniquement dans des copies jetables utilisant des services loopback. La carte reste absente du catalogue statique. Le candidat disable-only désactive uniquement l'app et ses presets, sans effacer état, XP, reçus ni archives. Ne jamais lancer `supabase db push` pour installer ce candidat.

## Reproduire les validations

Node 24, Python, Chromium et Docker local. Outillage de test hors checkout :

```sh
npm install --prefix /workspace/.mathas-tools --no-audit --no-fund playwright@1.58.2 @supabase/supabase-js@2.95.0 esbuild@0.25.12
cd /workspace/Mathas-Connect
node --test tests/*.test.mjs
bash tests/local/run-calculs-melanges-postgres.sh
```

Démarrer dans un terminal `python -m http.server 8765 --bind 127.0.0.1`, puis :

```sh
PLAYWRIGHT_MODULE=/workspace/.mathas-tools/node_modules/playwright/index.mjs CHROMIUM_PATH=/usr/bin/chromium node tests/calculs-melanges-browser.e2e.mjs
bash tests/local/run-calculs-melanges-auth.sh
```

Les runners SQL/Auth créent uniquement des conteneurs nommés pour le test, des volumes jetables et des identités fictives ; ils les détruisent ensuite. Auth utilise GoTrue v2.186.0, PostgREST v14.3, Edge Runtime v1.70.0, PostgreSQL 17-alpine et Kong 2.8.1. Le SDK est bundlé hors ligne pour les conteneurs, sans désactiver TLS. Le proxy HTTP Internet de la plateforme est conservé ; les exceptions NO_PROXY ciblent les seuls services locaux du test. Les ports loopback Auth/statique sont configurables si occupés. La recette navigateur interdit toute requête vers un service hébergé.

La pile complète du CLI Supabase a été abandonnée avant saturation du disque par son image PostgreSQL ; les services officiels nécessaires sont testés dans le laboratoire léger ci-dessus. Le relais loopback est nécessaire dans cet environnement car les ports publiés d'un réseau Docker `--internal` ne sont pas exposés à l'hôte. Les processus ne survivent pas nécessairement à la restauration d'un environnement.

Le workflow `.github/workflows/calculs-melanges-local.yml` reproduit ces vérifications sans secret de production, avec permission GitHub lecture seule. Un succès local n'est pas un résultat CI distant ni une recette en classe.

## Limites et accords avant activation

- Le plafond 594 et la règle 25 % / 50 % / 100 % avec complément unique sont validés et implémentés. Le HARD natif sélectionne toujours les trois opérations : aucun mode HARD réduit n’est inventé.
- Les aides suivent les conventions existantes. Les tables du hub sont propres à Mélange, comme demandé, sans écraser Multiplication simple. La miniature native reste à approuver ou remplacer avant visibilité de la carte. Le challenge HARD caché reste inactif.
- Le journal réseau est borné à 1 000 calculs pour rester sous la taille JSON admise. Les parties natives plus longues restent locales ; une compression auditable serait nécessaire avant de prendre en charge ces marathons en Connect.
- Les preuves sont des observations du navigateur, pas une attestation cryptographique des réponses. Le serveur contrôle identité, cohérence, seuils, unicité et transaction.
- Cette session a analysé les JSON bruts fournis par le professeur après lecture seule via sa connexion. Elle a testé le candidat dans une base jetable et n’a ni interrogé Supabase hébergé directement ni testé de session scolaire réelle. Aucune publication n’est réalisée.

La consigne finale confirme la mission **PR draft complète, testée et non publiée**. Les opérations de publication préparées restent hors périmètre : aucune fusion, installation SQL/Edge, activation ou ouverture des HUB. Le barème 594 validé n’autorise pas leur exécution. Le mode pilote et les candidats d’arrêt sont seulement des artefacts de revue et de laboratoire. Voir la [préparation de publication](PUBLICATION_CALCULS_MELANGES_20261030.md).

## Configuration cloud et PR

Les instructions cloud sauvegardées demandent maintenant exclusivement une PR draft et des tests locaux. Aucun accès Supabase de production ni jeton personnel n’est requis. L’ancien champ non renseigné `SUPABASE_ACCESS_TOKEN`, ajouté à tort, est inutilisé ; l’outil de configuration ne permet sa suppression que depuis l’éditeur de revue. Sa déclaration retient automatiquement `api.supabase.com` dans le brouillon réseau, mais aucun secret n’est associé et aucun appel Supabase hébergé n’est nécessaire ou effectué pour cette livraison. Les autres destinations de publication devenues inutiles ont été retirées du brouillon. Ce brouillon sauvegardé n’est pas une configuration appliquée.

GitHub HTTPS Git permet lecture et push. La création de PR draft utilise une API distincte ; si elle reste inaccessible ici, le dossier est prêt pour la connexion GitHub déjà autorisée du professeur, sans ajouter de jeton Supabase. Dépôt : `Mr-Tat/Mathas-Connect` ; base : `main` ; head : `integration/calculs-melanges-connect-20261030` ; draft : `true` ; titre : **Calculs écrits mélangés : intégration Connect, XP 594 validés et verrous fermés** ; corps complet : `docs/PR_CALCULS_MELANGES_DRAFT.md`. Vérifier une éventuelle PR existante de cette branche avant d’en créer une autre. Une branche poussée ou un lien de comparaison ne prouve pas qu’une PR existe.

## Seconde revue critique demandée

La revue a renforcé trois frontières, sans ouvrir de verrou :

- **Réaffectation avec JWT inchangé** : `student-load` fournit l’identité de stockage réellement résolue côté serveur ; chaque requête suivante porte `expectedStudentId`, comparé à l’identité authentifiée. Cache et file incluent aussi cet élève. Une recette réelle réaffecte le même appareil à un autre élève fictif avec une révision et une époque identiques : l’ancien événement est rejeté, l’état du nouvel élève reste vide et l’ancienne file est conservée. Le champ client ne confère aucun droit.
- **Saturation** : à 100 résultats en attente, les contrôles natifs Connect deviennent inertes et un message demande la reconnexion. Un bouton de synchronisation manuelle reste accessible. La recette injecte explicitement 100 journaux synthétiques, vérifie le blocage réel du bouton de départ, leur conservation puis le déblocage après ACK. Aucun test ne présente ces journaux injectés comme 100 parties jouées.
- **ACK et requêtes lentes** : les réponses sont corrélées par événement, application et élève, en plus de CAS/époque. Une réponse numérique plausible pour un autre événement ne supprime rien. Les requêtes HTTP sont bornées à dix secondes ; les lots supplémentaires arrivant à la frontière des 100 ACK sont repris sans polling ni boucle sur un échec.

Les corrections du report latéral et de l’emprunt à deux chiffres restent limitées à la copie. Le helper clavier ignore les marqueurs d’emprunt cachés, respecte les transitions automatiques et ne saisit pas de report dans la colonne finale qui contient déjà la retenue. La première tentative détermine le score ; toutes les opérations terminées restent dans le journal. La nouvelle décision du professeur supprime la condition de variété : la sélection de départ détermine le taux. Les limites pédagogiques et le plafond de journal 1 000 restent explicitement ouverts avant activation.

La revue du contexte professeur a également corrigé l’accès à la matrice GLOBAL lorsque le sélecteur de résultats contient Mélange. Le détail affiche les XP propres à ce jeu, lus côté serveur (28 dans la recette, contre 50 XP globaux), y compris via le tableau récapitulatif. Ces lectures sont déclenchées à l’ouverture du détail, sans polling et sans changement d’affichage des autres jeux.

Le professeur rapporte depuis une autre conversation connectée que le projet Supabase `awmhpfofacaglewammxt` est actif, ses migrations/tables/Edge lisibles et les quatre RPC `connect_xp_sync_v2`, `connect_xp_read_v2`, `connect_parcours_restart_one`, `connect_parcours_restart_class` présentes. Provenance : déclaration du professeur, pas introspection par cette session. Le candidat ne remplace aucune de ces fonctions. Leur lecture supplémentaire ne bloque pas l’implémentation.

Création de PR via une API GitHub disponible, sans aucun accès Supabase :

```sh
gh pr create --draft --repo Mr-Tat/Mathas-Connect --base main --head integration/calculs-melanges-connect-20261030 --title "Calculs écrits mélangés : intégration Connect, XP 594 validés et verrous fermés" --body-file docs/PR_CALCULS_MELANGES_DRAFT.md
```

## Suite vers la mise en service

La suite ajoute `scripts/calculs-melanges-release.mjs` (`plan`, `schema-query`, `check-report`) et le SQL d’audit du schéma en lecture seule, sans consultation des tables élèves. Le plan trace le commit, les trois constantes et les empreintes des fichiers de publication. L’export fournit une transaction READ ONLY sans l’exécuter. Le vérificateur hors ligne refuse les écarts de types, clés, valeurs par défaut indispensables, droits privés, barème ou catalogue. Aucun appel HTTP ni mécanisme d’authentification Supabase n’est présent dans cet outil ; le rapport JSON fourni est signalé comme non collecté par cette session. Les contraintes/triggers et la source Edge déployée restent à relire sur la cible ; le rapport ne prétend pas certifier une production qu’il n’a pas testée.

`calculs_melanges_enable_hidden.sql` est la transaction contrôlée d’activation du pilote : neuf règles exactes, cinq signatures RPC, droits privés et quatre presets invisibles obligatoires. Les refus pour XP modifiés, droit RPC public et preset visible sont vérifiés dans PostgreSQL jetable, puis l’activation et le retrait non destructif sont réellement exécutés dans ce laboratoire. Les fonctions partagées conservent les mêmes empreintes avant et après.

La nouvelle portée Edge `CONNECT_MIXED_ACCESS` est fermée par défaut. `pilot:<uuid>` limite les essais à une classe fictive ; une liste malformée refuse tout accès ; `open` est réservé à l’ouverture ultérieure choisie. Elle ne remplace aucune vérification d’identité. La sauvegarde hebdomadaire chiffrée ajoute obligatoirement les deux tables privées Mélange dès que son catalogue est installé, et échoue si leur lecture manque. Les tests déchiffrent réellement le résultat pour vérifier leur présence ; aucun backup de production n’est exécuté.

Dernière régression Node sans identifiants Supabase : **217 tests, 216 réussis, aucun échec, 1 historique ignoré**. Le laboratoire PostgreSQL est réussi : la requête de métadonnées exportée est réellement exécutée en READ ONLY, puis les installations/rejets/retraits sont testés uniquement dans la base jetable. Les recettes GoTrue/Edge/PostgreSQL/Chromium et de saisie native sont réussies sur cette version, sans identifiants Supabase de production : classe pilote filtrée, vraie saisie, ACK +28, professeur/reset/Monsieur T, réaffectation du JWT et saturation/reprise à 100 résultats. Les deux ordres 4→10→20 et 20→10→4 et les niveaux HARD 1/2/3 sont réussis ; aucun trafic hébergé. Le patch des trois constantes est préparé et vérifié sans être appliqué. La CI distante et la recette hébergée restent des contrôles distincts.

## Métadonnées différées et périmètre final

Aucune vérification Supabase hébergée n’est indispensable pour compléter cette implémentation ou sa PR. La [fiche de lecture seule](CALCULS_MELANGES_CONTROLES_LECTURE_SEULE.md) fournit la requête exacte et les métadonnées Edge/migrations/Pages à transférer via la connexion autorisée du professeur au moment de préparer une publication. Elle exclut les lignes élèves et les secrets et distingue son origine des tests exécutés ici. Les droits de publication ne sont pas demandés pendant cette étape.

## Bilan des vérifications au périmètre draft

| Vérification | Résultat et provenance |
| --- | --- |
| Régression Node | Exécutée ici : 217 tests, 216 réussis, 0 échec, 1 historique Soustraction/pg ignoré faute de module pg dans la suite générale |
| PostgreSQL jetable | Exécuté ici : SQL, 27 droits/594 XP, deux ordres de séries, reçus permanents, CAS concurrent, reset/rejeu, rollback et droits privés ; export READ ONLY avec triggers et event triggers sentinelles |
| Auth/Edge/SQL/Chromium | Exécuté ici : services officiels locaux, SDK natif, élève approuvé, pilote, ACK, offline/reload, page professeur/reset, Monsieur T, même JWT réaffecté et file 100 |
| Chromium moteur réel | Exécuté ici : calculs réellement saisis, méthodes natives, 4/10/20 dans les deux ordres, mort subite, HARD 1/2/3 et entraînement sans XP ; contrôles 320/768/1366 |
| HEAD main et moteur | Lus via Git ici : respectivement `91bcca7aba97d9fb00460a7e4ff56a0675f1459b` et `e11c88b4e449e8cdb17b0fee78c7daa6ea5bf279`, inchangés |
| Projet hébergé / quatre RPC historiques | Présence et projet actif rapportés par le professeur depuis sa connexion autorisée ; pas de nouvelles requêtes Supabase ici |
| CI distante de la PR | PR #34 créée et vérifiée en brouillon ; résultats initiaux du commit `972db1d` lus directement sur GitHub : 6 réussis, 1 échec SQL, 1 job arrêté au délai maximal ; correctifs décrits ci-dessous |
| Compatibilité hébergée complète / recette publiée | Différées à une éventuelle préparation de publication ; aucune modification réelle autorisée dans cette mission |

Aucun accès d’administration Supabase ne manque à l’implémentation livrée. Les métadonnées de publication sont préparées pour un échange en lecture seule ; elles ne conditionnent pas la complétude de la PR draft.

## PR draft n°34 et revue des contrôles

La [PR #34](https://github.com/Mr-Tat/Mathas-Connect/pull/34) a été créée depuis la connexion GitHub autorisée du professeur. Son état **Draft** et son head `972db1d` ont ensuite été vérifiés directement par cette session via Git et les pages GitHub. L’API GraphQL reste bloquée ici, mais les pages web publiques permettent de consulter les résultats. Les logs détaillés demandent une connexion ; les extraits ci-dessous ont été transmis par le professeur après lecture depuis sa connexion autorisée.

Résultats initiaux du commit `972db1d`, indépendants de la nouvelle exécution après correction :

| Contrôle | Résultat initial |
| --- | --- |
| Restore emergency smoke tests | Réussi — run `41101217758` |
| Mathas Connect regression tests | Réussi — run `41101217779` |
| Addition multiple SQL release preview | Réussi — run `41101217824` |
| Backup and XP checks | Job annulé au délai maximal de 3 minutes — run `41101217833` ; journal transmis : 8 tests réussis, 0 échec |
| Addition plusieurs Auth/Edge/PostgreSQL | Réussi — run `41101217855` |
| Soustraction PostgreSQL | Réussi — run `41101217886` |
| Addition plusieurs staging | Réussi — run `41101217916` |
| Calculs mélangés local integration | Échec de connexion PostgreSQL dans `run-calculs-melanges-postgres.sh` — run `41101217961` |

Erreur SQL précise transmise : socket `/var/run/postgresql/.s.PGSQL.5432` absente, sortie psql 2. L’image PostgreSQL avait bien été téléchargée et la régression Node avait 0 échec.

La course de démarrage a été reproduite ici avec un conteneur PostgreSQL jetable et un script d’initialisation fictif retardé : `pg_isready` sur socket répondait prêt à 7,81 secondes, alors que TCP ne devenait prêt qu’à 10 secondes, après l’arrêt du serveur temporaire d’initialisation. Les deux runners Mélange attendent maintenant le **serveur TCP définitif**, bornent explicitement l’attente et affichent les seuls logs de démarrage du conteneur si celle-ci échoue, avant insertion des fixtures. Aucun contrat, crédit XP, verrou ou moteur n’est modifié.

Le job backup/XP dispose de 8 minutes pour inclure checkout et installation de Node sur runner froid, mais son étape d’assertions reste bornée à 2 minutes. Les assertions existantes sont conservées et les trois tests de sauvegarde chiffrée Mélange sont inclus : **11 tests locaux réussis, 0 échec**. Les recettes PostgreSQL et Auth/Edge/PostgreSQL/Chromium sont toutes deux réussies après la correction TCP.

Le push des correctifs relance les contrôles de la même PR draft. Leur verdict doit être lu pour le nouveau head ; les six succès initiaux ne sont pas présentés comme validation du commit corrigé. Source à suivre : [Checks de la PR](https://github.com/Mr-Tat/Mathas-Connect/pull/34/checks). Aucune fusion, publication, activation ni opération Supabase hébergée n’est effectuée.

### Portabilité du runner SQL après le correctif TCP

Sur le head `11bfe64`, le contrôle Mélange `41105761238` signale ensuite une sortie 127, indiquant une commande indisponible. Le runner utilisait `rg` pour cinq vérifications de messages, alors que le workflow ne déclare pas cette dépendance. Le défaut de portabilité a été reproduit sur une version figée du script dans un PATH limité aux utilitaires standard : `rg: command not found`, sortie 127. La version corrigée emploie `grep -Fq`, garde les cinq mêmes assertions et termine toute la recette SQL avec succès dans ce même environnement dépourvu de ripgrep. Aucun paquet supplémentaire n’est ajouté au job.

Les nouveaux contrôles doivent à nouveau être évalués pour le commit qui contient ce correctif ; la sortie 127 du head précédent ne décrit pas cette nouvelle exécution.


## Actualisation : taux réduit, compléments et contrôles du hub

La [règle XP de sélection](CALCULS_MELANGES_XP_SELECTION_20261030.md) remplace les propositions historiques du kit. Les deux JSON complets fournis clôturent la comparaison de schéma : PostgreSQL 17.11, 26 tables, 137 contraintes, aucun namespace Mélange, quatre presets parents existants et deux watchers dont les définitions ne font que NOTIFY. Leurs empreintes correspondent au premier audit. Le laboratoire a rejoué le candidat actualisé sous ces watchers exacts, sans données de production.

La régression Node de cette actualisation compte 224 tests : 223 réussis, 0 échec, 1 historique Soustraction/pg ignoré. Le laboratoire SQL vérifie désormais 7 puis 7 puis 14 puis 0, les compléments après reset sans recollection, les tranches d’un parcours rejouable, l’arrondi /20 et une vraie course entre taux réduit et complet. Le contrôle d’activation masquée refuse aussi une version XP divergente. Les chiffres 217/216 cités dans les bilans précédents sont ceux de la revue initiale, avant cette actualisation.

La recette Auth/Edge/PostgreSQL/Chromium du nouveau changement et la recette complète du moteur natif sont réussies, uniquement avec des services locaux et des identités fictives. Les tests ajoutés couvrent les commandes réelles du hub (classe, élève, retrait et héritage), leur application dans les sélecteurs natifs, et la conservation des réglages de Multiplication simple. Ils couvrent aussi des parties réelles aux trois taux, les compléments hors ligne sans XP anticipés et une répétition sans crédit supplémentaire.

Le corps de PR actualisé est dans `docs/PR_CALCULS_MELANGES_DRAFT.md`. Une modification de ce fichier ne synchronise pas à elle seule la description GitHub si son API est inaccessible. La PR reste Draft ; aucun changement de `main`, déploiement ou activation n’est autorisé.
