# Compte unique, plusieurs classes — 27/11/2026

Décision : la classe est celle du raccourci HUB, sans nouveau sélecteur. Compte, XP, trophées et progression communs ; envoi du score isolé par classe et événement. Le compte unique n'est pas recréé.

Causes : student-join-status prenait la première inscription ; le trigger de capture ignorait les multi-inscrits ; reçus Abaque sans classe. Correction : priorité à l'inscription demandée ; capture depuis la preuve de session, repli historique seulement si une classe unique ; reçus Abaque liés à la classe, anciennes preuves attribuables sans ambiguïté ; retrait d'une inscription distinct de l'archivage ; avertissements de parcours partagé.

Limites : calculs mélangés et routes historiques sans preuve de classe nécessitent une vérification spécifique avant ouverture à des multi-inscrits. Aucun score réel utilisé en test. Ne pas activer les élèves avant migration, Edge, Pages et tests ciblés. Recette navigateur authentifiée à effectuer avec un compte fictif.

- Test transactionnel PostgreSQL sur fiche fictive, annulé par ROLLBACK : PASS capture deux classes, rejet score ambigu, meilleur score distinct, Abaque classe correcte/refus mauvaise classe, retrait ciblé. CI générale #45958361497 PASS. Banc Auth initial bloqué avant test car le workflow ne copiait pas le module existant `milieu-profile-progress.mjs` ; fixture complétée et scénario Auth multiclasse ajouté.
