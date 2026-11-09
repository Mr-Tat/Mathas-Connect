# Math'as Connect — synthèse IA à lire EN PREMIER (09/11/2026)

> **Règles essentielles de toutes les intégrations, sans code ni longues archives.** Lire ensuite **l'en-tête A + la dernière passation pertinente** du [suivi courant](SUIVI_COURANT.md). Les références détaillées ci-dessous se chargent **uniquement par section utile**. Un compte rendu ancien n'est pas une preuve de l'état LIVE.

## 1. Méthode de travail

- Dépôt `Mr-Tat/Mathas-Connect` ; vérifier `main`, **PR déjà ouvertes**, droits, Pages, Edge/SQL et classes avant toute affirmation ou écriture. **Fusion GitHub ≠ déploiement Pages ≠ déploiement Edge ≠ recette élève.**
- Préserver **le moteur original** (pédagogie, niveaux, méthodes, contrôles, version/empreinte) ; Connect est une couche d'intégration minimale. **Un seul candidat final**, éventuellement testé avec profils fictifs approuvés en HUB TEST, jamais une série de prototypes.
- Déclarer par jeu : XP, trophées, score, Objectif record, projection et réglages prof = **oui / SANS OBJET**. Ne rien inventer pour obtenir une interface uniforme ; barèmes et coupes propres au jeu.
- **Aucun test sur élèves réels**, aucun secret dans Git, aucune remise à zéro massive, ouverture de classe ni modification SQL/Edge implicite. Les décisions pédagogiques récentes et l'état serveur vérifié priment sur les archives.

## 2. Socle fonctionnel commun

| Élément | Attendu si applicable |
| --- | --- |
| HUB / identité | Carte + miniature, `app_key` stable, visibilité réglée par classe ET autorisation serveur. Session approuvée, **pastille + avatar + nom**, retour HUB ; Monsieur T distinct de l'élève ; mode libre isolé de Connect. |
| Bandeau | Nom/version, **niveau global Connect et barre XP**, bouton **« XP à récupérer »**, plein écran et retour. Distinguer difficulté du jeu et niveau global ; rester compact. |
| Exercices | Méthode, niveau et sélection réellement autorisés ; blocage/déblocage correct ; **« Reste N XP »** discret sur les boutons, **uniquement depuis le droit serveur confirmé** (inconnu ≠ zéro). |
| Trophées | Coupes réellement atteignables par exercice/section ; non acquises nettement assombries ; acquises près des exercices et du score. **Permanents malgré reset des scores** ; compteur = coupes visuelles uniques, pas flags XP. |
| Score | **Optionnel** : score du jour, record historique personnel, historique/podium, sans cacher le panneau natif ; points distincts des XP. Pas de classement si aucun score pertinent. |
| Fin de partie | **Preuve + enregistrement + ACK** fiables AVANT animations et menus ; événement idempotent, reprise/abandon sans bloquer les autres modes. |
| Professeur / projection | Résultats classe/élève/app/mode, autorisations et reset **de cette app seulement**. Projection isolée classe+app : Score du jour/Meilleur score si prévu ; **score certifié et amélioré + consentement explicite** ; reset projeté indépendant des acquis personnels. |
| Qualité | Saisie au clavier scolaire, 320 px, bonne lisibilité, absence de chevauchements, vraie recette authentifiée avec fictifs avant ouverture des classes autorisées. |

## 3. Objectif record — règles déjà décidées

- **3 vies** : partie arrêtée à la **3e réponse complète fausse** ; **une seule vie perdue par calcul faux**, jamais pour une réponse incomplète.
- **Mort subite** : partie arrêtée à la **1re réponse complète fausse**.
- **POINTS**, quatre calculs écrits : à même difficulté/niveau et nombre de réussites, **Mort subite = ×2 les points des 3 vies avant arrondi**. **Pas +20 %.** Les séries classiques de 4/10/20 ont des coefficients propres.
- **XP distincts des points** : 3 vies donne **la moitié du droit d'un palier**, Mort subite le droit entier et **seulement le complément** si la moitié est déjà acquise. Quatre écrits : seuils normaux **5/10**, HARD **3/7**, droit plein **20 XP** par seuil et demi-droit **10 XP** ; max combiné **40 XP par groupe normal/niveau**. Après crédit, rejouer n'ajoute pas les mêmes XP.
- Les quatre écrits demandent actuellement **≥80 % en série 10 ou 20 du même niveau** avant Objectif record normal. **Mélange utilise une autre formule de points et d'XP** : reprendre l'architecture, pas les chiffres.
- **[DÉCISION PROF, 09/11]** Un **trophée lié au SCORE** peut être gagné en **3 vies** si son seuil de points certifiés est atteint (ex. 200/400/600 sur les quatre écrits). Une coupe **spécifique à Mort subite** nécessite réellement Mort subite. « Sans trophée en 3 vies » signifie seulement **aucune coupe spécifique à ce mode**.

## 4. Reprise d'une discussion et publication

1. Lire ce fichier et le [suivi courant](SUIVI_COURANT.md) **section A + dernière entrée utile**, puis vérifier les faits LIVE. Ne pas parcourir les anciennes PR sans motif.
2. Par intégration, garder **une PR technique ciblée**. Mettre décisions, SHA, tests, risques et prochaine action dans le suivi, avec preuves `[LIVE]` / `[REPO]` / `[TEST LOCAL]` / `[RECETTE HÉBERGÉE]` / `[NON VÉRIFIÉ]`.
3. En changeant de conversation : mettre à jour la **synthèse de tête du suivi** et une passation détaillée reliée à sa PR/fiche ; ne pas laisser une **PR de suivi global** ouverte indéfiniment.
4. Pour déclarer « terminé » : CI sur le bon SHA, recette authentifiée fictive si nécessaire, **Pages + Edge + SQL + catalogues/classes** vérifiés indépendamment. Sinon préciser **NON VÉRIFIÉ** ou **SANS OBJET**.

## 5. Où chercher le détail — ouvrir la rubrique utile, pas tout

- [Contrat complet #272, conservé sur GitHub](CONTRAT_FONCTIONNEL_COMMUN_APPLICATIONS_20261109.md) : formules SQL/JS, XP, 3 vies/Mort subite, trophées, interface, preuves et tests.
- [Guide permanent](README.md), [doctrine et incidents du 04/11](DOCTRINE_EFFICACITE_ET_RETEX_20261104.md), [contrat XP/scores/trophées](CONTRAT_COMMUN_SCORES_XP_TROPHEES.md), [référence technique](REFERENCE_TECHNIQUE.md).
- [Fiche de chaque app](TEMPLATE_FICHE_APPLICATION.md), [passation](TEMPLATE_PASSAGE_FLAMBEAU.md), [recette](RECETTE_ET_PUBLICATION.md).
- [Ancien suivi des décisions ouvertes au 07/11](SUIVI_DECISIONS_OUVERTES_20261107.md) : **conservé et à revérifier** lors d'une reprise.

**Règle finale :** si une donnée précise manque, ouvrir **la section appropriée** du contrat, puis vérifier le moteur/serveur effectivement utilisés. Ne jamais remplacer une absence de preuve par une supposition.
