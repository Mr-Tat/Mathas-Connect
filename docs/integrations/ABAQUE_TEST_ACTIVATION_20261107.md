# Activation TEST abaque — 7 novembre 2026

**[LIVE vérifié, 07/11/2026]** Projet Supabase Connect `awmhpfofacaglewammxt`. Schéma Abaque installé (migration `20261102190000`), classe démo TEST activée, catalogue Laboratoire visible, zéro profil dans `connect_abaque_pilot_students`, zéro reçu, zéro crédit ou trophée Abaque, et aucune classe scolaire ouverte. Edge `connect-abaque` encore v1 avant ce changement.

**[REPO vérifié, 07/11/2026]** Le `main` a évolué de 527 commits depuis la PR #114, y compris les composants Abaque et Laboratoire. Ne pas remettre en ligne les fichiers historiques de cette PR.

## Activation limitée sans changement de secret

Le client reste soumis à Auth Supabase et aux approbations d'appareil et de profil du serveur. Le nouveau module `access-policy.mjs` résout le mode d'accès selon :
- `CONNECT_ABAQUE_ACCESS=closed` ou toute valeur inattendue : fermeture ;
- `CONNECT_ABAQUE_ACCESS=pilot` : pilote seulement ;
- variable absente : pilote **uniquement** si `SUPABASE_URL` désigne le projet Connect autorisé ; sinon fermeture.

Le handler continue de refuser toute `classId` hors TEST en mode pilote. Les fonctions SQL refusent toute identité sans approbation du professeur et inscription active ; elles n'accordent rien à un élève non autorisé. Aucune entrée dans les quatre HUB scolaires et aucun barème XP ou trophée modifié.

**Retour arrière immédiat** : configurer `CONNECT_ABAQUE_ACCESS=closed` dans les secrets Supabase si ce réglage est possible ; sinon redéployer la version précédente du seul Edge `connect-abaque`. Fermer le catalogue et `connect_abaque_classes.enabled` si nécessaire, sans suppression des états ni des XP.

**Preuves attendues avant « prêt élève »** : CI au nouveau SHA, comparaison avec la version Edge distante, déploiement Edge ciblé, test en ligne avec session professeur authentifiée et profil fictif TEST approuvé, sauvegarde/XP/trophées et résultats professeur. Ni un test Node, ni une CI locale, ni une publication Pages seule ne valent recette hébergée authentifiée.
