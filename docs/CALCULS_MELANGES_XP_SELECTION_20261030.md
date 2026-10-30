# Mélange — règle XP validée le 30 octobre 2026

La décision explicite de l’enseignant remplace la proposition initiale du kit qui exigeait deux types réellement rencontrés. Le moteur reste libre de tirer plusieurs fois la même opération.

- **Trois opérations cochées au début de la partie : 100 % des XP**, même si le tirage ne présente qu’un ou deux types.
- **Deux opérations cochées : 50 % des XP.**
- **Une opération cochée : 25 % des XP.**
- Réussir ensuite le même jalon avec deux puis trois opérations donne **uniquement les compléments manquants**, une fois par palier, jusqu’au montant complet. Le passage direct de une à trois est également possible. Une répétition ou un retour à une sélection réduite ne baisse et ne recrédite aucun acquis.
- Le réglage est capturé au démarrage. Un changement ultérieur ne requalifie pas la partie déjà terminée ; une nouvelle réussite admissible est nécessaire.
- Cocher des cases seul ne donne rien : le journal réel des calculs terminés, le score aux premières tentatives, le niveau, le mode, l’identité, la révision et l’époque restent vérifiés par le serveur.
- Master, entraînement et challenge HARD dormant : **0 XP**. Les aides gardent la convention existante : usage tracé sans nouvelle exclusion.

## Barème par niveau

| Jalon | 1 opération · 25 % | 2 opérations · 50 % | 3 opérations · 100 % |
| --- | ---: | ---: | ---: |
| Classique 4/4 | 7 | 14 | 28 |
| Classique 8/10 | 10 | 19 | 38 |
| Bonus 10/10 | +2, soit 12 au total | +4, soit 23 au total | +8, soit 46 au total |
| Classique 16/20 | 16 | 32 | 63 |
| Bonus 20/20 | +3, soit 19 au total | +6, soit 38 au total | +13, soit 76 au total |
| Mort subite normale 5 | 3 | 6 | 12 |
| Mort subite normale 10 | +3 | +6 | +12 |
| Mort subite HARD 3 | Non lançable | Non lançable | 12 |
| Mort subite HARD 7 | Non lançable | Non lançable | +12 |

Le serveur stocke des XP entiers : les montants cumulés de chaque longueur de série sont arrondis au plus proche. Ainsi 46/4 = 11,5 devient 12, et 76/4 = 19 reste 19. Les bonus sont la différence entre ce total arrondi et le palier de réussite : 10 puis +2 sur /10, 16 puis +3 sur /20 au taux 25 %. À 50 %, /20 reste 32 puis +6. On ne réarrondit jamais un complément isolé : on verse la différence entre les droits cumulés.

Exemple 4/4 : **7 XP, puis +7, puis +14**, soit 28 au total. Une nouvelle réussite répétée ou à un taux inférieur donne 0. Le plafond complet demeure **198 par niveau, 594 pour l’application**, hors rejeu expressément permis par le professeur. Aucun changement des autres jeux et aucun multiplicateur global.

Le HARD natif sélectionne toujours les trois opérations et reste à 100 %. Un parcours dont les modes normaux sont tous réussis à 25 %, plus ce HARD complet, atteint 204 XP ; les compléments à 50 % portent ce total à 333, puis ceux à 100 % à 594. Aucun mode HARD restreint n’est inventé.

## Conservation et compléments

Les meilleurs résultats 4/10/20 restent séparés par niveau et longueur. L’état conserve trois arbres de preuves : `eligible` pour trois opérations, `halfEligible` pour deux et `quarterEligible` pour une. Un meilleur résultat réduit ne remplace pas une preuve complète déjà acquise.

Chaque jalon possède une seule ligne dans `connect_xp_milestones`. Son champ serveur `xpPoints` ne peut qu’augmenter du quart à la moitié puis à la valeur complète ; une nouvelle réussite complète ne touche que cette différence. UUID/reçu durable, verrou de l’élève, CAS et transaction commune état/XP empêchent les doubles crédits, y compris quand deux paliers quelconques arrivent simultanément.

La politique XP porte la version 3, sans modifier le schéma de transport version 1 ou remplacer les RPC des autres applications. Aucun montant ou taux fourni par le navigateur n’est utilisé pour calculer les crédits.

## Reset et rejeu professeur

Sans droit de rejeu, les XP déjà obtenus restent acquis et ne sont pas recollectables. Les compléments **jamais obtenus** restent accessibles après reset : 7 XP au premier parcours, puis une réussite à deux opérations ajoute seulement 7 ; une réussite à trois ajoute ensuite 14.

Avec rejeu explicite, `firstParcours`, `halfParcours` et `fullParcours` datent l’acquisition des trois tranches. Seules les tranches acquises dans un parcours antérieur peuvent être répétées. Exemple : 7 XP au parcours 1 ; au parcours 2 rejouable, une réussite à deux opérations ajoute 7 de complément nouveau et 7 de rejeu ancien. La première réussite à trois ajoute ensuite seulement les 14 nouveaux. Le bonus de rejeu de ce parcours reste 7 : aucun nouveau complément n’est doublé. Au parcours suivant rejouable, les trois tranches peuvent être regagnées progressivement, chacune une fois.

## Commandes de multiplication depuis le hub

Le panneau professeur du jeu, accessible depuis les résultats du hub, propose les tables de 2 à 9 pour toute la classe ou pour un élève. Un réglage individuel remplace celui de la classe ; sa suppression rétablit l’héritage. Comme dans Multiplication simple, ce sont des minimums obligatoires : l’élève ne peut pas les retirer, mais peut ajouter d’autres tables. Ils s’appliquent au prochain lancement.

Mélange utilise uniquement `connect_mixed_multiplier_locks`. Le test Auth/Edge/PostgreSQL/Chromium vérifie la véritable interface professeur, l’application dans le moteur et la conservation du réglage de `connect_multiplier_locks` appartenant à Multiplication simple.

Cette validation pédagogique ne vaut aucune autorisation de fusion, publication, livraison Edge, installation SQL hébergée ou activation.
