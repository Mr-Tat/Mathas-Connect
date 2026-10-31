# Sources, contradictions et état vérifié

**Instantané de rédaction : 31 octobre 2026**. Ce fichier est **une photographie documentée**, non le tableau de bord perpétuel de production. Un agent doit refaire les vérifications de `main`, GitHub Pages, Supabase et des versions déployées au début de chaque mission.

## Origine et hiérarchie

**Sources fournies par le professeur :**
- `PASSAGE_FLAMBEAU_GUIDE_INTEGRATION_MATHAS_CONNECT_2026-10-31.zip` : historique, audit, contrats, checklist, RETEX, décisions.
- `Mathas-Connect-guides-integration.zip` : bilan/guide Codex Mélange, matrice des accès, analyse des prochains moteurs, prompt de travail.

**Vérifications réalisées directement, en lecture seule :**
- HEAD `main` GitHub : `4c99ce322963b1abd3620cca0f29e194edc14bd3` au moment de la rédaction, et arbre complet du dépôt.
- Fichiers réellement lus : `README.md`, `hub.js`, `app.js`, `laboratoire.js`, `hub-catalog.json`, `docs/CONNECT_GAME_CONTRACT_V0.md`, `docs/REGLES_XP_NIVEAUX_ET_INTEGRATION_V1.md`, `docs/LABORATOIRE_HUB_ISOLE_20261031.md`, `docs/PUBLICATION_CALCULS_MELANGES_20261030.md`, modules `apps/calculs-melanges/*` et `apps/addition-plusieurs/*`, Edge `supabase/functions/*`, workflows, tests et candidats SQL.
- Supabase Connect : liste réelle des migrations (jusqu'à `20261031112439`), versions Edge `connect-api` v25, `connect-results` v40, `connect-catalog` v2, `connect-lab-catalog` v1, chacune active à la lecture. `connect-api` et `connect-results` déclarent `verify_jwt=true` ; les deux catalogues publics `false` avec contrôles particuliers dans le code.
- SQL **métadonnées de catalogue/XP uniquement** : `addition-ecrite-multiple` et `melange-calculs-ecrits` présentes et activées ; leurs règles XP déclarent respectivement 9 jalons × 158 par niveau et 9 × 198 par niveau ; laboratoire isolé présent en code. **Aucun résultat réel lu.**
- Lecture des chemins de code : `apps/calculs-melanges/sync-protocol.mjs` vérifie l'ACK avant de retirer la file ; `completion-contract.mjs` vérifie le choix d'opérations au départ, y compris en HARD ; `connect-results/index.ts` gère les branches spécifiques de jeux ; `connect-lab-catalog/index.ts` filtre le HUB laboratoire indépendamment.

**Limite :** lecture des versions Edge et du dépôt **ne prouve pas** l'exactitude des octets Edge LIVE, la réussite actuelle d'une partie élève authentifiée, la conformité de Pages au dernier commit, ni l'exécution d'une recette complète sur un vrai PC scolaire. Ces preuves doivent être collectées à l'intégration concernée.

## Arbitrages des anciennes recommandations

| Assertion des ZIP / archives | Décision du guide | Fondement |
| --- | --- | --- |
| « Aucun jeu n'est synchronisé », « XP non implémentés », « Soustraction encore à intégrer » | **HISTORIQUE / dépassé** ; ne pas réutiliser comme état actuel | Docs de conception d'octobre vs code, migrations, Edge actuels |
| « 500 XP pour toute application » | **HISTORIQUE / écarté** | Ancienne `REGLES_XP…` ; modèles actuels par `app_key` |
| « 474 XP pour toutes les futures apps » | **Non universel** | Contrats 474 compatibles ; Mélange défini à 594 |
| « Barème Mélange selon familles réellement tirées » | **Obsolète** | Contrat Mélange prend opérations **sélectionnées au départ** |
| « Cache meilleur score natif suffit au crédit /4, /10, /20 » | **Incomplet** | Records Connect ventilés par niveau et longueur |
| « Source originale inchangée donc aucune adaptation de la copie » | **Trop absolu** | Manifeste Mélange décrit hooks minimaux et deux réparations de saisie |
| « Une simulation ou CI Chromium vaut recette publiée » | **Faux** | Besoin de vrai navigateur authentifié, profil fictif, ACK serveur |
| « Tout `node --test tests/*.test.mjs` est hors réseau » | **Faux aujourd'hui** | Des `*.test.mjs` font des GET vers des services publics |
| « Une case test Afficher ouvre la carte aux quatre classes » | **Faux** | Catalogue laboratoire indépendant |
| « Toute fusion Pages redéploie Supabase » | **Faux** | Les Edge et SQL demandent livraison distincte |
| « Il faut un PAT dès qu'un terminal Git manque de GH_TOKEN » | **Faux** | Tester les capacités de connexion/outils avant de réclamer un secret |
| « Il faut recopier les 5 RPC du jeu précédent » | **Non justifié** | Choisir la surface minimale selon contrat et sécurité |
| « On doit toujours récompenser HARD 5 calculs » | **Faux** | Seuls les modes réellement accessibles comptent |
| « On peut démarrer Connect offline parce que la file supporte offline » | **Non prouvé** | Distinguer fin de partie hors ligne et lancement initial sans session |

**Réserves importantes :** la suite de tests et les sources SQL versionnées ne garantissent pas à elles seules qu'une production a été testée après fusion. Les décisions pédagogiques restent aux mains du professeur. Les évolutions de Supabase/outil CLI doivent être recontrôlées avec la documentation/version courante avant chaque migration.

## Enrichissement attendu

Pour chaque intégration, ajouter aux nouvelles fiches et PR : commit, versions Edge, manifestes SQL, tests avec catégories de preuve, arbitrage XP et problème corrigé. Mettre à jour ce fichier **seulement si un principe commun change** ; ne pas le transformer en journal de chaque micro-commit.