# Guide permanent — intégrer une application dans Math’as Connect

**Version 1.0 — 31 octobre 2026.** Destiné au professeur, à ChatGPT et à Codex. **Cette page est la procédure à suivre**, pas l'historique d'un jeu. Le dépôt et les services évoluent : vérifier leurs versions à chaque mission.

> **Principe : ajouter un jeu, pas réécrire Math’as Connect.** Préserver son moteur, ses modes et sa pédagogie ; brancher un adaptateur minimal au système Connect. Un outil pédagogique peut être intégré **sans XP**.

## Démarrage rapide : huit étapes, trois véritables portes

1. **Lire l'état réel et fixer les capacités.** Identifier `main`, PR concurrentes, repo moteur, sa version/empreinte, état serveur de la nouvelle `app_key`, Git push/PR, lecture Supabase, écriture Supabase, navigateur local et navigateur **hébergé authentifié**. Tester l'accès existant avant de réclamer un token. Aucune écriture pour cet audit. Remplir la [fiche d'application](TEMPLATE_FICHE_APPLICATION.md).
2. **Auditer le moteur avant de coder.** Jouer ses modes réellement atteignables, comparer 4/10/20 ou autres durées, scores, aides, Master, méthodes, déblocages, trophées différés, chemins de fin, callbacks, cache natif et réglages. Choisir ce qu'est **une unité terminée**. Décider avec le professeur uniquement les points pédagogiques réellement ambigus.
3. **Copier sans casser.** Figurer dans `apps/<slug>/` avec manifeste source (commit et SHA-256), copie du moteur, lanceur/bridge propres et miniatures officielles optimisées. Ne modifier la copie native que pour des hooks ou bugs indispensables, documentés ; le dépôt d'origine reste intact. Mode libre sans identité/XP/réseau Connect.
4. **Créer le contrat et les tests.** `app_key` stable, fin émise une fois, UUID, schéma/version, session approuvée, options prises **au départ**, bornes du score, preuve des modes et aides. Stockage par app + libre/Connect + identité serveur + époque. Définir état/hydratation et tests vrais clavier avant SQL.
5. **Décider XP et synchronisation.** Barème **par application**, versionné et chiffré ; jalons uniques, compléments, arrondis cumulés, répétition à 0, cas Master/reset. Définir l'éventuel mode sans XP. Écriture atomique serveur état + reçu + XP, comparaison révision/époque, file locale bornée jusqu'à ACK exact. Voir [référence](REFERENCE_TECHNIQUE.md).
6. **Fermer les boucles professeur/HUB.** Résultats compacts et détail, réglages de classe/élève et minimums de tables s'ils existent, GLOBAL (4 espaces), séparation Monsieur T, historique/reset limité à **la seule** application. Le catalogue du laboratoire est indépendant. Miniature, poids et contrôle 320 px.
7. **Tout prouver avant publication.** Node/contrats → PostgreSQL jetable (atomicité, droits, concurrence, échec tardif) → Auth + Edge locaux → Chromium **sur vrai moteur au clavier** → régression existante. Préparer migration/version/manifestes, plan d'arrêt. Créer une PR au diff étroit. **Porte A :** aucun risque P0, contrats et CI réussis sur SHA exact.
8. **Livrer sans surprises.** Installation SQL gardée **désactivée et masquée**, Edge du SHA approuvé, publication Pages contrôlée ; recette de **vraie session navigateur authentifiée fictive** dans le laboratoire puis accès scolaire selon décision. **Porte B :** essai hébergé prouvé, pas de simple mock ; **porte C :** feu vert pédagogique d'ouverture, quatre catalogues et caches vérifiés. À la fin : RETEX et [passage de flambeau](TEMPLATE_PASSAGE_FLAMBEAU.md).

Ces étapes sont des **lots de travail**, pas huit demandes d'accord : mener tous les audits, tests et PR permis en autonomie. Solliciter le professeur **seulement** pour un barème ou un choix pédagogique non tranché, une session réelle qu'aucun outil ne peut ouvrir, une permission/secret indispensable, une opération de production non autorisée ou une anomalie bloquante.

## Interdictions permanentes

- Pas d'XP décidés par un navigateur ni obtenus sur rechargement ; aucune écriture cloud en mode libre.
- Ne pas réutiliser les profils, caches, droits, `app_key`, tables ou crédits d'un autre jeu ; ne pas réinitialiser les élèves réels.
- Pas de `supabase db push` global sur cet historique sans rapprochement préalable des migrations ; pas de double enregistrement manuel/outil des migrations ; pas de RPC `SECURITY DEFINER` ouverte aux clients.
- Pas de fusion précipitée Pages = Edge = SQL : leurs déploiements sont **distincts**. Une URL directe sur Pages demeure publiquement accessible, même sans carte HUB.
- Ne jamais présenter un test Node, une fixture Auth, un GET catalogue ou un appareil approuvé en base comme une session élève **réellement** authentifiée dans un navigateur hébergé.

## Contrat de sortie : quand une intégration est terminée

Le moteur libre et ses variantes pédagogiques fonctionnent ; le nouveau jeu et les anciens sont isolés ; identité/révocation, scores, restauration, idempotence et XP réels sont testés ; GLOBAL/professeur, Monsieur T et laboratoire sont cohérents ; la recette publiée a un **journal de preuves** (réussi/échoué/non exécuté, URL, commit, Edge, migration, profil fictif) ; publication autorisée et rollback de ce jeu seul prêts ; le guide a reçu les nouveaux pièges. Sinon la livraison reste **candidate** ou **pilote**, jamais « définitive ».

## Navigation

- [Référence technique : architecture, XP, états, sécurité, professeur, performances](REFERENCE_TECHNIQUE.md)
- [Erreurs connues, causes et contre-mesures](RETEX_ERREURS.md)
- [Tests, preuves, publication et retour arrière](RECETTE_ET_PUBLICATION.md)
- [Fiche à remplir pour une nouvelle application](TEMPLATE_FICHE_APPLICATION.md)
- [Passage de flambeau entre conversations](TEMPLATE_PASSAGE_FLAMBEAU.md)
- [Feuille de route de mutualisation et automatisation](AUTOMATISATION.md)
- [Sources vérifiées, contradictions et statut des anciens conseils](SOURCES_ET_STATUT.md)

## Entretien du guide

À chaque jeu, la PR technique complète sa **fiche**, ses **preuves** et uniquement les règles du guide que l'expérience a réellement fait évoluer ; versionner la date et l'exemple test associé. Éviter d'ajouter des copies de passages périmés. Le modèle d'application est la **spécification locale** ; ce guide est le **contrat commun**. En cas de divergence, bloquer l'ouverture, vérifier la source LIVE, et noter le résultat dans la PR.