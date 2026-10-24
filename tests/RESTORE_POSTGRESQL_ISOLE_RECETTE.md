# Recette RESTORE V9 — PostgreSQL isolé, gratuit, jetable

**Ne jamais exécuter sur Math’as Connect production.** Le projet Mathas-Test est inactif (quota gratuit Supabase atteint). Le conteneur d’exécution actuel n’a ni serveur PostgreSQL ni `psql` : aucune recette PostgreSQL réelle n'a été effectuée.

## Préparation sur PostgreSQL local gratuit
Créer une base vide autonome, des tables fictives minimales `public.connect_states`, `public.connect_class_permissions` et `public.connect_enrollments` avec les contraintes correspondant à la production. Créer localement les rôles `anon`, `authenticated`, `service_role` de test, puis appliquer `supabase/drafts/restore_v9_atomic_NOT_DEPLOYED.sql`. Ne jamais utiliser de dump de production ni de sauvegarde du professeur.

## Cas de recette obligatoires
1. Prévisualisation fictive : état existant, `revision=1`, `reset_epoch=0` ; vérifier que l’état préparé est journalisé côté serveur et reste inchangé.
2. Application de la prévisualisation valide : journal « avant », révision +1, données après restauration exactes, jeton consommé.
3. Deuxième application avec le même jeton : refus ; état et audit inchangés.
4. Révision changée entre preview et apply : refus ; aucune entrée d’audit supplémentaire.
5. Confirmation manquante, acteur d’une autre classe, élève non inscrit : refus sans changement.
6. Prévisualisation périmée (cinq minutes) : refus sans changement.
7. Sauvegarde antérieure au reset : refus sans consentement explicite ; avec consentement, vérifier le résultat et le journal.
8. Undo immédiatement après restore : ancien état retrouvé ; révision augmente toujours.
9. Une nouvelle partie modifie la révision après restore : undo refusé ; nouveau meilleur score conservé.
10. Déclencher une erreur à l’intérieur de la transaction (ex. contrainte SQL fictive) : audit, état et consommation du jeton entièrement annulés.
11. Première restauration sur élève sans `connect_states` : insertion à révision 1 et undo logique vers état vide, sans suppression de ligne.
12. Vérifier les `GRANT/REVOKE` : rôles `anon` et `authenticated` ne peuvent appeler aucune RPC ni lire les tables privées.
13. Tester la concurrence : deux previews sur même révision, une seule restauration peut réussir.
14. Interface professeur : sélection d’un autre élève invalide la prévisualisation.

## Bloquants identifiés
- Le fichier SQL n'est **pas** une migration certifiée : pas de compilation ni de test PostgreSQL réel.
- Un jeton applicatif ne garantit pas l’authenticité d'un fichier historique JSON non signé. Définir un mécanisme de provenance / confiance et de confirmation.
- Le retour arrière vers un état initial absent utilise `{}` (convention à valider avec le client).
- Le `safetyBackupExported` de l'interface est déclaratif ; le journal PostgreSQL sera la vraie protection si la transaction est validée.
- Prévoir une rétention des snapshots, et la suppression périodique des previews expirées avant production.
- Préparer une suite de recette automatique à exécuter sur une vraie base isolée, pas seulement une liste de contrôles.

**Condition de sortie** : preuve d’exécution des cas sur une base fictive isolée, aucun échec et vérification après déploiement uniquement sur comptes fictifs.
