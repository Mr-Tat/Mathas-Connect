# Math’as Connect — Règles XP, niveaux et intégration des jeux (V1 de conception)

> Document de référence pour toutes les prochaines intégrations Math’as Connect.
> Décision de conception validée le 25 octobre 2026. **Pas encore implémenté en production**.
> Ne modifie jamais l'ancien Math’as (`Mr-Tat/Mathas` / Supabase legacy).
> Les règles sont recalibrables et versionnées : ce document décrit le barème initial, non une vérité immuable.

## 1. Philosophie et vocabulaire

- **Points du jeu** : barème propre à chaque application. Le joueur garde les records, les médailles et trophées du jeu.
- **XP Connect** : progression globale, déterminée par les **meilleurs acquis** de jeux différents. Aucune somme de toutes les parties jouées.
- **Niveau Connect** : palier atteint à partir de la somme des XP attribués par application, indépendamment de la classe administrative. L'élève conserve son identité, sa progression et ses acquis s'il change de groupe.
- **Record du jour** : affichage dans les résultats, ne rapporte aucun XP additionnel de répétition.
- **Avatars et pseudo** : indépendants des scores. Pseudo prévu mais **masqué côté élève en V1**.
- **Élève connecté** : compte autorisé par professeur via appareil / code de contrôle. Le prénom + initiale ne permettent jamais de reprendre le compte d'un autre enfant.

## 2. Budget XP par jeu — plafond commun de 500 XP

| Catégorie | Plafond | Principe |
| --- | ---: | --- |
| Performance personnelle | 350 XP | Meilleur score *historique admissible* et normalisé |
| Accomplissements / trophées | 100 XP | Réussites uniques, sans re-gain au redémarrage |
| Défis spéciaux | 50 XP | Jalons difficiles, par exemple HARD |
| **Maximum par application** | **500 XP** | Aucun jeu ne peut dominer les autres par la seule échelle de points |

Une application sans trophées ou sans HARD doit proposer **des réussites équivalentes** dans ces deux enveloppes (ou renoncer provisoirement aux XP correspondants, sans les offrir gratuitement).
Les maxima sont communs, les seuils, la fonction de performance et les jalons sont propres au jeu et restent calibrables.

### Normalisation initiale des points

Proposition de départ, à éprouver sur des données d'élèves :

`performanceXP = round(350 × min(1, meilleurScoreAdmissible / scoreReference)^0.85)`

- `scoreReference` est déterminé jeu par jeu pour représenter une excellente performance, **pas forcément le maximum théorique**. Jamais une valeur inférieure à 1.
- `meilleurScoreAdmissible` est le plus haut résultat valide ayant été conservé comme acquis du compte, même si les records d'affichage ont ensuite été effacés volontairement.
- Le calcul ne dépend pas du nombre d'essais. Un même résultat ne peut pas être récompensé deux fois.
- Toute donnée transmise par le navigateur doit être vérifiée/corroborée côté serveur avant d'accorder de nouveaux XP : ne jamais accorder les XP sur la seule foi d'un champ arbitraire de points ou de trophées reçu du client.

### Première calibration : Addition écrite simple

Le moteur CE-Addition-simple utilise actuellement le barème `5 × multiplicateurNiveau × multiplicateurMode × performance` (le mode Mort subite a une pondération cumulative) ; son meilleur score unitaire est déjà stocké sous `bestPoints`. Le HARD « 5 calculs » a volontairement **0 point de jeu**. Les trophées existent dans `state_data.rewards`.

**Valeur initiale proposée : `scoreReference = 320` points**, à réexaminer après les premiers vrais résultats, sans modifier les points affichés à l'intérieur d'Addition.

| Meilleur score Addition | XP performance (sur 350) |
| ---: | ---: |
| 0 | 0 |
| 50 | 72 |
| 100 | 130 |
| 150 | 184 |
| 200 | 235 |
| 224 (exemple standard parfait N3 /20) | 258 |
| 260 | 293 |
| 300 | 331 |
| 320 ou plus | 350 |

Calculs indicatifs arrondis à l'entier le plus proche. Ils ne sont pas encore déployés.

### Addition — 100 XP d'accomplissements uniques

Réutiliser les clés de récompense **existantes** ; ne pas réinventer leurs noms :

| Acquis déjà enregistré | XP / élément | Nombre max | Total |
| --- | ---: | ---: | ---: |
| `rewards.mastery[4/10/20][niveau]` | 2 | 9 | 18 |
| `rewards.sudden[niveau]` | 6 | 3 | 18 |
| `rewards.hardAwards.bronze[niveau]` | 3 | 3 | 9 |
| `rewards.hardAwards.silver[niveau]` | 5 | 3 | 15 |
| `rewards.hardAwards.gold[niveau]` | 8 | 3 | 24 |
| `rewards.scoreOne.bronze/silver/gold` | 3 | 3 | 9 |
| `rewards.unlockedGold` | 7 | 1 | 7 |
| **Total** | | | **100 XP** |

Chaque case n'accorde les XP qu'à sa **première obtention**, même après effacement des trophées visibles.

### Addition — 50 XP maximum de défis HARD « 5 calculs »

Prendre `state_data.hardThree[0..2]`, meilleur total valide sur 5 calculs pour chaque niveau.
Accorder des XP aux jalons déjà franchis, cumulables au sein du niveau :

| HARD (5 calculs) | Niveau 1 | Niveau 2 | Niveau 3 |
| --- | ---: | ---: | ---: |
| Avoir réussi au moins 1/5 | 3 XP | 3 XP | 4 XP |
| Avoir réussi au moins 3/5 | +5 XP | +5 XP | +5 XP |
| Avoir réussi 5/5 | +7 XP | +9 XP | +9 XP |
| **Total du niveau** | **15 XP** | **17 XP** | **18 XP** |

TOTAL : 50 XP possibles. Ex. 5/5 en HARD N1 vaut 15 XP de défi, même si le jeu attribue 0 point de score pour cette partie. Pas de répétition possible des XP.

Les trophées HARD constituent une autre forme d'accomplissement, distincte de cette maîtrise du défi à cinq calculs : ce bonus cumulatif est **volontaire** mais plafonné au total 500 XP pour Addition.

## 3. Seuils des niveaux Connect — V1

Le niveau commence à **1** avec 0 XP. La formule initiale du seuil d'accès au niveau L est :

`T(L) = 20 × (L − 1)² + 70 × (L − 1)`, L entier >= 1.

| Niveau | Total XP nécessaire |
| ---: | ---: |
| 1 | 0 |
| 2 | 90 |
| 3 | 220 |
| 4 | 390 |
| 5 | 600 |
| 6 | 850 |
| 7 | 1 140 |
| 8 | 1 470 |
| 9 | 1 840 |
| 10 | 2 250 |
| 11 | 2 700 |
| 12 | 3 190 |
| 13 | 3 720 |
| 14 | 4 290 |
| 15 | 4 900 |
| 16 | 5 550 |
| 17 | 6 240 |
| 18 | 6 970 |
| 19 | 7 740 |
| 20 | 8 550 |

Un seul jeu plafonné à 500 XP permet donc d'atteindre au maximum le **niveau 4**. Deux jeux permettent d'aller plus loin, et la progression ralentit naturellement lorsque le catalogue grandit. Ces paliers pourront changer par version.

Affichage HUB connecté : niveau actuel, points acquis et points manquants avant le niveau suivant, petite jauge ; aucun affichage en Mode Classique. Les chiffres sont relatifs aux acquis de l'élève, **pas aux parties jouées dans le navigateur**.

## 4. Rééquilibrage sans destruction — décision structurante

Prévoir **avant la première attribution d'XP** des données séparées des scores visibles :

- `student_id` : identité pérenne unique de l'élève.
- `app_key` : application (clé immuable).
- `xp_credited` : plus haut nombre d'XP définitivement crédité pour ce jeu, entre 0 et 500 (**monotone**).
- `evidence` : preuves des meilleurs records / jalons effectivement déjà crédités, distinctes des récompenses visibles ; en particulier identifiants d'accomplissements pour empêcher de récolter à nouveau les XP après effacement des trophées.
- `ruleset_version` : version des coefficients sous lesquels le crédit a été établi.
- `highest_level_reached` : niveau le plus haut déjà annoncé à l'élève, jamais diminué automatiquement.
- `level_ruleset_version` : version des seuils du niveau.

**Recalibrage d'un jeu :** recalculer les droits théoriques à partir des preuves validées et créditer au plus la différence positive : `xp_credited = max(xp_credited, xp_theorique_vN)`. Jamais de débits silencieux ; le cap global de 500 XP/app reste en place.

**Changement de seuils :** recalculer le niveau de la courbe courante, mais ne pas afficher un niveau inférieur à `highest_level_reached`. En cas de seuils relevés, conserver le niveau déjà acquis et afficher 0 progression jusqu'au seuil suivant si nécessaire, sans promettre une progression inexistante.

**Effacer les records / médailles / trophées visibles** n'efface pas le crédit d'XP ni les preuves des récompenses déjà attribuées. **Remettre à zéro la progression** est une autre action Master, explicite et confirmée ; son périmètre exact devra être convenu avant son implémentation. La révocation d'un appareil et le changement de classe ne modifient jamais ces acquis.

**Import historique** : migrer séparément les acquis validables et non les caches arbitraires du navigateur. Ne jamais créer des XP doublement crédités.

Important : l'interface ne doit jamais laisser croire que les niveaux ont déjà été implémentés avant la validation serveur.

## 5. Règles d'architecture pour les jeux à venir

1. Chaque nouvelle application déclare `app_key`, titre, URL, schéma du score et une **version de contrat XP**.
2. Elle continue de gérer son barème interne ; Connect lit ses **meilleurs acquis** et non des points distribués à chaque partie.
3. Elle spécifie son `scoreReference`, sa conversion vers 350 XP, ses récompenses identifiables vers 100 XP, et ses défis vers 50 XP.
4. Une application sans points visibles peut utiliser un meilleur indicateur interne validé (ex. réussite maximale) pour le contrat XP.
5. **Ne jamais accorder les XP directement dans le JavaScript public sans contrôle serveur.** Idempotence par événement / identifiant de récompense et contrôle d'appartenance à l'élève.
6. Conserver l'identité globale de l'élève lors de son passage d'Observation à Phase 1/2 ou 2 ECO. Les classes servent au HUB, au suivi et à la projection, pas à dupliquer ses XP.
7. Côté projection, respecter l'autorisation d'affichage, utiliser avatar/pseudo public lorsqu'il sera activé et ne pas afficher le nom complet sans nécessité.
8. Économie Supabase : calculer/cacher les XP lors d'un nouvel acquis validé ; le HUB connecté lit un résumé compact à l'ouverture/retour d'un jeu, et ne fait **aucune interrogation périodique**. Le HUB en Mode Classique ne fait pas de requête XP.
9. Les sauvegardes chiffrées et exports devront inclure les preuves XP, crédits et règles/version de progression, **sans mettre de données personnelles sur GitHub public**.
10. Tester : doublons d'envoi, hors-ligne, révisions simultanées, reset scores, reset progression, retour depuis un jeu, appareil révoqué, changement de classe, changement de barème, anciennes récompenses, identité prof `Monsieur T` (exclue des projections par défaut).

## 6. Attention à la validation côté serveur

Au 25 octobre 2026, `CE-Addition-simple` expédie déjà `points` et `rewards` via `game-record` ; le serveur Connect valide leur **forme, les limites et la révision**, mais ne recalcule pas encore entièrement la formule de points à partir de la preuve de partie. Ne pas alimenter des classements compétitifs ou un système d'XP irréversible avec ces champs sans renforcer cette étape de contrôle.

Les états `connect_states` du premier jeu, les récompenses et les `hardThree` servent à définir le contrat, mais **le stockage XP permanent et la vérification de performance restent à développer**.

## 7. Pour les prochains passages de flambeau

Joindre ce fichier à tout nouveau projet Connect ou fournir son chemin GitHub exact : `Mr-Tat/Mathas-Connect/docs/REGLES_XP_NIVEAUX_ET_INTEGRATION_V1.md`.

Réviser le numéro de version et consigner explicitement toute modification des seuils, coefficients et règles de conservation d'acquis. Ne pas effacer les récompenses déjà créditées.
