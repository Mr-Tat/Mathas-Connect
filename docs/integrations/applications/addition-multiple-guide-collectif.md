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

## Implémentation de la branche au 12/11/2026
- Hôte Connect, pont natif, contrôleur optimisé #295 et stockage F5 adaptés à `addends`.
- Niveau 1 = 3 nombres, 2 = 4, 3 = 5 ; chiffres 5/6/7 par niveau, retenues à plusieurs unités.
- Chaque élève clique volontairement pour rejoindre ou avancer ; aucun polling supplémentaire.
- CI contrat + syntaxe et staging verts ; Chromium vrai moteur prof/élève, même page, obligation réussie : **VERT**. F5 par pavé réel ajouté, recette complémentaire en cours.
- Edge/SQL partagées PR #299 **non déployées**. Pas de publication ni de test Auth hébergé sur comptes fictifs.

## Retours de recette renforcée — 12 novembre 2026
- Chromium natif multi-termes : profils simulés professeur/élève, correction après erreur, deux opérations validées, page obligatoire débloquée, retour à l'ancienne page, F5 élève et professeur, corrigé uniquement visuel ([exécution Chromium](https://github.com/Mr-Tat/Mathas-Connect/actions/runs/43271813919)).
- Retenues 2 à 4 et champs du moteur `addends` : vérifiés ; une retenue manquante ne reconstitue plus une réussite après F5, tests anti-faux brouillon.
- UI sans polling des élèves, sauvegarde limitée et locale. Aucun XP, trophée, score ni projection collectif.
- **Blocage livraison** : Auth/Edge vrais avec profils fictifs, mise en ligne Pages, puis contrôle de non-régression. La suite globale échoue sur des assertions sans rapport direct avec ce patch ; à traiter séparément avant fusion.

## Optimisation contrôlée avant recette réelle — 12/11/2026
- Élève : aucune minuterie réseau, seules les actions « Rejoindre » et « Suivant / Vérifier la suite » font un `status` ; les touches et la page précédente ne font aucun appel. Vérifié dans le Chromium à deux rôles par comptage des appels.
- Saisies F5 : écritures `sessionStorage` regroupées après 300 ms, immédiates à la sortie/navigation, sans contenu élève sur Supabase.
- Enseignant : un seul heartbeat toutes les 25 s **si une séance existe** ; aucun minuteur au repos ni après « Terminer ». Vérifié dans le Chromium, y compris après F5.
- Portée : seulement Connect, moteur `game-original.html` intact ; aucune publication de cette branche au 12/11.
