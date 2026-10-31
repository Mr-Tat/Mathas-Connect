# Projet — Défis de score : 3 vies + Mort subite

**Date : 1er novembre 2026.**

**Statut : [DÉCISION professeur]** sur le concept pédagogique et les choix de présentation ; **[PROPOSÉ]** pour le contrat détaillé des XP et scores ; **[PROTOTYPE isolé]** pour Addition simple. Ce document n'autorise aucun déploiement de barème en production, ni accès aux résultats réels.

## Interface commune souhaitée

Renommer la grande carte « Mort subite » en **🏆 Défis de score** et afficher exactement le sous-titre pédagogique **« Deux façons de marquer un gros score. »**. La partager en deux grands boutons de largeur égale, turquoise à gauche et rouge à droite :
- À **gauche**, **❤️ 3 vies** : trois erreurs permises, 50 % du droit XP comparable, pas de trophée.
- À **droite**, **💀 Mort subite** : une seule erreur, 100 % du droit XP comparable, trophées natifs habituels, et badge positif **+20 % de points**.

Les séries normales **4 / 10 / 20 calculs restent totalement inchangées**, y compris les corrections et leurs XP/trophées. Les modes HARD et Mort subite HARD sont hors du premier périmètre. Conserver les choix de niveau et les réglages du jeu original.

## Règles de fonctionnement 3 vies

- La partie commence avec **❤️❤️❤️** et se poursuit sans nombre fixe de calculs jusqu'à épuisement des vies.
- Un **calcul complètement renseigné, validé faux** fait perdre exactement **un** cœur, quel que soit le nombre d'erreurs dans ses chiffres. Un calcul incomplet n'enlève aucune vie.
- Un calcul raté **ne se corrige pas**, ne rapporte pas de point, et est marqué comme terminé. On passe au calcul suivant. Impossible de perdre plusieurs vies sur le même calcul.
- Si deux calculs sont présents, chacun doit être évalué séparément. Deux calculs faux peuvent donc coûter deux vies.
- La troisième erreur termine la partie et affiche le score de bonnes réponses.
- Animation : le cœur concerné **grossit**, se **fissure puis se brise**, finit en **gris anthracite très foncé** avec cassure visible et reste ainsi. Prévoir une alternative sans mouvement.

## Scores et projection

**[DÉCISION professeur] Un classement unique par application**, regroupant les résultats des séries 4/10/20, de 3 vies et de Mort subite. Les scores de jeux différents ne sont jamais cumulés.

- 3 vies : points normaux selon le contrat de l'application.
- Mort subite : **+20 % des points servant au classement**, non des XP. Afficher le badge positif « +20 % » sur Mort subite, pas de « −20 % » sur 3 vies.
- Séries 4/10/20 : restent admissibles au même classement, mais avec leurs règles historiques inchangées.
- **[À spécifier]** Vérifier les vrais points natifs du moteur, les possibilités de comparaison entre les modes, l'arrondi et le plafonnement éventuel. Les réussites brutes 20/20 et Mort subite ne sont pas automatiquement la même unité de points. Garder les records et preuves bruts intacts ; ne pas convertir arbitrairement les scores existants ni réécrire les résultats historiques.
- Aucun affichage en projection d'un score d'élève sans événement validé **et consentement explicite**, conformément au contrat Projection V2.

## XP Connect et trophées

**[DÉCISION professeur]** Le mode 3 vies rapporte **la moitié du droit XP** des jalons de Mort subite équivalents, mais **aucun trophée**.

- Pour un jalon de valeur pleine 10 XP, par exemple : 3 vies peut donner **5 XP**, puis une Mort subite validée sur ce même jalon donne le **complément 5 XP**. Une fois le droit complet obtenu, aucun nouveau crédit en rejouant le même jalon.
- Crédit serveur sur événement prouvé, idempotence, plafond et contrat XP de **chaque application**, aucune distribution permanente par partie. Le +20 % sur le classement n'augmente pas les XP.
- Les trophées Mort subite existants ne se gagnent que selon leurs conditions natives, **jamais** via 3 vies. Les trophées déjà acquis restent permanents.
- Les séries 4/10/20 et le HARD n'entrent pas dans la réduction de 50 %.
- **[À spécifier]** Choisir jalons d'appariement, arrondis, éventuelles aides et limites anti-abus par jeu. Ne modifier aucun barème, RPC ou Edge sans accord, tests PostgreSQL jetables et recette fictive.

## Première expérience sur le vrai moteur Addition simple

**[PROTOTYPE isolé — 01/11/2026]**

- Essai : https://mr-tat.github.io/CE-Addition-simple/essai-mode-score-3-vies.html
- PR source : https://github.com/Mr-Tat/CE-Addition-simple/pull/6 ; reprise visuelle fidèle au montage professeur : https://github.com/Mr-Tat/CE-Addition-simple/pull/7
- Cette **page distincte** charge le vrai moteur HTML Addition simple dans un iframe. Les transformations du mode 3 vies s'appliquent dans l'iframe ; **le jeu habituel et sa copie native sont inchangés**.
- Le localStorage et le sessionStorage de l'iframe sont remplacés par une mémoire volatile, et ses requêtes fetch sont bloquées. Aucun XP, trophée, record, consentement ni résultat Connect ne doit être publié par cet essai.
- Les mentions « 50 % XP » et « +20 % » sont **informatives uniquement** dans ce prototype : leurs calculs réels restent un chantier séparé. Les restrictions de déblocage de Mort subite sont levées seulement dans le prototype, pour permettre le test.
- Des contrôles de correspondance du code source et de syntaxe des scripts transformés ont été exécutés. Un test réutilisable est joint dans le dépôt Addition simple. **La recette en navigateur sur Pages n'est pas encore attestée.**

## Étapes avant la vraie intégration

1. Faire essayer la page isolée : petits/grands écrans, vraie addition posée, deux calculs, saisie incomplète, perte individuelle des cœurs et cœur final très foncé.
2. Arrêter le contrat détaillé des **points natifs**, de la conversion +20 %, des records et des seuils XP d'Addition simple.
3. Créer une vraie version du mode 3 vies avec preuve serveur, compléments XP sans doublon et **aucun trophée**. Tester avec des comptes fictifs uniquement.
4. Vérifier la compatibilité des scores avec la projection protégée et le consentement avant publication.
5. Transposer progressivement aux autres applications, après audit de leurs modes et barèmes.

**Ce document décrit le projet ; il n'annonce aucune activation des XP 3 vies ou du classement bonifié en production.**
