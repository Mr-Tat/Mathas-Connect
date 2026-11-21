# Addition écrite multiple — guidé collectif

**LIVE le 17/11/2026** — [PR #297](https://github.com/Mr-Tat/Mathas-Connect/pull/297) fusionnée ; [GitHub Pages réussi](https://github.com/Mr-Tat/Mathas-Connect/actions/runs/44053182710). Le service commun `connect-guided-written` v1 et sa table RLS sont déployés. Chromium réel professeur/élève et tests d'Auth local isolée réussis sur la dernière branche candidate ; contrôle Auth réel en classe TEST à confirmer. « Ensemble en classe » n'existe que dans Exercice guidé ; le professeur peut récupérer son onglet avec confirmation ; les modes individuels et seuils de déblocage restent inchangés. Les sections plus anciennes documentent les étapes précédant la publication.

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

## Correctif 17/11/2026 — collectif strictement dans Exercice guidé
- L'audit du portage a révélé le défaut déjà corrigé sur Multiplication : le bandeau utilisait `joined` même quand l'écran natif n'était plus en mode `training`; le pont pouvait conserver `active` en dehors du guidé.
- Contrôles ajoutés : affichage du bandeau uniquement si `gameScreen` est visible **et** la session native est `training` ; entrée/lancement impossibles hors guidé ; détachement de l'onglet au changement de mode avec sauvegarde des saisies privées, sans arrêter la séance du professeur ; interception du bouton natif restreinte au guidé visible.
- Test Chromium de régression ajouté : quitter un guidé collectif actif, ouvrir successivement les séries 4/10/20 et Mort subite sans bandeau ni commande de classe, conserver la séance côté professeur, puis rejoindre volontairement le collectif à l'intérieur d'Exercice guidé.
- **Travail sur la branche de la PR candidate uniquement.** Les clients dépendent encore du service partagé PR #299 non déployé au dernier audit. Aucun droit de classe, migration SQL/Edge, résultats ni barèmes modifiés dans ce correctif. Séparer validations CI, déploiement GitHub Pages, Edge/SQL et recette authentifiée.

## Reprise enseignant après fermeture d'onglet — 17/11/2026
- Aligné sur Multiplication #325 et #326 : « Reprendre la séance » déclenche, après confirmation si le contrôle appartient à un autre onglet, le transfert explicite du verrou au **même enseignant authentifié**. L'ancien onglet n'a plus le droit de changer les pages ni de terminer la séance.
- Le contrôleur rafraîchit réellement le statut après `session_owned_by_other_tab` ; auparavant `poll()` était ignoré sous `busy=true`. Le guidé reste l'unique endroit où démarrer/rejoindre.
- La PR de service partagé #299 contient `takeover` avec `app_key`, classe, enseignant, IDs de page, révision et comparaison atomique de l'ancien propriétaire. Les enseignants d'autres classes et tous les élèves ne peuvent pas reprendre.
- Tests supplémentaires : les séries 4/10/20 n'affichent pas le collectif même en présence d'une séance ; Mort subite reste individuel s'il est débloqué, et reste verrouillé lorsque le barème natif ne l'autorise pas.
- **Candidat uniquement : aucune publication Pages / SQL / Edge de cette application**. La recette Auth réelle avec profils fictifs reste une condition distincte.

## Preuve d'addition scolaire — reprise d'une série notée après F5 (21/11/2026, PR #336)

- **Observation du vrai défaut :** PostgreSQL `connect_objective_record_school_issue_multi_v1` réémet le même défi non terminé tant que sa preuve n'a pas expiré et que la révision correspond. Mais le client `certified-multiple-ui.mjs` conservait l'ancienne preuve locale **seulement si les 4/10/20 premières réponses étaient déjà présentes**. Si la partie était interrompue après 1, 2, 3... calculs, il sauvegardait `[]` et les premières réponses étaient perdues.
- **Réparation :** ne réutiliser les premières réponses locales que pour le même `sessionId` certifié, même niveau et même longueur ; vérifier rigoureusement chaque preuve ; reprendre l'index au début de la paire restante. Si une réponse a déjà été vérifiée dans une paire, la marquer comme telle et **ne jamais la capturer une seconde fois**.
- **Autre défaut confirmé avec Chromium :** dans ce moteur, cliquer sur le choix visible de 4/10/20 déclenche déjà `startClassic.click()`. L'hôte certifié appelait pourtant `startClassic.click()` **une deuxième fois**, détruisant le rendu de la première paire restaurée. Le double lancement est retiré.
- **Séparation de sécurité :** nombre de réussites « avant F5 » calculé seulement pour le rendu provisoire du jeu ; aucune valeur locale n'ouvre un niveau, ne valide une coupe, ne donne des XP ou ne projette un score. Les valeurs officielles proviennent seulement du reçu serveur atomique. Une preuve locale provenant d'un défi différent n'est jamais réutilisée.
- **Portée :** moteur original non modifié ; adaptateur scolaire de l'iframe uniquement. Guidé collectif, jeux libres, barèmes, droits de classe, profils et historiques officiels inchangés ; aucune migration SQL/Edge.
- **Preuves CI 21/11 (HEAD fonctionnel `2db8c6c`) :** [reprise F5 réelle en Chromium #44909835719](https://github.com/Mr-Tat/Mathas-Connect/actions/runs/44909835719), [ensemble des 20 parcours certifiés additions #44909835745](https://github.com/Mr-Tat/Mathas-Connect/actions/runs/44909835745), [guidé collectif des additions #44909835725](https://github.com/Mr-Tat/Mathas-Connect/actions/runs/44909835725), [guidé Addition multiple #44909835722](https://github.com/Mr-Tat/Mathas-Connect/actions/runs/44909835722), [reports/clavier #44909835767](https://github.com/Mr-Tat/Mathas-Connect/actions/runs/44909835767), [contrats Objectif record #44909835768](https://github.com/Mr-Tat/Mathas-Connect/actions/runs/44909835768) : **tous verts**.
- **Suite générale :** 742 tests réussis / **10 échecs historiques** déjà présents sur `main`. Aucun nouveau test en échec dans ce patch.
- **Recette navigateur authentifiée contre le vrai Supabase avec deux profils fictifs approuvés :** encore non exécutée ; CI automatisée avec JWT/Edge simulés. À vérifier après fusion : GitHub Pages au SHA fusionné, puis recette AUTH distincte.
