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

Les meilleurs scores Connect sont indépendants pour chaque `(niveau, longueur 4/10/20)`. La vue native garde son unique meilleur record par niveau, sans être utilisée comme preuve XP. L'état possède une branche `eligible` distincte : une meilleure partie non éligible n'efface pas les preuves admissibles. Les deux paliers de mort subite sont mémorisés séparément : la variété acquise après le cinquième calcul ne crédite pas rétroactivement le seuil 5.

La file persistante est bornée à 100 événements, isolée par classe/sujet JWT/élève serveur/app ; ACK strict avant suppression, une seule requête en vol, aucun polling, reprise sur `online`. Un conflit d'époque bloque le rejeu ; au prochain chargement de l'époque actuelle, les anciens événements sont archivés localement sous le même profil. Aucun XP optimiste. Les doublons ACK affichent toujours delta 0.

Le menu natif annonce « 0 et 1 sont toujours activés », mais le générateur original sélectionne effectivement dans son pool 2–9. Cette incohérence d’origine est conservée et signalée ; aucun nouveau calcul 0/1 n’a été inventé.

Les tables minimales sont indépendantes de Multiplication simple (`connect_mixed_multiplier_locks`), avec priorité élève puis classe. L'élève conserve les tables obligatoires et peut en ajouter. Le HARD natif utilise toutes les tables, et inclut donc ces minimums. Aucune portée globale entre applications n'est imposée silencieusement.

## XP candidat et remise à zéro

Règle provisoire `mixed_v1` : trois opérations sélectionnées au départ, au moins deux types effectivement terminés ; pour la mort subite, vérification au seuil récompensé. Les aides suivent la convention actuelle (métadonnée, pas d'exclusion supplémentaire), Master donne 0 XP. Pas de crédit à partir du seul réglage ou cache natif.

| Jalon par niveau | XP |
| --- | ---: |
| Classique 4/4 | 28 |
| Classique 8/10 | 38 |
| Bonus 10/10 | 8 (46 au total) |
| Classique 16/20 | 63 |
| Bonus 20/20 | 13 (76 au total) |
| Mort subite 5 puis 10 | 12 + 12 |
| HARD mort subite 3 puis 7 | 12 + 12 |

198 par niveau, 27 droits, 594 sans rejeu explicitement autorisé. Aucun multiplicateur global, aucun changement des autres crédits. Un nouveau jalon pendant un parcours rejouable n'est pas doublé : la preuve mémorise son premier parcours. La répétition ne concerne que les droits acquis dans un parcours antérieur, une seule fois par parcours autorisé.

Le reset élève/classe archive uniquement Mélange, augmente revision/reset_epoch et préserve les crédits. `repeatXp=false` interdit la recollection ; `true` est une permission explicite du professeur. Pour Mélange, la case de rejeu est décochée par défaut. Les événements de l'ancienne époque sont refusés, y compris ceux dont l'UUID est déjà connu.

## SQL / Edge et verrouillage

Le candidat `supabase/release-candidates/calculs_melanges_locked_v1.sql` est une transaction à usage unique. Il refuse un app_key ou namespace RPC déjà présent, puis crée une app désactivée, quatre presets invisibles/non featured, neuf règles totalisant 198, cinq RPC **nouvelles**, les reçus permanents d'idempotence et les minimums de tables. Il ne remplace aucune fonction partagée existante : pas de définition historique de RPC à réinjecter. Le schéma doit néanmoins être comparé à la cible avant une éventuelle installation autorisée.

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

- Confirmer la règle d'éligibilité proposée et le barème 594 ; l'alternative XP de base pour 1/2 opérations n'est pas implémentée.
- Confirmer la politique des aides, la portée indépendante/globale des tables et la miniature officielle. Ne pas rétablir le challenge HARD caché sans décision.
- Le journal réseau est borné à 1 000 calculs pour rester sous la taille JSON admise. Les parties natives plus longues restent locales ; une compression auditable serait nécessaire avant de prendre en charge ces marathons en Connect.
- Les preuves sont des observations du navigateur, pas une attestation cryptographique des réponses. Le serveur contrôle identité, cohérence, seuils, unicité et transaction.
- Aucun schéma hébergé n'a été introspecté, aucune vraie session scolaire testée et aucune publication réalisée.

La demande ultérieure du professeur étend la mission vers la mise en service complète. La suite préparée est : audit schéma et catalogue actuels sans données élèves ; installation du seul candidat masqué ; déploiement Edge puis Pages et ouverture contrôlée des trois verrous dans une modification revue ; recette professeur/élève d’une classe fictive autorisée par le mode pilote ; ouverture et visibilité des HUB décidées individuellement par le professeur. La portée Edge de classe protège la phase pilote indépendamment de l’URL Pages publique. Retour arrière : fermeture Edge, disable-only, puis fermeture des constantes si nécessaire, sans effacer les résultats. Voir la [procédure concrète](PUBLICATION_CALCULS_MELANGES_20261030.md).

## Configuration cloud et PR

Le brouillon cloud enregistre `install_script`, `start_skill` et les ajouts réseau `api.github.com`, `api.supabase.com`, `awmhpfofacaglewammxt.supabase.co`, `mr-tat.github.io`, `esm.sh` (les presets existants sont préservés). Un emplacement sécurisé `SUPABASE_ACCESS_TOKEN`, limité à l’API de gestion Supabase, est déclaré pour la suite demandée ; aucune valeur n’a été reçue. Le site n'est pas publié par cette opération. L’application des paramètres et la publication de **l'environnement cloud** sont des opérations distinctes de Pages.

GitHub HTTPS Git est opérationnel avec l'authentification injectée. L'appel API requis pour une PR draft a rencontré un refus réseau. Si ce refus persiste, appliquer l'ajout enregistré dans les paramètres cloud puis reprendre la création de PR ; ne pas fournir de token dans le chat. La branche et un corps de PR sont préparés indépendamment de ce prérequis. La présence d'un fichier de corps ou d'un lien de comparaison ne prouve pas qu'une PR existe.

## Seconde revue critique demandée

La revue a renforcé trois frontières, sans ouvrir de verrou :

- **Réaffectation avec JWT inchangé** : `student-load` fournit l’identité de stockage réellement résolue côté serveur ; chaque requête suivante porte `expectedStudentId`, comparé à l’identité authentifiée. Cache et file incluent aussi cet élève. Une recette réelle réaffecte le même appareil à un autre élève fictif avec une révision et une époque identiques : l’ancien événement est rejeté, l’état du nouvel élève reste vide et l’ancienne file est conservée. Le champ client ne confère aucun droit.
- **Saturation** : à 100 résultats en attente, les contrôles natifs Connect deviennent inertes et un message demande la reconnexion. Un bouton de synchronisation manuelle reste accessible. La recette injecte explicitement 100 journaux synthétiques, vérifie le blocage réel du bouton de départ, leur conservation puis le déblocage après ACK. Aucun test ne présente ces journaux injectés comme 100 parties jouées.
- **ACK et requêtes lentes** : les réponses sont corrélées par événement, application et élève, en plus de CAS/époque. Une réponse numérique plausible pour un autre événement ne supprime rien. Les requêtes HTTP sont bornées à dix secondes ; les lots supplémentaires arrivant à la frontière des 100 ACK sont repris sans polling ni boucle sur un échec.

Les corrections du report latéral et de l’emprunt à deux chiffres restent limitées à la copie. Le helper clavier ignore les marqueurs d’emprunt cachés, respecte les transitions automatiques et ne saisit pas de report dans la colonne finale qui contient déjà la retenue. La première tentative détermine le score, mais une opération corrigée puis réellement terminée compte pour la variété : aucune exclusion pédagogique supplémentaire n’est introduite. Les limites pédagogiques et le plafond de journal 1 000 restent explicitement ouverts avant activation.

La revue du contexte professeur a également corrigé l’accès à la matrice GLOBAL lorsque le sélecteur de résultats contient Mélange. Le détail affiche les XP propres à ce jeu, lus côté serveur (28 dans la recette, contre 50 XP globaux), y compris via le tableau récapitulatif. Ces lectures sont déclenchées à l’ouverture du détail, sans polling et sans changement d’affichage des autres jeux.

Contrôle des accès demandé en fin de tâche : le Git HTTPS authentifié permet lecture et push. Le jeton GitHub est injecté, mais les API REST/GraphQL échouent au tunnel proxy (`CONNECT 403`), avant vérification des permissions API. Aucun outil Supabase n'est exposé ; le CLI ne trouve pas de jeton existant et les endpoints publics de gestion/santé échouent également au tunnel réseau. Aucune requête sur les résultats élèves n'a été faite pour ce contrôle. Aucun secret Supabase n'est nécessaire pour la validation locale ; l’accès de gestion manquant est désormais déclaré pour préparer la publication demandée.

Après application du seul ajout réseau GitHub enregistré dans les paramètres cloud, la création demandée se reprend avec :

```sh
gh pr create --draft --repo Mr-Tat/Mathas-Connect --base main --head integration/calculs-melanges-connect-20261030 --title "Calculs écrits mélangés : intégration isolée, XP candidat 594 et verrous fermés" --body-file docs/PR_CALCULS_MELANGES_DRAFT.md
```

## Suite vers la mise en service

La suite ajoute `scripts/calculs-melanges-release.mjs` (`plan`, `audit`, `check-report`) et le SQL d’audit du schéma en lecture seule, sans consultation des tables élèves. Le plan trace le commit, les trois constantes et les empreintes des fichiers de publication. L’audit n’utilise jamais le endpoint SQL modifiable et refuse les écarts de types, clés, valeurs par défaut indispensables, droits privés, barème ou catalogue. Les contraintes/triggers et la source Edge déployée restent à relire sur la cible ; le rapport ne prétend pas certifier une production qu’il n’a pas testée.

`calculs_melanges_enable_hidden.sql` est la transaction contrôlée d’activation du pilote : neuf règles exactes, cinq signatures RPC, droits privés et quatre presets invisibles obligatoires. Les refus pour XP modifiés, droit RPC public et preset visible sont vérifiés dans PostgreSQL jetable, puis l’activation et le retrait non destructif sont réellement exécutés dans ce laboratoire. Les fonctions partagées conservent les mêmes empreintes avant et après.

La nouvelle portée Edge `CONNECT_MIXED_ACCESS` est fermée par défaut. `pilot:<uuid>` limite les essais à une classe fictive ; une liste malformée refuse tout accès ; `open` est réservé à l’ouverture ultérieure choisie. Elle ne remplace aucune vérification d’identité. La sauvegarde hebdomadaire chiffrée ajoute obligatoirement les deux tables privées Mélange dès que son catalogue est installé, et échoue si leur lecture manque. Les tests déchiffrent réellement le résultat pour vérifier leur présence ; aucun backup de production n’est exécuté.

Dernière régression Node : **216 tests, 215 réussis, aucun échec, 1 historique ignoré**. Le laboratoire PostgreSQL de publication est réussi. La recette GoTrue/Edge/PostgreSQL/Chromium a été rejouée avec une classe pilote réellement filtrée : refus des autres classes, saisie offline puis ACK +28, professeur/reset, Monsieur T, réaffectation du JWT et saturation/reprise à 100 résultats sont réussis. Le patch des trois constantes est généré et `git apply --check` le valide sans l’appliquer. La validation hébergée et la CI distante restent non exécutées faute d’accès effectifs ; les nouvelles exigences cloud sont enregistrées sans être appliquées à la machine courante.
