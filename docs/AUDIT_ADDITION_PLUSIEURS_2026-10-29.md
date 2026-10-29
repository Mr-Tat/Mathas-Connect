# Audit critique — Addition de plusieurs nombres — 29 octobre 2026

**Périmètre :** PR #29, branche `integration/addition-plusieurs-isolee-20261029`. Analyse approfondie après le changement de niveau de réflexion. **NE PAS FUSIONNER / DÉPLOYER / ACTIVER.**

## Conclusion

- La branche `main` a été contrôlée inchangée depuis le début de la PR (`e82726a4d8c467cba1ef0644c04060077b6e3f51`). Les corrections ne sont pas dans le site élève en production.
- Le catalogue Addition multiple est absent de la base active Math'as Connect lors du contrôle **en lecture seule**. Aucune donnée élève n'a été lue ni modifiée.
- La copie du moteur original est byte-identique à la source (`d2b158a7a32f917316cc43c4dafe78aca6b07893`). Les quatre formats d'événements ont été vérifiés à leurs sites d'émission.
- Les tests de composants et SQL isolés ne démontrent **pas** une intégration Connect de bout en bout. Le jeu ne doit pas être présenté comme terminé.

## Problèmes détectés et corrigés sur la branche

1. **P0 — Activation incomplète possible :** l'ancienne garde serveur ne vérifiait que `connect_apps.enabled`, alors que `refreshXp()` n'autorise encore que trois applications. Une activation prématurée aurait pu enregistrer des résultats sans crédit XP. Ajout du verrou indépendant `ADD_MULTI_SERVER_READY=false`, en plus de `CONNECT_WRITE_READY=false` et du catalogue masqué.
2. **P1 — Simulation de XP instable après rechargement :** l'état du simulateur repartait de zéro. Correction : état, révision et identifiants d'événements conservés en `sessionStorage`, acquittements idempotents, test de reload et de nouveau record.
3. **P1 — Miniature manquante :** l'URL prévue ne pointait vers aucun fichier. Ajout d'une copie bit-identique de l'illustration d'origine en attendant la validation visuelle du format carré.
4. **P1 — Droits de fonctions privilégiées :** le SQL candidat conserve `SECURITY DEFINER`; ajout d'un `REVOKE EXECUTE FROM PUBLIC` explicite et de `GRANT ... TO service_role`, avec test PostgreSQL. Le contrôle en lecture seule du projet actif indique que les quatre RPC existantes sont déjà interdites aux rôles `anon` et `authenticated`.
5. **P2 — Test Chromium erroné :** la première version du test multiévénements utilisait incorrectement `locator.evaluate` (le premier argument du callback est l'élément DOM, non les données envoyées). Correction du test et maintien des diagnostics en cas d'échec. Il ne s'agissait pas d'un deuxième bug de `postMessage` dans le jeu.

## Vérifications positives

- Moteur original inchangé ; fourchette et labels des quatre modes contrôlés.
- Vrai navigateur Chromium : démarrage du moteur et toutes les fins de partie injectées dans le pont natif (4/4, 10/10, 20/20, Mort subite, HARD 5 et HARD Mort subite) validés ; cumul simulé de 158 XP pour un niveau et non-double comptage d'un 4/4 répété. **Ce n'est pas une partie jouée par clics.**
- PostgreSQL 17 isolé : version candidate des quatre fonctions chargée, modèle de crédits, rejets de conflits, isolation de deux élèves, règles 474 XP et permissions du rôle serveur testés.
- Migration de catalogue exécutée deux fois dans une reproduction isolée des contraintes réelles : application désactivée, quatre presets invisibles, neuf règles XP, entrées préexistantes inchangées.
- Vérifications en lecture seule du schéma réel : colonnes, contraintes, droits des fonctions et absence de la nouvelle application au catalogue. Aucune ligne de résultats élève n'a été consultée.
- Suites de régression des trois applications existantes sur la branche vérifiées.

## Bloqueurs majeurs encore ouverts (AVANT TOUTE ACTIVATION)

1. **P0 — Connexion réelle absente :** l'hôte `window.MathasConnectHost` est attendu par le lanceur mais n'est pas fourni actuellement par le HUB. La connexion de classe, le chargement d'état et l'authentification ne sont pas opérationnels dans cette application.
2. **P0 — XP officiels non raccordés :** `refreshXp()` et l'action `student-xp` dans l'Edge excluent `addition-ecrite-multiple` ; la version SQL candidate n'est pas déployée. Exiger validation intégrée et cohérence transactionnelle avant de lever les verrous.
3. **P0 — Persistance locale de l'original non isolée :** les scores, trophées et paramètres du moteur ne sont pas encore migrés et cloisonnés par élève/classe. Sur des PC partagés, cela pourrait mélanger les profils si le Connect était activé tel quel. Reprendre les mécanismes éprouvés des trois jeux intégrés.
4. **P1 — Fonctions professeur et parcours incomplètes :** listes Edge de `student-xp`, `teacher-parcours-restart`, `teacher-parcours-history` et restauration encore limitées aux trois applications. Contrôler résultats, remises à zéro indépendantes et historiques après intégration.
5. **P1 — Trophées et récompenses :** le pont Connect du moteur ne transfère pas encore le vrai `rewards` au serveur. Vérifier la persistance et la non-régression des trophées.
6. **P1 — Jauge XP globale absente :** l'animation actuelle vole vers le texte de résultat du laboratoire, et pas vers la jauge du HUB. Tester les deltas réels, niveaux, animations même en mode mouvement réduit.
7. **P1 — Test PostgreSQL incomplet :** les quatre RPC compilent, mais ne sont pas encore exercées contre une reproduction complète des tables, fonctions et contraintes de production. Les tests transactionnels actuels portent sur des tables de test dédiées.
8. **P1 — Vraie partie non jouée dans Chromium :** les événements de fin sont injectés dans l'API native du moteur ; les clics et saisies d'une série de calculs, les appareils peu puissants, les reconnexions multi-onglets et le tableau de résultats professeur ne sont pas encore validés.
9. **P2 — Présentation :** l'illustration originale copiée comme miniature doit être vérifiée à l'écran selon la taille des cartes.

## Règles de mise en service

- Ne jamais toucher aux trois applications existantes pour « faciliter » l'intégration.
- Garder l'app désactivée au catalogue et invisible dans observation / phase1 / phase2 / 2eco.
- Ne lever ni le verrou du lanceur, ni celui de l'Edge avant les tests connectés et la validation explicite du professeur.
- N'effectuer aucune modification destructive des véritables données élèves. Les essais de crédits/remises à zéro utilisent exclusivement des identités de test dans une base isolée.
- Faire un test manuel avec le professeur avant activation.

## Dernière recette automatisée validée

- Node (contrats et régressions) : https://github.com/Mr-Tat/Mathas-Connect/actions/runs/40915570318 et https://github.com/Mr-Tat/Mathas-Connect/actions/runs/40915570379
- PostgreSQL 17 isolé (RPC, droits, attribution, migration catalogue exécutée deux fois) : https://github.com/Mr-Tat/Mathas-Connect/actions/runs/40915570324
- Chromium réel (pont multiévénements et XP simulés) : https://github.com/Mr-Tat/Mathas-Connect/actions/runs/40915570252

**Verdict de recette :** les tests automatisés disponibles passent, mais les bloqueurs de vraie connexion, stockage par élève, XP officiels, résultats professeur et authentification restent ouverts. Ne pas interpréter « CI verte » comme « prêt à mettre en classe ».
