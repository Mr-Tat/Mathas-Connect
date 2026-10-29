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
3. **P0 — Persistance locale de l'original : protection préventive ajoutée, hydratation serveur encore ouverte.** Le lanceur injecte un adaptateur de stockage en premier, sans changer le moteur original : clés `addition2_*` et `mathas_*` cloisonnées pour Libre, Simulation et chaque couple classe/élève (localStorage **et** sessionStorage pour le mode maître). Chromium contrôle Libre/Simulation sur un même navigateur ; le test Node simule deux élèves et deux classes. **Reste indispensable :** recharger les records connectés depuis `student-load`, éviter toute divergence locale/serveur et faire un E2E authentifié avant activation.
4. **P1 — Fonctions professeur et parcours incomplètes :** listes Edge de `student-xp`, `teacher-parcours-restart`, `teacher-parcours-history` et restauration encore limitées aux trois applications. Contrôler résultats, remises à zéro indépendantes et historiques après intégration.
5. **P1 — Trophées et récompenses :** le pont Connect du moteur ne transfère pas encore le vrai `rewards` au serveur. Vérifier la persistance et la non-régression des trophées.
6. **P1 — Jauge XP globale absente :** l'animation actuelle vole vers le texte de résultat du laboratoire, et pas vers la jauge du HUB. Tester les deltas réels, niveaux, animations même en mode mouvement réduit.
7. **P1 — Test PostgreSQL incomplet :** les quatre RPC compilent, mais ne sont pas encore exercées contre une reproduction complète des tables, fonctions et contraintes de production. Les tests transactionnels actuels portent sur des tables de test dédiées.
8. **P1 — Vraie partie non jouée dans Chromium :** les événements de fin sont injectés dans l'API native du moteur ; les clics et saisies d'une série de calculs, les appareils peu puissants, les reconnexions multi-onglets et le tableau de résultats professeur ne sont pas encore validés.
9. **P2 — Présentation :** l'illustration originale copiée comme miniature doit être vérifiée à l'écran selon la taille des cartes.
10. **P1 — Synchronisation à deux parties : correctif ajouté.** Le protocole lit de nouveau la file après chaque acquittement au lieu de figer un instantané; un calcul terminé durant la requête HTTP précédente est envoyé dans la même exécution, sans polling. Un test asynchrone reproduit le cas et conserve les gardes de révision / epoch.

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

## Réparations complémentaires sur cette branche

- Isolation des données natives **avant** tout script du jeu, via `apps/addition-plusieurs/storage-scope.js` injecté en tête du `srcdoc`; moteur original non modifié. Ne pas supprimer cette protection lors du futur branchement authentifié.
- Le fichier `game-original.html` et les visuels sources restent conservés ; le mode libre conserve les fonctionnalités, mais désormais dans un espace distinct du reste du site.
- Correction de la file hors ligne pour vider aussi les nouvelles parties arrivées pendant une requête en cours. Aucun polling, une requête en vol.
- Tests Playwright : même contexte navigateur libre + simulation ; vérifications de la séparation des clés natives et du mode maître. Tests VM : deux élèves, deux classes et validation stricte de l'identité de stockage.
- Malgré ces réparations, les verrous serveur/client et le statut de brouillon restent en place. **Ne pas activer sans intégration des XP officiels, hydratation de l'état serveur, et recette professeur.**

## Mise à jour : connexion et jauge préparées (29 octobre 2026)

- Le lanceur ne dépend plus de window.MathasConnectHost, qui n'existait pas dans le HUB. Nouveau module connect-host.mjs : reprise de la session Supabase déjà utilisée par le site, vérification du profil approuvé, profil séparé du professeur, chargement de parcours et lecture XP. Vérifications avec fausses réponses HTTP seulement ; aucun accès authentifié à la nouvelle application en production.
- Nouveau connect-hydration.mjs : conversion de la sauvegarde serveur en formats de records natifs du moteur (classiques, mort subite, HARD et progression). L'import est bloqué si des résultats hors connexion restent à synchroniser. Testé sans données élèves.
- Barre XP en haut du lanceur, dont le total vient du serveur en mode Connect et du simulateur en laboratoire. Les gains volent vers la jauge, puis la jauge se met à jour ; les vols sont exécutés dans l'ordre. Vérification Chromium avec 158 XP et niveau 4.
- Côté Edge, les actions de lecture XP et de parcours professeur sont préparées derrière le verrou ADD_MULTI_SERVER_READY=false. Les applications existantes restent autorisées comme avant.
- Important : les verrous restent fermés. Il manque encore les migrations RPC réelles, les essais authentifiés de bout en bout, la concordance des trophées et la vérification manuelle professeur.

## Recette PostgreSQL et affichage professeur — complément

- **Testé dans PostgreSQL 17 éphémère** : la vraie définition candidate de `connect_xp_sync_v2`, `connect_xp_read_v2`, `connect_parcours_restart_one` et `connect_parcours_restart_class` s'exécute désormais sur des tables reproduisant les colonnes et contraintes vérifiées en lecture seule sur Supabase. Ce n'est plus seulement le modèle de crédits simulé.
- **Deux élèves fictifs et une application existante :** premier 4/4 = +22 XP, second élève 8/10 = +30 XP, lecture des XP globaux avec +22 XP historiques d'Addition simple, pas de crédit doublé, états visibles dans la même structure que les résultats professeur.
- **Parcours professeur :** archivage, remise à zéro indépendante, XP historiques conservés, refus de re-crédit sans autorisation, autorisation explicite de rejeu, remise à zéro de classe pour deux élèves. La révision de l'autre application reste inchangée.
- **Interface professeur préparée dans `app.js` :** tableau global, tableaux détaillés par niveau et commandes de recommencement acceptent Addition multiple **uniquement** si `ADD_MULTI_TEACHER_READY=true`. Ce verrou reste `false` ; pas de quatrième colonne visible aux professeurs pour l'instant. Le HUB principal et le catalogue visible restent inchangés.
- **Important :** la recette SQL utilise le candidat RPC dans une base de test, pas une fonction déployée sur les données réelles. Le parcours complet `authentification → Edge → RPC → affichage professeur` et les trophées restent non validés. Maintenir les verrous du navigateur, de l'Edge et de la page professeur jusqu'à la recette supervisée.
- Test réel des RPC : https://github.com/Mr-Tat/Mathas-Connect/actions/runs/40925072304

## 29 octobre — transaction atomique et navigateur Connect (complément)

- Un test Playwright supplémentaire exécute maintenant le véritable lanceur Connect, l'adaptateur de session, la file durable, l'envoi HTTP Edge, l'acquittement XP et le rechargement des records dans Chromium. Il intercepte localement les réponses du fournisseur d'authentification et d'un faux serveur Edge ; les verrous ne sont ouverts **que dans le navigateur de test**. Aucune donnée ni Edge de production n'est utilisée. Le 4/4 donne 22 XP, une seconde tentative identique donne 0 XP supplémentaire, le rechargement restitue le 4/4 et la jauge.
- Risque réel identifié : l'ancien Edge enregistrait `connect_states` puis appelait séparément `connect_xp_sync_v2`. Une erreur après la première écriture pouvait enregistrer une réussite sans validation du crédit XP dans la même transaction.
- Réparation candidate : `connect_addition_multiple_record_v1` est une fonction PostgreSQL transactionnelle réservée au rôle `service_role`. Elle vérifie révision / resetEpoch, gère l'idempotence, écrit le record puis appelle `connect_xp_sync_v2` dans **la même transaction SQL**. En cas d'échec du crédit, l'enregistrement de l'événement et sa révision sont également annulés. Un test PostgreSQL déclenche volontairement une erreur XP, vérifie le rollback complet, puis retente la partie, avec gain 30 XP une seule fois.
- Le chemin `game-record` d'Addition multiple dans l'Edge appelle exclusivement cette fonction, **derrière** `ADD_MULTI_SERVER_READY=false`. Les trois applications déjà actives conservent leur comportement et leur chemin de code.
- Les trophées n'étant pas encore intégrés dans cette fonction transactionnelle, le serveur les refuse explicitement au lieu d'accuser réception d'une récompense ignorée.
- Autre correction : après un `resetEpoch` professeur, les événements hors ligne du parcours précédent sont archivés sous le même profil local, sans être rejoués dans le nouveau parcours. Celui-ci peut ainsi démarrer. Un échec du stockage de cette archive conserve la file initiale intacte ; l'archive est limitée à 100 enregistrements sans suppression silencieuse.
- **Important pour la mise en service :** la fonction atomique est encore un candidat SQL situé dans `tests/postgres/`, pas une migration déployée. La recette entre une vraie session Supabase, un serveur Edge de test déployé, une véritable base de test et la page professeur reste à réaliser. Le catalogue, le pilote client, l'Edge et la page professeur demeurent verrouillés.

## Trophées V3 d'origine — intégration testée sur la branche

- Le moteur original V6.0.2 utilise la clé locale `mathas_trophies_v3_addition-plusieurs` et la même structure V3 (maîtrise 4/10/20, mort subite, trois catégories HARD, trois records de points et déblocage or) que les autres jeux déjà intégrés.
- Le pont `audit-bridge.js` lit ce trophée au tour d'événement suivant la fin de partie, car le jeu original met à jour ses trophées **après** l'appel au callback natif `__setLastWork`. Test Chromium reproduisant explicitement cet ordre d'exécution.
- Le contrat `completion-contract.mjs` valide la structure complète et transmet uniquement les récompenses valides; le serveur Edge valide lui aussi avec son `normalizeRewards` existant.
- La fonction candidate transactionnelle `connect_addition_multiple_record_v1` reçoit `p_rewards jsonb`, refuse tous les champs manquants, valeurs non booléennes, longueurs incorrectes ou versions étrangères, puis fusionne les trophées avec les acquis en utilisant un `OU` logique. Sauvegarde du score, des XP et du trophée dans **une seule transaction** ; une erreur XP annule aussi le trophée et la révision.
- La récupération de l'état serveur restaure `mathas_trophies_v3_addition-plusieurs` dans la bonne identité classe/élève, sans mélanger les PC partagés. Lors d'un nouveau parcours remis à zéro par le professeur, les trophées locaux du parcours précédent sont effacés; les XP acquis restent dans leur crédit serveur séparé.
- Tests Node et PostgreSQL en base éphémère : persistance, merge monotone, doubles sauvegardes, mauvaises structures, données absentes, permissions `service_role` et isolation. Tests Chromium : transfert avec faux serveur Edge et reprise du trophée après rechargement.
- **Restant avant activation :** vraie recette Edge/Supabase authentifiée dans un environnement isolé avec utilisateurs fictifs et interface professeur, puis test manuel des célébrations visuelles et d'une partie terminée par les vraies saisies. Les verrous `CONNECT_WRITE_READY=false`, `ADD_MULTI_SERVER_READY=false` et `ADD_MULTI_TEACHER_READY=false` demeurent fermés; aucune migration n'est déployée.
