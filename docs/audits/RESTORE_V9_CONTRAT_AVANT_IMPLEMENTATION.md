# RESTORE V9 — contrat d’implémentation (24 octobre 2026)

**Statut : PRÉPARÉ NON DÉPLOYÉ.** Aucun élève ni sauvegarde privée utilisée.
**Production : connect-results V8, à conserver.**

## Décision de sécurité
Ne pas publier le RESTORE présent dans `supabase/functions/connect-results/index.ts`.
La branche d’audit contient une barrière `restore_apply_not_enabled`.
Les anciens brouillons SQL étaient incomplets et une réécriture a produit du SQL malformé : ils ont été **retirés** plutôt que déployés. Les tests statiques qui les ciblaient ont aussi été retirés.

## Contrat cible
1. `teacher-restore-preview` : JWT professeur validé côté Edge ; appartenance active, `can_manage`, app_key autorisée ; sauvegarde format V1/V2 authentifiée et inspectée ; fusion sur **état courant** à révision R et reset_epoch E ; conserver l'état `after` exact dans une table privée de prévisualisations en PostgreSQL, associée à actor/class/student/app/R/E/empreinte du fichier, durée 5 min, jeton aléatoire à usage unique. Ne jamais exposer la table à anon/authenticated.
2. `teacher-restore-apply` : même JWT et mêmes droits, confirmation explicite et sauvegarde préalable ; **aucun nouveau JSON d'état accepté** ; RPC transactionnelle qui verrouille la prévisualisation, contrôle expiration/usage et révision+epoch, capture l'état avant mutation dans un journal privé, applique l'état sauvegardé dans la prévisualisation, marque le jeton consommé ; rollback entier si échec.
3. `teacher-restore-undo` : droits professeur, confirmation distincte ; verrouillage d'état, exigence d'égalité avec révision et empreinte immédiatement post-restauration ; si une partie a eu lieu depuis, **refuser**. Journal d’annulation séparé, aucune destruction d’historique d’audit. Préserver la monotonie des révisions.
4. Retour à un état antérieurement absent : formaliser l'équivalent logique d'un état vide **sans supprimer physiquement la ligne** et tester la compatibilité client.
5. Signature des sauvegardes : spécifier intégrité/authenticité et stratégie d'import d'anciens exports non signés. Ne pas confondre UUID, `projectRef` ou revision avec preuve d'authenticité.
6. Vie privée : pas de copie de sauvegarde dans les logs, pas de résultats individuels retournés par erreur, conservation limitée des copies privées et suppression contrôlée.

## Barrières obligatoires avant production
- Test automatisé SQL PostgreSQL sur projet ou DB **isolé** avec uniquement comptes, classe, élèves et états fictifs.
- Couverture : refus prof non gestionnaire, élève non inscrit, token anonyme, fichier erroné, hash modifié, jeton périmé ou réutilisé, reset_epoch différent, révision modifiée, échec au milieu de la RPC (aucun audit partiel), apply conforme, undo conforme, undo refusé si nouvelle partie.
- Audit réel grants/RLS, schéma privé non exposé, `SECURITY DEFINER SET search_path=''` et permissions RPC limitées à service_role ; protections contre actor_id arbitraire via Edge.
- Déploiement de nouvelle version uniquement après recette ; relire source/numéro de version LIVE et refaire recette uniquement sur données fictives.

## Invariants
- Original Addition V6.0.2 intact. Import V6.0.2, rattrapage réseau, faux 10/10 et HARD niveau 1 sont déjà validés.
- Défi HARD 5 calculs non accessible, pas un trophée.
- Jeux : classique local / connecté élève ; progression et trophées spécifiques.
- Aucune nouvelle session de 10 calculs inutile.
