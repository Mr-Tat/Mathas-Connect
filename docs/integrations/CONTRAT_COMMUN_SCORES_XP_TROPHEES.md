# Contrat commun — scores, XP et trophées Connect

**Statut : contrat implémenté et déployé le 31/10/2026.** Voir la [fiche de livraison et les limites de preuve](DEPLOIEMENT_TROPHEES_20261031.md). Vérifier les versions LIVE à chaque nouvelle mission.

## Trois notions distinctes

| | Scores / parcours | XP Connect | Trophées Connect |
| --- | --- | --- | --- |
| Signification | Réussites et records propres au moteur, au mode, niveau, longueur et méthode | Jalons de compétences crédibilisés côté serveur et progression du niveau global | Distinctions uniques **déjà prévues par le jeu**, pas de nouvelles récompenses inventées |
| Événement | Fin de partie admissible, preuve structurée, meilleur score si applicable | Droit serveur à un jalon + compléments de droit éventuels | Déblocage authentique d'un identifiant de trophée de cette application |
| Conservation | Records actifs réinitialisables, historique archivé | Crédit conservé et jamais redéduit par reset | **Définitive** : une fois gagné, toujours acquis et visible |
| Remise à zéro professeur | Recommence le parcours de **cette app** ; `reset_epoch` empêche les événements anciens | Le `repeatXp` reste une permission séparée selon la politique XP existante | **Aucun effacement, aucun nouvel exemplaire, aucune seconde obtention ou animation de première découverte** |
| Dénominateur des compteurs | Les modes/durées propres à l'app | Plafond validé pour l'app (474, 594… selon contrat) | Nombre de distinctions uniques réellement atteignables, déclaré par l'app |
| Identité et source | Fiche élève + `app_key`, serveur autoritaire | Journal de preuves et RPC serveur | Identifiant stable `(student_id, app_key, trophy_key)`, non déduit d'une répétition de partie |

**Ne jamais remplacer « trophées » par « nombre de jalons XP »** : les jalons peuvent être partiels, répétés avec autorisation ou bénéficier de compléments et ne représentent pas le même objet pédagogique. Un trophée peut être lié à une réussite mais demeure un identifiant distinct.

## Comptages sans doublons

- Le nombre d'un jeu est le nombre de ses clés de trophées **distinctes définitivement acquises**, **pas** le nombre de parties, de resets ni de fois où une animation s'est jouée.
- Le nombre du profil HUB est la somme des clés distinctes sur les jeux Connect : deux trophées de jeux différents sont deux trophées ; le même trophée rejoué est un seul.
- La définition des trophées appartient au moteur et au contrat de l'application. Plusieurs jeux écrits ont un objet natif `rewards` de version 3 : `mastery` (9 cases), `sudden` (3), `hardAwards` (9), `scoreOne` (3), `unlockedGold` (1), soit **25 emplacements de distinction dans ce schéma**. **Vérifier** pour chaque jeu ceux qui sont effectivement atteignables ; ce n'est pas un plafond universel.
- Un jeu sans trophées définis n'obtient pas 25 distinctions artificielles ; son statut est « non proposé » jusqu'à décision pédagogique. Ne pas convertir des scores ou des XP en trophées pour remplir le compteur.
- Ne pas afficher `0` si le serveur n'a pas pu lire les trophées : afficher un état indisponible (`—`), contrairement à « zéro acquis » dûment confirmé.

## Invariant essentiel de persistance

**Implémenté :** les fonctions de remise à zéro continuent à remettre `connect_states.state_data` à `{}` pour les scores et progrès. Cela n'efface **plus** les trophées : le registre `connect_trophy_achievements` conserve chaque `(élève, jeu, trophée)` ; `connect_trophy_rewards_v1` les restitue lors de `student-load`. Les archives et états antérieurs ont été réconciliés sans toucher aux crédits XP.

**Implémentation recommandée à valider par les tests avant publication :**

1. Définir une source **serveur** persistante des distinctions uniques par `student_id + app_key + trophy_key` (registre indépendant des parcours **ou** conservation de `rewards` sur tous les chemins de reset avec protection équivalente). Ne pas toucher aux RPC XP pour « attribuer » des trophées.
2. Reconstituer avec prudence les trophées historiques *prouvés* depuis les états actifs et, si besoin, les archives de parcours. Garder les acquis déjà présents ; ne pas inventer de trophées à partir des seules statistiques XP. Documenter les archives incomplètes.
3. L'écriture d'un nouveau trophée accompagne la réussite authentique et l'ACK de manière transactionnelle, avec déduplication. Un reset de scores ne révoque pas le registre.
4. Au retour dans un jeu, restaurer la vue native des trophées acquis **même sur un nouveau parcours** ; ne pas restaurer les records ni les anciens événements. Ne jamais rejouer l'animation « nouveau trophée » pour un trophée déjà gagné.
5. Exposer au HUB le **résumé autorisé et léger du profil courant** (nombre global et, plus tard, détails par application) via l'authentification existante. Respecter les permissions élève/Monsieur T et l'absence de réseau Connect en mode libre. Pas de polling ni de lecture directe de profils voisins.

## Affichage : projet distinct de la règle de conservation

- **Profil HUB :** placer `🏆 N trophées` sous le badge « Niveau », après avoir légèrement remonté celui-ci, sans réduire la lisibilité de la jauge XP ni du bouton « Mon profil » ; comportement mobile à 320 px.
- **Cartes d'applications :** préparer des champs `xpEarned/xpMax`, `trophiesEarned/trophiesMax` à valeur typée **non disponible** si la source n'est pas fiable. Les textes, la disposition exacte et les jeux sans trophées restent à convenir avec le professeur avant activation de ce rendu.
- Le total global du profil s'entend **toutes applications Connect de l'élève**, pas uniquement la page HUB/les jeux visibles dans le preset du jour.
- Ne pas confondre « XP Connect de niveau global » et « XP acquis sur l'application ». Les XP de rejeu explicitement permis doivent être signalés dans le contrat avant d'afficher un « x / maximum ».

## Vérifications bloquantes de la future implémentation

- Élève fictif : acquérir une distinction A, redémarrer **une seule app**, retrouver A dans le jeu et dans le profil ; score actif réinitialisé ; trophée A **non proposé ni récompensé à nouveau**.
- Refaire dix fois le même trophée, fermer hors ligne/reconnecter, ouvrir un autre appareil : compteur inchangé, ACK idempotent, pas d'animation de nouveau trophée.
- Obtenir un nouveau trophée B après reset : compteur +1, tout en conservant A.
- Rejouabilité XP `false` puis `true` : ne change jamais le nombre de trophées ; les règles XP déjà décidées restent intactes.
- Reset de l'app A : l'app B et ses trophées/XP/scores ne sont pas modifiés. Monsieur T est isolé des vrais élèves.
- Tests SQL jetables : rollback d'écriture tardive, accès non autorisé, concurrentiel, anciennes archives, versions de contrat, non-régression des resets. **Aucune opération sur les résultats réels pour la recette.**

**État au 31/10/2026 :** SQL, Edge et HUB publiés. Les tests PostgreSQL jetables, Auth/Edge/navigateur locaux et CI sont verts ; **la recette sur Pages avec authentification réelle n'a pas été effectuée**. Aucun moteur original ni barème XP modifié.
