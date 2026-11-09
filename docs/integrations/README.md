# Guide actif — intégrer une application dans Math'as Connect

> **Mode d'emploi opérationnel**, à consulter **si une intégration commence** ; l'entrée initiale demeure la [synthèse](00_DEMARRER_ICI.md) et le [suivi actif](SUIVI_COURANT.md). Ce guide ne remplace ni les décisions du professeur ni le contrôle de l'état LIVE. Son [ancienne version complète est archivée](archives/GUIDE_INTEGRATION_AVANT_SIMPLIFICATION_20261109.md).

## Un seul parcours, six étapes

1. **Préflight et audit, en lecture seule :** vérifier `main`, PR déjà ouvertes, Supabase Connect, GitHub Pages et permissions ; moteur source + SHA, `app_key`, licence, parcours natif, modes réellement utilisables, événements de fin, aides, score, trophées, reprise, clavier et petit écran. Commencer une [fiche propre à l'app](TEMPLATE_FICHE_APPLICATION.md), indexée dans [applications/README.md](applications/README.md).
2. **Point d'arrêt professeur — obligatoire :** présenter dans la conversation une proposition chiffrée **XP**, une proposition de **trophées** avec critères/nombre et une proposition de **scores** avec formule/comparabilité. Montrer des alternatives, dont `SANS OBJET`, et la cohérence pédagogique. **Enregistrer les trois décisions explicites et datées** dans la fiche. Aucune règle nouvelle, crédit ou classement n'est programmé sans validation ; audit et branchements indépendants peuvent avancer.
3. **Intégrer sans réécrire :** préserver le jeu libre et le moteur natif ; brancher identité Connect (`app_key` stable, classe/élève approuvés), preuve de fin versionnée, UUID/ACK, reprise, états XP/trophées/scores **selon les capacités validées**, HUB, professeur et projection consentie si pertinente. Éviter simulation de droits et double interface.
4. **Prouver au bon niveau :** tests de moteur, logique XP/score et idempotence, SQL local jetable si risque, Auth/Edge locaux, Chromium sur **vraie saisie** et écran 320 px, isolation des autres jeux. Tests authentifiés fictifs sur Pages si la fonctionnalité l'exige. **Ne jamais confondre mock/GET HTTP et élève fictif connecté.** Voir [recette exhaustive, à ouvrir par sections](RECETTE_ET_PUBLICATION.md).
5. **Publier en couches et avec autorisation :** une PR ciblée ; CI sur le SHA exact, fusion, Pages effectivement servi, Edge/SQL versionnés et déployés **séparément si modifiés**, classe TEST si approuvée, puis ouverture des classes **après accord du professeur**. Une PR fusionnée ≠ jeu disponible aux élèves. Aucun reset ni migration globale sans autorisation explicite.
6. **Terminer par une passation frugale :** sur **la branche de la PR active**, dans **la même fiche** : trois arbitrages pédagogiques, liens PR/SHA, preuves et limites de publication, incidents et correctifs, prochaine action. Lors d'une reprise, consulter cette branche si la PR n'est pas fusionnée. Mettre **une ligne** dans [le suivi actif](SUIVI_COURANT.md) ; en clôture archiver cette ligne dans [le registre d'applications](applications/README.md). Les raccourcis et tendances **réutilisables** seulement vont au [RETEX opérationnel](RETEX_OPERATIONNEL.md).

## Conditions de sortie

**TERMINÉ pour une application scolaire** = moteur natif préservé + décisions pédagogiques approuvées + carte HUB/permissions + preuve/ACK et résultats adaptés + professeur/projection si applicables + tests pertinents réussis + SHA GitHub/Pages et éventuelles versions SQL/Edge vérifiés + recette fictive authentifiée si requise + visibilité dans les seules classes **autorisées**. Si une couche manque : **EN ATTENTE**, **NON VÉRIFIÉ** ou **SANS OBJET**, jamais « terminé » fictivement.

**Sécurité :** aucune écriture de test sur de vrais élèves, aucun secret ou donnée personnelle dans Git, et aucun déploiement de service non autorisé. Préserver les autres applications et les acquis.

## Où chercher sans charger tout GitHub

| Besoin | Consulter uniquement |
| --- | --- |
| Contrat fonctionnel, XP, 3 vies/Mort subite, trophées, exemples JS/SQL | [Contrat complet de la PR #272](CONTRAT_FONCTIONNEL_COMMUN_APPLICATIONS_20261109.md), section concernée |
| Schémas, sécurité, SQL/Edge, scores | [Référence technique](REFERENCE_TECHNIQUE.md) et [contrat XP](CONTRAT_COMMUN_SCORES_XP_TROPHEES.md) |
| Test, publication, rollback | [Recette](RECETTE_ET_PUBLICATION.md) |
| Symptôme connu, raccourci, tendance émergente | [RETEX opérationnel](RETEX_OPERATIONNEL.md), puis [erreurs détaillées](RETEX_ERREURS.md) |
| Cas historique complexe | [Doctrine/RETEX du 04/11](DOCTRINE_EFFICACITE_ET_RETEX_20261104.md) |
| Décisions anciennes à revérifier | [Suivi daté du 07/11](SUIVI_DECISIONS_OUVERTES_20261107.md) |

**Priorité des sources :** décision pédagogique récente du professeur → état LIVE vérifié pour les faits techniques → contrat actif validé → documentation historique. Un vieux chiffre XP ou catalogue n'est jamais une preuve de production.
