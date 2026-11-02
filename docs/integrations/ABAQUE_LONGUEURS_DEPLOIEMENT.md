# Abaque — lot Connect fermé — 2 novembre 2026

**[PROPOSÉ]** Projet Connect `awmhpfofacaglewammxt`, app `abaque-longueurs`. Aucun SQL, déploiement Edge ou pilote hébergé n’a été exécuté dans cette mission. Le professeur a autorisé la publication directe de la seule démonstration sur `main`, pas ce lot serveur.

## Contenu à autoriser

1. Installer les nouvelles tables/RPC désactivées, avec une seule ligne d’historique atomique. Aucun changement des RPC existantes. Fichier source : `supabase/release-candidates/20261102_abaque_longueurs_v1.sql` ; empreintes de livraison dans `abaque_installation_manifest.json`.
2. Déployer `connect-abaque` et la modification ciblée de `connect-api` du même commit approuvé. La nouvelle Edge refuse tout par défaut (`CONNECT_ABAQUE_ACCESS=closed`). La modification de l’API commune sélectionne le nouveau résumé uniquement lorsque le drapeau est `pilot` pour la classe TEST ; sinon son appel historique est conservé.
3. Publier les fichiers statiques de cette branche sur Pages : même moteur et même URL que la démo, mode connecté uniquement avec `?connect=1&class=…`. La démo sans paramètre reste isolée. Le serveur contrôle chaque identité et classe indépendamment de l’URL.
4. Après sélection explicite des seuls profils fictifs approuvés, activer le pilote de la classe `4bf3400d-a315-4ea4-a2f3-afaca24dc9b9` (« Classe démo - TEST »). Passer le drapeau Edge à `pilot` puis montrer sa carte dans le catalogue indépendant du Laboratoire. Aucune entrée dans les HUB scolaires.

**[DÉCISION professeur]** Le prompt final demande un accord préalable pour les écritures SQL et déploiements Edge de production. Il faut donc une autorisation pour ce lot avant exécution. Les identifiants de profils fictifs restent dans un fichier local privé, jamais dans le dépôt.

## Préparation et contrôles

**[CI locale]** `bash tests/local/run-abaque-local.sh` exécute sur Docker jetable les mêmes sources SQL et Edge, avec Auth véritable et navigateur Chromium. L’installation fermée enregistre le corps SQL exact, bloque un deuxième passage, puis les tests vérifient 160 XP, six trophées, concurrence, rollback tardif, révocation, réaffectation, reset, hors ligne, autre appareil et permissions professeur. Cela ne prouve pas une session authentifiée sur Supabase hébergé. La décision du [montage de l’accueil](ABAQUE_LONGUEURS_ACCUEIL_20261102.md) réserve les trois nouvelles coupes à Mort subite, aux pages 3/5/8 ; le serveur vérifie aussi 80 % dans chaque format classique avant les deux variantes record.

**[REPO vérifié]** Les outils de préparation n’ont aucun accès réseau :

```bash
node scripts/abaque-release.mjs manifest
node scripts/abaque-release.mjs audit-sql > /tmp/abaque-schema-readonly.sql
node scripts/abaque-release.mjs validate /tmp/abaque-live-audit.json
node scripts/abaque-release.mjs prepare-install /tmp/abaque-live-audit.json /tmp/abaque-install.sql
```

Le nouvel audit doit être exécuté en lecture seule sur le projet cible, puis son résultat enregistré dans `/tmp/abaque-live-audit.json`. Il lit uniquement métadonnées, contraintes, empreintes de fonctions/triggers et historique de migrations ; aucune identité, réponse, XP ou note d’élève. Examiner les contraintes, index, triggers et versions Edge réels avant d’approuver l’installation. En cas de divergence, ajuster la candidate et refaire les validations concernées.

L’installateur généré vérifie à nouveau l’empreinte du schéma et de l’historique sous verrou, exécute le corps candidat et enregistre une seule migration `20261102020000_connect_abaque_longueurs_closed_v1` dans la même transaction. Toute erreur annule l’ensemble. **Une seule exécution SQL brute autorisée ; ni `db push` global ni `apply_migration` en plus.** Les historiques gérés à trois ou six colonnes sont acceptés si leurs champs obligatoires sont compatibles. Une migration plus récente impose un rapprochement et une nouvelle version.

Préparer ensuite un JSON local privé contenant `classId` (la seule classe TEST), `fictiveConfirmed: true` et `studentIds` (les UUID fictifs vérifiés, au moins un) :

```bash
node scripts/abaque-release.mjs prepare-pilot /tmp/abaque-fictifs.json /tmp/abaque-pilot.sql
```

Cette commande ne contacte pas le serveur. Le SQL produit contrôle la classe, l’inscription active de chaque UUID et l’absence d’une autre classe ouverte ou d’une carte scolaire. Il permet uniquement les UUID fournis ; une simple inscription au Laboratoire ne suffit pas. Aucun fichier d’activation prêt à créditer des identités inventées n’est livré.

## Recette hébergée à exécuter après accord et accès

- Vérifier le SHA Pages, les versions et empreintes Edge/SQL réellement déployées, l’état fermé, puis l’activation limitée au pilote.
- Depuis le Laboratoire et après confirmation fictive, approuver un appareil fictif et ouvrir l’Abaque via sa carte Connect. Vérifier les XP restants serveur et les trophées au bon endroit.
- Terminer une activité au clavier, contrôler état/reçu/crédit, recharger puis ouvrir sur un second appareil fictif approuvé. Vérifier complément, répétition à zéro, hors ligne/reprise et rejet après révocation.
- Vérifier le résumé HUB et le tableau professeur, la remise à zéro de l’Abaque seule et les trophées permanents. Tester les refus sans autorisation et la non-visibilité dans les espaces scolaires.
- Consigner URL, SHA, versions serveur, migration et résultats sans JWT ni nom réel. La réussite de ces opérations est la porte du pilote hébergé.

## Arrêt et ouverture ultérieure

**[PROPOSÉ]** Arrêt : drapeau `CONNECT_ABAQUE_ACCESS=closed`, puis `supabase/release-candidates/abaque_disable_only.sql` après autorisation. Cette opération masque/désactive l’Abaque et conserve états, reçus, XP, trophées et historique. Aucun retour arrière par suppression de données. L’ancien chemin du résumé HUB est repris lorsque le drapeau est fermé.

Après recette hébergée et validation pédagogique distincte, la même application peut être ouverte à une classe scolaire par `connect_abaque_classes` (activation explicite, `pilot_only=false`), le drapeau Edge `open` et ses cartes de catalogue autorisées. Aucun nouveau moteur n’est nécessaire. **Aucune ouverture scolaire n’est comprise dans le lot pilote.**

**[LIVE vérifié, environnement]** Git lecture/push et pages publiques de CI GitHub fonctionnent. Le runtime cloud reste à la révision 1 ; Supabase et Pages renvoient CONNECT 403 et aucun identifiant Supabase n’y est lié. Les domaines requis et le besoin `SUPABASE_ACCESS_TOKEN` sont enregistrés dans le brouillon cloud. Les valeurs se renseignent uniquement dans les paramètres sécurisés ; leur sauvegarde ne vaut ni autorisation SQL/Edge ni preuve d’accès effectif.
