# Recette pragmatique, preuves, publication et retrait

**Objectif :** une seule matrice de scénarios, exécutée à la profondeur justifiée par le risque. Pas de checklists de 60 cases sans propriétaire. **Aucune donnée d'élève réel** ; utiliser exclusivement les comptes/élèves fictifs approuvés.

## Matrice de preuve (à cocher pour chaque jeu)

Remplir **OK / ÉCHEC / NON EXÉCUTÉ / SANS OBJET**, lien run/capture ou journal **sans données personnelles**, commit, version et auteur. Les tests et les URL directes n'usurpent pas un vrai navigateur connecté.

| Test minimal et condition d'arrêt | Contrat/Node | PG + Auth/Edge locaux | Chromium vrai moteur | Pages + LAB authentifié |
| --- | :---: | :---: | :---: | :---: |
| Moteur original, mode libre, vrais menus, saisies et focus (320 px) | ✓ | – | ✓ | ✓ |
| Session approuvée / révoquée ; classe et autre élève refusés | ✓ | ✓ | ✓ | ✓ |
| Partie terminée une seule fois, journaux/modes/aides corrects | ✓ | ✓ | ✓ | ✓ |
| Jalons, complément, arrondis, repetition 0, plafond; Master non payant | ✓ | ✓ | ✓ | ✓ |
| Transaction score+XP+reçu, panne tardive et double/concurrent | ✓ | ✓ | – | observation ACK |
| Reprise multi-appareil et reload, records, trophées et déblocages | ✓ | ✓ | ✓ | ✓ |
| File offline, réseau lent, 409, mauvais ACK, file pleine, réaffectation | ✓ | ✓ | ✓ | échantillon |
| Reset fictif d'une app : époque, archive, pas de recollecte par défaut | ✓ | ✓ | ✓ | ✓ si autorisé |
| Professeur : résultats, GLOBAL, classe/élève, tables si applicables, Monsieur T | ✓ | ✓ | ✓ | ✓ |
| Quatre vrais HUB **non ouverts** pendant pilote ; labo isolé | ✓ | ✓ | – | GET et UI |
| Régression des autres jeux et des quatre espaces / projection anonyme | ✓ | ✓ | ciblée | lecture seule |
| Miniature/WebP/URL, cache, poids, mobile et appareil scolaire | ✓ | – | ✓ | ✓ |

Pour outils sans XP, marquer explicitement **sans objet** plutôt que simuler des points. Pour applications sans tables ou sans mode HARD, ne pas leur inventer des tests de tables/HARD. L'exigence d'un vrai navigateur authentifié reste pour les flux concernés.

## Trois portes bloquantes, pas une autorisation à chaque micro-étape

**A — Prête pour la PR technique :** moteur et modes audités, échec P0 absent, contrat, tests locaux pertinents, compatibilité SQL, matrice professeur, portée diff, manifeste et rollback. CI sur SHA exact ; pas de secrets ni de vrais élèves ; migrations **non exécutées** à ce stade.

**B — Prête pour la recette hébergée :** installation **gardée et réconciliée** avec production, version Edge exacte/`verify_jwt`, Pages livré sur SHA attesté, app accessible uniquement selon pilote autorisé, quatre cartes générales encore masquées. Un navigateur réel avec **session fictive connectée** et appareil approuvé est nécessaire. Une app globalement désactivée ne peut pas être testée en Connect par le seul lien labo.

**C — Prête pour ouverture :** vraie partie finie, ACK et XP confirmé, complément et répétition, recharge/reprise, classe/élève/professeur/Monsieur T selon disponibilité, aucune anomalie P0/P1, preuve que les autres jeux ne régressent pas, accord pédagogique réel. Contrôler les 4 catalogues après leur cache, lien Pages et accès classes ordinaires, puis consigner l'état final.

Si une couche est **NON EXÉCUTÉE**, le dire clairement et rester à un stade candidat/pilote ; pas de succès présumé. Si recette propriétaire indispensable et inaccessible à l'agent, fournir un **script court** de gestes précis plutôt que demander des captures répétées.

## Plan de publication en couches

1. **Préflight lecture seule** juste avant intervention : HEAD/PR, manifest SHA SQL/Edge, schéma/ACL/migrations, code live et catalogue, risques de dérive. Si des RPC communes ont changé, régénérer/retester le candidat ; **jamais retirer les garde-fous** pour passer.
2. **Une méthode de migration.** SQL transactionnel **ou** gestion de migration par outil, selon le manifeste exact : pas les deux. En particulier, ne pas rejouer le stock de `supabase/migrations` avec un `db push` aveugle. Préparer et tester la candidate PostgreSQL jetable avec rollback tardif.
3. **Installer sans exposition** : nouvelle app désactivée, cartes invisibles ; aucune écriture sur résultats d'élèves. Après inspection et autorisation de la phase concernée, déployer les Edge nécessaires sur les sources figées, JWT selon route. Ne pas redéployer des fonctions hors changement.
4. **Publier le statique** via branche/PR/Pages et constater l'empreinte du contenu réellement servi ; URL directe accessible techniquement même quand les cartes sont cachées. Le lien secret n'est pas une authentification.
5. **Activer le pilote serveur** et la carte **seulement dans le laboratoire** une fois les préconditions réunies. La classe du labo possède le HUB test indépendant ; ne jamais modifier les vrais presets pour lui faire contourner une panne. Vérifier vraie session, approbation, jeu et preuves.
6. **Ouvrir les espaces réels** uniquement après la porte C et le périmètre autorisé, via script exact gardé et réversible. Vérifier Observation, Phase 1, Phase 2, 2 ECO **individuellement** et la cache du catalogue (60 s actuellement). Tracer commit/Edge/migration et état.
7. **Suivi frugal :** un contrôle lecture seule, court, ciblé. Si régression grave, retirer l'accès de **ce jeu** et sa visibilité ; garder tables, états, crédits, reçus, historiques. Pas de restauration globale d'une base ancienne.

## Réutiliser le laboratoire existant

Ouvrir `laboratoire.html` sous une session professeur gérant la classe fictive « Classe démo - TEST » ; confirmer les profils comme fictifs. « Se connecter avec ce profil » **préremplit** le formulaire élève, n'authentifie pas : utiliser son navigateur élève, demander puis approuver la session native, vérifier qu'elle est effectivement reconnue **dans ce même navigateur**. Les cases « Afficher » modifient le **catalogue HUB test**, indépendant de `GLOBAL` ; elles ne créent ni compte ni permission.

Pour tester « première récompense », utiliser une fiche fictive **sans cet acquis** : reset sans `repeatXp` n'efface pas les droits consommés. Répéter sur un PC scolaire si disponible ; un test Chromium grand écran ne suffit pas. Ne pas utiliser de SQL pour injecter de faux XP dans la vraie base.

## Commandes et risques de tests

- Regarder le contenu des workflows existants avant d'utiliser `node --test tests/*.test.mjs` : des `*.test.mjs` appellent désormais des **HTTP publics en direct** (`laboratoire-live-readonly`, `melange-public-catalogs-live`). Éviter de mélanger un échec réseau avec une régression locale.
- Les workflows `mathas-connect-tests.yml`, `connect-safety.yml`, `calculs-melanges-local.yml`, `addition-plusieurs-auth-local.yml`, `soustraction-browser.yml` et autres sont **spécifiques** ; leurs chemins déclencheurs peuvent ne pas lancer de CI pour une PR uniquement Markdown.
- Pour chaque contrôle, relever **nombre passé / échecs / skips**, SHA et environnement. Test Playwright/Chromium avec mock ≠ Auth locale complète ≠ connexion de l'élève fictif à Pages.
- Les tests réutilisables clés : `tests/calculs-melanges-contract.test.mjs`, `tests/calculs-melanges-auth-local.e2e.mjs`, `tests/calculs-melanges-browser.e2e.mjs`, `tests/postgres/calculs-melanges-assertions.sql`, `tests/laboratoire-static.test.mjs` et tests de sécurité/isolement Addition et Soustraction.

## Preuve de fin

Dans la fiche finale : `main` SHA, moteur source SHA, `app_key`, versions contrat/barème, migration/version et méthode, Edge live version + JWT, Pages SHA vérifié, 4 catalogues, résultats de CI, scénario réel du labo (date/navigateur/fiche fictive/ACK), anomalies encore ouvertes, procédure de retrait, confirmation d'absence de modification des vrais élèves. Un tableau « OK/ÉCHEC/NON EXÉCUTÉ » suffit ; pas de capture répétée ni secret.