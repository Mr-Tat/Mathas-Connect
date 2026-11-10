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
- **Code GitHub :** [PR #277](https://github.com/Mr-Tat/Mathas-Connect/pull/277) fusionnée le 10/11/2026 par squash dans `main`, SHA du code livré : `0572059a4e4b991749538681259a574c2d7836dc`.
- **CI (HEAD `df148822`, 10/11/2026) :** 11 workflows réussis, dont tests PostgreSQL 16 jetable et Chromium des quatre jeux. Une suite générale reste en échec pour 4 cas hors périmètre : 3 miniatures et un guide Laboratoire ancien ; les trois miniatures échouaient déjà sur `main` le 09/11.
- **Migration SQL :** `20261110120000_projection_written_daily_best_consent.sql` **APPLIQUÉE le 10/11/2026**, historique Supabase `20261110110523` / `projection_written_daily_best_consent_20261110`, sur `awmhpfofacaglewammxt`. Six fonctions inspectées après installation (propriétaire et ACL inchangés), quatre appels de lecture sur UUID fictifs ont renvoyé `boardTodayBest`. Aucune modification de résultats/XP/trophées.
- **GitHub Pages :** **déploiement confirmé** le 10/11/2026 pour `0572059a` (Actions [run 42804980643](https://github.com/Mr-Tat/Mathas-Connect/actions/runs/42804980643), jobs build, deploy et report-build-status **success**). Le réseau d'inspection externe n'a pas permis de vérifier les réponses HTTP du site indépendamment. Contrôle Soustraction production en lecture seule : [réussi](https://github.com/Mr-Tat/Mathas-Connect/actions/runs/42804980443).
- **Recette attendue :** classe TEST, profil fictif, une série mort subite et 3 vies moins élevée que son record historique ; Oui / Non, publication avec retour serveur, relancement du jeu et état « Déjà envoyé », lendemain, reset, réseau absent puis rétabli. Vérifier l'envoi par clic sur les cartes des quatre applications.
- **Prochaine action :** **recette hébergée NON EXÉCUTÉE** : utiliser un profil fictif approuvé dans la classe TEST pour lancer Mort subite puis 3 vies ; score certifié du jour sous record historique → proposition Oui/Non → ACK → pastille « Score envoyé » → rafraîchir → « Meilleur score déjà envoyé ». Vérifier que le projecteur « Score du jour » change sans modifier « Meilleur score », et que Non ne transmet rien. Vérifier les deux additions et la soustraction. Aucune activation de classe ou migration Edge supplémentaire requise. Garder ce chantier actif avant validation humaine.
- **RETEX émergent :** un classement quotidien et un classement historique peuvent utiliser la même liste de consentements mais pas le même seuil de publication. Contrôler simultanément client + SQL + projection avant de corriger les symptômes dans chaque moteur.
