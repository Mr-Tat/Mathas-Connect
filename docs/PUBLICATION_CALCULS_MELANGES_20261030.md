# Calculs mélangés — livraison aux élèves autorisée

31 octobre 2026. Le professeur a élargi son autorisation au déploiement complet et à l’accès des élèves. Les anciennes demandes d’accord distinct pour ce lot sont remplacées par cette consigne. Les contrôles de sécurité et de compatibilité restent obligatoires ; aucune lecture ou remise à zéro des vrais résultats n’est nécessaire.

## Livraison préparée

Application indépendante `melange-calculs-ecrits`, moteur original préservé, XP 594 avec sélection initiale 25/50/100 et compléments uniques. Auth native, Monsieur T, sauvegarde atomique, file offline, ACK, résultats/reset professeur et tables minimales propres au jeu sont testés localement. La miniature native légère est incluse.

Les trois chemins compilés sont prêts. Sans configuration supplémentaire, le serveur utilise les contrôles Connect habituels : app activée, JWT réel, appareil approuvé, élève actif et inscrit dans la classe ; professeur gestionnaire et joueur séparé. Aucun nouveau secret n’est nécessaire. Les overrides `CONNECT_MIXED_ACCESS=closed` et `pilot:<uuid>` restent disponibles ; une valeur vide ou invalide refuse l’accès. Un éventuel override existant n’est jamais ignoré. Les cartes restent absentes du catalogue statique.

L’installation laisse l’app désactivée et les quatre presets invisibles. L’activation masquée autorise ensuite les URL directes des sessions approuvées ; elle ne limite plus l’accès à une seule classe par défaut. La recette utilise uniquement des profils fictifs avant la visibilité des cartes.

## Audit et historique

L’export reçu `audit-melange-before-install.json`, collecté le 31 octobre, confirme lecture seule, 26 tables et 13 fonctions publiques sans dérive, les watchers PostgREST inchangés, quatre parents existants et 25 migrations. L’historique géré possède six colonnes : version, statements, name, created_by, idempotency_key et rollback. Les trois dernières sont facultatives, sans défaut ni trigger. La contrainte unique d’idempotence accepte les anciennes valeurs NULL.

Le manifeste `supabase/release-candidates/calculs_melanges_installation_manifest.json` relie le SQL approuvé, son corps inchangé, le nouveau fichier de migration et l’enveloppe d’installation. L’enveloppe place le jeu et sa seule ligne d’historique dans une transaction, avec garde de forme d’historique, verrou court et clé d’idempotence. Elle est destinée à une exécution SQL brute autorisée en un seul lot, ou au SQL Editor du propriétaire. **Ne pas la passer à apply_migration**, qui pourrait ajouter un deuxième enregistrement. Ne pas exécuter `db push`, rejouer l’historique ou appliquer une fixture.

Les tests locaux reproduisent le danger d’un COMMIT imbriqué puis vérifient l’atomicité sur les deux formes d’historique. La CI exécute aussi le fichier final exact avec 25 migrations fictives : une seule ligne ajoutée, anciennes lignes intactes, rollback sur erreur après l’insertion et refus de réapplication. Aucun de ces tests n’a écrit en production.

## Ordre d’exécution du lot autorisé

1. Reconfirmer tête/arbre de la PR n°34, huit CI réussies, main attendu et absence de remplacement des sources Edge depuis le rapport. Le seul Edge à livrer est `connect-results` ; `connect-catalog` et `connect-api` ne changent pas.
2. Exécuter `calculs_melanges_install_atomic.sql` en une seule requête SQL autorisée. Vérifier 26 migrations, une nouvelle ligne avec la version et la clé du manifeste, app désactivée, quatre presets masqués, neuf règles version 3, cinq RPC privées et deux tables RLS. Si la version existe déjà, vérifier son état sans réappliquer.
3. Déployer `supabase/functions/connect-results/index.ts` du commit testé, en conservant `verify_jwt=true`. Le mode normal ne nécessite pas de création de secret. Un override existant fermé devra être traité par son propriétaire ; ne pas lire ni supprimer les autres secrets.
4. Mettre à jour la description de PR depuis `docs/PR_CALCULS_MELANGES_DRAFT.md`, puis fusionner et publier le candidat conforme. Main est signalée non protégée ; la fusion peut déclencher Pages immédiatement. Vérifier le SHA publié et l’arbre effectivement livré. Les versions des scripts de portail et de HUB sont actualisées pour les navigateurs déjà utilisés.
5. Après vérification SQL/Edge/Pages, exécuter `calculs_melanges_enable_hidden.sql`. L’app devient utilisable, les quatre cartes restent masquées. Créer la classe et le joueur fictifs par les parcours natifs du HUB, puis effectuer la recette ci-dessous.
6. Après réussite de la recette publiée, exécuter `calculs_melanges_open_hubs.sql`. Ce fichier exige l’app activée, les règles exactes et les droits privés, puis rend visibles seulement les quatre lignes Mélange. Vérifier les quatre catalogues après leur cache de 60 secondes. Aucune nouvelle permission n’est à demander pour cette ouverture déjà autorisée.

## Recette publiée minimale avant les cartes

Dans l’espace professeur, Gestion → Créer une classe : « PILOTE MÉLANGE — FICTIF ». Copier son lien élève et l’ouvrir en fenêtre privée. Se connecter, demander l’accès comme « Pilote X », puis autoriser uniquement ce profil fictif depuis le professeur. Le parcours crée lui-même une vraie session anonyme ; aucun Auth Admin ni faux JWT n’est requis.

Lancer `apps/calculs-melanges/?class=<uuid-fictif>` : vraie série classique 4/4 niveau 1 à une opération → ACK 7 ; nouvelle réussite à deux → +7 ; à trois → +14 ; répétition → 0. Vérifier le maintien du total acquitté hors ligne puis la reprise après reconnexion, le rechargement, les résultats/XP professeur, les tables classe/élève, le reset du seul profil fictif sans recollection et Monsieur T avec sa session séparée. Les quatre autres jeux doivent continuer à fonctionner sur des profils de test. Les preuves locales et les événements API synthétiques ne remplacent pas les actions réellement effectuées dans le navigateur publié.

L’outil de l’autre conversation ne disposait pas d’un navigateur authentifié dans le rapport initial. S’il en dispose maintenant, l’utiliser avec les profils de test ; sinon indiquer au propriétaire uniquement les liens et gestes indispensables. Marquer les vérifications non exécutées comme telles et ne pas déclarer la recette publiée réussie par déduction.

## Contrôles et arrêt

`check-report` accepte `before-install`, `installed-hidden`, `enabled-hidden`, puis `enabled-visible`. Le plan hors ligne trace le commit, les fichiers, la version de migration, les empreintes et la politique XP. Aucune commande de cet outillage ne déploie.

En cas d’anomalie, `calculs_melanges_disable_only.sql` ferme l’app et masque ses cartes sans supprimer états, XP, reçus, réglages ou historique. Ce retrait fonctionne sans secret supplémentaire. Ne restaurer aucune base globale et ne réinitialiser aucun résultat réel. Le plafond de journal 1 000 reste explicite ; les preuves navigateur ne sont pas une attestation cryptographique des réponses.
