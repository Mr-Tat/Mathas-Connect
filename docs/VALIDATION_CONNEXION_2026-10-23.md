# Math’as Connect — Validation de connexion (23 octobre 2026)

## Résultat : 6/6 tests utilisateurs réussis
Tests réalisés par l'enseignant sur le projet Connect (Brave : professeur ; Chrome LBIDT : Élève A).

1. ✅ Le HUB de classe de Chrome LBIDT reconnaît automatiquement Élève A.
2. ✅ Actualiser la page conserve la connexion.
3. ✅ « Modifier → Passer en mode libre » affiche Mode libre.
4. ✅ « Se connecter » restaure Élève A sans nouvelle autorisation.
5. ✅ Fermeture puis réouverture de l'onglet : connexion cohérente.
6. ✅ Brave professeur : fiche Élève A et appareil toujours présents.

Ce rapport est un **retour de tests utilisateurs**, pas un test automatisé de tous les scénarios.

## Portée et prochaines étapes
- Validé : cycle ordinaire de reconnaissance, mode libre, reprise de session sur le même navigateur et maintien des données côté enseignant.
- **Non testé et non déclaré validé** : révocation de l'appareil, action « Oublier cet élève », changement d'élève sur un ordinateur partagé, connexion après effacement du stockage navigateur, mauvais lien de classe, refus/réessai, deuxième appareil, conflits entre ordinateurs.
- **Pas encore mis en œuvre** : sauvegarde et récupération des progressions Connect dans les jeux ; les jeux ouverts depuis le HUB restent en stockage local.
- Éviter de faire révoquer l'unique appareil approuvé jusqu'à la disponibilité d'un chemin de restauration vérifié. Utiliser de nouveaux navigateurs/profils de test pour les scénarios destructifs.
- Corriger les incohérences d'accès par classe et d'oubli local vs révocation serveur avant l'activation des données cloud.
- Économie : ne pas poller constamment Supabase ; conserver le catalogue statique du HUB.
- Projet historique Math’as et dépôts de jeux non modifiés.

## Critère pour l'étape suivante
Valider **révocation + oubli sécurisé + changement d'élève**, puis utiliser un jeu de test avant tout branchement de progression réelle.
