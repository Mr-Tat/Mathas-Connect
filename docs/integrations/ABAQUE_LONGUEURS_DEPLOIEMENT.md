# Abaque — pilote Connect du Laboratoire — 2 novembre 2026

**[DÉCISION professeur, 02/11/2026 — demande « Tests en ligne »]** Intégrer l’Abaque à la rubrique connectée du Laboratoire, avec Auth, XP, trophées et résultats serveur pour les profils fictifs de la classe TEST. Cette nouvelle demande étend le travail au pilote Connect ; les anciens accords de publication de la seule démonstration ne décrivent plus tout le périmètre demandé. Aucune ouverture des quatre HUB scolaires.

**[REPO vérifié, 02/11/2026]** Projet Connect `awmhpfofacaglewammxt`, `app_key=abaque-longueurs`, source autonome `69ed04e`, copie `apps/GRAN-abaque-m-1/`. Candidate sur `feat/abaque-longueurs-connect`, intégrant le main `6e20398` (qui contient `1234854`). Aucun SQL ou Edge de production exécuté ; aucune recette hébergée authentifiée réussie. Le frontend attend honnêtement l’activation serveur.

## Comportement du Laboratoire

- « Tests en ligne » contient une carte Abaque distincte de la démonstration. Son lien impose `?connect=1&class=<TEST>`, même si une ancienne URL de démo subsiste dans le catalogue.
- Catalogue absent/désactivé, Edge inaccessible ou pilote fermé : liens et Monsieur T restent bloqués, avec état d’attente et bouton de vérification. Aucune simulation ne prend le relais.
- Une fois le pilote actif, le professeur confirme les profils fictifs puis utilise « Autoriser les profils fictifs ». Seuls les UUID actifs explicitement affichés dans TEST et, s’il est activé, son propre Monsieur T entrent dans la liste autorisée. Cette action ne crée ni XP, ni résultat, ni approbation d’appareil.
- La validation d’appareil Connect habituelle reste nécessaire. Monsieur T conserve son identité et ses résultats distincts. Le lien « Résultats Abaque » ouvre le tableau professeur dédié, avec contrôle des permissions et consentement avant lecture.
- La démonstration isolée et ses trois simulations restent dans « Test hors ligne ».

**[REPO vérifié, 02/11/2026]** `teacher-pilot-status` et `teacher-pilot-approve` vérifient un véritable sujet Auth non anonyme, la seule classe TEST et le droit de gestion. Les RPC sont accessibles uniquement au rôle serveur. Toute sélection hors classe ou partiellement invalide annule l’autorisation entière. Ni la case fictive ni l’URL ne permettent de contourner les contrôles serveur du jeu.

## Lot serveur et préparation

1. Réexaminer en lecture seule le schéma, l’historique et les versions Edge du projet cible. Lire uniquement les métadonnées, jamais les résultats d’élèves réels.
2. Préparer puis appliquer l’installation additive **désactivée et masquée**, gardée par empreinte du nouvel audit. Une seule ligne d’historique et une seule transaction. Les RPC historiques restent inchangées.
3. Déployer uniquement `connect-abaque` et la modification ciblée de `connect-api`, du SHA testé. Vérifier au préalable l’absence de version distante concurrente. Le drapeau `CONNECT_ABAQUE_ACCESS` reste fermé par défaut. La branche commune conserve son chemin historique hors TEST ou hors drapeau `pilot`.
4. Publier le frontend du même lot, puis activer uniquement TEST. L’activation peut commencer avec une liste vide : aucun profil ne joue tant que le professeur n’a pas explicitement autorisé les profils fictifs. Passer le drapeau à `pilot`. Le catalogue indépendant du Laboratoire reçoit la carte ; aucun catalogue scolaire n’est modifié.
5. Effectuer la recette authentifiée hébergée ci-dessous. Une CI verte ne remplace pas cette étape.

Les outils de préparation n’ouvrent aucune connexion :

```bash
node scripts/abaque-release.mjs manifest
node scripts/abaque-release.mjs audit-sql > /tmp/abaque-schema-readonly.sql
node scripts/abaque-release.mjs validate /tmp/abaque-live-audit.json --version <version_revue>
node scripts/abaque-release.mjs prepare-install /tmp/abaque-live-audit.json /tmp/abaque-install.sql --version <version_revue>
node scripts/abaque-release.mjs manifest --version <version_revue> > /tmp/abaque-release-manifest.json
```

**[REPO vérifié, 02/11/2026]** La version locale par défaut `20261102020000` appartient aux fixtures. Main contient déjà une migration plus récente (`20261102134600`) : choisir explicitement une version de 14 chiffres après l’audit hébergé, puis conserver la même dans l’installation et le manifeste de livraison. L’outil rejette tout historique supérieur ou égal à cette version, ainsi qu’un espace de noms Abaque déjà installé. Il n’incrémente jamais silencieusement.

Exécuter l’audit en lecture seule sur le projet cible et enregistrer le résultat privé dans `/tmp/abaque-live-audit.json`. Examiner contraintes, index, triggers et versions Edge. L’installation générée relit cette empreinte sous verrou avant toute écriture et insère son historique dans la même transaction ; toute divergence annule l’ensemble. **Ni `supabase db push` global, ni `apply_migration` en plus de ce SQL brut.**

Pour préparer l’activation, utiliser un JSON privé avec `classId: "4bf3400d-a315-4ea4-a2f3-afaca24dc9b9"`, `fictiveConfirmed: true` et `studentIds` contenant uniquement les UUID fictifs vérifiés. Pour différer leur autorisation au panneau professeur, utiliser `studentIds: []` et `deferProfileApproval: true` :

```bash
node scripts/abaque-release.mjs prepare-pilot /tmp/abaque-fictifs.json /tmp/abaque-pilot.sql
```

Le SQL vérifie classe, inscriptions actives, liste autorisée et absence d’autre classe ouverte ou d’entrée scolaire. Les fichiers privés d’audit, de profils, de SQL préparé et les secrets restent hors dépôt. Le manifeste versionné décrit une candidate, jamais une installation effectuée.

## Preuves et recette hébergée

**[CI locale, 02/11/2026]** Le runner Docker `bash tests/local/run-abaque-local.sh` utilise PostgreSQL, Auth, PostgREST, Edge Deno et Chromium réels sur services jetables et profils fictifs. Il couvre installation fermée/historique, 160 XP, six coupes permanentes, concurrence, rollback, révocation, réaffectation, reset, reprise et second appareil. Le panneau d’autorisation est également exercé avec Auth/Edge locaux : élève refusé avant autorisation, confirmation obligatoire, Monsieur T séparé, crédit réel local sans crédit de l’élève. Le test de la page Laboratoire complète utilise des transports et une Auth simulés ; il vérifie placement, états d’attente et liens. Aucun de ces tests ne prouve le fonctionnement du projet hébergé.

**[PROPOSÉ, 02/11/2026] Recette hébergée restante :**

- Relever SHA Pages, versions/empreintes Edge, migration, configuration et activation limitée à TEST.
- Ouvrir une vraie session professeur, confirmer les seuls profils fictifs puis les autoriser ; approuver l’appareil fictif selon le flux Connect habituel.
- Depuis la carte « Tests en ligne », jouer au clavier ; contrôler XP restants, reçu/crédit, trophées, rechargement, autre appareil, complément et répétition à zéro.
- Contrôler hors ligne/reprise, révocation, Monsieur T distinct, résumé HUB et résultats professeur ; reset Abaque seul, XP et trophées conservés.
- Vérifier les refus hors périmètre et l’absence de l’Abaque dans les quatre HUB scolaires. Consigner les preuves sans jeton ni nom réel.

## Accès constatés et arrêt

**[LIVE vérifié, 02/11/2026 — outil officiel Supabase 3.0.0]** La lecture des fonctions du projet échoue explicitement avec « Access token not provided ». Aucune variable d’authentification Supabase et aucun binding prêt n’existent dans le runtime révision 1. Les requêtes HTTP Supabase ont également reçu un refus de tunnel 403. Le brouillon cloud conserve les destinations requises et le champ sécurisé `SUPABASE_ACCESS_TOKEN`, sans valeur liée. Il faut renseigner le secret dans les paramètres de l’environnement puis appliquer/publier cette configuration ; sauvegarder le brouillon ne modifie pas l’instance active. Ne pas transmettre ce secret dans une conversation. Git lecture/push et pages publiques GitHub restent accessibles ; API GitHub/PR non disponibles lors du contrôle.

**[PROPOSÉ, 02/11/2026]** Arrêt non destructif : `CONNECT_ABAQUE_ACCESS=closed`, puis `supabase/release-candidates/abaque_disable_only.sql`. Cela masque/désactive la seule Abaque et conserve états, reçus, XP, trophées et historique ; le résumé HUB reprend son ancien chemin. L’ouverture scolaire demande une décision distincte après recette, avec classes et catalogues explicitement autorisés.
