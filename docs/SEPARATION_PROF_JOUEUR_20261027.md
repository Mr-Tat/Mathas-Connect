# Séparation professeur / joueur Monsieur T — 27 octobre 2026

## Architecture mise en place

- Professeur : session Supabase indépendante, storageKey `mathas-connect-professor-auth-v1`. Seule l'interface `?portail=prof` utilise cette session.
- Joueurs (élèves et Monsieur T) : conservent le stockage Supabase historique, partagé entre HUB et jeu pilote. Aucun changement de session pour les élèves existants.
- Le serveur refuse désormais le jeu par la session professeur : `student-me`, `student-load`, sauvegardes, avatar et XP passent par une session élève anonyme approuvée.
- La fiche `Monsieur T` préexistante est désormais inscrite dans Phase 1, sans changement de son identifiant ni de ses scores. L'ancienne association professeur → fiche joueur reste en base en repère non privilégié pour les fonctions ultérieures (projection).
- Toute nouvelle connexion de Monsieur T, y compris depuis un autre PC, doit être une demande élève approuvée et **rattachée à la fiche existante** par le professeur. Ne pas créer une seconde fiche.
- Un ancien navigateur stockant encore la session professeur dans l'espace joueur présente une action explicitement confirmée pour libérer uniquement cette ancienne session. La session professeur indépendante reste disponible après reconnexion.

## Contrainte projection

Le repère de Monsieur T n'accorde pas d'accès professeur au joueur. `projection_opt_in` reste à false pour Monsieur T ; futur tableau projeté : interrupteur prof séparé.

## Contrôles

Tests de syntaxe app.js et hub.js : OK. Edge Functions `connect-api` v21 et `connect-results` v26 : statut ACTIVE.
SQL : une seule fiche Monsieur T, une seule inscription Phase 1, aucune ligne d'état de jeu au moment de la transition. Aucun effacement des données.
Test utilisateur nécessaire : reconnecter l'espace professeur, puis approuver une demande Monsieur T depuis l'espace élève et la rattacher à sa fiche existante. Vérifier une partie du jeu pilote avant d'ouvrir à toute la classe.
