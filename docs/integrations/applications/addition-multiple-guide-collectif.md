# Addition écrite multiple — guidé collectif (chantier en cours)

## Décision validée
Transposer le guidé collectif de Multiplication simple, y compris la dernière optimisation #295 (requêtes élèves exclusivement au clic ; pas de polling, pas de rendu permanent ; sauvegardes groupées), sans XP/trophée/score.

## Audit technique au 12/11/2026
- Chemin confirmé : `apps/addition-plusieurs/`, `app_key=addition-ecrite-multiple`.
- Hôte : `index.html` avec iframe `srcdoc`, `game-original.html` généré depuis la source autonome. Ne pas modifier directement le moteur généré.
- Pont actuel `audit-bridge.js` capture les résultats/écritures de trophées ; il n'est **pas** un pont de guidé et ne doit pas être réutilisé comme tel.
- Moteur : `startSession('training')` ; champs natifs `answer-input` / `carry-input` en `readonly`, donc pilotage uniquement via les fonctions et le pavé du moteur.
- Service Supabase guidé actuellement existant : `connect-guided-multiplication` (v3), table `connect_guided_multiplication_sessions`. Aucun service propre aux additions trouvé à ce stade.
- Différences fonctionnelles : addition à plusieurs termes, reports propres au moteur, génération et réussite natives à analyser avant raccordement.
- 5 PR héritées ouvertes (#213, #248–#251) : ne pas fusionner ni écraser silencieusement.

## Ce qui est codé dans cette branche
- `collective-contract.mjs` : format de deux opérations à plusieurs termes par page, validation de séance, progression ordinaire, blocage rétroactif et arrivée tardive, addition en entiers.
- `tests/addition-plusieurs-collective-contract.test.mjs` : 5 tests unitaires de ces règles.
- Cette première tranche **n'est pas encore reliée à l'interface ni au serveur**. Aucun élève ne dispose du nouveau guidé dans cette branche à ce stade.

## À développer impérativement
1. Vérifier format de termes et niveaux du générateur natif ; adopter le contrat exact au besoin.
2. Construire pont natif indépendant avec snapshot/restauration, réussite native, corrigé des reports sous cases sans jamais remplir les inputs.
3. Adapter hôte et contrôleur prof/élève avec actions exclusivement au clic élève.
4. Établir service Edge protégé, séance par ID de classe, RLS, lease de professeur, sans stocker de réponse élève.
5. Tests Chromium sur vrai moteur 320 / 390 / 1160, tests sécurité/isolement, non-régression des modes, recette Connect fictive.
6. Fusion, Pages, Edge/SQL, puis recette hébergée : à prouver séparément.

## Statut
AUDIT PARTIEL + CONTRAT INITIAL. Aucun déploiement, aucune migration, aucune donnée scolaire touchée.
