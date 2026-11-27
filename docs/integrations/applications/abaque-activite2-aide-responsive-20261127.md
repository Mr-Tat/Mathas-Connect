# Abaque des longueurs — Activité 2 : sept colonnes visibles dans l'aide

**Date :** 27 novembre 2026. **Périmètre :** présentation de l'aide de l'activité 2, source autonome + copie Connect. Identifiant maintenu : `abaque-longueurs`.

## Incident
Dans « Reconstitue l'abaque pour obtenir l'aide » comme après déblocage de l'abaque compact, des colonnes étaient accessibles uniquement par un scroll horizontal. La règle partagée `.metricTable{min-width:560px}` dépassait les quelque 490 px disponibles dans le panneau.

## Correction
- CSS localisé à `#moveScreen .moveAbacus` : table et grilles en sept colonnes de largeur flexible, sans `min-width:560px` dans **cette aide seulement** ;
- étiquettes de placement ajustées à leurs cellules et texte réduit sur écrans étroits ; modèle et validations inchangés ;
- même CSS appliqué dans `Mr-Tat/abaque-m-1/index.html` (PR [#2](https://github.com/Mr-Tat/abaque-m-1/pull/2)) et `apps/GRAN-abaque-m-1/index.html` (PR [#365](https://github.com/Mr-Tat/Mathas-Connect/pull/365)).
- copie Connect conservée avec ses hooks Auth supplémentaires ; pas de remplacement par l'outil automatique de synchronisation (manifest historique non réécrit sans rebasage complet).

## Contrôles
- **OK** : rendu Chromium sur une reproduction fidèle de l'abaque avec CSS source aux largeurs 320, 390, 500, 610, 820 et 1440 px ; sept colonnes sans dépassement ni texte d'étiquette tronqué ;
- **À vérifier sur les versions fusionnées :** GitHub Actions, Pages et test réel authentifié prof/élève fictifs de l'ouverture, du glisser-déposer, de la validation et de l'abaque complet ;
- **Non modifiés :** exercices et scores, XP, coupes, verrous, droit des classes, activité 3 et fonctions Supabase.

## Prochaine action
Confirmer la CI, fusionner les deux PR si validées, vérifier Pages puis recetter dans la classe TEST avec profils fictifs.
