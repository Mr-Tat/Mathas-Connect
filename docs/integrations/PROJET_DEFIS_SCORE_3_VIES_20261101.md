# Projet — Objectif record : 3 vies + Mort subite

**Date : 1er novembre 2026.**

**Statut : [DÉCISION professeur]** sur le concept pédagogique et les choix de présentation ; **[PROPOSÉ]** pour le contrat détaillé des XP et scores ; **[PROTOTYPE isolé]** pour Addition simple. Ce document n'autorise aucun déploiement de barème en production, ni accès aux résultats réels.

## Interface commune souhaitée

Renommer la grande carte « Mort subite » en **🏆 Objectif record** (sans point d'exclamation) et afficher exactement le sous-titre pédagogique **« Deux façons de marquer un gros score. »**. La partager en deux grands boutons de largeur égale : **mauve prune à gauche** pour 3 vies (dégradé assombri `#754287` → `#502963`, bordure `#a77cbe`), et **rouge plus intense à droite** pour Mort subite. Le contraste doit montrer que le premier est moins dangereux, sans utiliser de turquoise :
- À **gauche**, **❤️ 3 vies** : trois erreurs permises, 50 % du droit XP comparable, pas de trophée.
- À **droite**, **💀 Mort subite** : une seule erreur, 100 % du droit XP comparable, trophées natifs habituels, et badge positif **+20 % de points**.
- **Ordre et discrétion des informations validés sur montage (01/11/2026)** : dans le bouton **3 vies**, afficher « Sans trophée » puis « 50 % des XP » ; dans **Mort subite**, afficher **« +20 % de points » puis « 100 % des XP »**. Entourer les deux lignes de chaque bouton d’un **petit cadre à fond translucide et bordure fine**, avec des textes plus discrets que les noms des modes. À l'intérieur du cadre Mort subite, faire ressortir « +20 % de points » dans **un badge doré compact**. Pas de badge autour des XP ni de cadre extérieur supplémentaire. **Dernier ajustement visuel** : les textes « Sans trophée », « 50 % des XP » et « 100 % des XP » doivent être **beaucoup plus discrets** (petits, police peu grasse, couleur atténuée) ; le badge « +20 % de points » reste bien contrasté et très visible.

**[AJUSTEMENT INTERFACE — 01/11/2026]** Rapprocher fortement les deux boutons du sous-titre (pas de grand vide entre eux). Éliminer les marges automatiques des réglages et réduire les espaces internes à quelques pixels. **Ne plus afficher** la phrase provisoire « XP et bonus présentés à titre indicatif dans cet essai. » ; cela ne change pas le statut du prototype : bonus et XP toujours **non crédités** dans l'essai.

Les séries normales **4 / 10 / 20 calculs restent totalement inchangées**, y compris les corrections et leurs XP/trophées. Les modes HARD et Mort subite HARD sont hors du premier périmètre. Conserver les choix de niveau et les réglages du jeu original.

## Règles de fonctionnement 3 vies

- La partie commence avec **❤️❤️❤️** et se poursuit sans nombre fixe de calculs jusqu'à épuisement des vies.
- Un **calcul complètement renseigné, validé faux** fait perdre exactement **un** cœur, quel que soit le nombre d'erreurs dans ses chiffres. Un calcul incomplet n'enlève aucune vie.
- Un calcul raté **ne se corrige pas**, ne rapporte pas de point, et est marqué comme terminé. On passe au calcul suivant. Impossible de perdre plusieurs vies sur le même calcul.
- Si deux calculs sont présents, chacun doit être évalué séparément. Deux calculs faux peuvent donc coûter deux vies.
- La troisième erreur termine la partie et affiche le score de bonnes réponses.
- Animation : le cœur concerné **grossit**, se **fissure puis se brise**, finit en **gris anthracite très foncé** avec cassure visible et reste ainsi. Prévoir une alternative sans mouvement.
- **Placement en jeu confirmé par le professeur** : les **trois cœurs côte à côte dans un cadre discret** au milieu de la **barre supérieure de session**, entre « ← Menu » et les pastilles Niveau/progression/score, sans déplacer ces commandes. Les autres éléments doivent reprendre **exactement** la disposition de Mort subite. Aucun cœur ne s’affiche dans Mort subite ou dans les séries 4/10/20. Sur écran étroit et téléphone, les cœurs peuvent passer sur une petite ligne dédiée pour éviter les chevauchements.

## Scores et projection

**[DÉCISION professeur] Un classement unique par application**, regroupant les résultats des séries 4/10/20, de 3 vies et de Mort subite. Les scores de jeux différents ne sont jamais cumulés.

- 3 vies : points normaux selon le contrat de l'application.
- Mort subite : **+20 % des points servant au classement**, non des XP. Afficher le badge positif « +20 % » sur Mort subite, pas de « −20 % » sur 3 vies.
- Séries 4/10/20 : restent admissibles au même classement, mais avec leurs règles historiques inchangées.
- **[À spécifier]** Vérifier les vrais points natifs du moteur, les possibilités de comparaison entre les modes, l'arrondi et le plafonnement éventuel. Les réussites brutes 20/20 et Mort subite ne sont pas automatiquement la même unité de points. Garder les records et preuves bruts intacts ; ne pas convertir arbitrairement les scores existants ni réécrire les résultats historiques.
- Aucun affichage en projection d'un score d'élève sans événement validé **et consentement explicite**, conformément au contrat Projection V2.

## Affichage des XP encore gagnables sur les deux boutons

**[DEMANDE PROFESSEUR — conception validable, pas encore implémentée]** Remplacer les libellés fixes « 50 % des XP » et « 100 % des XP » de **🏆 Objectif record** par des **montants XP personnalisés** lorsque l'application détecte un compte élève Connect approuvé, dans la classe et l'application concernées.

- **Compte Connect validé seulement :** afficher sous les deux modes une ligne discrète de type « Jusqu'à +N XP » (et « 0 XP à gagner » quand tous les droits correspondants sont réellement crédités). Ces montants sont les **XP additionnels encore accessibles** au niveau sélectionné, et non les XP déjà acquis ni des gains garantis. Conserver « Sans trophée » sous 3 vies et le badge « +20 % de points » sous Mort subite. En mode libre, invité, non approuvé, ou si le serveur est inaccessible, **masquer la ligne des XP** plutôt que montrer un chiffre approximatif ou un faux zéro.
- **À l'échelle du niveau sélectionné,** calculer les droits par jalon de 5 et 10 calculs réussis (10 XP de droit plein par jalon dans Addition simple à la date du 01/11/2026) : **3 vies : demi-droit de 5 XP par jalon** ; **Mort subite : droit plein de 10 XP par jalon**. Exemple sans acquis sur ce niveau : « Jusqu'à +10 XP » et « Jusqu'à +20 XP », respectivement. Ce sont des exemples, **pas des promesses de gain au lancement**.
- Pour chaque jalon, le **serveur fait foi** : `reste_3vies = max(0, demi_droit - droit_déjà_crédité_sur_ce_jalon)` et `reste_mort_subite = max(0, droit_plein - droit_déjà_crédité_sur_ce_jalon)`. Exemple : 5 XP crédités en 3 vies → le même jalon ne donne **plus** d'XP en 3 vies, mais laisse un complément de 5 XP en Mort subite. Une fois les 10 XP crédités, les deux montants restent à 0. Les droits d'un autre niveau ne doivent pas être additionnés.
- **Limite technique de l'API actuelle :** le lanceur Addition simple possède déjà un appel authentifié `connect-results` avec `action:'student-xp'` et la lecture `connect_xp_read_v2` ; la réponse contient les listes `milestones`/`currentMilestones` et `repeatXp`, **mais ne donne pas l'état des demi-droits 3 vies** car le barème et le crédit 3 vies ne sont pas encore implémentés. Les booléens de jalons pleins ne suffisent pas à déterminer des compléments 5/10 XP : créer un **résumé serveur autorisé en lecture seule** des droits restants par mode et niveau, issu d'un registre de crédits partiels idempotent, avant d'activer ces libellés dynamiques.
- Respecter les décisions de rejeu `repeatXp`, l'époque du parcours et la lecture d'identité réellement approuvée. Rafraîchir au chargement Connect, au changement de niveau et après accusé de réception du résultat serveur ; aucune lecture réseau par frappe ni calcul d'attribution dans le navigateur. Ne jamais confondre points du classement (+20 %) et XP.
- **Prototype isolé Addition simple :** interdiction de connecter de vrais élèves ou d'interroger leurs XP depuis la page d'essai ; conserver le prototype isolé tant que ce calcul serveur n'est pas prêt. Valider d'abord les scénarios (aucun jalon, demi-jalon gagné, jalon plein gagné, niveaux mélangés, répétition/époque, mode libre, serveur indisponible) avec des comptes fictifs.

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
- PR source : https://github.com/Mr-Tat/CE-Addition-simple/pull/6 ; reprise visuelle fidèle au montage professeur : https://github.com/Mr-Tat/CE-Addition-simple/pull/7 ; correction des réécritures natives et des deux colonnes CSS : https://github.com/Mr-Tat/CE-Addition-simple/pull/9 ; cadre des cœurs dans le bandeau : https://github.com/Mr-Tat/CE-Addition-simple/pull/10 ; cadres secondaires et badge +20 % : https://github.com/Mr-Tat/CE-Addition-simple/pull/11 ; mauves assombris sur la page d'essai : https://github.com/Mr-Tat/CE-Addition-simple/pull/12 ; mentions XP fortement atténuées : https://github.com/Mr-Tat/CE-Addition-simple/pull/13 ; titre « Objectif record » et carte compacte : https://github.com/Mr-Tat/CE-Addition-simple/pull/14
- Cette **page distincte** charge le vrai moteur HTML Addition simple dans un iframe. Les transformations du mode 3 vies s'appliquent dans l'iframe ; **le jeu habituel et sa copie native sont inchangés**.
- Le localStorage et le sessionStorage de l'iframe sont remplacés par une mémoire volatile, et ses requêtes fetch sont bloquées. Aucun XP, trophée, record, consentement ni résultat Connect ne doit être publié par cet essai.
- **Piège moteur détecté et corrigé dans l’essai** : un script natif restaure « Continue jusqu’à la première erreur. » et « Lancer la mort subite » après le chargement ; une règle CSS impose un bouton pleine largeur. Le prototype doit préserver la phrase du professeur et les quatre lignes XP/bonus, protéger la réécriture et maintenir les boutons explicitement en colonne 1 / colonne 2. Aucun correctif de ce type ne doit être appliqué aveuglément aux autres applications.
- Les mentions « 50 % XP » et « +20 % » sont **informatives uniquement** dans ce prototype : leurs calculs réels restent un chantier séparé. Les restrictions de déblocage de Mort subite sont levées seulement dans le prototype, pour permettre le test.
- Des contrôles de correspondance du code source et de syntaxe des scripts transformés ont été exécutés. Un test réutilisable est joint dans le dépôt Addition simple. **La recette en navigateur sur Pages n'est pas encore attestée.**

## Étapes avant la vraie intégration

1. Faire essayer la page isolée : petits/grands écrans, vraie addition posée, deux calculs, saisie incomplète, perte individuelle des cœurs et cœur final très foncé.
2. Arrêter le contrat détaillé des **points natifs**, de la conversion +20 %, des records et des seuils XP d'Addition simple.
3. Créer une vraie version du mode 3 vies avec preuve serveur, compléments XP sans doublon et **aucun trophée**. Tester avec des comptes fictifs uniquement.
4. Vérifier la compatibilité des scores avec la projection protégée et le consentement avant publication.
5. Transposer progressivement aux autres applications, après audit de leurs modes et barèmes.

**Ce document décrit le projet ; il n'annonce aucune activation des XP 3 vies ou du classement bonifié en production.**
