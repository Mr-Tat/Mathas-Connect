# Soustraction simple — guidé collectif (chantier en cours)

## Contrat pédagogique validé
Copier le comportement de Multiplication simple avec optimisation #295 : aucune surveillance périodique côté élève ; « Rejoindre la classe » et « Suivant / Vérifier la suite » interrogent le serveur au clic. Deux opérations par page, copies personnelles, page ordinaire libre, obligation rétroactive, arrivée tardive, entraînement séparé, reprise F5 locale, aucun XP/score/trophée.

## Audit ciblé (12/11/2026)
- Intégration Connect : `apps/soustraction-simple/index.html`, `app_key=soustraction-ecrite-simple`.
- Moteur natif autonome `game-original.html` : `startSession('training')` et `makePair()` ; champs `answer-input` et `adjust-input` en `readonly`, pilotés par pavé interne.
- Deux variantes constatées : `borrowMethod='takeTop'` (emprunt direct) et `borrowMethod='addBottom'` (compensation). **Ne pas calquer les reports de multiplication**.
- Le pont scolaire et l'Edge `connect-soustraction-school` concernent les preuves scolaires ; ne pas mélanger ces données au guidé collectif.
- À ce stade seul `connect-guided-multiplication` (v3) et sa table sont installés pour le guidé ; aucune Edge/table guidé soustraction constatée.
- PR héritée #213 « Soustraction scolaire finale » encore ouverte lors de l'audit ; ne pas fusionner implicitement.

## Code sur cette branche
- `collective-contract.mjs` : contrat initial isolé, deux soustractions par page, méthode conservée, progression libre/obligatoire et entrée tardive.
- `tests/soustraction-collective-contract.test.mjs` : 5 scénarios unitaires.
- **Non connecté à l'interface ni à Supabase.**

## Étapes restantes avant publication
1. Analyser génération native `newState`, reports/emprunts, vérité de réussite après correction, et réaliser pont natif propre aux deux techniques.
2. Corrigé sous cases en respectant les colonnes et les deux méthodes, purement visuel.
3. Hôte Connect et contrôleur à requêtes élèves sur clic, sauvegarde sessionStorage identifiée par élève/classe/séance.
4. Edge/RLS/lease, tests de sécurité et séparation des classes.
5. Chromium réel (320, 390, 1160), non-régression des autres modes, CI, Pages/Edge/SQL contrôlés séparément et recette fictive.

**Statut :** audit initial + contrat, pas de déploiement, pas de modification des données ou résultats d'élèves.
