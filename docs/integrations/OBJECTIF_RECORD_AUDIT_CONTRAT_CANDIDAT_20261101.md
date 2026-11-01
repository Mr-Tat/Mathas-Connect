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
