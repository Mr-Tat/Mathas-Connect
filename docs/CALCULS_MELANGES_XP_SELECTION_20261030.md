# Mélange — règle XP validée le 30 octobre 2026

La décision explicite de l’enseignant remplace la proposition initiale du kit qui exigeait deux types réellement rencontrés. Le moteur reste libre de tirer plusieurs fois la même opération.

- **Trois opérations cochées au début de la partie : 100 % des XP**, même si le tirage ne présente qu’un ou deux types.
- **Une ou deux opérations cochées : 50 % des XP.**
- Réussir ensuite le même jalon avec les trois opérations donne **uniquement le complément manquant**, une seule fois, jusqu’au montant complet. Une répétition ou un retour à une sélection réduite ne baisse et ne recrédite aucun acquis.
- Le réglage est capturé au démarrage. Un changement ultérieur ne requalifie pas la partie déjà terminée ; une nouvelle réussite admissible est nécessaire.
- Cocher des cases seul ne donne rien : le journal réel des calculs terminés, le score aux premières tentatives, le niveau, le mode, l’identité, la révision et l’époque restent vérifiés par le serveur.
- Master, entraînement et challenge HARD dormant : **0 XP**. Les aides gardent la convention existante : usage tracé sans nouvelle exclusion.

## Barème par niveau

| Jalon | Trois opérations | Une ou deux opérations |
| --- | ---: | ---: |
| Classique 4/4 | 28 | 14 |
| Classique 8/10 | 38 | 19 |
| Bonus 10/10 | +8, soit 46 au total | +4, soit 23 au total |
| Classique 16/20 | 63 | 32 |
| Bonus 20/20 | +13, soit 76 au total | +6, soit 38 au total |
| Mort subite normale 5 | 12 | 6 |
| Mort subite normale 10 | +12 | +6 |
| Mort subite HARD 3 | 12 | Non lançable : le HARD sélectionne toujours les trois |
| Mort subite HARD 7 | +12 | Non lançable : le HARD sélectionne toujours les trois |

Le serveur stocke des XP entiers. L’arrondi 32 puis +6 conserve exactement la moitié du total 76. Les compléments correspondants valent +31 puis +7. Le plafond complet demeure **198 par niveau, 594 pour l’application**, hors rejeu expressément permis par le professeur. Aucun changement des autres jeux et aucun multiplicateur global.

Les modes normaux seuls donnent au maximum 261 XP avec sélection réduite sur les trois niveaux. Le HARD natif choisit automatiquement les trois opérations et peut ajouter 72 XP complets : ce parcours atteint 333, puis peut atteindre 594 par les compléments normaux. On ne présente donc pas 297 comme un plafond réellement lançable de tous les modes réduits.

## Conservation et compléments

Les meilleurs résultats 4/10/20 restent séparés par niveau et longueur. L’état conserve deux arbres de preuves : `eligible` pour les sélections complètes et `halfEligible` pour les réduites. Un meilleur résultat réduit ne remplace pas une preuve complète déjà acquise.

Chaque jalon possède une seule ligne dans `connect_xp_milestones`. Son champ serveur `xpPoints` ne peut qu’augmenter de la demi-valeur à la valeur complète ; une nouvelle réussite complète ne touche que cette différence. UUID/reçu durable, verrou de l’élève, CAS et transaction commune état/XP empêchent les doubles crédits, y compris quand des parties réduites et complètes arrivent simultanément.

La politique XP porte la version 2, sans modifier le schéma de transport version 1 ou remplacer les RPC des autres applications. Aucun montant ou taux fourni par le navigateur n’est utilisé pour calculer les crédits.

## Reset et rejeu professeur

Sans droit de rejeu, les XP déjà obtenus restent acquis et ne sont pas recollectables. Un complément **jamais obtenu** reste accessible après le reset : 14 XP acquis avant, puis une réussite complète après, donne seulement les 14 manquants.

Avec rejeu explicite, `firstParcours` et `fullParcours` distinguent l’acquisition de la première tranche et du complément. Exemple : 14 XP acquis au parcours 1 ; au parcours 2 rejouable, une première réussite complète peut ajouter 14 de complément nouveau et 14 de rejeu ancien, sans doubler le complément nouveau. Une répétition du même jalon n’ajoute plus rien. Un jalon entièrement nouveau dans ce parcours n’est jamais doublé.

## Commandes de multiplication depuis le hub

Le panneau professeur du jeu, accessible depuis les résultats du hub, propose les tables de 2 à 9 pour toute la classe ou pour un élève. Un réglage individuel remplace celui de la classe ; sa suppression rétablit l’héritage. Comme dans Multiplication simple, ce sont des minimums obligatoires : l’élève ne peut pas les retirer, mais peut ajouter d’autres tables. Ils s’appliquent au prochain lancement.

Mélange utilise uniquement `connect_mixed_multiplier_locks`. Le test Auth/Edge/PostgreSQL/Chromium vérifie la véritable interface professeur, l’application dans le moteur et la conservation du réglage de `connect_multiplier_locks` appartenant à Multiplication simple.

Cette validation pédagogique ne vaut aucune autorisation de fusion, publication, livraison Edge, installation SQL hébergée ou activation.
