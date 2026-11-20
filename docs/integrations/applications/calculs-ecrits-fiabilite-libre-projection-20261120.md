# Quatre calculs écrits — fiabilité lancement libre, score du jour et projection

**Date : 20/11/2026 · PR #333** : https://github.com/Mr-Tat/Mathas-Connect/pull/333
**Source de départ :** `main` `4d85fef29d34041501205d1b2a9836af258da869`.
**Jeux :** `addition-ecrite-simple`, `addition-ecrite-multiple`, `multiplication-ecrite-simple`, `soustraction-ecrite-simple`.

## Contrat professeur inchangé
- Multiplication est le pilote le plus abouti. Ne changer ni méthodes natives, ni guidage collectif, ni XP/trophées/barèmes.
- En fin de série, un score certifié du jour peut être proposé au tableau avec OUI/NON. NON ne partage rien et n'interdit pas une proposition ultérieure en cliquant sur la carte du meilleur score de l'accueil ; si le résultat est déjà pris en compte, ne pas le proposer une nouvelle fois.
- OUI inscrit un consentement durable spécifique à l'événement/élève/classe/jeu. **Seule la réponse serveur** donne droit à « Score envoyé ». En panne réseau : file de réessai et état « Envoi en attente ».
- « Score du jour » n'est pas « record historique » ; les scores affichés restent issus d'une source certifiée Connect.

## Corrections de la PR
1. **HUB :** lorsque le mode libre a été explicitement sélectionné, les deux additions vont vers leur moteur autonome au lieu d'Objectif record, qui charge un SDK distant avant de démarrer. Même protection dans l'espace TEST. Connect certifié conserve son routage habituel.
2. **Addition multiple directe :** `?libre=1` ouvre le moteur sans consulter Supabase ; si connexion officielle impossible, deux choix explicites « Réessayer » / « Jouer librement (sans XP Connect) », sans dégrader silencieusement les preuves.
3. **Soustraction :** rétablir `todayBest` certifié dans le Top natif au chargement, sans confondre avec les scores locaux.
4. **Vue de scores commune (4 jeux) :** afficher la valeur de secours certifiée `student-load.todayBest` datée Europe/Brussels si l'historique de projection ne répond pas ou est incomplet. Aucune preuve événementielle n'est inventée : un partage exige toujours l'historique valide avec `eventId`.
5. **Consentement commun :** un seul clic OUI/NON ; OUI met en file persistante avant de fermer et distingue « en attente »/ACK « envoyé » ; NON ferme sans enregistrer de publication. Protection contre les offres en double en attente.

## Régressions à couvrir
- Test unitaire de routage sur les cinq classes scolaires et TEST : `tests/ce-additions-free-routing.test.mjs`.
- Chromium avec services externes bloqués : `tests/ce-free-launch.browser.mjs` (guidé + classique Multiplication, Soustraction, Addition multiple, sortie directe après panne SDK).
- `tests/projection-consent.test.mjs` : refus sans écriture, OUI non bloquant, deux événements et ACK.
- `tests/projection-written-daily-share.test.mjs` : meilleur score du jour avec/sans historique et absence de preuve artificielle.
- Suite de régression générale : plusieurs échecs hérités indépendants ; comparer à la base avant de déclarer vert.
- **Recette AUTH hébergée TEST avec professeur et élève fictifs : NON EXÉCUTÉE** (professeur la réalisera après mise en place).

## Portes de livraison
- PR / CI ciblée : suivre les runs du HEAD de #333 ; aucune migration SQL ou Edge.
- GitHub Pages après fusion : vérifier succès de déploiement au SHA fusionné, séparément de la recette authentifiée.
- Catalogue Supabase et permissions/classes : **inchangés** ; aucun score, XP, trophée ni profil réel touché.
- Ne pas fusionner mécaniquement les anciennes PR #248 (fenêtre Oui/Non), #250 (score du jour Soustraction), #251 (score du jour Additions) : ces besoins sont repris ici, et leurs patches datés doivent être comparés à `main`.

**Prochaine action :** tests de #333 → correction de toute nouvelle régression → fusion/pub Pages si les contrôles ciblés sont bons → recette du professeur en classe TEST. Les deux additions passent par Objectif record en mode scolaire, et leur lanceur autonome ne doit pas être substitué en mode connecté.
