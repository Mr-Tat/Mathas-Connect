# Prompt de reprise — intégrer 🏆 Objectif record dans cinq applications Math’as

> Texte à copier dans une **nouvelle conversation avec accès GitHub et outils de développement**. Ce document est un mandat d'implémentation, **pas** une annonce que les cinq jeux sont déjà modifiés.

Tu travailles sur **Math’as Connect** (GitHub : `Mr-Tat/Mathas-Connect`) et cinq applications de calculs écrits. **Réalise le travail technique de bout en bout sur des branches/PR séparées**, avec audits, prototypes fidèles, tests et preuves. Ne te limite pas à des conseils, ne demande pas de répétition des choix déjà inscrits. **Ne publie ni n'active de crédits XP réels, de classement réel ou de nouvelle mécanique dans les jeux vivants sans mon accord explicite**. Les démos doivent être strictement isolées.

## Lecture initiale obligatoire

1. Lis intégralement le guide permanent : `docs/integrations/README.md`, la référence technique et le contrat XP/trophées.
2. Lis le **patron multi-applications** : `docs/integrations/PATRON_REUTILISABLE_OBJECTIF_RECORD_3_VIES_XP_20261101.md`.
3. Lis le prototype et ses décisions : `docs/integrations/PROJET_DEFIS_SCORE_3_VIES_20261101.md`.
4. Étudie **sur GitHub les fichiers exacts, le code courant et les tests**, pas une ancienne copie. Inspecte la démo `Mr-Tat/CE-Addition-simple/essai-mode-score-3-vies.html`, les PR #6–#18 et les tests `tests/demo-3-vies.test.mjs`.
5. Relève `main`, versions, architecture, modes, barèmes, contrats et scripts générés. Vérifie les états Connect existants ; **n'exécute aucune écriture Supabase pendant le simple audit**.

## Applications concernées, exactement cinq

| Application | Dépôt Github | Clé Connect |
| --- | --- | --- |
| Addition simple | `Mr-Tat/CE-Addition-simple` | `addition-ecrite-simple` |
| Addition de plusieurs nombres | `Mr-Tat/addition-ecrite-multiple` | `addition-ecrite-multiple` |
| Soustraction écrite | `Mr-Tat/soustraction-ecrite` | `soustraction-ecrite-simple` |
| Multiplication simple | `Mr-Tat/Multiplication-simple` | `multiplication-ecrite-simple` |
| Mélange de calculs écrits | `Mr-Tat/Melange-calculs-ecrits-1` | `melange-calculs-ecrits` |

**Ne pas confondre** avec `Mr-Tat/Multiplication-multi` ou `Mr-Tat/Addition-ecrite-simple` : les cinq dépôts ci-dessus ont été vérifiés pour cette mission. Si le catalogue vivant révèle un décalage, analyse-le et documente-le avant de modifier quoi que ce soit.

## Expérience à reproduire et adapter

- Remplacer **Mort subite** dans le menu par la carte **« 🏆 Objectif record »**, **sans !** ; sous-titre exact **« Deux façons de marquer un gros score. »**, peu d'espace entre sous-titre et boutons.
- Deux grandes options équilibrées : **❤️❤️❤️ 3 vies** à gauche, dégradé **mauve prune foncé** `#754287 → #502963` ; **💀 Mort subite** à droite, dégradé **rouge** `#a32b47 → #7e253b`. **3 vies : Sans trophée** ; **Mort subite : badge doré « +20 % de points »**. Cadres intérieurs translucides discrets. Pas de phrase « XP et bonus présentés à titre indicatif dans cet essai. ».
- **3 vies** : trois cœurs côte à côte dans un **cadre dans le bandeau de session**, entre menu et niveau/progression/score sur PC, repli mobile autorisé. Une réponse complètement renseignée et validée fausse **fait perdre exactement un cœur par calcul** ; pas de perte sur réponse incomplète ; un calcul raté ne se corrige pas et ne donne pas de point ; deux calculs ratés dans une paire coûtent deux vies ; troisième erreur = fin. Animation du cœur qui grossit, se fissure, se brise et reste anthracite foncé ; respect du reduced motion.
- **Mort subite : une erreur termine la partie**. Bonus **+20 % sur les points de classement, pas sur les XP**. **Un seul classement par application** pour les séries habituelles, 3 vies et Mort subite, seulement après audit des unités de points, équité, arrondis et preuves. Jamais de classement transversal entre jeux.
- **3 vies : droit XP égal à 50 % du droit d'un jalon Mort subite correspondant**, sans aucun trophée. Si 3 vies a crédité 5 XP sur un jalon de valeur 10, Mort subite ne peut créditer ensuite que le complément 5 ; et si Mort subite a déjà crédité 10, 3 vies n'accorde plus rien. Fixer les jalons réels **par application** avant codage serveur. Conserver les trophées natifs Mort subite et toutes les récompenses historiques. Aucune attribution par simple clic/rechargement.
- Sur **tous les boutons des séries disponibles** (notamment 4/10/20) **et sur les deux boutons Objectif record**, afficher **« Reste N XP »**, même **« Reste 0 XP »**, **uniquement si l'élève est véritablement connecté et approuvé ET que le serveur a confirmé ses droits restants**. Sinon **aucune ligne XP**. Le montant est le maximum encore accessible pour la **configuration choisie**, pas une promesse de gain prochain.
- **Placement** : pour les boutons 4/10/20, petit texte estompé **dans le coin inférieur droit du bouton**. Pour 3 vies/Mort subite, **dans le coin inférieur droit du petit cadre intérieur**, sans recouvrir le badge +20 %. Le texte « Sans trophée » et les montants XP sont très discrets ; le badge +20 % doit rester visible.
- Mettre à jour les montants après lecture Connect, changement de niveau/configuration et après le reçu serveur d'une récompense. Conserver le panneau **« XP à gagner »**, l'animation des XP gagnés et les compteurs actuels. **Serveur autoritaire** ; ne pas calculer ou soustraire des crédits à partir de localStorage, des scores seuls ou de chiffres de simulation.

## Particularité INDISPENSABLE : Mélange de calculs écrits

Dans `Mr-Tat/Melange-calculs-ecrits-1`, l'élève sélectionne les types **Addition (+), Soustraction (−), Multiplication (×)** : **un, deux ou trois types** peuvent être cochés ; il choisit aussi **4/10/20 calculs** et un **niveau**.

**Le « Reste N XP » doit correspondre à cette sélection exacte** : `[add]`, `[sub]`, `[mul]`, `[add,sub]`, `[add,mul]`, `[sub,mul]`, `[add,sub,mul]`, et au nombre 4/10/20, au niveau, aux jalons restants, aux aides/méthodes pertinentes et au parcours. Deux sélections de deux types ne sont pas nécessairement équivalentes : **ne pas faire une règle arbitraire XP × 1/2/3**, ni créditer les opérations non cochées.

Le moteur utilise `opsSelector`, `data-op`, `countBtn`, `suddenBtn`, `levelSelect`, et ses preuves Connect contiennent `operationsSelectedAtStart`, `operationsCompleted`, `firstTry`. L'API existante utilise `connect_mixed_xp_read_v1` et `connect_mixed_record_v1`. **Audite la formule réelle des XP Mélange et ses 9 jalons par niveau avant de projeter les XP**, en tenant compte des combinaisons et du total. Figé au **début de la partie** pour les preuves, choix courant pour l'affichage du menu. Changement de cases cochées → actualisation immédiate sur données autorisées. Si la lecture serveur ne sait pas certifier le reste pour cette combinaison, **ne rien afficher**.

## Contraintes d'architecture par jeu

- Addition simple : moteur `game-original.html` et lanceur Connect `index.html` ; le prototype existe **seulement dans la page d'essai**.
- Addition multiple et Multiplication simple : `index.html` indique une **architecture clean-v1 générée** ; modifier les **sources** appropriées et reconstruire, **pas bricoler le HTML généré**.
- Soustraction : conserver les deux méthodes d'emprunt, états de chiffres, validations séparées et leurs trophées.
- Multiplication simple : `startSudden` / `sudden-choice`, **pas** de `suddenMaxDigits` : adapter et non transposer les remplacements de chaînes d'Addition simple.
- Mélange : moteur et UI différents (`suddenBtn`, `countBtn`, `opsSelector`) ; faire un adaptateur propre. Protéger les contraintes de multiplicateurs et les aides.
- HARD / Master / modes classiques / entraînements : ne pas changer leurs comportements, records, déblocages, corrections et XP existants sans accord explicite.

## Étapes d'exécution attendues

1. **Audit comparatif** et matrice de capacités (les cinq moteurs, adaptateurs, contrats, tables/récompenses, options, différence d'unité de points, version réelle). Identifier clairement les choix pédagogiques encore non tranchés, sans bloquer les travaux autonomes.
2. **Contrat commun versionné** du mode 3 vies, de l'événement de fin, de la preuve par calcul, des jalons partiels XP et du résumé serveur **lecture seule** des XP restants. Par application, adapter règles/projections ; prouver l'idempotence, le non-double crédit et les droits professeur/élève.
3. **Prototype isolé par application** sur la dernière version des moteurs. Rendre réellement testables 3 vies, Mort subite, la nouvelle carte et **« Reste N XP » fictif** (Connect simulé / tout acquis / sans connexion), avec montants **explicitement fictifs** dans les démos. Aucun réseau de compte réel depuis ces démos.
4. **Implémentation authentifiée dans des branches et PRs distinctes** : client ne fait qu'afficher le résumé serveur et envoyer des preuves ; backend prépare contrats XP 3 vies/compléments et +20 % points classements, **sans exécuter de migration ou déployer d'Edge dans l'environnement vivant sans accord**. Ne pas fusionner les changements qui déclenchent une publication publique non autorisée.
5. **Tests exhaustifs** : 0/1/2/3 erreurs, calculs incomplets, double clics, calculs doubles, aides, erreurs de retenue/emprunt, méthodes de multiplication, Mélange 1/2/3 types et **toutes les 7 combinaisons**, 4/10/20, niveau 1/2/3, demi-droits 5+5, déjà acquis, zéro XP, reset/repeat, mode libre, identité refusée, réseau indisponible, backend idempotent/transactions, clavier, téléphone 320 px, portrait/tablette/PC. Vérifier toutes les séries et trophées existants.
6. **Recette avant ouverture** : CI + scripts du moteur compilables, tests PostgreSQL jetables, Auth/Edge local, Chromium réel au clavier, navigateur hébergé sous **comptes fictifs**. Distinguer ce qui est confirmé de ce qui manque. Les URL Pages, SHA, Edge et migration sont des preuves distinctes.
7. **Compte rendu concret** : une PR par application, une PR serveur/guide s'il faut, fichiers et SHAs exacts, captures et liens de démo si disponibles, tableau passé/échoué/non testé, sécurité et rollback par application, ce qui reste à autoriser avant production. Ne pas annoncer « terminé dans les cinq jeux » si seul le prototype est fait.

**Important :** tu as mon accord pour auditer, proposer des contrats, coder sur des branches et ouvrir des PRs de prototype ; tu **n'as pas mon accord pour créditer des XP réels, changer les classements élèves, modifier les comptes, pousser du SQL/Edge de production ou activer silencieusement ces modes dans les jeux publics**. Si une opération de ce type devient indispensable, prépare tout et demande **un feu vert explicite avant cette opération**, mais avance sur le reste.
