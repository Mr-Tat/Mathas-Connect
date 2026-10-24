# Math'as Connect — secours simple et gratuit

Décision au 24/10/2026 : aucun lancement en classe. Les données actuellement présentes dans Supabase/GitHub sont des essais, perdables sans conséquence pédagogique. La priorité est un socle fiable pour le futur déploiement réel, pas la récupération parfaite des essais.

## Hebdomadaire
- Export JSON privé **par classe** depuis l'interface professeur. Vérifier le téléchargement et garder une deuxième copie hors du navigateur. Rappel local après sept jours.
- Export de précaution avant grande modification. Ne jamais publier les noms et scores sur GitHub.
- Conserver environ quatre hebdomadaires et un mensuel, manuellement et gratuitement.

## À sauver lors d'une future panne réelle
1. Dépôts et versions fonctionnelles (HUB et jeux), règles et interfaces ; conserver les originaux.
2. Schéma Supabase, politiques RLS, fonctions Edge et configuration reproductible **sans clés secrètes**.
3. Classes, fiches élèves et relations, puis meilleurs scores, trophées et déblocages par jeu.

## Pertes tolérables
Dernières parties depuis l'export, meilleur score du jour, tableaux historiques, statistiques fines, sessions/authentifications anonymes, appareils et demandes de connexion en attente.

## Recette en urgence
Relancer les jeux en classique local ; reconstruire HUB et backend ; recréer/reconnecter classes et élèves ; puis réimporter les acquis essentiels en contrôlant l'identité et la révision. Import actuellement **par élève existant** ; il ne recrée pas Auth, les appareils ni une base Supabase disparue. Cela nécessitera des instructions de reconstruction SQL et Edge.

## État technique
- GitHub, branche d'audit : rappel hebdomadaire + restauration simple fusionnant l'état existant et une sauvegarde, contrôlée par révision. **NON DÉPLOYÉ, NON TESTÉ DE BOUT EN BOUT**.
- Supabase : connect-results V8 ACTIVE.
- Ancienne architecture de restauration transactionnelle annulée : pas de RPC RESTORE nouvelle ni de migration SQL prévue.
- Pour la mise en service réelle : test avec comptes fictifs, export + lecture du fichier + restauration sur un élève test. Pas besoin de refaire des séries de dix calculs.

**Règle permanente : gratuit, frugal, sans dépendance à Mathas-Test.**
