# Objectif record — candidat contractuel, sans activation (01/11/2026)

## État de sécurité
Ce lot ne modifie aucun HTML vivant, Edge, SQL, table, XP, trophée ou classement. Il prépare uniquement un modèle de contrat `apps/objective-record/contract.mjs` et ses tests. **Ne pas interpréter les projections tests comme des droits réels.** Aucun profil authentifié hébergé n'a été testé ici.

## Matrice d'audit du moteur GitHub (main)
| Jeu | Source GitHub | Validation | Points | Particularité |
| --- | --- | --- | --- | --- |
| Addition simple | `game-original.html` | `evaluateCalc` / `verifyPair` | 1 par calcul correct au premier essai | prototype séparé, lanceur Connect `index.html` |
| Addition multiple | `index.html` généré clean-v1 / v3.2.1 | `evaluateCalc` / `verifyPair` | idem | source génératrice absente du dépôt moteur ; copie Connect séparée |
| Soustraction | `index.html` | `evaluateCalc` / `verifyPair` | idem | `borrowMethod`, ajustements/emprunts, verrouillage de case |
| Multiplication | `index.html` clean-v1 / V4.3.2 | `evaluate` / `verifyPair` | idem | `carryMethod`, tables autorisées, `startSudden.onclick` |
| Mélange | `index.html` | `evaluate` / `validateNormal` | idem | `opsSelector`, `settings.ops`, `suddenBtn`, jeu HARD distinct |

Le moteur `index.html` de Mélange, Multiplication et Addition multiple se déclare généré mais aucune source génératrice/build n'est présente dans **leurs dépôts publics** au moment de cet audit. Ne pas éditer ces fichiers à la main : candidats `essai-...` indépendants et recherche des sources de construction d'abord.

## Ce que la lecture serveur actuelle ne permet PAS de conclure
`connect_mixed_xp_read_v1` renvoie les jalons acquis, `repeatXp` et `rulesetVersion:3`, mais **pas un registre de crédits partiels 3 vies** ni une projection pour une combinaison exacte. Ajouter un registre interne unique par (élève, app, parcours/époque, jalon), avec montants cumulés et reçus idempotents, puis une RPC lecture seule renvoyant la projection des cinq boutons pour la configuration figée. Ne jamais déduire un demi-crédit depuis les seuls booléens `milestones`.

La politique Mélange existante est `perfect4:28`, `pass10:38`, `bonus10:8`, `pass20:63`, `bonus20:13`, `sudden5:12`, `sudden10:12`, `hard3:12`, `hard7:12` au plein droit, avec 25/50/100 % selon **nombre de familles sélectionnées au départ** (et cumul avant arrondi), soit 594 XP théoriques. **Ce contrat de crédit existant tient compte du nombre**, mais l'affichage demandé doit encore être prouvé pour la **combinaison exacte** et les droits déjà obtenus. Le modèle fail-closed n'en extrapole aucune valeur.

## Conditions à satisfaire avant de brancher cette API
1. Convenir de l'unité commune de points et de l'arrondi du bonus +20 %, puis n'appliquer ce bonus qu'au score de classement vérifié côté serveur.
2. Réconcilier sources génératrices, lanceurs Connect, état `app_key`, événements uniques/UUID et preuve par calcul ; tests de complétude par méthode.
3. Rendre atomiques : journal d'erreur, état, meilleurs scores, top-up XP, reçus, trophées uniquement Mort subite ; protégés par identité et `reset_epoch`.
4. Tests PostgreSQL jetables, double requête/concurrence, Auth + Edge locaux, Chromiums réel et navigateur hébergé fictif. Aucune écriture dans la base réelle sans accord.
5. Puis seulement versionner migration/Edge, vérifier comparabilité et préparer les portes A/B/C de la recette.

## Statut de preuve
- Audit statique des cinq moteurs : effectué sur main.
- Pure functions / unit tests : voir CI du commit (à contrôler).
- SQL transactionnel et API connectés : **non implémentés**.
- Navigateur authentifié, clavier, PC/GSM, droits professeur : **non testés**.
- Publication : **interdite sans feu vert**.


## Vérification directe des accès Supabase (lecture de métadonnées uniquement)

**Vérifié le 01/11/2026 à partir de la connexion Supabase :**

- Le compte a accès à trois projets : `Mathas-Test` (**INACTIVE**), `Math'as Connect` et `Math'as` (**ACTIVE_HEALTHY**). Ne pas relancer automatiquement le projet de test : confirmer frais éventuels et usage prévu.
- Aucune branche Supabase existante dans les projets de test ou Connect. Les outils de création de branche, migration, exécution SQL et déploiement Edge sont disponibles **mais n'ont pas été utilisés** pour écrire dans la production.
- Sur Connect, le catalogue de métadonnées expose 35 tables publiques, dont `connect_xp_award_rules`, `connect_xp_milestones`, `connect_xp_credits`, `connect_parcours_current` et `connect_states`. 32 migrations figurent dans l'historique, et `connect-results` est déployée en version 42 au moment de la lecture.
- Les signatures PostgreSQL réellement déployées confirment `connect_mixed_record_v1(uuid,uuid,bigint,bigint,text,integer,integer,integer,jsonb,jsonb,jsonb,jsonb,boolean,boolean)`, `connect_mixed_xp_read_v1(uuid,text,boolean)` et `connect_mixed_xp_sync_v1(uuid,text,boolean)`, toutes `SECURITY DEFINER`.
- **Risque de lecture avec effet de bord :** le code existant `connect_mixed_xp_read_v1` peut invoquer `connect_mixed_xp_sync_v1` quand l'état paraît plus récent. Pour l'audit, seules les métadonnées du catalogue et les définitions GitHub ont été lues ; aucune RPC individuelle d'XP n'a été invoquée.
- **Point critique Mélange :** `connect_mixed_record_v1` agrège aujourd'hui les droits dans `eligible`, `halfEligible`, `quarterEligible` selon la **quantité** d'opérations sélectionnées ; les preuves `operationsSelectedAtStart` restent dans le journal récent mais ne constituent pas un registre pérenne de droits par combinaison exacte. L'affichage distinct `add+sub` / `add+mul` exige une persistance serveur nouvelle et une politique explicite, pas une déduction du nombre de cases cochées.
- La RPC reçoit actuellement un journal déclaré par le navigateur (`operationsCompleted`, `firstTry`), en contrôle les bornes et la cohérence, mais la syntaxe de la preuve ne suffit pas à prouver côté SQL que chaque addition, soustraction ou multiplication est mathématiquement correcte. Prévoir validation déterministe des opérations/calculs ou une attestation de partie contrôlée, en plus du contrôle de structure.
- **Aucune donnée individuelle d'élève n'a été interrogée.** Aucune transaction de récompense, écriture, migration ou déploiement Supabase n'a été lancée.

Pour les tests serveur, privilégier une base PostgreSQL éphémère dans GitHub Actions, ou une branche Supabase de test facturée seulement après accord.


## Prototype serveur transactionnel ajouté dans la PR (non installé)

- Fichier de recherche `supabase/release-candidates/objective_record_ledger_candidate.sql` (**pas** sous `migrations/`). Une CI séparée le charge **uniquement** dans PostgreSQL 16 jetable, sur de faux UUID : `.github/workflows/objective-record-ledger-candidate.yml` et `tests/objective-record-ledger-candidate.sql`.
- Schéma privé `objective_record_candidate`, sans accès `anon`/`authenticated`, avec fonctions `SECURITY INVOKER` exécutables seulement par `service_role`. Il ne touche aucune table Connect et n'invente aucun trophée.
- Contrat de la couche **serveur de confiance** : vérifier Auth, approbation active, droits professeur/élève et époque, ainsi que chaque opération et chaque réponse mathématique avant de transformer la preuve en événement normalisé. Les paramètres `p_evidence` ne sont **pas** une preuve à eux seuls ; le SQL ne garantit pas cette validation.
- Cinq lignes de règles obligatoires par `app + version + niveau + sélection exacte` : `classic:4`, `classic:10`, `classic:20`, `record:5`, `record:10`. Aucun montant n'est initialisé dans une vraie base. Les fixtures des tests sont fictives.
- Les modes 3 vies et Mort subite partagent chaque jalon `record:5` / `record:10`. Crédit plafonné à `floor(plein/2)` puis complément jusqu'au plein ; journal de reçus unique par `(student,event_id)`, hachage SHA-256 des champs normalisés, verrou transactionnel par élève/app. Un événement réémis ne recrédite rien ; un ID réutilisé avec autre charge est refusé.
- L'absence de droits de rejeu conserve les crédits sur `scope_epoch=0` malgré la remise à zéro ; seule une autorisation serveur `repeat_xp=true` pour une nouvelle époque crée un droit séparé. La lecture renvoie `NULL` si contexte, version, combinaison ou règles ne concordent pas.
- Les sept sous-ensembles Mélange ont des clés persistantes distinctes, pas un multiplicateur déduit du nombre d'opérations. **Cette granularité est une proposition de contrat nouvelle**, et doit être validée pédagogiquement pour éviter de distribuer plus d'XP que les plafonds du système actuel.
- La CI tente aussi 16 crédits simultanés sur un même jalon et vérifie plafond/reçus, ainsi que les tests de retrait de privilèges, rejouabilité et ROLLBACK. Le statut de réussite doit être relu sur GitHub Actions.

### Bloquants conservés

1. Raccorder sans privilège excessif l'Edge `connect-results` à une vérification arithmétique réelle, sans faire confiance à un booléen ou une preuve déclarée par le navigateur.
2. Définir le barème officiel par sous-ensemble Mélange et le budget d'XP global (risque de cumul entre sept sélections), et les règles communes applicables aux autres moteurs ; définir la politique de points du classement +20 %.
3. Relier de manière atomique les crédits validés à `connect_xp_credits`/`connect_xp_milestones` et aux trophées **existants**, sans modifier la logique de remise à zéro ni donner de trophée en mode 3 vies. Le schéma candidat est volontairement indépendant, sans effet sur le total réel du HUB.
4. Tester Auth/Edge et navigateur de bout en bout sur identités fictives, jamais dans la production. Pas de migration ni de publication avant cette recette.


## Contrôle arithmétique candidat hors Edge

- `apps/objective-record/server-proof.mjs` + `tests/objective-record-proof.test.mjs` vérifient des **réponses numériques finales** contre des questions que le backend a préalablement émises et qu'il relit depuis son stockage de confiance. Le navigateur ne peut pas injecter son `score`, ses questions ou ses indicateurs `correct` / `firstTry` dans ce modèle.
- La fonction rejette toute question non prévue, réponse incomplète, répétition d'ID, calcul après la troisième erreur (ou après la première en Mort subite), mélange d'opérations invalide et fin anticipée sans motif. Elle déduit score, erreurs, jalons candidats et éligibilité à un trophée **sans attribuer celui-ci**.
- Les cinq familles de moteur et les sept combinaisons Mélange × trois niveaux sont couvertes par des tests JavaScript. **Limite majeure** : la vérification arithmétique terminale ne prouve pas encore les gestes de retenue/emprunt ni la première tentative par case du moteur natif. Avant branchement, les questions doivent être générées et persistées côté serveur, avec TTL/nonce, Auth + validation de classe, parcours/époque, nombre de questions, interdiction de réutiliser une session et concordance exacte des règles de chaque moteur. La consommation de session et le crédit doivent être atomiques.
- Le +20 % du classement n'est toujours **pas activé** : il attend l'unité et l'arrondi communs. Le modèle arithmétique ne change jamais les montants XP.


## Point d'intégration Edge identifié dans les sources réelles

**Lecture du code GitHub** `supabase/functions/connect-results/index.ts` (branche PR, fichier source du service en place) :

- La route existante exige `POST`, `Bearer` vérifié par `auth.getUser(token)`, un `classId` UUID, et dispose de `identity()` : un élève doit avoir un appareil `connect_devices.state='approved'`, une inscription active `connect_enrollments` et un compte `connect_students` non archivé ; un enseignant non anonyme doit avoir `can_manage` sur la classe et son propre joueur.
- Le `student-load` existant renvoie `resetEpoch`. Les nouvelles actions de lecture doivent revalider `identity()` + l'application active et renvoyer les montants **du seul élève lié au JWT**, jamais d'un `studentId` arbitraire reçu du client.
- Le `game-record` Mélange passe par `connect_mixed_record_v1` avec `p_selected`, `p_completed`, `p_first` ; les autres chemins diffèrent : Addition multiple possède une RPC atomique et les jeux classiques une mise à jour partiellement dans l'Edge. **Ne pas coller le registre candidat directement à ces chemins**, ni faire une seconde RPC de crédit après un ACK : la preuve, la consommation de session, le score et l'XP doivent être une seule opération transactionnelle.
- Proposition d'actions **non ajoutées** : `objective-record-start` (identité + configuration, stockage de questions privées), `objective-record-finish` (lecture du challenge, contrôle réponse/méthode, écriture atomique), `objective-record-remaining` (lecture seule, approbation + époque + sélection exactes). Aucun nom de route n'est encore un contrat déployé.
- Un `game-record` ou `student-xp` actuel ne constitue **pas** une preuve suffisante pour afficher le solde des cinq boutons ni pour récompenser 3 vies. Les fonctions XP actuelles sont réutilisées seulement après adaptation vérifiée, sans invocation en production durant l'audit.
