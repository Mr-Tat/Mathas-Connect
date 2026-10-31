# Roadmap de mutualisation — réduire le temps sans refactor dangereux

**Ce document est une proposition**, pas un état déployé ni une autorisation de modifier les jeux. La première optimisation est **d'arrêter de reproduire l'audit, les imports et les mêmes tests** dans chaque conversation.

| Priorité | Outil / composant proposé | Ce qui devient commun | Ce qui reste propre au jeu | Critère avant développement |
| --- | --- | --- | --- | --- |
| **P0 / prochain jeu** | `scripts/connect-integration-preflight` (lecture seule) | HEADs, migrations, objets SQL, Edge versions, flags, matrices, SHA, limites de droits, audit de dérive | `app_key`, schema/versions, barème | Aucun accès aux résultats réels, sorties sans secrets, tests sur instantané |
| **P0 / prochain jeu** | `tests/integration-contract` paramétrable | UUID, borne, identity binding, reset epoch, ACK, offline, idempotence, conflits et autorisations | Preuves pédagogiques, interprétation aide/Master, menus | Rejouer au moins Mélange et Addition sans modifier leurs contrats |
| **P1** | Mini-librairie `connect-client` : scope/queue/ACK/transport | Validation identités, file bornée, drainage sans polling, relecture ACK, erreurs 401/403/409, isolation libre/Connect | Hook de fin, records et hydratation, score, sélection initiale | Tests d'injection d'erreur et rétrocompatibilité des stockages actuels |
| **P1** | Commande `integration-verify` à profils | Lint manifestes/liens, SHA source, miniatures, tests ciblés locaux vs HTTP live, catalogue et CI | Scénarios vrais claviers, longueur/méthodes/tables | CI sous minute pour docs; suites lourdes déclenchées au code |
| **P1** | `release-manifest` et générateur de rapport | Compare migration/Edge/Pages/PR, droits RPC, déploiement par étapes, retrait non destructif | SQL spécifiques, version et signatures actives | Pas d'exécution SQL par défaut, refuse drift / idempotence |
| **P2** | Interface commune de rendu XP | Popup depuis ACK, vol vers jauge, niveau affiché, états pending/offline | Style et rythme du moteur original | Tests navigateur accessibilité et préférences professeur |
| **P2** | Adaptateurs professeur par capacités | Résumé/détail, reset scoped, matrices GLOBAL et réglages propres | Tables minimales, modes, records/déblocages | Contrats stables et absence de régression sur les jeux existants |
| **P3, seulement après 2–3 jeux** | Registre typé côté Edge / RPC de résultat par famille | Déclaration app_key, versions, routage et validations communes | Preuves avancées, algorithmes, règles XP, transactions particulières | Revue sécurité et migration incrémentale, jamais refonte Big Bang |

## Ce qu'on ne doit surtout pas mutualiser

- Les fonctions internes de génération, calculs, reports, méthodes de soustraction, score natif ou aides pédagogiques.
- Les noms de stockage natifs, cache de trophées, état de Master et granularité des records.
- Une grille « 9 jalons / 474 XP » par automatisme, ni la règle « sélection 25/50/100 » hors Mélange.
- Les commandes SQL de publication ou de rollback de l'application précédente.

## Plan de travail frugal

1. **Maintenant :** ce guide + templates + preuves ; aucun runtime modifié. C'est le plus gros gain de temps.
2. **Prochaine intégration :** copier le protocole file/ACK avec tests communs et extraire un validateur **pur**, si les différences entre moteurs le permettent. Commencer par deux exemples avec types et scénarios dissemblables.
3. **Ensuite :** script audit read-only et manifeste de release vérifiable en CI ; jamais une commande qui déploie par défaut.
4. **Après retour d'expérience :** isoler un petit composant partagé versionné sans casser les caches de joueurs actuels ; conserver des adaptateurs par jeu et des tests de compatibilité.
5. **Collaboration :** une branche et un responsable de fusion par app. Les autres agents produisent PR séparées ou patches non concurrents ; ne jamais modifier simultanément `connect-results/index.ts` ou SQL candidats sans coordination. Transmettre SHAs, état, tests et étape suivante dans [le modèle](TEMPLATE_PASSAGE_FLAMBEAU.md).

## Mesures utiles pour confirmer le gain

Temps « audit → première copie libre », « copie → premier E2E local », « PR → recette labo », nombre de reprises de bug, appels Supabase par partie, taille d'assets, volume de file et régressions sur autres jeux. Collecte **agrégée sur profils fictifs**, jamais télémétrie des frappes d'élèves. Une mesure vaut mieux qu'une « optimisation » qui ajoute de la complexité sans gain.