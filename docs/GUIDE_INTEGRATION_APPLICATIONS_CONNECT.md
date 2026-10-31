# Guide général d'intégration d'une application dans Math’as Connect

Retour d'expérience du 31 octobre 2026. Ce guide s'applique aussi aux jeux non arithmétiques et aux outils pédagogiques. Les sources et états déployés doivent être revérifiés au début de la nouvelle tâche ; les exemples Mélange ne sont pas des règles universelles.

## 1. Commencer par quatre décisions concrètes

Décrire ce que fait l'application, ce qu'elle doit sauvegarder, ce qui constitue une réussite et quels usages sont attendus côté élève et professeur. Un outil de manipulation sans performance mesurable peut être intégré sans XP ni faux événement de fin de partie.

Identifier le dépôt cible **Mr-Tat/Mathas-Connect**, le dépôt moteur, leurs HEAD, le futur app_key et le périmètre autorisé. Ne pas travailler dans l'ancien `Mr-Tat/Mathas`. Si le moteur n'est pas connu, le rechercher dans les sources connectées et la documentation avant de demander son URL.

Une intégration se prépare et se teste de façon autonome, par lots cohérents. Les choix pédagogiques non tranchés peuvent attendre pendant la copie isolée et les essais locaux. Une publication ne doit pas dépendre d'un « go » redemandé à chaque fichier ; elle respecte l'autorisation réelle de la session et les conditions qui l'accompagnent.

## 2. Établir les capacités sans demander de secret par réflexe

Consigner, pour chaque opération utile, un état **disponible / vérifié / indisponible** :

| Capacité | Vérification adaptée |
| --- | --- |
| Git lecture | `git ls-remote` avec la configuration existante |
| Git push | Publication de la branche autorisée ; ce n'est pas une preuve d'accès API |
| API GitHub | Outils de création de PR, contrôles, journaux, fusion, selon les droits disponibles |
| Supabase lecture | Métadonnées du projet, schéma et versions nécessaires, sans résultats réels |
| Supabase écriture | Migrations, requêtes ou Edge : vérifier chaque capacité séparément |
| Navigateur local | Chromium avec données fictives et endpoints jetables |
| Navigateur hébergé authentifié | Session réellement ouverte et autorisée ; un UUID ou un appareil approuvé en base ne la remplace pas |

Un `GH_TOKEN` absent ou `gh auth status` non connecté n'invalide pas l'authentification Git fournie par le proxy. Un accès Supabase via connexion ChatGPT peut fonctionner sans `SUPABASE_ACCESS_TOKEN` local. Ne demander un secret que pour une opération précise impossible autrement, après vérification des capacités et de la politique réseau.

Respecter les protections de réseau et d'outils. Une destination bloquée nécessite la configuration supportée ou une exécution dans l'environnement autorisé ; ne pas extraire les credentials du proxy ni utiliser une autre machine comme relais clandestin. Une requête refusée par un contrôle de sécurité ne doit pas être camouflée dans une fonction ou un autre outil.

Si plusieurs conversations ont des capacités complémentaires, préparer un seul passage de relais : référence exacte, fichiers et empreintes, opération à effectuer, critères de réussite et limites. Ne pas demander une série de captures ou d'exports déjà suffisants.

## 3. Auditer le moteur avant d'écrire l'adaptateur

Examiner les vraies entrées utilisateur, modes lançables, règles de score, aides, paramètres, progressions, clés de stockage et fonctions de fin. Une recherche de noms ne remplace pas un essai des chemins concernés.

Répondre notamment à ces questions :

- Une activité est-elle une série, un problème, une question, un projet ou un document ?
- Quand est-elle définitivement terminée, y compris erreur fatale, abandon, nouvelle tentative et retour au menu ?
- Quels champs sont écrits avant/après les animations ? Un trophée apparaît-il avec retard ?
- Le cache natif conserve-t-il tous les meilleurs acquis nécessaires ou seulement un record d'affichage ?
- Les modes du code sont-ils accessibles dans l'interface ? Des contrôles historiques sont-ils masqués ou neutralisés ?
- L'application utilise-t-elle des nombres, chaînes, listes, fichiers ou médias qui nécessitent un autre contrat que celui des calculs écrits ?

Copier le moteur dans un répertoire propre au nouveau jeu, sans modifier son dépôt d'origine. Tracer commit, empreintes et adaptations de la copie. Préserver l'expérience libre et les méthodes pédagogiques. Toute correction native nécessaire doit être minimale, expliquée et vérifiée.

## 4. Définir un contrat, pas une collection de champs copiés

Le contrat indique une version, un identifiant d'événement unique, le type d'activité, sa difficulté, les bornes du résultat, les paramètres pertinents capturés au départ et la version du parcours. La sémantique des champs compte plus que leur nom.

Distinguer version du moteur, contrat de transport, schéma d'état, barème et époque du parcours. Mélange peut ainsi afficher V6.0.2, transporter un contrat version 1 et appliquer une politique XP version 3 ; ces numéros ne sont pas interchangeables.

Pour un résultat terminal, le pont doit transmettre exactement une fois après finalisation. Il ne doit pas créditer au clic sur « commencer », à la sauvegarde d'un réglage, à l'affichage d'une médaille ou à une étape partielle. Si l'activité produit un document évolutif plutôt qu'un score, définir explicitement sauvegarde, version et éventuelle validation ; ne pas inventer un faux `score/total`.

Valider côté serveur identité, appartenance, application autorisée, version du contrat, types, bornes, cohérence de la preuve, révision et époque. Le navigateur ne décide pas du montant XP. Un journal client validé n'est pas une preuve cryptographique qu'un humain a travaillé : le niveau de confiance doit être adapté à l'usage, sans promettre une invulnérabilité à la triche.

Si un pont utilise `postMessage`, vérifier à la fois la fenêtre émettrice attendue, son origine et le schéma du message. Plusieurs jeux du même domaine peuvent partager une origine. Une iframe ne constitue pas à elle seule une protection de secrets ou une preuve de résultat.

## 5. Séparer identité, données, affichage et droits XP

Réutiliser l'authentification Connect. Conserver la distinction entre utilisateur Auth, fiche élève, appareil et inscription de classe. Le serveur résout la fiche concernée ; un `studentId` reçu dans l'URL ne donne aucun droit.

L'identité de stockage doit suivre la fiche actuelle, même si le même appareil et le même JWT sont réaffectés à un autre élève. Vérifier cette liaison sur les lectures et les écritures, pas seulement au lancement.

Définir la portée de chaque information : configuration de classe, préférence personnelle, progression par élève/application, résultat d'une activité, session temporaire. Les caches et files locales doivent inclure les identités nécessaires. Ne pas transformer la classe d'autorisation en nouveau budget XP à chaque changement de groupe.

Les scores et records affichés ne sont pas les preuves permanentes de crédit. Un reset d'affichage ou de parcours ne doit pas effacer implicitement les droits déjà consommés. Un rejeu avec nouveaux crédits, lorsqu'il est autorisé, est une politique explicite et distincte.

Le compte joueur **Monsieur T** utilise sa session professeur séparée. Tester ce parcours sans le confondre avec un élève ni exposer les données des classes habituelles.

## 6. Concevoir les XP pour l'activité réelle

Écrire d'abord des exemples de réussite, de répétition, d'amélioration, de changement d'options et de reset, avec montants attendus. Faire valider les choix pédagogiques qui changent ces droits. Versionner ensuite la politique.

Ne pas importer un ancien plafond de 500/750 XP depuis une note historique. Les 474 XP de certaines applications et les 594 XP de Mélange sont des références existantes, pas une loi pour toute future application. Ni bonus global ajouté à tous les jeux, ni recalibrage de tous les élèves lors d'un déploiement technique.

Les crédits doivent correspondre à une progression ou un accomplissement défini, plutôt qu'au nombre de rechargements, au temps laissé ouvert ou aux réglages sélectionnés. Prévoir les règles pour l'amélioration d'un acquis, les fractions éventuelles et les arrondis cumulés. Le niveau global Connect reste celui de Connect : ne pas introduire une deuxième courbe de niveaux dans chaque application.

Une application sans XP reste une intégration valide. Si des règles spécifiques ne sont pas approuvées, garder l'activité libre ou ses résultats fonctionnels sans distribuer des récompenses inventées.

## 7. Garantir sauvegarde et synchronisation

Une réception serveur doit enregistrer de manière atomique ce qui doit rester cohérent : état, preuves, crédits et reçu d'événement. Une erreur ne doit laisser ni XP seul, ni score seul, ni historique de migration partiel.

Prévoir un identifiant d'événement idempotent, une révision pour les écritures concurrentes et une époque de reset. Le reçu serveur doit durer suffisamment pour éviter un double crédit après purge d'une courte liste d'affichage. Tester deux requêtes concurrentes ; un verrou et une transaction SQL ne sont pas équivalents à un simple booléen JavaScript.

Conserver la file locale jusqu'à l'ACK. Borner taille des événements, nombre d'éléments et gestion d'une file pleine. À la reconnexion, réessayer sans recalculer arbitrairement un nouvel événement. Une mauvaise identité ou une ancienne époque doit être rejetée ou mise à part ; ne pas réécrire silencieusement les preuves pour les faire passer.

Afficher les XP et leur animation depuis l'ACK, jamais comme crédit certain avant confirmation. Rendre visibles attente, refus et besoin de reconnexion.

Définir précisément l'offre hors ligne. Pour le lanceur Connect actuel de Mélange, le démarrage demande une session et un état serveur ; le jeu déjà chargé peut ensuite conserver une fin hors ligne et la synchroniser. Un démarrage complet sans réseau exige un autre travail de cache et d'authentification, à ne pas promettre par simple présence d'une file.

Éviter le polling des états/XP. Utiliser les événements de connexion, l'ouverture, le retour ou l'actualisation explicite. Les timers internes d'un moteur ne justifient pas des requêtes Supabase au clavier.

## 8. Préparer le serveur sans toucher aux applications existantes

Limiter les modifications communes aux ajouts nécessaires et contrôlés : allowlist, catalogue, adaptateur de résultat ou vue professeur. Ne pas profiter d'une intégration pour refondre tous les jeux déjà utilisés.

Le nouvel app_key, ses règles et ses éventuels objets privés ne doivent pas écraser un namespace existant. Des RPC ou tables supplémentaires ne sont nécessaires que si le contrat les justifie ; ne pas copier mécaniquement les cinq RPC de Mélange pour chaque outil.

Vérifier RLS, grants et signatures. Une fonction `SECURITY DEFINER` exige notamment un `search_path` maîtrisé et des droits explicites. Aucune clé `service_role` dans le navigateur. Un catalogue public peut avoir un GET sans JWT ; ses écritures et les résultats d'élèves doivent conserver leur contrôle d'identité. Ne pas désactiver une protection JWT pour contourner un problème de session.

Collecter une seule fois les métadonnées requises pour le candidat : colonnes, types, contraintes, droits, fonctions concernées, historique de migration, catalogue et éventuels triggers/watchers. Les exports peuvent être complets pour ce périmètre sans lire une table de résultats. Enregistrer date, commit et empreinte. Ne pas figer pour toujours « 25 » ou « 26 migrations » : le laboratoire a depuis ajouté ses propres objets.

Choisir un propriétaire unique de la transaction et de l'historique de migration :

- soit l'outil de migration gère ces éléments selon son contrat ;
- soit un lot SQL brut préparé et testé gère explicitement transaction et ligne d'historique, et s'exécute par l'outil approprié.

Ne pas mélanger les deux, retirer des gardes pour passer un outil ou rejouer une migration historique. Tester sur une base jetable la compatibilité de l'historique réel, un échec tardif, l'absence de mutation partielle et le rejet d'une réapplication.

## 9. Réutiliser le laboratoire, sans ouvrir les vraies cartes

Utiliser le laboratoire existant et des profils confirmés fictifs. Une demande peut être rattachée à une fiche existante : un nouvel appareil de test n'impose pas un nouvel élève. Ne pas supprimer une fiche, ses crédits ou ses résultats pour rendre les tests plus commodes.

Pour un test de première récompense, choisir une fiche sans cet acquis. Une réinitialisation sans recollection ne fabrique pas un compte vierge. Éviter les homonymes et vérifier le profil reconnu par la session.

La case **Afficher** du laboratoire ne concerne que le HUB de test. Les quatre catalogues habituels doivent rester indépendants. Le pilote connecté peut exiger une application serveur activée tout en gardant les cartes habituelles masquées ; ne pas confondre les deux interrupteurs.

Un éventuel verrou d'accès au pilote est côté serveur et propre au nouveau jeu. Prévoir dès le début comment il sera administré puis retiré. Ne pas recopier aveuglément le `open` de Mélange déjà publié pour exposer un nouveau jeu en préparation.

## 10. Tester par couches, avec un compte rendu court

| Couche | Ce qu'elle prouve |
| --- | --- |
| Contrats/unités | Normalisation, bornes, calculs, états et erreurs déterministes |
| PostgreSQL jetable | Atomicité, concurrence, droits, idempotence, reset et migration |
| Auth/Edge locaux | JWT, appartenances, rôles, transports et erreurs avec données fictives |
| Chromium local | Saisie, focus, vrais contrôles, fin unique, affichage et reprise |
| Recette hébergée fictive | Fonctionnement du code déployé avec une véritable session et un vrai ACK |
| Contrôles publics | Publication, catalogues, URL et assets ; ils ne prouvent pas l'auth élève |

Vérifier le nombre réel de tests exécutés, les skips et les étapes conditionnelles. Dans cet environnement, certaines restrictions de sous-processus pouvaient empêcher le vrai déroulement du runner ; un code de sortie ou un compte de fichiers ne remplace pas un bilan de tests.

Séparer tests locaux et tests HTTP publics. Au main du 31 octobre, `tests/laboratoire-live-readonly.test.mjs` et `tests/melange-public-catalogs-live.test.mjs` appellent des services hébergés. Leur présence dans `*.test.mjs` signifie qu'un glob large peut utiliser le réseau. Ne pas déclarer une unité cassée quand seul un endpoint public est inaccessible, et ne pas affaiblir le test pour faire disparaître l'erreur.

Tester des comportements utiles plutôt que des textes décoratifs. Une modification de libellé ne devrait pas casser le contrôle d'une permission inchangée. Une visibilité choisie par le professeur ne devrait pas être assimilée à une corruption du jeu ; les attentes de catalogue doivent correspondre au contrat de publication visé.

Préparer dès le début un retour humain à quelques cases : session, première récompense, amélioration, répétition, reconnexion, page professeur, réglage, reset, rôle professeur. Noter **réussi / échoué / non exécuté**, lieu, version et provenance. Un avis global positif n'est pas une preuve détaillée de chaque scénario ; le conserver comme tel.

## 11. Publier un candidat précis, puis vérifier l'accès

Préparer code, tests, PR, manifestes et retour arrière avant l'étape de production. Vérifier la référence exacte, les contrôles terminés et l'absence de dérive pertinente. Une branche pushée n'est pas une PR ; une PR fusionnée n'est pas une publication Pages ; Pages ne déploie pas une Edge et ne rend pas automatiquement visible une carte Supabase.

Pendant cette intégration, main a été signalée non protégée. Revérifier ce réglage si l'outil le permet ; ne jamais supposer que GitHub bloquera une publication accidentelle. Une protection de branche et des contrôles requis sont recommandés pour l'exploitation, sans les activer implicitement au cours d'une intégration.

Installer le nouveau jeu avec des états explicites : serveur fermé/désactivé, pilote connecté avec cartes habituelles masquées, puis ouverture générale après les validations et autorisations prévues. Ne pas utiliser le blocage d'un contrôle comme raison de l'ignorer. Inversement, ne pas demander une nouvelle approbation pour les mêmes actions déjà autorisées.

Après ouverture, contrôler les catalogues après leur délai de cache, les URL et un lancement autorisé. Un verrou serveur limité à la classe pilote peut encore bloquer une classe habituelle malgré une carte visible : le vérifier selon les moyens disponibles, avec Monsieur T si cela évite d'accéder à des résultats réels.

Le retour arrière doit pouvoir fermer ou masquer **la nouvelle application seulement**, sans détruire ses acquis, restaurer toute la base ou réinstaller les autres jeux. Les sauvegardes et exports doivent inclure les nouveaux objets utiles sans publier de données personnelles sur GitHub.

## Fichiers de référence à lire selon le sujet

- Authentification et transport : [`apps/calculs-melanges/connect-host.mjs`](../apps/calculs-melanges/connect-host.mjs), [`connect-context.js`](../connect-context.js), [`app.js`](../app.js).
- Fin, file et révisions : [`native-bridge.js`](../apps/calculs-melanges/native-bridge.js), [`completion-contract.mjs`](../apps/calculs-melanges/completion-contract.mjs), [`offline-queue.mjs`](../apps/calculs-melanges/offline-queue.mjs), [`sync-protocol.mjs`](../apps/calculs-melanges/sync-protocol.mjs).
- Preuves et hydratation : [`records.mjs`](../apps/calculs-melanges/records.mjs), [`connect-hydration.mjs`](../apps/calculs-melanges/connect-hydration.mjs).
- Serveur : [`connect-results`](../supabase/functions/connect-results/index.ts), migrations et candidats de la nouvelle application ; Mélange est un exemple à étudier, pas à réappliquer.
- Laboratoire : [`LABORATOIRE_HUB_ISOLE_20261031.md`](LABORATOIRE_HUB_ISOLE_20261031.md), [`laboratoire.js`](../laboratoire.js), [`connect-lab-catalog`](../supabase/functions/connect-lab-catalog/index.ts).
- Recettes : [`tests/calculs-melanges-auth-local.e2e.mjs`](../tests/calculs-melanges-auth-local.e2e.mjs), [`tests/calculs-melanges-browser.e2e.mjs`](../tests/calculs-melanges-browser.e2e.mjs), runners de [`tests/local`](../tests/local).

Les conventions de ces fichiers sont réutilisables ; leurs app_key, modes, plafonds, tables et empreintes sont spécifiques. Une nouvelle application doit conserver son propre contrat.
