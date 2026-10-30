# Calculs mélangés — préparation du pilote, sans publication

30 octobre 2026. La consigne actuelle maintient l’interdiction de fusion, installation SQL hébergée, déploiement et activation sans autorisation distincte. Ce document prépare un lot reviewable ; il ne l’autorise pas. Aucun accès ni changement de données élèves réelles.

## État technique

`melange-calculs-ecrits` est une application indépendante dans `apps/calculs-melanges/`, issue du moteur `e11c88b4e449e8cdb17b0fee78c7daa6ea5bf279`. Le pont terminal, les preuves 4/10/20, l’isolation classe/JWT/élève/app, la file offline, l’ACK, les reçus durables et l’atomicité état/XP sont préparés. Les sessions élève approuvé et Monsieur T, résultats/reset professeur et tables obligatoires par classe ou élève sont testés localement.

Les trois constantes restent `false` : `CONNECT_WRITE_READY`, `MIXED_SERVER_READY`, `MIXED_TEACHER_READY`. `CONNECT_MIXED_ACCESS` vaut `closed` par défaut ; les valeurs pilote et `open` n’ajoutent aucun droit d’identité. Le catalogue statique ne contient aucune carte Mélange et les quatre presets du candidat sont invisibles.

Le [barème validé](CALCULS_MELANGES_XP_SELECTION_20261030.md) conserve 594 XP : trois opérations cochées au départ donnent 100 %, une ou deux donnent 50 %, puis une réussite complète peut verser seulement le complément. Le tirage chanceux ne réduit pas le taux. Les aides suivent la convention existante ; les tables sont propres à Mélange, sans modifier Multiplication simple. La miniature native demeure provisoire et doit être approuvée ou remplacée avant visibilité publique de sa carte. Le pilote masqué n’en dépend pas.

Le candidat ajoute cinq RPC privées et deux tables RLS. Il ne remplace aucune fonction historique ni ne rééquilibre les autres jeux. La sauvegarde chiffrée inclut les deux nouvelles tables dès que l’app est installée ; une lecture manquante refuse un backup incomplet. Aucun backup de production n’est exécuté pour les tests.

## Compatibilité déjà vérifiée

Les deux JSON complets transmis par le professeur après READ ONLY/ROLLBACK ont permis de clôturer les contrôles : PostgreSQL 17.11, 26 tables, 137 contraintes, namespace Mélange libre et quatre presets parents existants. Les deux watchers exacts ont été relus, leurs empreintes concordent et le candidat actualisé a été testé sous leurs définitions dans une base locale jetable. Ils ne font que notifier PostgREST, sans modifier données ou droits. La [fiche de provenance](CALCULS_MELANGES_CONTROLES_LECTURE_SEULE.md) conserve les empreintes et limites.

Le rapport externe confirme une correspondance exacte des sources Edge avec main : `connect-results` v39, `verify_jwt=true` ; `connect-catalog` v2, `verify_jwt=false`. Le catalogue est inchangé dans la PR et ne nécessite pas de déploiement. Pages a publié `91bcca7aba97d9fb00460a7e4ff56a0675f1459b` depuis main à la racine, selon les logs transmis. Main est rapportée non protégée : une fusion doit être traitée comme une publication Pages, sans compter sur un blocage automatique.

Cette session a analysé les fichiers et exécuté les recettes locales. Elle n’a pas effectué ces lectures Supabase hébergées ni une recette publiée. Aucune nouvelle demande de métadonnées ou de jeton personnel n’est nécessaire pour poursuivre la préparation sur ces références.

## À finaliser avant une autorisation de publication

1. Préparer la livraison d’activation : revoir le patch des trois constantes, adapter les attentes de tests actuellement fixées à l’état fermé et les textes de laboratoire, puis obtenir les résultats Node/PostgreSQL/Auth/Chromium et CI au nouveau SHA. Le patch de constantes seul n’est pas une version finale déjà validée.
2. Reconfirmer HEAD/SHA, versions Edge et absence de dérive depuis les fichiers fournis. Toute différence pertinente doit être revue avant remplacement.
3. Présenter le lot exact à autoriser : fichiers SQL et empreintes, commit à publier, source/configuration JWT Edge, classe fictive pilote, recette et arrêt non destructif. La validation pédagogique ne remplace pas cette autorisation.

## Ordre du lot de publication, après autorisation distincte

1. Installer uniquement `supabase/release-candidates/calculs_melanges_locked_v1.sql` dans une nouvelle migration contrôlée et enregistrée. App désactivée, quatre presets cachés. Ne pas utiliser `db push`, rejouer l’historique ou importer une fixture. Vérifier la gestion BEGIN/COMMIT et de l’historique propre à l’outil retenu avant exécution.
2. Contrôler le résultat en lecture seule avec `check-report --stage installed-hidden` : signatures et droits privés, RLS, neuf règles version 2 totalisant 198 par niveau, quatre presets invisibles, app désactivée. Vérifier les objets existants conservés.
3. Préparer des identités et une classe fictives dédiées via Auth/Connect. Ne pas réaffecter de vrai élève ou appareil. Configurer la portée hébergée `CONNECT_MIXED_ACCESS=pilot:<uuid-réel-de-la-classe-fictive>` ; ce n’est pas une variable du seul environnement cloud.
4. Comparer puis déployer uniquement la version revue de `connect-results`, en conservant `verify_jwt=true` et les routes des autres jeux, sans `--prune`. Ne pas remplacer `connect-catalog`.
5. Fusionner/publier le commit d’activation revu avec sa CI réussie, selon Pages/main/racine. Vérifier le SHA effectivement livré, pas seulement celui de la PR.
6. Après contrôle du schéma, de la portée, de l’Edge et du site, activer le pilote via `calculs_melanges_enable_hidden.sql`. Le fichier refuse la dérive de règles/version XP, signatures/droits et visibilité. Les cartes restent masquées et les classes hors pilote sont refusées, y compris par URL directe.
7. Réaliser la recette hébergée ci-dessous. Ensuite seulement, selon l’ouverture choisie par l’enseignant, élargir la portée aux classes retenues et rendre visibles les espaces voulus depuis la matrice GLOBAL. Vérifier les quatre catalogues après leur cache de 60 secondes.

## Recette du pilote avant les vrais élèves

Sur identités fictives : approbation native et appartenance à la classe ; refus des autres classes ; vraie saisie à taux réduit → ACK 14, rechargement, vraie réussite complète hors ligne sans XP anticipé → ACK du complément 14, puis répétition sans crédit nouveau. Vérifier aussi un tirage chanceux à sélection complète, le second appareil, les deux ordres 4/10/20, les résultats/XP professeur, reset sans recollection, Monsieur T et tables obligatoires classe/élève. Les quatre cartes restent cachées et les quatre autres jeux doivent continuer à fonctionner.

Le journal reste borné à 1 000 calculs ; au-delà, le moteur conserve le résultat natif localement et avertit. Les preuves sont des observations du navigateur, pas une attestation cryptographique des réponses. Le serveur contrôle identité, cohérence, seuils, taux, unicité et transaction.

## Retour arrière non destructif

Fermer la portée Edge (`closed`), puis appliquer le seul `calculs_melanges_disable_only.sql` autorisé pour désactiver l’app et masquer ses presets. Conserver états, crédits, reçus, réglages et archives. Ne pas supprimer les tables/RPC, réinitialiser les résultats ou restaurer globalement une ancienne base. Refermer les constantes dans une livraison revue si nécessaire, puis vérifier le refus des sessions connectées et le SHA publié.

## Outillage hors ligne

`node scripts/calculs-melanges-release.mjs plan` trace les empreintes, la politique XP version 2, les constantes et le commit. `schema-query` exporte seulement une transaction READ ONLY. `check-report FILE --stage before-install|installed-hidden|enabled-hidden` analyse le JSON fourni et précise sa provenance externe. Aucun de ces outils ne requiert de jeton Supabase ni n’effectue de déploiement.
