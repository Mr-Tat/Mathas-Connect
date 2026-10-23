# Brain Mathing n° 1 — Audit architecture ET économie des données
Date : 23 octobre 2026
Projet : Math’as Connect — audit de l'existant, pas de migration destructrice.

## Décision
**Conserver l'infrastructure Connect, mais simplifier son architecture avant de brancher les jeux.**
Pas de redémarrage ni suppression précipitée. Le système doit être autonome vis-à-vis du HUB classique, gratuit, sûr, extensible et peu gourmand en transferts.

## Contrat UX non négociable
1. Le raccourci bureau ouvre le HUB de la classe ; un clic « Se connecter » reprend automatiquement cette classe. L'URL indique le contexte, pas les droits : Supabase vérifie l'appartenance.
2. Un **seul HUB de classe**, deux modes :
   - « Mode libre / Se connecter » : applications utilisables et sauvegardes locales inchangées.
   - « Pseudo · Classe / Modifier » : données personnelles récupérées sur tout appareil autorisé.
3. Déconnexion / passage en mode libre : **ne pas perdre la session anonyme** et **ne pas écraser les sauvegardes locales**. L'action « oublier cet appareil/changer d'élève » est distincte, explicite et sûre pour les PC partagés.
4. L'identité durable de l'élève est différente de ses appareils. Le professeur peut autoriser, associer au même élève, révoquer. Pas de doublons involontaires.
5. Le pseudo modifiable sera ajouté plus tard ; ne pas le traiter comme une identité d'authentification. Contrôle professeur et confidentialité de la projection.
6. Jeux dans leurs propres dépôts ; intégration avec le contrat Connect **un par un, après infrastructure validée**. Ne jamais toucher à la production Math’as sans autorisation.

## État réellement vérifié (23/10/2026)
- GitHub `Mr-Tat/Mathas-Connect` : site statique, API et CSS du HUB copiés, fichier du service `supabase/functions/connect-api/index.ts` versionné.
- Projet Supabase Connect isolé `awmhpfofacaglewammxt` : fonction `connect-api` active en v4 avec JWT.
- 17 tables Connect avec RLS. Le catalogue et les préréglages sont lisibles de manière restreinte ; données élèves, comptes et scores ne sont pas directement exposés aux visiteurs.
- 1 application inscrite, 1 classe de test, 2 fiches élèves (dont un exemple), 1 appareil autorisé ; **aucune sauvegarde Connect et aucune tentative enregistrée**.
- 2 projets Supabase actifs (Math’as et Connect), un projet de test en pause.
- L'écran des comptes sait faire les demandes, les approbations et la gestion initiale ; le HUB `hub.html` n'intègre pas encore le contexte de classe ni l'état utilisateur.
- L'ancien HUB public n'a pas été modifié par cette construction.

## Brain Mathing — économie : règle permanente et systématique
Vérifier à chaque nouvelle fonction, pour **Supabase ET GitHub** :
1. Nombre de requêtes par action et par élève, volume moyen de la réponse, trafic réseau total, répétitions inutiles.
2. Nombre d'écritures SQL/Edge Function par partie ; fréquence de sauvegarde ; consommation CPU, stockage des lignes ET de leurs index.
3. Stockage et egress des images, miniatures, scripts ; cache navigateur/CDN ; taille totale des assets.
4. Usage probable par classe et par école sur plusieurs mois, par rapport aux quotas GRATUITS (ne jamais engager de frais).
5. Risque de panne réseau et mode libre : pas d'obligation d'appeler Supabase pour jouer localement.
6. Retours réels du tableau de bord Supabase Usage + métriques GitHub Pages, et test avant/après optimisation.
7. Déduplication des transferts, minimisation des données personnelles, durée de conservation réfléchie ; ne jamais effacer des résultats réels sans validation.

### Mesures à date
- Supabase Connect, **database totale ≈ 12 Mo** (tous schémas/extensions), dont **tables connect_* et leurs index ≈ 680 Ko** ; valeurs issues de `pg_database_size` et `pg_total_relation_size`. Ce ne sont PAS des mesures du trafic mensuel ni de la taille des futurs scores.
- Forfait gratuit actuellement annoncé : 500 Mo de base par projet, 5 Go d'egress, 5 Go d'egress cache, 1 Go de Storage ; deux projets actifs max. Document officiel : https://supabase.com/pricing — revérifier périodiquement.
- GitHub Pages : site jusqu'à 1 Go, **limite souple de 100 Go/mois de bande passante**, environ 10 builds/heure sans workflow dédié. Source : https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits. Ne pas confondre avec les quotas Actions, LFS ou GitHub API.
- Pages Connect : JS comptes ~10 Ko, JS HUB ~2,6 Ko, CSS HUB ~14,6 Ko, CSS comptes ~2,6 Ko, plus HTML. Très légers en source ; poids réseau/compression non mesuré sur navigateur.
- Pas d'image intégrée au dépôt Connect pour l'instant. Des miniatures de l'ancien HUB sont sur l'ancien Supabase : **interdiction d'en créer une dépendance permanente dans Connect**.

### Optimisations nécessaires (par priorité)
**P0 : réduction du trafic avant que les classes l'utilisent**
- La page professeur fait plusieurs appels Edge (classes, années, demandes, élèves, appareils), chacun avec vérification de jeton et accès DB. Prévoir **un seul endpoint `teacher-dashboard`** paginé/limité regroupant les données utiles, rafraîchir seulement ce qui a changé.
- Côté élève, un appel « état / identité » à l'ouverture du HUB suffit ; éviter boucle de requêtes sur chaque clic ou chaque changement de page.
- Demandes d'autorisation : mise à jour manuelle ou rafraîchissement périodique léger **uniquement pendant que l'onglet est visible**, jamais par élève en continu.
- Distinguer mode libre (pas d'appel Auth/DB pour jouer) et mode connecté. La récupération du catalogue ne doit pas être un point unique de panne : version statique minimale de secours dans le GitHub Connect, maintenue sans double administration.
- Une miniature versionnée en **WebP/AVIF redimensionnée**, `loading="lazy"`, tailles adaptées à l'écran, cache HTTP long. Éviter traitement automatique à chaque chargement et éviter les URL d'images hébergées par l'ancien Supabase. GitHub Pages convient au contenu statique ; privilégier réutilisation des images plutôt que doublons.

**P1 : contrat de résultats à optimiser avant le premier jeu**
- **Jamais une écriture à chaque frappe, boule ou clic.** Une sauvegarde groupée aux jalons (fin d'exercice / page / partie), éventuellement différée et dédupliquée.
- Écrire une sauvegarde si et seulement si son contenu a changé ; conserver `schema_version`, `revision` et contrôle des conflits inter-appareils dans `connect_states`.
- Les événements `connect_attempts` doivent être **idempotents** (`event_id` unique), compacts et seulement pour une tentative pertinente. Évaluer la rétention et l'agrégation AVANT la collecte à grande échelle ; ne pas supprimer des historiques existants sans consentement.
- Séparer progression/déblocages de scores/trophées/médailles, selon les règles de chaque jeu. Reset des scores ≠ reset de la progression. N'envoyer que les changements.
- API universelle : identité, lancement, sauvegarde, tentative. Tokens courts et vérifiés côté serveur, jamais secret/service role côté JS public ou dans les URLs de jeux.
- Cap sur la croissance : exemple **100 élèves × 10 tentatives/jour × 180 jours = 180 000 lignes/an** ; la taille physique comprend les index et peut devenir importante. C'est une simulation, pas une mesure.
- Le traitement serveur agrège les classements par requêtes ciblées / index plutôt que renvoyer tous les événements à chaque affichage. Limiter et paginer les tableaux.

**P2 : préparation à plusieurs classes et jeux**
- Rendre le catalogue une **source unique de vérité** : `connect_apps` liste les jeux, la visibilité/position de chaque jeu vient d'un paramétrage de classe, les presets ne sont que des modèles. Les champs globaux `featured/section/display_order` et les presets sont à clarifier : risque de doubles configurations.
- Scores au tableau uniquement lors de l'utilisation ; pas de rafraîchissement continu pour toute l'école.
- Mesurer les egress Supabase par type (API/Storage/Edge) dans le tableau de bord ; mesurer poids des pages et cache dans outils réseau du navigateur. Ne pas promettre économie chiffrée sans métriques.

## Dette technique identifiée
- `signOut()` de l'élève efface l'identité Auth anonyme ; le serveur conserve cependant l'appareil approuvé. Corriger en distinguant « mode libre » et « oublier le compte ».
- `hub.html` et `index.html` sont aujourd'hui deux parcours, le HUB ne connaît ni la classe ni la session élève.
- État approuvé/révoqué dans le frontend vérifié ponctuellement ; éviter accès cloud résiduel d'un onglet déjà ouvert.
- Le vieux flux `teacher-pair-code` / `device-claim` et `connect_pairings` coexistent avec l'inscription à quatre chiffres ; décider un parcours unique, ne supprimer qu'après audit de dépendances.
- `connect-ui` est une Edge Function ancienne et inutile pour servir l'interface ; sauvegarder/archiver et nettoyer lors d'un bloc dédié.
- Le README GitHub est périmé : il dit que le backend n'est pas versionné et que le test end-to-end n'est pas fait, alors que ces deux points ont évolué.
- Migrations Supabase enregistrées dans Supabase, mais leur source exhaustive n'est pas encore conservée dans le dépôt ; archiver proprement le schéma et la méthode de reconstruction.

## Ordre recommandé des blocs
1. HUB unique par classe ; en-tête « Mode libre / Se connecter » ou « Pseudo / Classe / Modifier » ; contexte de classe du raccourci.
2. Sessions et changement de mode **sans perte ni contamination** des sauvegardes ; règles de poste partagé et appareils révoqués.
3. Revue des appels serveur et réduction du nombre de requêtes + mode libre de secours + cache.
4. API standard des sauvegardes / résultats, révisions, contrôle de conflits, coûts et tests automatisés.
5. Rapport professeur / projection sobres en données.
6. Intégrer chaque jeu individuellement avec campagne de tests en deux modes et sur deux PC.

## Cadence du Brain Mathing
À refaire spontanément **pendant les séances de travail** : avant grand nouveau bloc, après un bug structurel, avant une intégration de jeu et à chaque plusieurs versions. Dans chaque Brain Mathing donner : avancées réelles, problème d'architecture, sécurité des enfants, dette technique, économie chiffrée quand possible, risque de coût, décision et tests.
Ce n'est pas un travail en arrière-plan : il se produit au moment des échanges ou des travaux demandés.

**Aucune suppression ni mise en production faite pendant cet audit.**
