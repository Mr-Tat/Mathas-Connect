# Réalignement des tests de contrat et du runner Chromium — 21/11/2026

**PR :** https://github.com/Mr-Tat/Mathas-Connect/pull/337
**Base :** `main` `147e2f6a412d1651160b58db55a36f8ef08bb4a5`.
**Périmètre :** tests d'intégrité et workflow GitHub Actions. Aucun changement de jeu, classe, droit, SQL/Edge, barème, score, XP, trophée ni historique d'élèves.

## Problème → origine → correction

- La suite globale affichait en permanence **742 réussites / 10 échecs** sur la base. Ces échecs ne constituaient pas 10 régressions de calcul écrit, mais protégeaient des versions de fichiers et des décisions antérieures.
- **Abaque, source immuable :** titre d'onglet seul harmonisé par `a10941fd`, favicon local ajouté par `01817c6a`. Le nouveau test enlève uniquement ces surcouches avant de comparer au SHA-256 original du manifest ; il continue à refuser un moteur différent.
- **Mélange, archive immuable :** titre de l'archive seul changé par `f7b1ebd`. Comparaison à la même empreinte native originelle après normalisation de cette présentation seulement.
- **Soustraction, moteur natif :** titre de l'onglet seul changé par `e0604b91`. Hash Git de la version canonique historique encore strictement contrôlé.
- **Master Abaque :** l'ancien test cherchait une condition UI obsolète. Le test contrôle désormais le garde plus restrictif `guestMode || (!!connectBinding && !teacherFree)`, la vraie propriété `hidden` du bouton et le rejet des utilisateurs non professeurs. La protection existante du serveur reste inchangée.
- **Catalogue Abaque :** le professeur a explicitement retiré l'application à Observation et Phase 1. La lecture seule Supabase `connect_hub_preset_entries` confirme `visible=false` pour ces deux espaces, `true` pour Phase 2 A / 2 B / 2 ECO. Le test des cinq catalogues respecte cette décision. La carte demeure correctement présente dans le JSON de secours et dans le sélecteur de visibilité du professeur, ce qui invalide deux anciennes assertions.
- **Miniatures :** réoptimisation WebP documentée dans les commits `1d449567` (Addition multiple, Soustraction) et `e0c84e4d` (Mélange). Les empreintes exactes sont mises à jour avec le nouveau format de référence ; aucun média n'est remplacé par cette PR.
- **Guide d'intégration et pilote Pages :** vérifier les exigences normatives du guide à six étapes et le titre public actuel, pas la prose archivée.
- **CI calculs mélangés :** le runner `ubuntu-latest` résolvait vers 26.04 où Playwright 1.58.2 ne pouvait installer Chromium. Épinglage `ubuntu-24.04` sans changer la dépendance du jeu.

## Preuves / limites

- [Suite générale candidate 21/11, 752 PASS / 0 FAIL](https://github.com/Mr-Tat/Mathas-Connect/actions/runs/44912487765) sur le code ayant corrigé les dix tests, avant le seul correctif de runner.
- Les contrôles ciblés existants des jeux n'ont pas été assouplis. Certains anciens scénarios de démonstration Abaque échouent encore séparément en Chromium ; ils exigent un audit distinct avant de les déclarer résolus.
- **Un problème fonctionnel distinct a été détecté pendant l'audit :** le JSON de secours du HUB peut afficher des jeux qui sont masqués par les presets de classes lorsque Supabase ne répond pas. Traiter ce défaut sur une **PR séparée**, sans retirer la carte des options professeur ni empêcher les classes autorisées d'accéder aux jeux libres.
- Recette réellement authentifiée TEST professeur + élève fictif : **NON EXÉCUTÉE**.
- À faire après fusion : constater le SHA Pages de `main`, qualifier les tests de calculs mélangés sur runner épinglé, puis traiter le repli statique par classe.
