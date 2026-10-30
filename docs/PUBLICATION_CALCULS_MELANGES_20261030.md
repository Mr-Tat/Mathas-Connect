# Préparation de publication — hors périmètre de la PR draft

30 octobre 2026. **La mission courante est une PR draft complète, testée et non publiée.** Aucune fusion, publication Pages, installation SQL hébergée, livraison Edge, activation ni consultation de données élèves réelles n’est autorisée dans cette étape. Ce document prépare une éventuelle suite ; il ne l’autorise pas.

## Livrables préparés

- `melange-calculs-ecrits` dans `apps/calculs-melanges/`, copie indépendante du moteur source `e11c88b4e449e8cdb17b0fee78c7daa6ea5bf279`.
- Pont terminal unique, preuves 4/10/20 séparées, cache par classe/sujet JWT/élève/app, file offline bornée, ACK corrélé, reçus permanents et XP atomiques côté serveur.
- Session élève approuvée, Monsieur T séparé, résultats/XP propres au jeu/reset professeur et minimums de tables indépendants.
- **594 XP de base validés pédagogiquement**, 198 par niveau, sans modification des autres jeux. L’éligibilité proposée reste trois opérations sélectionnées et au moins deux types réellement terminés ; elle se distingue de la validation du montant maximal.
- Trois constantes compilées conservées à `false` : `CONNECT_WRITE_READY`, `MIXED_SERVER_READY`, `MIXED_TEACHER_READY`. App désactivée, quatre presets invisibles et catalogue statique inchangé.
- Portée Edge supplémentaire `CONNECT_MIXED_ACCESS=closed` par défaut ; `pilot:<uuid-classe-fictive>` et `open` sont préparés pour une phase ultérieure. Cette portée ne remplace jamais l’authentification ni l’approbation.
- Candidat SQL additif avec cinq nouvelles RPC privées ; aucune des quatre RPC historiques n’est remplacée. Patch d’ouverture des constantes et arrêt non destructif préparés, non appliqués.
- Sauvegarde chiffrée : les deux tables privées Mélange sont incluses après installation du catalogue ; leur lecture manquante empêche une sauvegarde incomplète. Le backup de production n’est pas exécuté pour tester ce code.

## Développement et PR sans accès Supabase hébergé

Aucun jeton personnel Supabase n’est nécessaire. Les recettes utilisent les migrations, contrats et fixtures du dépôt, PostgreSQL et les services officiels GoTrue/PostgREST/Edge Runtime/Kong locaux, avec des identités fictives. Les SDK sont installés dans l’outillage externe au dépôt. Les constantes Connect ne sont ouvertes que dans des copies jetables connectées au laboratoire loopback.

Les outils de préparation sont entièrement hors ligne :

```sh
node scripts/calculs-melanges-release.mjs plan
node scripts/calculs-melanges-release.mjs schema-query --output /tmp/mathas-mixed-schema-readonly.sql
node scripts/calculs-melanges-release.mjs check-report /tmp/mathas-mixed-schema.json --stage before-install
```

`plan` trace le commit, les constantes et les empreintes des fichiers. `schema-query` exporte une transaction READ ONLY, sans l’exécuter. `check-report` analyse un JSON fourni et indique explicitement que sa provenance n’a pas été vérifiée par une requête hébergée dans cette session. L’ancien appel direct à l’API Supabase est retiré. Une absence de jeton ne bloque aucune de ces commandes.

Le professeur rapporte avoir confirmé le projet actif `awmhpfofacaglewammxt`, ses migrations/tables/Edge et les quatre RPC historiques depuis une autre conversation disposant des connexions autorisées. Cette information est distinguée des tests locaux effectivement exécutés ici. Elle n’impose aucune nouvelle lecture de production pour terminer la PR.

## Contrôles de publication à faire plus tard

La [fiche de lecture seule](CALCULS_MELANGES_CONTROLES_LECTURE_SEULE.md) donne les métadonnées exactes à demander via la connexion déjà autorisée du professeur. Aucun résultat, identité, appareil ou crédit élève n’est demandé.

Avant toute nouvelle autorisation de publication : comparer le schéma cible (types, index, valeurs par défaut, contraintes et triggers), le namespace Mélange, les droits des fonctions et tables, puis la version/source actuellement déployée de `connect-results` et son réglage `verify_jwt`. Ces vérifications préviennent l’écrasement d’une évolution hébergée ; elles ne sont pas des prérequis de compilation ou de tests locaux.

Les choix restant à fixer concernent l’éligibilité par variété d’opérations, les aides, la portée indépendante/globale des tables et la miniature officielle. Le plafond 594 est déjà validé. La miniature native provisoire est tracée ; le journal est borné à 1 000 calculs et avertit au-delà en conservant le score natif localement. Le guidé normal et le challenge HARD cachés ne sont pas réactivés artificiellement.

## Opérations futures nécessitant une instruction explicite distincte

1. Installer le seul `supabase/release-candidates/calculs_melanges_locked_v1.sql` dans une migration contrôlée et enregistrée, après comparaison de l’historique réel. App désactivée et quatre presets invisibles à la sortie. Ne pas employer `supabase db push` ni rejouer l’historique.
2. Préparer une classe et des identités fictives de recette, puis configurer la portée Edge `pilot:<uuid>` sur cette seule classe. Aucune réaffectation d’élève réel.
3. Revoir le patch `calculs_melanges_connect_enable.patch`, qui ouvre uniquement les trois constantes ; vérifier sa compatibilité par `git apply --check`. Adapter les attentes des tests à cette nouvelle phase. Comparer puis déployer uniquement `connect-results`, en préservant sa configuration JWT et les routes des autres jeux ; ne pas utiliser `--prune`.
4. Fusionner la PR revue et publier les fichiers statiques selon la configuration Pages effectivement constatée. Un push de branche et une PR draft ne constituent pas cette publication.
5. Activer le pilote avec `calculs_melanges_enable_hidden.sql` après contrôles. Le fichier refuse les règles XP divergentes, les signatures RPC manquantes, les droits publics et tout preset déjà visible. L’Edge refuse les classes hors pilote, même par URL directe.
6. Effectuer la recette hébergée : approbation, vraie saisie, ACK +28 sans doublon, refresh/reload, second appareil fictif, offline/reconnexion, deux ordres 4/10/20, résultats/reset/XP professeur, Monsieur T et tables minimales. Tous les catalogues doivent rester masqués.
7. Seulement sur ouverture choisie par le professeur : portée Edge `open` ou liste des classes retenues, puis visibilité individuelle dans la matrice GLOBAL pour Observation, Phase 1, Phase 2 et 2 ECO. Vérifier chaque catalogue après son cache de 60 secondes.

## Retour arrière préparé

Après une éventuelle publication future : fermer la portée Edge (`closed`), puis appliquer `calculs_melanges_disable_only.sql` pour désactiver l’app et masquer ses presets sans effacer résultats, XP, reçus, réglages ni archives. Refermer les constantes dans une livraison revue si nécessaire. Les acquis et files restent conservés ; les reçus empêchent les doubles crédits lors d’une reprise. Ce retour arrière a été testé en base jetable, pas exécuté sur le projet hébergé.
