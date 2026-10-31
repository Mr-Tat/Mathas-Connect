# Référence technique — contrats et invariants Connect

**Statut :** conventions issues des intégrations au 31/10/2026 ; vérifier code, service et version avant de développer. Les **obligations** protègent les données ; les idées de refactor sont dans [AUTOMATISATION.md](AUTOMATISATION.md).

## 1. Frontières d'architecture

| Couche | Rôle | Invariant |
| --- | --- | --- |
| Moteur original | Générateur, pédagogie, score local, clavier, trophées | Pas d'adaptation artificielle des règles ou modes |
| Lanceur/adaptateur `apps/<slug>/` | Mode libre/Connect, contexte et événements, UX, cache | Pas de privilège ni calcul définitif des XP |
| `hub.js` / `connect-context.js` / `app.js` | Auth élève, accès HUB, professeur | Une URL `class` n'est jamais une permission |
| Edge `connect-api` | Connexion, appareil approuvé, classe/élève, professeur | Auth user et autorisation en base à chaque action sensible |
| Edge `connect-results` | Résultat, restauration, XP, professeur | App activée, identité, contrat, limites, version |
| PostgreSQL / RPC privées | CAS + idempotence, état, acquis, reçus, crédits | Transaction tout-ou-rien ; rôle serveur uniquement |
| `connect-catalog` / `connect-lab-catalog` | Quatre HUB et HUB laboratoire indépendant | Visibilité ≠ habilitation ; POST de labo protégé |
| GitHub Pages | HTML/JS statiques, visuels | Une URL publiée est atteignable directement |

**Références réelles :** `apps/calculs-melanges/{connect-host.mjs,completion-contract.mjs,connect-hydration.mjs,offline-queue.mjs,sync-protocol.mjs}`, `apps/addition-plusieurs/`, `supabase/functions/{connect-api,connect-results,connect-catalog,connect-lab-catalog}/index.ts`. **Ne pas copier tels quels** leurs app_keys ou contrats.

Une iframe peut être utile pour conserver un moteur lourd ; si elle envoie `postMessage`, valider **source de fenêtre + origine + schéma**, y compris lorsque plusieurs apps partagent l'origine Pages. Capturer la fin après la sauvegarde/trophées natifs, avec garde de réentrée et UUID stable ; ne pas confondre `lastWork` et preuve de fin. Versionner séparément moteur, schéma d'état, événement, politique XP et SQL.

## 2. Identité et partition

- Identités distinctes : utilisateur Supabase Auth, appareil approuvé, fiche élève serveur, inscription active à une classe, professeur avec `can_manage`. Résoudre la fiche **sur serveur**, vérifier appareil actif, classe et permission, et comparer avec `expectedStudentId` plutôt que croire un UUID transmis.
- Une session anonyme sur appareil partagé peut être réaffectée : **la fiche serveur change** sans forcément changer le sujet JWT. Scoper file/cache par `app_key + mode + classe + sujet Auth + élève serveur`, vérifier avant chaque synchronisation et hydratation.
- Libre, simulation et Connect sont des compartiments séparés, y compris `sessionStorage` Master, préférences, récompenses et fichiers temporairement cachés. Aucun transfert implicite du libre vers Connect.
- Session enseignant distincte de session joueur. Monsieur T passe par **sa fiche joueur existante et son appareil élève approuvé**, non par le JWT professeur. La projection collective garde ses protections et n'affiche aucun classement individuel sans décision spécifique.
- JWT valide n'est pas, seul, une permission ; serveur vérifie le statut d'approbation et l'inscription actifs et refuse appareil révoqué. Ne pas mettre les secrets `service_role` en JS public.

## 3. Résultat, restauration et hors ligne

Contrat type **illustratif** (adapter aux activités, ne pas inventer `score` pour un outil sans score) :

~~~json
{
  "schemaVersion": 1,
  "appKey": "app-key-stable",
  "eventId": "uuid",
  "classId": "uuid-classe",
  "expectedStudentId": "uuid-fiche-resolue",
  "expectedRevision": 0,
  "expectedResetEpoch": 0,
  "mode": "classic",
  "level": 1,
  "score": 4,
  "total": 4,
  "proof": {"optionsAtStart": [], "firstTry": true}
}
~~~

**Serveur :** vérifier schéma, classes/modes réellement admissibles, aide/Master, bornes, cohérence des calculs ou journaux, app activée, permissions et identité. Une preuve client structurée n'est **pas** une attestation cryptographique contre la triche. Taille bornée et aucune frappe individuelle envoyée. Résultats conservés par (`student_id`, `app_key`) avec `revision`, `reset_epoch` ; records distincts par longueur/méthode si moteur le nécessite, mêmes jalons seulement si politique choisie.

**Séquence :** identité + `student-load` (état et époque) → hydratation des caches dérivés du jeu si aucune écriture locale pendante → fin native unique → événement UUID durable dans file isolée → RPC transactionnelle serveur (`état, preuves, XP, reçu`) → ACK strictement corrélé (événement, app, élève, époque, révision, et classe si présente au contrat) → suppression **après** ACK → animation delta crédité → relire file. Une requête en vol ; en cas de 409, **arrêt + résolution prudente**, jamais « dernière sauvegarde gagne ». Un timeout garde l'événement original. Duplicata reconnu donne `delta=0`. Les reçus serveur doivent rester suffisamment durables, indépendamment du journal court visible.

**Hors ligne :** une partie déjà chargée peut produire un événement conservé sans réseau si le moteur le permet ; cela **n'implique pas** qu'on puisse démarrer une nouvelle session Connect totalement hors ligne. Tester la promesse concrète de chaque jeu. File pleine (100 dans Mélange) = refus explicite de nouvelle preuve, pas suppression silencieuse. `resetEpoch` changé = quarantaine locale des anciens événements de ce parcours, sans les rejouer ni altérer les autres jeux. L'hydratation ne doit pas ressusciter les trophées pré-reset.

**Parcours professeur :** reset élève ou classe **et une seule app** ; archive du parcours, incrément `resetEpoch`, états/records dérivés cohérents et conservation des XP historiques. `repeatXp=false` par défaut ; un rejeu avec XP exige une permission enseignant explicite et des garanties de crédits bornés, distinctes du score affiché.

## 4. XP, niveaux et pédagogie

- XP serveur = droits à des **jalons prouvés**, non points locaux, nombre de clics ou de parties. Le professeur choisit le barème pour la **nouvelle** app ; écrire les exemples puis les tests **avant** la migration. Une app-outil sans XP est légitime.
- Barèmes historiques **non universels** : proposition de 500 XP normalisés (supplantée) ; 474 XP théoriques pour plusieurs calculs écrits compatibles ; **Mélange 594**, 198 par niveau, 9 règles et version de barème 3. Ne pas propager 594/474 aux futurs jeux par défaut.
- **Mélange, exemple contractuel actif vérifié dans code/migration :** sélection initiale 1/2/3 opérations = droits 25/50/100 %, même si tirage réalisé contient moins de familles. Niveau 1, 4/4 : 7 → complément +7 (total 14) → complément +14 (total 28) → répétition +0. Cumul avant arrondi : /10 parfait 46 × 25 % donne 12, /20 parfait 76 × 25 % donne 19. Ne jamais arrondir indépendamment chaque bonus.
- Les jalons d'un même acquis s'améliorent par **différence du droit déjà crédité** ; les méthodes de soustraction peuvent conserver deux records distincts sans multiplier les XP si c'est la règle pédagogique. Les modes Master, entraînement, abandons, HARD non accessible n'engendrent pas de crédit par simple présence de clé.
- Niveau global : respecter la formule **effectivement appliquée** par les RPC/HUB du moment et son caractère cumulatif entre `app_key`, sans introduire de nouvelle courbe par jeu. Les textes historiques ont plusieurs courbes incompatibles ; vérifier `connect_xp_read_v2` et la fonction de lecture appropriée. L'animation UI n'accorde rien : elle découle du delta ACK confirmé, du niveau et des seuils reçus. Tester popup **et** vol vers jauge, y compris les préférences de mouvement décidées avec le professeur.

## 5. SQL, Edge, permissions et migration

- **Preflight read-only :** `main`, SQL des fonctions, schéma de migration/historique, inventaire `connect_apps`/presets/règles concernés, RLS, grants, signatures RPC, versions Edge live, checks et empreintes. Ne jamais lire les résultats d'élèves réels pour un simple déploiement.
- Méthode de migration **unique** : soit CLI/outil gère la transaction et `schema_migrations`, soit SQL enveloppé gère une seule exécution/une seule entrée. Pas les deux. Tests PostgreSQL jetable : échec tardif rollback complet, concurrence, réapplication rejetée, ancienne app inchangée. Ne pas exécuter `supabase db push` aveuglément : migrations historiques locales et versions réelles ne coïncident pas partout.
- Les RPC `SECURITY DEFINER` fixent `search_path`, vérifient la portée, refusent `PUBLIC`, `anon`, `authenticated` quand internes et n'accordent `EXECUTE` qu'au rôle serveur requis. RLS sur toutes tables exposées. Les politiques `TO authenticated` sans restriction de ligne ne suffisent pas ; ne pas autoriser avec `user_metadata` éditable. GET public des catalogues peut être non-JWT intentionnellement ; POST administratif exige JWT + autorisation en code.
- `connect-results` et `connect-api` sont en production avec `verify_jwt=true` à l'instantané de référence. **Aucune Edge n'est déployée par fusion GitHub.** Geler les empreintes SQL/Edge du candidat, comparer au live le jour même, déployer le minimum et relire versions/résultats.
- **Rollback :** masquer la carte et fermer les accès de l'app nouvelle sans effacer états, migrations, XP, reçus ni données des autres apps. Éviter un retour au schéma global ancien sur données nouvelles.

## 6. Professeur, laboratoire et performance

`GLOBAL` = matrice de catalogue des quatre espaces Observation, Phase 1, Phase 2, 2 ECO ; distincte du HUB de test. Les résultats professeur ont une vue classe/élève avec vue compacte, détails au clic, historique et reset strictement limité à `app_key`. Les tables minimales de multiplication sont propres à l'app, avec priorité configuration élève puis classe ; « minimum » ne signifie pas « seule table tirée ». Ne pas toucher aux réglages d'un autre jeu. Pour Monsieur T, vérifier **la séparation des sessions** et l'unicité de sa fiche.

Laboratoire existant : `laboratoire.html`/`laboratoire.js`, classe fictive dédiée, connexion élève **native** avec approbation, catalogue test indépendant (Edge `connect-lab-catalog` et table `connect_lab_hub_visibility`), confirmation fictive avant tests. Une case « Afficher » de ce HUB ne remplace ni l'activation serveur ni l'ouverture des quatre catalogues. Un appareil approuvé ailleurs ne fournit pas de session dans le navigateur courant.

Performance sur PC école / GSM : aucun SDK en libre si inutile, assets WebP légers approuvés, cache maîtrisé, une lecture compacte au chargement et une écriture par vraie fin, aucune requête par frappe ni par image animée, aucun polling XP ; limites réseau et taille file ; test 320 px, focus de saisie, pavé numérique, retenues/emprunts, clavier physique, déconnexion, retour et chargements réels. Les miniatures doivent provenir du visuel fourni/validé et être vérifiées sur Pages, catalogue et fallback statique. Conserver leurs couleurs/composition sans substitution arbitraire.