# Instructions GitHub Copilot — Math’as Connect

> À appliquer à **toute modification ou intégration d'application** dans ce dépôt. Ces instructions complètent `AGENTS.md` et ne remplacent pas les permissions de l'utilisateur.

## Documents à consulter AVANT de coder — chargement progressif

1. **TOUJOURS** : [synthèse express nouvelle génération](../docs/integrations/00_DEMARRER_ICI.md), puis uniquement **l'en-tête de reprise et la dernière passation utile** du [suivi courant](../docs/integrations/SUIVI_COURANT.md), plus ce fichier et [AGENTS.md](../AGENTS.md). Vérifier HEAD, PR et déploiement avant d'affirmer un statut.
2. **SELON LA FONCTION TRAVAILLÉE** : rubriques utiles du [contrat complet PR #272](../docs/integrations/CONTRAT_FONCTIONNEL_COMMUN_APPLICATIONS_20261109.md), [guide](../docs/integrations/README.md), [contrat XP/scores/trophées](../docs/integrations/CONTRAT_COMMUN_SCORES_XP_TROPHEES.md), [recette](../docs/integrations/RECETTE_ET_PUBLICATION.md) et fiche de l'application. **Ne pas lire intégralement tous ces documents par défaut.**
3. **SI INCIDENT OU ARBITRAGE** : [doctrine/RETEX historiques](../docs/integrations/DOCTRINE_EFFICACITE_ET_RETEX_20261104.md) ou [ancienne fiche express](../docs/integrations/DOCTRINE_EFFICACITE_INTEGRATION_20261104.md), seules sections pertinentes. Les originaux sont conservés. Le suivi inter-conversations se met à jour **dans la PR de l'intégration**, pas dans une PR globale ouverte en permanence.

Ne pas utiliser un ancien compte rendu comme état actuel. Relire HEAD de `main`, PR concurrentes, catalogue, GitHub Pages, SQL et versions Edge effectivement déployées. Ne pas prétendre qu'une vérification simulée vaut une partie hébergée authentifiée.

## Règles prioritaires de Math’as Connect

- **Un seul candidat final pour les élèves**, pas une série de prototypes ou de versions LAB qui seront jetées. Le laboratoire sert seulement de courte recette sécurisée avec des profils fictifs, si nécessaire.
- **Préserver la pédagogie native**, les modes et le dépôt source du moteur. Fixer `app_key`, commit et empreinte, garder la copie/ZIP ; ajouter un adaptateur Connect minimal plutôt que réécrire le jeu.
- **Capacités facultatives et déclarées** : XP, trophées, score et projection peuvent être absents. Marquer `SANS OBJET` sans inventer de valeurs.
- **XP** : crédits, jalons et droits confirmés **sur serveur** ; mettre `Reste N XP` discrètement en bas à droite de chaque bouton de mode/série concerné, suivant le niveau et les options. Afficher 0 seulement s'il est confirmé, jamais de double badge ou de simulation Connect.
- **Trophées** : coupes réelles encore à obtenir et acquises visibles **dans les cases d'exercice/mode** concernées. Permanentes après reset ; compteur HUB = nombre de **trophées visuels réels**, pas d'indicateurs internes (20 pour les deux additions actuelles).
- **Score, si pertinent** : conserver les meilleurs scores du jour et records natifs, ainsi que leur historique ; jamais les masquer pour créer un panneau supplémentaire. Projection uniquement avec score certifié, amélioration admissible et consentement explicite `Oui`. Aucun score projeté fictif pour une application sans score.
- **Projection** : classement et exploits isolés par application et classe, sans scores privés, rafraîchissement actuel 20 secondes et rotation 30 secondes. Ne pas jouer les animations d'un jeu pendant qu'une autre application est affichée.
- **Livrable complet** : vraie carte HUB, classes réglables, auth Connect, sauvegarde/ACK, XP/trophées, professeur/Monsieur T, projection adaptée, miniature officielle, favicon, mobile et clavier scolaire, rollback non destructif.
- **Définition de terminé** : CI sur SHA exact + recette fictive authentifiée si nécessaire + PR fusionnée + GitHub Pages déployé et vérifié + SQL/Edge comparés et publiés séparément si modifiés + catalogues élèves effectivement contrôlés. Une PR verte en brouillon n'est **pas** une application livrée.

## Rapidité sans régression

Réutiliser les bridges/contrats connus, la [fiche d'application](../docs/integrations/TEMPLATE_FICHE_APPLICATION.md) et le [passage de flambeau](../docs/integrations/TEMPLATE_PASSAGE_FLAMBEAU.md). Tester d'abord une chaîne complète carte → vraie activité → serveur/ACK → HUB → professeur → projection, puis les variantes. Ne pas modifier les données d'élèves réels pour tester, ni déployer SQL à l'aveugle. Vérifier les droits déjà disponibles avant de réclamer un token. Une seule branche/PR de référence par intégration, pas de développement concurrent sur les mêmes fichiers.

En cas de contradiction, appliquer le **choix pédagogique le plus récent** puis les contrats et sources LIVE vérifiés. Ne pas copier un barème d'une autre application. Consulter la [table des incidents résolus](../docs/integrations/DOCTRINE_EFFICACITE_ET_RETEX_20261104.md#4-retour-dexpérience--symptômes-cause-correction-et-raccourci) avant de redéboguer un symptôme connu.
