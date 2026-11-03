# Deux additions — publication scolaire progressive

## Livré sur la branche candidate

- Applications **Addition simple** et **Addition de plusieurs nombres** uniquement. Les trois autres écrits restent sur les URLs historiques.
- Les 2 moteurs natifs, leurs graphismes et commandes sont conservés ; bouton de série Classique certifiée : niveaux 1/2/3, longueurs 4/10/20 (18 configurations).
- L'identité Connect est vérifiée : élève avec appareil approuvé inscrit dans **la classe demandée**, ou profil joueur de Monsieur T avec permission sur cette classe.
- La classe TEST conserve son Edge et ses SQL distincts ; aucun résultat scolaire issu de `game-record` natif n'est autorisé pour ces nouvelles pages.
- Nouveau service JWT `connect-objective-record-school` actif en production (v1), code identique au dépôt ; vérification des classes et des réponses sans score transmis par le navigateur.
- Six migrations additives déployées : registre RLS de sessions, reçus, quatre fonctions privées d'émission/correction et enregistrement atomique pour Addition simple. Les six fonctions sont `service_role` uniquement, aucun accès `anon`/`authenticated`.
- Le déclencheur de capture des scores du tableau de projection est déjà actif sur les écritures `connect_states.state_data`. Une publication individuelle exige un **oui** explicite après l'ACK serveur ; le simple jeu ne publie pas de score.
- Les trophées permanents visibles dans les deux moteurs proviennent de `student-load` authentifié. La prévisualisation ne substitue jamais de faux trophées locaux.
- Tests PostgreSQL 16 jetables : **18/18 configurations** avec vrais nombres, chiffres et reports, rejouage idempotent, première réponse fausse, séparation de classes, refus TEST, droits SQL. Pas d'élèves réels dans ces tests.

## État de diffusion

Le HUB a un aiguillage **indépendant des deux additions**, `SCHOOL_ADDITIONS_ROLLOUT`, actuellement fermé. Le routeur global des cinq jeux reste fermé. Les anciennes applications de classe restent accessibles.

La PR #138 doit être fusionnée après tests CI pour exposer la **page candidate sur GitHub Pages**, sans changer le HUB scolaire. L'enseignant peut alors vérifier avec son vrai profil joueur Connect par URL directe :

```text
apps/objective-record/eleve.html?class=<ID_DE_LA_CLASSE_SCOLAIRE>&app=addition-simple&joueur=prof
apps/objective-record/eleve.html?class=<ID_DE_LA_CLASSE_SCOLAIRE>&app=addition-multiple&joueur=prof
```

Ce sont des chemins relatifs au domaine GitHub Pages existant. La route `joueur=prof` utilise une session professeur existante et ne prend jamais l'identité d'un élève réel. Avant activation automatique dans le HUB, vérifier une série enregistrée, un rafraîchissement XP/trophées, et l'offre oui/non du tableau projeté.

## Limites explicites et non-régressions

- Les crédits XP officiels du **nouvel hôte** existent seulement pour les séries **Classique** avec preuve. Les modes 3 vies, Mort subite et HARD restent jouables mais **ne créditent aucun XP** avant leurs preuves mathématiques spécifiques et barèmes vérifiés.
- La sauvegarde des parties certifiées terminées est idempotente ; les réponses d'une épreuve inachevée conservées dans le navigateur ne constituent pas encore une reprise complète de la session visuelle sur un autre appareil.
- Les coupes/records natifs d'un mode libre ne sont pas synonymes de gain de trophée permanent Connect.
- Ne jamais activer la bascule des cinq apps pour sortir seulement ces deux-là. Ne pas supprimer les anciennes URLs ni les dépôts archivés.
- Aucun compte ou résultat élève réel ne doit servir de banc d'essai. La recette en ligne sur un authentique JWT scolaire reste une étape distincte des tests Chromium avec API simulées.

## Repères

- PR #136 : supprime tout score natif non vérifié du circuit XP des deux additions.
- PR #137 : coupe native = registre permanent Connect.
- PR #138 : nouveau circuit de classe et bascule indépendante, actuellement en brouillon.
- Ticket permanent : #125.
