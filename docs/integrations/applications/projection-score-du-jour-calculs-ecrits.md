# Projection : meilleur score du jour — quatre calculs écrits

**Décision pédagogique du 10/11/2026 :** le meilleur score certifié du jour est proposable même s'il est inférieur au meilleur score historique. L'élève voit « Envoyer au tableau » ou une indication d'envoi certifié (« Score envoyé », « Meilleur score déjà envoyé »). Consentement explicite Oui/Non conservé.

## Audit (lecture seule)
- Multiplication : 5 séries Mort subite et 1 série 3 vies enregistrées et prouvées côté Supabase ; aucune publication pour ces six événements ; leurs points sont inférieurs ou égaux au record historique déjà partagé.
- Cause : comparaisons du frontal et des RPC de publication fondées exclusivement sur `boardBest`, bien que le professeur dispose déjà de deux modes de projection.
- PR #248 (dialogue Oui/Non), #249 (avatars), #250 (soustraction), #251 (reconnexion additions) et #213 (soustraction) restent ouvertes : ne pas les fusionner implicitement.

## Portée du correctif
- Quatre jeux concernés : `addition-ecrite-simple`, `addition-ecrite-multiple`, `soustraction-ecrite-simple`, `multiplication-ecrite-simple`.
- Carte partagée des résultats : `boardTodayBest` certifié par serveur, état réactualisé après ACK de l'envoi, aucun « Score envoyé » sur clic seul ou erreur réseau.
- SQL : trois RPC d'historique ajoutent le meilleur score déjà consenti **aujourd'hui**, trois RPC de partage acceptent un nouveau record du jour sans exiger de battre le record historique. Propriétaire, classe, preuve certifiée, reset, idempotence et consentement restent protégés.
- Le calcul des points, XP, trophées, moteurs, méthodes, déblocages, espace professeur et le record historique ne changent pas.

## Publication / tests / prochaine action
- **Code GitHub :** branche `fix/written-daily-projection-feedback-20261110` ; PR séparée de reprise.
- **CI :** exécuter `node --test tests/*.test.mjs` via workflow, puis recette fictive.
- **Migration SQL :** `20261110120000_projection_written_daily_best_consent.sql` ; **NON appliquée**. Accord explicite et vérification préalable indispensables. La nouvelle UI désactive le bouton du jour tant que le serveur ne renvoie pas `boardTodayBest`.
- **GitHub Pages :** non publié dans ce chantier avant fusion / recette.
- **Recette attendue :** classe TEST, profil fictif, une série mort subite et 3 vies moins élevée que son record historique ; Oui / Non, publication avec retour serveur, relancement du jeu et état « Déjà envoyé », lendemain, reset, réseau absent puis rétabli. Vérifier l'envoi par clic sur les cartes des quatre applications.
- **Prochaine action :** revue CI, autorisation SQL distincte, recette avec profil fictif, fusion + publication Pages, puis recontrôle Supabase.
- **RETEX émergent :** un classement quotidien et un classement historique peuvent utiliser la même liste de consentements mais pas le même seuil de publication. Contrôler simultanément client + SQL + projection avant de corriger les symptômes dans chaque moteur.
