# Fiche d’intégration — [NOM DE L’APPLICATION]

**Statut :** BROUILLON / COPIE LIBRE / LOCAL VALIDÉ / PILOTE HÉBERGÉ / OUVERT — **Date :** [AAAA-MM-JJ]  
**Responsable de la PR :** [agent/conversation] — **Branche/PR :** [liens]

## 1. Source / périmètre et capacités (lot 0, avant code)

| Élément | Valeur / preuve |
| --- | --- |
| App Connect `app_key` (unique, stable) | |
| Dépôt original et commit HEAD | |
| Version moteur / SHA-256 original / licence | |
| Dossier `apps/<slug>/` et URL libre / URL Connect | |
| Commit `main` de départ et PR concurrentes | |
| Miniature officielle / source / dimensions / taille | |
| Git lecture / push / PR / fusion (vérifié ou indisponible) | |
| Supabase lecture / migration / Edge (chacun séparément) | |
| PostgreSQL/GoTrue/Chromium locaux (disponibles ?) | |
| Navigateur Pages avec session fictive approuvée (disponible ?) | |
| Opérations réellement autorisées par le professeur | |
| Jeux/Edge/RPC partagés à risque | |

**Ne pas demander de PAT/secret par réflexe.** Aucun secret dans la fiche.

## 2. Audit du moteur (mettre « absent » quand nécessaire)

| Point | Découverte / source / essai |
| --- | --- |
| Objectif pédagogique, unité d'activité terminée | |
| Modes **réellement accessibles** ; menus / Master / entraînement | |
| Niveaux, difficulté, tables ou opérations sélectionnées | |
| Score, premier essai, aides, erreurs, méthodes | |
| Déblocages, trophées, records (par durée/niveau/méthode) | |
| Hook réel début/fin, branches abandon/erreur/retour, ordre trophées | |
| Clés localStorage/sessionStorage et cache libre/Connect | |
| Écran étroit, clavier/reports/emprunts, performance | |
| Diff minimal du moteur intégré et manifest source | |

## 3. Contrat propre à cette application

- **Schéma événement version :** […] ; **schéma état version :** […] ; **barème version :** […].
- **Fin admissible :** […] ; **preuve bornée :** […] ; **modes sans droit :** […].
- **Identité :** `app_key` / classe / sujet Auth / fiche résolue / `expectedStudentId` ; **époque :** `resetEpoch`.
- **Records / trophées / déblocages / hydratation :** […] ; **trophées permanents malgré reset** : registre/clé unique […], maximum réellement atteignable […], source du total HUB […], traitement des archives et animations de trophées déjà acquis […].
- **Offline :** démarrage disponible ? fin hors ligne ? file max […] / ACK […] / gestion 409/quarantaine […].
- **Sans XP ou XP validés (décision explicite) :** […].
- **Table des exemples chiffrés :** première réussite […], amélioration […], répétition 0 […], sélection plus exigeante […], reset sans recollection […], éventuel rejeu autorisé […] ; **plafond théorique vérifié :** […].
- **Serveur :** route, RPC, receipt, RLS/grants et transaction […] ; contrôles anti-triche raisonnables […].
- **Professeur :** GLOBAL […], résumé/détail […], tables minimums si concerné […], reset app-scoped […], Monsieur T […].
- **Visuels :** WebP poids […], URL serveur […], rendu 320 px […].

## 4. Preuves de test — ne jamais confondre les couches

| Scénario / risque majeur | Statut OK/ÉCHEC/NON EXÉCUTÉ/SANS OBJET | Run / SHA / date / lieu |
| --- | --- | --- |
| Node et logique native | | |
| PostgreSQL local, rollback tardif, concurrence, ACL | | |
| Auth locale, Edge réel local, JWT/appareil révoqué | | |
| Chromium sur vraie saisie et petits écrans | | |
| Cas XP complémentaires + idempotence | | |
| Offline, mauvaise ACK, file pleine, resetEpoch | | |
| Professeur/GLOBAL/tables/Monsieur T | | |
| Tests de non-régression autres apps | | |
| Pages URL/miniature/catalogues HTTP publics | | |
| **Navigateur Pages authentifié avec fiche fictive** | | |
| Test PC scolaire / GSM | | |

## 5. Livraison / risques et retour

- **Manifest SQL** : chemin/hash/version/méthode d'installation […] ; **Edge** : chemin/hash/version JWT […] ; **Pages** : SHA servi […].
- **État catalogue prévu / vérifié** : désactivé → pilote masqué → ouverture décidée […].
- **Porte A/B/C** ([recette](RECETTE_ET_PUBLICATION.md)) : […].
- **Anomalies connues / incidents classés P0, P1, P2** : […].
- **Retrait app seule sans perte de données** : script/conditions […].
- **Décisions pédagogiques encore à confirmer** : […].
- **Enseignements à reporter au guide** : […].
