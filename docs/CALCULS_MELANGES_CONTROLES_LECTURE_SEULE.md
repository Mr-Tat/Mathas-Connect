# Métadonnées de publication — lecture seule et échange de JSON

**Aucune lecture de production n’est indispensable pour terminer l’implémentation ou la PR draft.** Cette fiche prépare uniquement la comparaison de compatibilité avant une éventuelle publication autorisée. Elle n’exige ni jeton personnel ni nouvelle connexion dans l’environnement cloud.

## Informations déjà rapportées

Le professeur a fait confirmer via une autre conversation ChatGPT connectée à GitHub et Supabase : projet `awmhpfofacaglewammxt` actif, accès en lecture seule aux migrations/tables/Edge et présence de `connect_xp_sync_v2`, `connect_xp_read_v2`, `connect_parcours_restart_one`, `connect_parcours_restart_class`.

Provenance : compte rendu du professeur, pas exécution par cette session. Les définitions JSON complètes n’ont pas été transmises ici. Le candidat Mélange crée ses propres cinq RPC et ne remplace aucune de ces quatre fonctions ; leur nouvelle interrogation ne bloque donc pas son implémentation.

## Requête précise de schéma et catalogue

Le fichier [calculs_melanges_schema_readonly.sql](../supabase/release-candidates/calculs_melanges_schema_readonly.sql) contient la requête exacte, uniquement SELECT sur les catalogues système PostgreSQL et les entrées de catalogue du nouveau jeu. Pour exporter la même requête dans une transaction imposant la lecture seule :

```sh
node scripts/calculs-melanges-release.mjs schema-query --output /tmp/mathas-mixed-schema-readonly.sql
```

L’export ne contacte aucun service et n’exécute pas le SQL. Le laboratoire PostgreSQL exécute ce même export avec `BEGIN READ ONLY` et `ROLLBACK`.

Résultat attendu : une ligne avec une colonne `audit` contenant du JSON. Elle décrit :

| Métadonnées | Utilité avant publication |
| --- | --- |
| Version PostgreSQL et rôles techniques | Compatibilité des types et vérifications de droits |
| Colonnes, types, valeurs par défaut, clés uniques, contraintes et RLS des tables `connect_*` | Compatibilité des INSERT/CAS et maintien des protections |
| Signatures, droits EXECUTE, search_path et empreintes des fonctions `connect_*` | Détecter une collision ou une évolution de schéma sans remplacer les fonctions partagées |
| Définitions des triggers des tables et empreintes de leurs fonctions ; event triggers de DDL | Repérer les effets indirects qui demandent une revue avant toute migration |
| App, quatre presets et neuf règles XP pour `melange-calculs-ecrits` seulement | Détecter un namespace déjà installé et vérifier son état masqué |

La requête ne lit aucune ligne de `connect_students`, `connect_devices`, `connect_enrollments`, `connect_states`, `connect_xp_credits`, `connect_xp_milestones` ou des historiques de parcours. Les noms et types de leurs colonnes restent des métadonnées de schéma.

Demande prête à transmettre à la conversation déjà connectée, le jour où cette comparaison est utile :

> Sur le seul projet Supabase `awmhpfofacaglewammxt`, exécute en lecture seule la requête du fichier `supabase/release-candidates/calculs_melanges_schema_readonly.sql` de la branche `integration/calculs-melanges-connect-20261030` du dépôt `Mr-Tat/Mathas-Connect`. Utilise une transaction READ ONLY puis ROLLBACK, ou le mécanisme de lecture seule de la connexion. Retourne le JSON brut de la colonne `audit`, sans résumé ni transformation. Aucune lecture de lignes élèves, aucune écriture, installation, activation ou livraison de fonction. Si l’outil ne permet pas de garantir la lecture seule, fournis seulement les métadonnées accessibles par ses opérations dédiées et indique cette limite.

## Analyser le résultat sans connexion

Enregistrer le JSON dans un fichier hors du dépôt, puis :

```sh
node scripts/calculs-melanges-release.mjs check-report /tmp/mathas-mixed-schema.json --stage before-install --output /tmp/mathas-mixed-schema-checked.json
```

Formats acceptés : objet `audit` brut, objet `{ "audit": ... }`, ou tableau `[{ "audit": ... }]`. Le programme signale les incompatibilités et indique `hostedRequests: 0` et `metadataProvenance: supplied-json-not-independently-fetched`. Un contrôle structurel réussi ne certifie pas l’authentification ou l’hébergement ; les contraintes et triggers restent à relire.

Les étapes `installed-hidden` et `enabled-hidden` sont destinées à une éventuelle publication future. Elles servent déjà à valider le laboratoire jetable et ne demandent aucune installation sur l’hébergement courant.

## Autres métadonnées à comparer avant un déploiement ultérieur

- Historique des migrations appliquées : version et nom uniquement, via l’opération dédiée de la connexion. Aucun export de tables.
- Edge `connect-results` : slug, version, statut, `verify_jwt`, chemin d’entrée et source actuellement déployée, avec secrets exclus. Le but est de revoir les différences avant un éventuel remplacement.
- Edge `connect-catalog` : version/source et filtrage réel `enabled`/`visible`, pour préparer la visibilité des quatre espaces.
- Configuration GitHub Pages et CI : branche/dossier ou workflow de publication, SHA livré et état des workflows de la PR.

Aucune de ces vérifications n’autorise l’application d’un candidat SQL, l’ouverture d’un verrou, une activation ou une modification de résultats. Aucune donnée d’élève ou valeur de secret n’est nécessaire au rapport.
