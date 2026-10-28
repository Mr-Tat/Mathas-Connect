# Soustraction — recette et mise en service contrôlée

État au 28/10/2026 : **PR #14 fusionnée, moteur publié mais Soustraction volontairement masquée**.

## Publication contrôlée effectuée
- Code GitHub fusionné dans `main` : commit `7807656b1a8f89bf49a884f044e1f197d05f98f8`. GitHub Pages publié avec succès (run `40777228507`), régression `main` réussie.
- Migration Supabase appliquée : `20261028220546_soustraction_connect_v1_20261028`. Application présente mais `enabled=false`, quatre entrées HUB `visible=false`, neuf règles XP.
- Edge Function `connect-results` : version **38**, active, `verify_jwt=true`. Version précédente 37 enregistrée dans GitHub `main` avant fusion (`544355d88dc5e95e569076bf948959a4740086c8`) pour retour arrière rapide.
- ACL après migration : aucun droit `EXECUTE` pour `anon` ou `authenticated` sur les RPC XP/reprise ; `service_role` autorisé.
- Test transactionnel sur la vraie base : élève fictif, 4/4 donnant 22 XP, second calcul donnant 0 XP, sous-transaction **annulée volontairement**. Élève fictif absent après test.
- Comptages élèves inchangés : 7 profils, 5 états, 3 crédits XP, 3 jalons XP, 2 historiques de parcours avant et après mise en service.
- Restent avant activation : recette avec véritable authentification Supabase pour un compte de test ; comparaison visuelle sur petit PC réel. **Ne pas rendre `enabled=true` ni les HUB visibles avant ces vérifications.**

## Vérifications effectivement réalisées
- Chromium avec le vrai moteur V6.0.2 : menus, technique d’emprunt, quatre vraies soustractions résolues au pavé numérique, événement Classique 4/4 émis par le moteur. Une seconde recette Chromium suit maintenant les résultats jusqu'à PostgreSQL et vérifie leur restauration.
- Chromium avec serveur simulé : fermeture d’onglet hors ligne, retour réseau, un seul envoi du résultat et aucun doublon.
- Chromium : largeur 320, 360, 390, 768 et 1 024 px, contrôles du HUB, de la jauge XP et du conteneur du jeu.
- PostgreSQL 16 isolé : migration réelle exécutée deux fois, jalons XP jusqu’à 474 points, reprise d’un parcours et non-régression d’Addition.
- Tests du professeur : affichage séparé des deux techniques Mort subite ; régressions Multiplication et restauration d’urgence.
- Miniature authentique Soustraction en WebP léger ; moteur autonome source inchangé.

**Nouvelle recette combinée validée :** le vrai navigateur Chromium appelle le vrai code `connect-results/index.ts`, dont les requêtes et RPC sont exécutées sur une base PostgreSQL 16 temporaire. Après un redémarrage de parcours, une partie 4/4 est enregistrée par le lanceur ; le rechargement du jeu récupère le record `4/4` depuis le serveur et reconstitue le stockage du moteur. Les contrôles Edge/SQL vérifient également les 22 XP, les 10 XP de Mort subite, l'idempotence, les résultats professeur, la reprise et l'isolation d'Addition. CI : https://github.com/Mr-Tat/Mathas-Connect/actions/runs/40776298244.

**Limite résiduelle :** l'authentification Supabase Auth/GoTrue et la couche PostgREST sont remplacées dans cette recette par des adaptateurs locaux sur données fictives. Aucune véritable instance Auth + Edge + Postgres distante n'a encore été testée de bout en bout.

## Plan de mise en service — historique des étapes et vérifications finales
1. Vérifier les autres PR en cours, la version de main et toutes les CI de la PR #14. Vérifier une sauvegarde privée récente des données de chaque classe concernée.
2. Fusionner #14 dans main. Vérifier GitHub Pages, game-original.html et la miniature authentique. Ne pas activer l’application dans les HUB.
3. Appliquer la migration 20261028_soustraction_connect_v1.sql. Vérifier connect_apps.enabled=false, quatre presets visible=false, neuf règles XP totalisant 158 points par niveau et le maintien des droits restreints sur les fonctions XP/reprise.
4. Déployer la fonction Edge connect-results correspondant au commit fusionné ; conserver le code de la précédente version pour retour arrière. Vérifier les journaux.
5. Faire la recette réelle avec une classe de TEST et un compte élève fictif : student-load, Classique 4/4 donnant 22 XP, retour au HUB, résultats professeur, deux méthodes Mort subite, trophées, HARD 5 et reprise de parcours. Contrôler qu’Addition et Multiplication restent inchangées.
6. Contrôler visuellement les guides, emprunts, réglette, pavé et aides sur un petit PC de la classe et sur GSM.
7. Activer Soustraction de manière progressive et choisir indépendamment les quatre visibilités HUB dans GLOBAL ; commencer par le compte de test avant les élèves.

## Retrait d’urgence sans perte
- Désactiver l’entrée du catalogue et les quatre visibilités HUB, sans effacer les états, les récompenses ni les archives de parcours.
- Si la fonction Edge touche les autres jeux, redéployer l’ancienne version connue. Ne supprimer aucune table ni jalon XP.
- Une restauration d’élève doit utiliser la sauvegarde privée et l’aperçu avant confirmation déjà prévus côté professeur.

Cette procédure ne doit jamais être lancée automatiquement par GitHub Actions sur les données élèves.