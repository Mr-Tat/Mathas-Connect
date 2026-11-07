# Math’as Connect — décisions ouvertes et vérifications restant à faire
*Mise à jour : 7 novembre 2026. Document vivant du dossier `docs/integrations`.*

Cette liste sépare **travail encore à réaliser** et **code déjà en place mais à vérifier en vraie session**. Les archives historiques et les PR fusionnées ne sont pas, à elles seules, la preuve qu'une classe a testé le rendu. Avant toute modification, relire le `main` actuel, les déploiements Pages/Edge et les décisions plus récentes du professeur.

## En attente / à contrôler

| Priorité | Décision du professeur | Situation constatée au 07/11 | Pour clôturer sans ambiguïté |
| --- | --- | --- | --- |
| P1 | **Avatar choisi entre le point vert et le nom dans chaque application Connect** (Monsieur T comme élèves). | **Implémentation dans la PR dédiée à ce document** : deux additions, soustraction, multiplication, Mélange TEST et Abaque de Toutes ; le HUB et la projection possèdent déjà leur affichage d'avatars. | Fusion, CI complète, déploiement Pages au SHA exact, puis ouvrir avec un compte fictif approuvé (avatar animal, smiley, initiale et fond coloré) et le compte professeur. Contrôler le petit écran, le mode libre sans avatar Connect et la mise à jour après rechargement. |
| P1 | **Mélange : garder le candidat définitif dans « Toutes → Tests »** avant de le rendre accessible aux classes scolaires. | Parcours TEST existant ; aucune décision d'ouverture générale n'est déduite de cette PR. | Faire une vraie recette hébergée avec profil fictif : jeux natifs, 4/10/20, Mort subite, 3 vies, HARD accessible, sauvegarde/XP/trophées, meilleure partie et consentement projection. **Puis demander le feu vert pédagogique** avant changement de visibilité. |
| P1 | **Abaque des longueurs : une seule version Connect officielle, uniquement « Toutes → Tests », pas les quatre HUB scolaires.** | Règles documentées dans `ABAQUE_TOUTES_ONLY_20261107.md`. | Réaliser la recette hébergée **professeur → approbation explicite d’un élève fictif → jeu → reçu serveur → XP/trophée → retour HUB**, confirmer la miniature validée et les accès. Ne pas étendre la visibilité sans décision explicite. |
| P1 | **Fin de jeu prioritaire : aucun score/XP perdu après 10/10 ou une animation**, y compris Mort subite et 3 vies. | Corrections des preuves certifiées déjà fusionnées (PR #241–#243). Tests navigateur automatisés, mais test réel en classe non documenté ici. | Vérifier avec **profils fictifs** une partie terminée dans chacun des quatre calculs écrits, une reconnexion, un nouvel essai et la persistance exacte du reçu. Vérifier que l’enregistrement précède l’animation et qu’aucune ancienne partie interrompue ne bloque une nouvelle partie. |
| P2 | **Top du jour, Mort subite et projection cohérents par application** (scores officiels uniquement). | Contrats et régressions GitHub existent ; le retour de classe sur les scores de Mort subite et sur « Top du jour » demande une recette complète. | Scénarios fictifs : meilleur du jour, égal/moins bon, aucune publication sans consentement, deux jeux distincts, nouveau jour Bruxelles et ouverture de la case « Top du jour ». Consigner les écarts exacts avant correctif. |
| P2 | **Rapidité ressentie au lancement** des séries Connect. | Réduction d'une vérification Auth redondante et retour visuel de préparation dans la PR #244. | Mesurer sur PC/connexion de la classe le délai du clic au premier calcul (première partie, partie répétée et réseau dégradé) ; n’améliorer ensuite que les étapes mesurées, sans contourner l'authentification ni la preuve serveur. |

## Décisions réalisées — ne pas recréer un chantier

- **Quatre jeux confirmés** : addition simple et multiple, soustraction, multiplication. Bandeau Calculs sur une ligne, options compactes et grands cœurs entre Menu et Niveau, avec adaptations à la réglette/tables : PR #245–#247 et leurs tests.
- **Bascule des sessions du HUB « Toutes »** : le bouton « Se connecter avec Monsieur T » et le choix du profil TEST, ainsi que l'accès aux connexions de test, existent dans `hub-toutes-auth.mjs`. Ne pas le lister comme fonctionnalité à programmer ; seulement vérifier son utilisation dans un futur parcours fictif.
- **Ne pas inventer de nouveaux XP, scores ou trophées** pour faire apparaître un avatar ou un bandeau. L'API Connect, le profil approuvé et le reçu d'épreuve restent les autorités.

## Méthode de mise à jour

Lorsqu'une décision est close, inscrire **le SHA de fusion, le run Pages réussi, les tests pertinents et — si nécessaire — la recette authentifiée**. Si une recette réelle manque, passer le point en « à contrôler en conditions réelles », pas en « terminé ». Ne pas tester sur un élève réel ni ouvrir Mélange/Abaque dans les classes scolaires par simple modification cosmétique.

Références : [guide d'intégration](README.md), [doctrine](DOCTRINE_EFFICACITE_ET_RETEX_20261104.md), [Abaque dans Toutes](ABAQUE_TOUTES_ONLY_20261107.md), [RECETTE ET PUBLICATION](RECETTE_ET_PUBLICATION.md).
