# Prépublication masquée — Addition de plusieurs nombres
**30 octobre 2026 — PR nº 29 — plan, pas une autorisation de déployer.**

## État constaté
- `main` toujours non modifiée par cette PR. Le moteur V6.0.2 est conservé.
- Les trois verrous du **code versionné** restent fermés : `CONNECT_WRITE_READY=false`, `ADD_MULTI_SERVER_READY=false`, `ADD_MULTI_TEACHER_READY=false`.
- Les quatre HUB n'ont pas la nouvelle entrée dans `hub-catalog.json`. Le catalogue Edge ne retourne que les presets `visible=true` liés aux applications `enabled=true`.
- Lecture seule de la production Supabase Math'as Connect le 30/10 : **0** app, **0** preset, **0** règle XP, **0** fonction atomique Addition multiple. Dernière migration appliquée : Soustraction simple du 28/10.
- La migration `20261029_addition_multiple_catalog_stage.sql` ajoute `enabled=false`, quatre entrées `visible=false`, neuf règles XP ; depuis cet audit elle **échoue volontairement** si elle trouve déjà une entrée activée ou visible. Ses exécutions répétées et ses rejets sont testés sur PostgreSQL éphémère.
- Comparaison en lecture seule du 30/10 entre la production et les quatre RPC candidates du dossier `tests/postgres` : leur corps ne diffère que par l'ajout de `addition-ecrite-multiple` à la liste des applications autorisées (une ligne par fonction). **À refaire le jour du déploiement**, car la production peut évoluer entre-temps.
- Recette réunifiée GoTrue local / Chromium / vraie Edge / vraie base / interface professeur : [réussie en CI](https://github.com/Mr-Tat/Mathas-Connect/actions/runs/40960928938).

## Ce que « publication masquée » signifie réellement
Fusionner le code statique dans `main` rendrait le fichier `/apps/addition-plusieurs/` **techniquement accessible par URL directe**, même si aucun des quatre HUB n'affiche sa carte. Avec les trois verrous fermés, le jeu demeure en mode laboratoire/libre, **sans XP Connect ni résultat enregistré**. Un lien non listé n'est **pas** une protection d'accès.

**Ne pas fusionner** tant que le professeur n'a pas explicitement accepté cette nuance et donné son feu vert à la publication technique masquée. Une invisibilité absolue exige une autre méthode de publication (ou contrôle d'accès), pas simplement un preset invisible.

## Déroulement proposé, sous autorisations séparées
1. **Avant tout déploiement** : vérifier le SHA de `main` et le diff PR ; exécuter les sept workflows ; vérifier les trois verrous, l'absence des liens dans les quatre HUB, le moteur original, et les droits `service_role` des RPC candidates.
2. **Préparer une sauvegarde logique des définitions SQL en lecture seule** (pas de résultats élèves) ; re-comparer les 4 fonctions `connect_parcours_restart_class`, `connect_parcours_restart_one`, `connect_xp_read_v2`, `connect_xp_sync_v2` avec les candidates. Refuser l'étape si une différence de logique apparaît.
3. **Sur accord explicite uniquement**, créer/appliquer la migration additive de catalogue (`enabled=false`, quatre `visible=false`) et les nouvelles définitions RPC, idéalement dans une transaction contrôlée avec journal et plan de retour. Le projet Connect est en production : ne pas utiliser `db reset` ni une migration destructive.
4. **Sur accord explicite distinct**, fusionner la PR et publier les fichiers statiques en masqué. Vérifier la présence de la page par URL directe, mais son absence de tous les HUB. Confirmer que l'Edge rejette l'app tant que son verrou est fermé.
5. Pour des **essais Connect réellement hébergés**, définir une stratégie autorisée : projet TEST réactivé si forfait/place disponible, ou compte/classe fictifs isolés sur le projet actif avec toutes les précautions et l'accord du professeur. Les essais locaux réussis ne couvrent ni les déploiements réels, ni la persistance native de la session navigateur sur PC élève.
6. Réaliser l'essai pédagogique manuel : quatre modes, clavier et retenues, trophées, animation +XP qui vole vers la jauge, historique des résultats et remise à zéro indépendante, vieux PC d'élève peu performant ; reconnection, coupure réseau.
7. **Seulement sur feu vert pour l'ouverture aux élèves** : activation graduée et contrôles des quatre espaces ; préparer le plan de retrait immédiat, surveiller les erreurs sans polling supplémentaire.

## Arrêts immédiats
- Tout test vert basé uniquement sur un mock ne vaut pas validation sur un hébergement réel.
- Fonction XP/Edge/code client désynchronisés ; risque de résultat sauvé sans XP : **stop**.
- Apparition d'Addition multiple dans un HUB avant autorisation : **stop**.
- Mutation des résultats, XP ou parcours d'un autre jeu ou d'un autre élève : **stop**.
- Besoin de réactiver Mathas-Test, de libérer une place ou d'engager des coûts : **demander l'accord**.

## Références versionnées
- `docs/AUDIT_ADDITION_PLUSIEURS_2026-10-29.md`
- `tests/addition-plusieurs-publish-guard.test.mjs`
- `.github/workflows/addition-plusieurs-stage.yml`
- `tests/postgres/addition-multiple-rpc-candidate.sql`
- `tests/postgres/addition-multiple-atomic-rpc-candidate.sql`
- `supabase/migrations/20261029_addition_multiple_catalog_stage.sql`

## Package SQL de publication verrouillée — préparé le 30/10, non déployé

**Fichiers de recette :**
- `supabase/release-candidates/addition_multiple_locked_v1.sql` : SQL complet de première installation, **une seule transaction**, 4 fonctions existantes avec uniquement l'extension de liste d'applications, nouvelle RPC atomique, catalogue désactivé avec 4 presets invisibles et neuf règles XP (158 XP par niveau).
- `supabase/release-candidates/addition_multiple_disable_only.sql` : arrêt d'urgence **non destructif**. Ne désactive que le catalogue et les presets du nouveau jeu, **sans effacer les résultats, trophées ou XP** ; les verrous client/Edge doivent aussi rester fermés si le code connecté a été activé séparément.
- `.github/workflows/addition-multiple-release-preview.yml` : prévisualisation intégralement **jetable**, sans aucun secret ni lien Supabase hébergé. Vérifie l'empreinte de quatre fonctions sur une base reconstituée, le refus d'une fonction divergente, une installation réelle, les droits SQL, les 4 HUB invisibles, les XP et les trophées, et le refus d'une nouvelle exécution.
- `tests/addition-plusieurs-release-bundle.test.mjs` : contrôle que le paquet SQL correspond exactement aux trois sources SQL candidates et ne contient aucune suppression d'acquis élèves.

### Alerte : ne pas lancer `supabase db push` contre ce dépôt

Le dépôt contient des fichiers `supabase/migrations/20261026_...`, `20261028_...` et `20261029_...` alors que l'historique effectif `supabase_migrations` de Math'as Connect enregistre des versions **à 14 chiffres** créées par les outils Supabase (exemple `20261028220546` pour Soustraction). Les noms et versions ne sont donc pas alignés. Un `db push` global peut essayer de rejouer des migrations déjà exécutées ou en appliquer d'autres non souhaitées.

**Le nouveau paquet est volontairement placé sous `supabase/release-candidates/` plutôt que `supabase/migrations/`**. Il n'est pas une migration Supabase CLI prête à pousser. Avant toute application autorisée, rapprocher les historiques et choisir une méthode de migration enregistrée une seule fois. Employer la CLI pour créer le nom/version de migration, jamais un timestamp inventé.

### Garde de version sur les fonctions officielles

La production a été contrôlée le 30/10 par requêtes SQL **en lecture seule**. Le paquet garde les empreintes MD5 de `pg_get_functiondef` des quatre RPC installées :
- `connect_parcours_restart_class` : `62194222ad2e5cfaec4999cea3f5363c`
- `connect_parcours_restart_one` : `eec598806f7950112b21920689a45baa`
- `connect_xp_read_v2` : `c5b879034329e6e03b7547e9661f642e`
- `connect_xp_sync_v2` : `d3a11bdef68483ccffa4ffe2c2b13f35`

La transaction refuse toute empreinte modifiée, tout droit RPC public existant anormal et toute fonction atomique déjà présente. Elle refuse aussi toute entrée catalogue déjà activée/visible et vérifie en fin de transaction les 4 presets invisibles, les 9 règles, les 158 XP et les droits des 5 RPC au rôle `service_role` seulement. Toute erreur annule **l'ensemble** de la transaction. Il ne faut jamais supprimer ces gardes pour forcer un déploiement : si la production a changé, reconstituer une candidate revue et tester à nouveau.

### Limites du retour arrière

- **Avant installation** : aucune action requise, rien n'a été touché.
- **Erreur d'installation** : la transaction SQL complète effectue automatiquement un rollback PostgreSQL.
- **Après installation mais avant ouverture du jeu** : l'arrêt d'urgence peut rendre le catalogue désactivé/invisible, en conservant le schéma et les données. Il n'est pas nécessaire de supprimer les RPC pour retirer la visibilité.
- **Après ouverture effective aux élèves** : conserver les résultats et XP acquis ; ne jamais restaurer une ancienne table ou effacer les crédits. Les modules client et Edge doivent être remis en mode sécurisé par une procédure de livraison de code indépendante.

**Accord du professeur indispensable pour toute migration réelle, fusion, publication masquée ou activation.** Ce document ne constitue pas cet accord.
