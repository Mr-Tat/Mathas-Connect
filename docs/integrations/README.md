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

## 🧪 Déployer d'abord dans le HUB du Laboratoire pour tester

**Règle permanente — 1er novembre 2026, validée par le professeur.** Le Laboratoire est précisément l'espace prévu pour **déployer et essayer une nouvelle version d'un jeu avant son ouverture officielle**, avec la classe fictive « Classe démo - TEST ». Il n'est **pas nécessaire** de rendre d'abord les nouveautés visibles dans Observation, Phase 1, Phase 2 ou 2 ECO. Un essai peut être publié dans la rubrique expérimentale du HUB test, puis retiré sans toucher aux quatre HUB normaux.

**Deux niveaux de test, à distinguer dans chaque compte rendu :**

1. **Démonstration visuelle ou de moteur, isolée.** Publier une page d'essai sur GitHub Pages, puis la référencer dans la rubrique d'essais **réservée à l'affichage du HUB de la classe TEST** et dans `laboratoire.html`. Garder la mention **« XP fictifs · aucun résultat Connect »**. Ne pas introduire son lien dans le catalogue des applications officielles, ne pas réutiliser l'`app_key` officielle pour créditer, et ne pas annoncer que le jeu est intégré à Connect. Les URL GitHub Pages demeurent accessibles directement par toute personne connaissant l'adresse : **le HUB de test n'est pas une protection d'accès à la page statique**.
2. **Pilote authentifié Connect.** Après vérification des contrats, déployer le moteur intégré et, si nécessaire et autorisé, la partie serveur avec garde-fous ; rendre la carte visible **seulement** via le catalogue indépendant `connect-lab-catalog` / `connect_lab_hub_visibility`. Tester une vraie session fictive approuvée, les reçus/XP et les restrictions professeur avec un navigateur hébergé. **Une page d'essai sans backend ne remplace jamais cette recette.**

**Chemin de test :** espace professeur → `laboratoire.html` → classe TEST vérifiée → confirmation que les profils sont fictifs → « 🏆 Objectif record — essais » ; ou « Ouvrir le HUB test » → rubrique « 🏆 Objectif record — essais ». Le HUB test reste séparé de ses applications Connect classiques, de leurs droits et du catalogue global. Les essais peuvent y être affichés sans déployer de SQL/Edge ou activer les nouveaux XP, tant qu'ils restent totalement isolés. Ne pas ajouter automatiquement les liens d'essai aux quatre espaces officiels.

**Cas livré le 01/11/2026 :** les cinq pages d'essai « Objectif record » (Addition simple, Addition multiple, Soustraction, Multiplication simple, Mélange) sont référencées par `objective-record-lab-previews.mjs` et apparaissent **uniquement dans le HUB de la classe TEST** et sur la page professeur du Laboratoire. Leur publication n'implique aucune activation réelle des nouveaux modes dans les lanceurs Connect ni du registre XP candidat.

## Interdictions permanentes

- Pas d'XP décidés par un navigateur ni obtenus sur rechargement ; aucune écriture cloud en mode libre.
- Ne pas réutiliser les profils, caches, droits, `app_key`, tables ou crédits d'un autre jeu ; ne pas réinitialiser les élèves réels.
- Pas de `supabase db push` global sur cet historique sans rapprochement préalable des migrations ; pas de double enregistrement manuel/outil des migrations ; pas de RPC `SECURITY DEFINER` ouverte aux clients.
- Pas de fusion précipitée Pages = Edge = SQL : leurs déploiements sont **distincts**. Une URL directe sur Pages demeure publiquement accessible, même sans carte HUB.
- Ne jamais présenter un test Node, une fixture Auth, un GET catalogue ou un appareil approuvé en base comme une session élève **réellement** authentifiée dans un navigateur hébergé.

## Décision réutilisable : Objectif record, 3 vies, XP restants

Pour les futures applications qui disposent des capacités correspondantes, suivre le [patron commun Objectif record](PATRON_REUTILISABLE_OBJECTIF_RECORD_3_VIES_XP_20261101.md) : carte renommée, deux modes 3 vies et Mort subite, cœurs animés, petits cadres, badge +20 % de points, et « Reste N XP » en bas à droite des boutons exclusivement quand le serveur confirme une session Connect approuvée et les droits restants. Ne pas copier les XP du prototype fictif dans le jeu vivant. Les mécanismes de score et les crédits sont par application, sur preuves serveur.

**Pour Mélange, la sélection exacte des opérations + / − / ×, le nombre de types sélectionnés, le nombre de calculs 4/10/20 et le niveau influencent potentiellement les XP restant accessibles.** Ne pas appliquer une simple multiplication ou division par le nombre de types ; vérifier les jalons du contrat Mélange. Voir le [prompt de mise en œuvre pour les cinq jeux](PROMPT_DEPLOIEMENT_OBJECTIF_RECORD_5_APPS_20261101.md). Le patron reste au stade de prototype isolé, sans mise en production des nouveaux XP.

## Contrat de sortie : quand une intégration est terminée

Le moteur libre et ses variantes pédagogiques fonctionnent ; le nouveau jeu et les anciens sont isolés ; identité/révocation, scores, restauration, idempotence et XP réels sont testés ; GLOBAL/professeur, Monsieur T et laboratoire sont cohérents ; la recette publiée a un **journal de preuves** (réussi/échoué/non exécuté, URL, commit, Edge, migration, profil fictif) ; publication autorisée et rollback de ce jeu seul prêts ; le guide a reçu les nouveaux pièges. Sinon la livraison reste **candidate** ou **pilote**, jamais « définitive ».

## Navigation

- [Référence technique : architecture, XP, états, sécurité, professeur, performances](REFERENCE_TECHNIQUE.md)
- [Contrat commun scores, XP et trophées permanents](CONTRAT_COMMUN_SCORES_XP_TROPHEES.md)
- [Projet « Objectif record » : prototype Addition simple (01/11/2026)](PROJET_DEFIS_SCORE_3_VIES_20261101.md)
- [Patron réutilisable Objectif record : 3 vies, XP restants et Mélange](PATRON_REUTILISABLE_OBJECTIF_RECORD_3_VIES_XP_20261101.md)
- [Prompt de travail : intégrer Objectif record aux cinq calculs écrits](PROMPT_DEPLOIEMENT_OBJECTIF_RECORD_5_APPS_20261101.md)
- [Déploiement des compteurs trophées / XP du parcours (31/10/2026)](DEPLOIEMENT_TROPHEES_20261031.md)
- [Erreurs connues, causes et contre-mesures](RETEX_ERREURS.md)
- [Tests, preuves, publication et retour arrière](RECETTE_ET_PUBLICATION.md)
- [Fiche à remplir pour une nouvelle application](TEMPLATE_FICHE_APPLICATION.md)
- [Passage de flambeau entre conversations](TEMPLATE_PASSAGE_FLAMBEAU.md)
- [Feuille de route de mutualisation et automatisation](AUTOMATISATION.md)
- [Sources vérifiées, contradictions et statut des anciens conseils](SOURCES_ET_STATUT.md)

## Entretien du guide

À chaque jeu, la PR technique complète sa **fiche**, ses **preuves** et uniquement les règles du guide que l'expérience a réellement fait évoluer ; versionner la date et l'exemple test associé. Éviter d'ajouter des copies de passages périmés. Le modèle d'application est la **spécification locale** ; ce guide est le **contrat commun**. En cas de divergence, bloquer l'ouverture, vérifier la source LIVE, et noter le résultat dans la PR.