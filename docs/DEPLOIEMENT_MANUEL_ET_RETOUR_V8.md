# DÉPLOIEMENT MANUEL — Math’as Connect (préparation)
Date : 24 octobre 2026

## Publication manuelle requise — après contrôle du fichier d'export
La V8 active est préservée dans `supabase/rollback/connect-results-V8-LIVE-2026-10-24.ts`. L’original GitHub main n’est PAS identique au live V8.
Le backend de secours préparé se trouve dans `supabase/functions/connect-results/index.ts` sur cette branche. Les tests GitHub Actions avec base simulée passent ; aucun test réel écrit dans Supabase n'a été effectué.
Projet Supabase : `awmhpfofacaglewammxt`, fonction `connect-results`, `verify_jwt=true`.
PR : https://github.com/Mr-Tat/Mathas-Connect/pull/1

## Ordre de publication, quand la recette sera prête
1. Vérifier un export JSON privé des données tests et sa bonne ouverture. NE PAS publier ce fichier.
2. Enregistrer la V8 live hors de toute modification : vérifier la copie GitHub ci-dessus (code et configuration). 
3. Ouvrir https://supabase.com/dashboard/project/awmhpfofacaglewammxt/functions et choisir `connect-results`.
4. Remplacer uniquement le contenu de `index.ts` par le fichier préparé sur la branche d'audit. Garder `verify_jwt=true`. Ne jamais coller de clés secrètes.
5. Après publication, noter la nouvelle version et vérifier que le code live correspond au fichier préparé.
6. Contrôler d'abord chargement, enregistrement et lecture habituelle, puis preview/apply avec un compte élève **fictif**. Ne pas utiliser un vrai export du professeur.
7. Fusionner la PR GitHub seulement si la recette précédente est réussie. Vérifier l'interface et le rappel hebdomadaire.

## En cas de problème
Revenir à `supabase/rollback/connect-results-V8-LIVE-2026-10-24.ts` dans la même fonction, garder `verify_jwt=true`, puis vérifier la version active. Le retour de la fonction n'annule pas les données déjà modifiées.

## Décision produit
Export privé chaque semaine par classe ; récupération des principaux scores, trophées et niveaux, pas les sessions et historiques détaillés. Aucun paiement, aucune dépendance à Mathas-Test. Originaux pédagogiques préservés.

## À NE PAS CONFONDRE
Lien GitHub = fichier source. PR = code non publié. Supabase ACTIVE = code effectivement exécuté.

## Sauvegarde automatique hebdomadaire : décision
**Non active.** Le rappel actuel est local au navigateur et ne sauvegarde aucun fichier automatiquement. Pour une vraie exécution hebdomadaire, il faut d'abord choisir un stockage externe privé et son authentification, s'assurer du chiffrement et tester la restauration depuis ce stockage. Ne pas déposer les exports nominatifs dans GitHub, y compris dans un dépôt privé destiné au code. Option zéro frais provisoire : export manuel hebdomadaire, fichier vérifié et conservé sur un support protégé.

## Améliorations vérifiées en branche
- Le nom de fichier JSON exporté contient désormais identifiant de classe et date/heure pour éviter les écrasements le même jour.
- Changer de classe invalide le formulaire de restauration en attente.
- Le panneau de restauration est fermé par défaut.
