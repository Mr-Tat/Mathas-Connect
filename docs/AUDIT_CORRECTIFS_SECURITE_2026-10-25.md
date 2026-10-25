# Math'as Connect — Correctifs de sécurité et sauvegardes

État du chantier au 25 octobre 2026. Ne pas qualifier une fonction de « testée en situation » avant un essai navigateur réel.

## Appliqués
- `connect-results` v14 : tout accès élève à `student-load`, `game-record`, `game-reset`, `legacy-import`, `lab-record`, etc. passe par `identity()`. Pour les élèves anonymes, `identity()` vérifie l'appareil approuvé, l'inscription active dans la classe ET `connect_students.archived_at IS NULL`. La restauration de résultats et le détail professeur refusent également les fiches archivées.
- `connect-api` v14 : `student-me` retourne revoked si élève archivé ; `student-join-status` ne confirme pas une ancienne autorisation d'élève archivé ; `student-avatar` n'actualise pas les fiches archivées ; `teacher-review-join` ne peut pas réassocier explicitement une fiche archivée ; `teacher-pair-code` n'attribue pas de code à une fiche archivée. `teacher-students` masque les archives.
- Sauvegarde `teacher-export` v3 : inclut le statut archivé, prénom/initiale, alias privé, avatar, projectionOptIn, inscriptions, états complets des applications, crédits XP avec preuves/version et profil de niveau/version. Les archives sont conservées dans l'export. Les résultats ordinaires excluent les archives.
- `app.js` accepte `mathas-connect-class-backup-v3` pour télécharger, lire et prévisualiser une restauration **des résultats Addition uniquement**. Les autres données de v3 sont sauvegardées mais **non restaurables automatiquement** pour le moment.
- Après suppression définitive, l'interface avertit si un nettoyage Auth a échoué et rappelle de supprimer également les exports privés anciens si approprié.

## Précautions non résolues
- Tests réels manquants : inscription enfant, validation enseignant, avatar, reconnexion, archivage puis tentative d'accès avec session encore ouverte, restauration, suppression définitive, jeu hors ligne et concurrence.
- Suppression des comptes Auth anonymes : nettoyage conditionnel hors transaction après suppression SQL. Si `accountCleanupPending`, intervention/contrôle nécessaire. Les exports privés déjà téléchargés ne peuvent pas être effacés par Connect. Veiller aux droits RGPD et à la politique de conservation.
- XP : tables `connect_xp_credits`/`connect_level_profiles` en place, mais aucun XP n'est attribué ; pas encore de validation serveur robuste des performances pour crédit irréversible.
- Monsieur T : profil provisionné seulement à sa première ouverture du HUB sous session professeur. Son score Addition sera stocké dans une fiche joueur dédiée ; pas de tests de bout en bout. Pas dans les tableaux de classe, pas de sauvegarde spéciale Monsieur T pour l'instant.
- Projection : future page, avec contrôle de visibilité de Monsieur T dans son coin inférieur gauche, **masqué par défaut**.
- Les avatars utilisent des emojis à remplacer éventuellement par des illustrations uniformes.
- La suppression de scores/trophées visible ne doit jamais effacer par inadvertance les XP crédités. Une récupération totale des XP/avatars/restauration sur une autre base reste à définir.
- Ancien Math'as (dépôt et Supabase historiques) : ne pas toucher.

## Tests indispensables
1. Nouveau profil anonyme, choix d'avatar, demander accès, validation professeur, avatar sur HUB.
2. 2 navigateurs, résultats Addition et synchronisation, fermeture/retour HUB.
3. Archiver compte utilisé, réessayer HUB/API/jeu depuis ancien navigateur : aucune lecture/écriture connectée possible ; restaurer compte, autoriser un nouvel appareil, scores préservés.
4. Exporter la sauvegarde v3, vérifier manuellement avatars, archivedAt, niveaux et crédits ; prévisualiser puis restaurer un résultat Addition seulement.
5. Compte de test sans données importantes : archiver puis supprimer, confirmer l'absence d'états/accès et vérifier le signalement `accountCleanupPending`.
6. Monsieur T dans une des quatre classes autorisées : vraie partie, score, retour HUB, continuité compte prof.
