# Cinq classes — séparation Phase 2 A/B (31 octobre 2026)

La classe historique Phase 2 (UUID `1b021ed9-4846-4203-9c7b-4b5fa8d7adab`) est renommée **Phase 2 A** sans changer d'identifiant ni toucher à des résultats. La nouvelle classe **Phase 2 B** a reçu l'UUID `0d8ba828-59cc-468b-a4b8-7b2a1af10b88`, ses propres permissions et son préréglage `phase2b`, initialisé par copie des options Phase 2 A. À l'état vérifié avant la migration, Phase 2 ne comptait aucune inscription ni tentative.

Le tableau d'accueil, le sélecteur de résultats, le catalogue Connect, les URL de HUB/projection et les colonnes GLOBAL utilisent dorénavant cinq espaces : `observation`, `phase1`, `phase2` (A), `phase2b` (B) et `2eco`. Ces espaces disposent de données distinctes. La projection actuelle utilise la classe passée dans l'URL et vérifiera les autorisations via le serveur.

Ne jamais réattribuer le UUID de Phase 2 A, ne jamais effacer des élèves, résultats, états, XP ou trophées lors de cette séparation. Chaque futur reset de **projection** doit être scoping `(class_id, app_key)` et ne toucher qu'aux périodes d'affichage, jamais aux scores persistés ni aux autres classes.

Le SQL de référence est `supabase/release-candidates/20261031_split_phase2_a_b.sql` ; la migration était déjà appliquée au serveur au moment du commit de ce document. Ne pas l'exécuter sans vérification préalable de l'état du serveur.
