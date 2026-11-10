# Fiches par application — registre d'intégration

> **Une fiche vivante par nouvelle application**, pas une suite de comptes rendus copiés entre conversations. Le [suivi global](../SUIVI_COURANT.md) ne conserve que les applications actives, leur étape et leur lien vers la fiche. Les anciennes intégrations peuvent recevoir une fiche lors d'un nouveau chantier ; **ne pas inventer rétroactivement leur validation ou statut LIVE**.

## Comment commencer une nouvelle application

1. Copier le [modèle court](../TEMPLATE_FICHE_APPLICATION.md) sous `docs/integrations/applications/<app-key>.md` (nom stable, sans donnée d'élève). Renseigner moteur, app_key, version et objectifs.
2. Auditer l'application, puis **faire le brainstorming avec le professeur** : XP, trophées et scores → **décisions explicites datées**, ou `SANS OBJET`. L'IA ne programme pas ces règles sans validation.
3. Compléter **la même fiche sur la branche de la PR en cours** : état, SHA, preuves par couche, incidents, solutions, tests, prochaines étapes et passation. **Si le travail n'est pas fusionné**, un nouveau chat doit consulter cette branche et non déduire l'état de `main` ; consigner le nom de la PR dans la passation.
4. Mettre à jour **une seule ligne** dans le suivi global ; à la fin, enlever cette ligne active et inscrire la fiche dans le registre ci-dessous.
5. Si une panne ou un raccourci revient dans plusieurs applications, comparer les causes et remonter le **motif transversal prouvé** dans [RETEX_OPERATIONNEL.md](../RETEX_OPERATIONNEL.md), y compris les tendances émergentes.

## Reprendre un chantier commencé AVANT ce registre

L'[index actif](../SUIVI_COURANT.md) conserve **un inventaire daté des PR héritées**. Pour un sujet ancien, **ne pas créer une nouvelle intégration fictive** et ne pas fusionner une vieille PR simplement parce qu'elle est ouverte : vérifier le statut actuel, comparer sa branche et ses fichiers à `main`, ainsi que les PR et livraisons plus récentes. Le travail peut avoir déjà été repris ailleurs.

Si le sujet doit vraiment continuer : réutiliser la PR existante si elle est encore adaptée, ou documenter clairement sa succession ; créer/mettre à jour la fiche **sur la branche réellement travaillée**, avec décisions pédagogiques déjà prouvées (ne jamais les inventer), tests et prochaine action. Remonter **une seule ligne active** dans le suivi. Une PR ancienne non fusionnée **ne constitue ni une mise en production ni une décision de fermeture**.

## Registre des intégrations terminées depuis le 09/11/2026

| Application / app_key | Fiche | Dernière preuve de livraison | Décisions pédagogiques |
| --- | --- | --- | --- |
| _Aucune fiche créée à ce stade de la refonte documentaire_ | — | — | — |

**Archives conservées** : le [modèle très détaillé du 09/11](../archives/TEMPLATE_FICHE_APPLICATION_DETAILLE_20261109.md) et les anciennes PR restent disponibles pour les cas complexes ; consulter les rubriques adaptées, sans recopier toute l'histoire dans une nouvelle conversation.
