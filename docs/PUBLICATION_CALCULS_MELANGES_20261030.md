# Mise en service de Calculs écrits mélangés

30 octobre 2026. Procédure exécutable préparée pour la suite de l’intégration demandée. **Aucune étape hébergée ci-dessous n’a encore été exécutée.** Le professeur conserve la main sur l’ouverture aux élèves et la visibilité des quatre HUB.

## Livrables et état actuel

- Branche : `integration/calculs-melanges-connect-20261030`, basée sur `main` `91bcca7aba97d9fb00460a7e4ff56a0675f1459b` au dernier contrôle. Moteur source inchangé : `e11c88b4e449e8cdb17b0fee78c7daa6ea5bf279`.
- Intégration élève/Monsieur T, preuves 4/10/20 séparées, file offline, ACK, XP serveur, résultats et reset professeur : réalisés et testés localement.
- Trois constantes compilées restent `false` : client `CONNECT_WRITE_READY`, Edge `MIXED_SERVER_READY`, professeur `MIXED_TEACHER_READY`.
- Nouvelle portée Edge `CONNECT_MIXED_ACCESS` : `closed` par défaut ; `pilot:<uuid-classe-fictive>` pour la recette ; `open` pour l’ouverture ultérieure. Plusieurs classes pilotes sont séparées par des virgules. Une configuration inconnue ou malformée refuse l’accès. Cette portée ne donne jamais de droits : l’authentification, l’approbation et l’inscription restent obligatoires.
- SQL d’installation désactivé/invisible, activation masquée contrôlée et arrêt non destructif sont séparés. La carte reste absente du catalogue statique.
- La sauvegarde chiffrée existante conserve ses 25 tables avant installation ; après installation du catalogue Mélange, elle inclut obligatoirement les reçus anti-doublon et les minimums de tables, soit 27 tables. Une lecture manquante empêche la publication d’une sauvegarde incomplète. Aucune sauvegarde hébergée n’a été déclenchée ici.

## 1. Appliquer les accès de l’environnement cloud

Le brouillon de configuration enregistre les destinations nécessaires, en conservant les presets réseau existants :

```
api.github.com
api.supabase.com
awmhpfofacaglewammxt.supabase.co
mr-tat.github.io
esm.sh
```

Il déclare également `SUPABASE_ACCESS_TOKEN`, à renseigner **dans les paramètres sécurisés de l’environnement**, avec destination limitée à `api.supabase.com`. Ne jamais transmettre ce secret dans le chat, un script ou un commit. L’authentification GitHub est déjà injectée ; ne pas ajouter de second jeton sans preuve d’un refus d’autorisation après déblocage réseau.

**Enregistrer le brouillon n’applique pas ses changements à la machine courante.** Appliquer les paramètres avec l’interface cloud, puis vérifier les accès. Publier cet environnement de développement est distinct de publier Math’as Connect.

## 2. Revoir les références, créer la PR et contrôler la CI

Depuis le dépôt Connect :

```sh
git fetch origin main
git ls-remote origin refs/heads/main
git ls-remote https://github.com/Mr-Tat/Melange-calculs-ecrits-1.git HEAD
node scripts/calculs-melanges-release.mjs plan
gh pr create --draft --repo Mr-Tat/Mathas-Connect --base main --head integration/calculs-melanges-connect-20261030 --title "Calculs écrits mélangés : intégration Connect, XP 594 et mise en service contrôlée" --body-file docs/PR_CALCULS_MELANGES_DRAFT.md
```

Si un HEAD a changé, comparer les modifications et refaire les contrôles concernés. Vérifier les workflows distants de la PR, notamment `Calculs melanges - local integration and release checks`. Un lien de création n’est pas une PR créée et une recette locale ne prouve pas que la CI distante est passée.

Le plan donne les empreintes SHA-256 des trois fichiers à ouvrir et des fichiers SQL ; il ne contacte aucun service hébergé. Conserver un nouveau plan pour chaque commit de publication.

## 3. Auditer la cible sans données élèves

```sh
node scripts/calculs-melanges-release.mjs audit --stage before-install --output /tmp/mathas-mixed-before.json
```

Ce programme utilise exclusivement le endpoint officiel **`POST /v1/projects/awmhpfofacaglewammxt/database/query/read-only`**. Il lit le schéma PostgreSQL, les contraintes/index, les droits et empreintes des fonctions, ainsi que les seules entrées de catalogue Mélange. Il ne lit aucune identité, aucun résultat, aucun crédit ni aucun appareil élève. Il respecte le proxy et TLS ; le jeton passe par stdin vers curl, jamais dans ses arguments ou un fichier. Aucun repli vers le endpoint SQL modifiable n’est prévu.

Le contrôle refuse les colonnes/types incompatibles, les clés uniques manquantes, les nouvelles colonnes obligatoires sans valeur par défaut, un namespace Mélange préexistant et, après installation, des droits publics ou des règles XP divergentes. Relire également les contraintes et triggers de la cible : le résultat `ok` est un précontrôle structurel, **pas une validation de la production complète**.

Télécharger séparément la source **actuellement déployée** de `connect-results` dans un répertoire temporaire via le CLI officiel (`functions download connect-results --project-ref awmhpfofacaglewammxt --use-api`). Comparer avec la version de base sur `main` ; intégrer toute évolution distante indispensable au lieu de l’écraser. Conserver aussi la version et la valeur `verify_jwt` actuelles. Le redéploiement doit préserver ce réglage, l’Edge continuant à vérifier chaque JWT avec `getUser`.

## 4. Installer le SQL masqué une seule fois

Après compatibilité du schéma et revue de la PR/CI, exécuter **le seul fichier complet** :

```
supabase/release-candidates/calculs_melanges_locked_v1.sql
```

Utiliser une opération de migration contrôlée et enregistrée sur le projet `awmhpfofacaglewammxt`, après rapprochement de son historique effectif. Ne jamais utiliser `supabase db push`, rejouer les anciennes migrations, copier une base locale, ni enlever les gardes pour forcer l’installation. Le fichier contient sa transaction ; toute erreur doit annuler l’ensemble.

Puis :

```sh
node scripts/calculs-melanges-release.mjs audit --stage installed-hidden --output /tmp/mathas-mixed-installed.json
```

Vérifier l’app désactivée, les quatre presets invisibles, les neuf règles totalisant 198 par niveau, les cinq RPC privées, les deux tables RLS et l’absence de modification des empreintes des fonctions partagées. La procédure ne remplace aucune RPC des autres jeux.

## 5. Publier le code connecté pour une classe pilote fictive

Créer uniquement les identités/classe de recette nécessaires, sans consulter ni réaffecter les élèves réels. Configurer dans **les paramètres Edge du projet Supabase**, et non simplement dans la machine cloud :

```
CONNECT_MIXED_ACCESS=pilot:<uuid-de-la-classe-fictive>
```

Dans une modification de publication revue, ouvrir exactement :

| Fichier | Constante |
| --- | --- |
| `apps/calculs-melanges/connect-pilot.mjs` | `CONNECT_WRITE_READY=true` |
| `supabase/functions/connect-results/index.ts` | `MIXED_SERVER_READY=true` |
| `app.js` | `MIXED_TEACHER_READY=true` |

Conserver les autres constantes, règles XP et moteurs. Refaire les tests avec les attentes de cette phase ; la recette locale ouvre déjà ces trois constantes dans des copies jetables. Déployer uniquement `connect-results` après comparaison de sa version hébergée, en conservant sa configuration JWT ; ne pas employer `--prune` ni déployer les autres fonctions par défaut. Fusionner ensuite la modification revue et publier les fichiers statiques selon la configuration Pages **réellement constatée**, sans supposer qu’un push de branche publie le site.

Le patch exact des trois constantes est préparé, mais non appliqué :

```sh
git apply --check supabase/release-candidates/calculs_melanges_connect_enable.patch
git apply supabase/release-candidates/calculs_melanges_connect_enable.patch
```

Ne l’appliquer qu’à cette étape, après audit du schéma et de l’Edge. Une divergence de contexte doit être revue, sans application forcée.

Pour autoriser le pilote, exécuter ensuite :

```
supabase/release-candidates/calculs_melanges_enable_hidden.sql
```

Ce fichier refuse des XP modifiés, un preset déjà visible, une signature RPC manquante ou des droits SQL publics ; il active uniquement l’app, sans modifier les quatre presets. Contrôler :

```sh
node scripts/calculs-melanges-release.mjs audit --stage enabled-hidden --output /tmp/mathas-mixed-pilot.json
```

La classe pilote est la seule autorisée par l’Edge. Un profil d’une autre classe doit obtenir `integration_not_open_for_class`, même avec l’URL directe. Une carte invisible ne constitue pas à elle seule un contrôle d’accès.

## 6. Recette hébergée puis ouverture par le professeur

Avec la seule classe fictive : approbation élève, quatre calculs réellement saisis, ACK +28, absence de double crédit, actualisation/rechargement, coupure/reprise réseau, jeu sur un second appareil de recette, page professeur et XP propres au jeu, Monsieur T distinct, minimums de tables, reset Mélange sans recollection et préservation des autres jeux. Vérifier aussi les deux ordres 4→10→20 et 20→10→4 sur l’hébergement réel et les quatre catalogues toujours masqués. Ne pas utiliser un élève réel pour cette validation.

Le barème préparé reste 594 XP de base, avec trois opérations sélectionnées et au moins deux types réellement terminés ; les seuils de mort subite vérifient leur propre préfixe. Les aides restent tracées sans exclusion supplémentaire ; les tables minimales sont propres à Mélange. La miniature est la copie provisoire tracée de l’illustration native. Le journal Connect accepte au plus 1 000 calculs ; au-delà, le résultat natif reste local avec un avertissement. Ne pas réactiver un mode natif caché pour lui attribuer des XP.

Après recette et choix pédagogique final, le professeur peut rendre l’application accessible : passage Edge à `CONNECT_MIXED_ACCESS=open` (ou liste explicite de classes autorisées), puis visibilité choisie individuellement dans la matrice GLOBAL pour Observation, Phase 1, Phase 2 et 2 ECO. Vérifier le catalogue réel de chaque espace après expiration de son cache de 60 secondes. L’app doit rester absente des espaces non choisis.

## Retour arrière sans perte

1. En urgence, portée Edge `CONNECT_MIXED_ACCESS=closed` pour refuser les nouvelles opérations Mélange.
2. Exécuter `supabase/release-candidates/calculs_melanges_disable_only.sql` : désactive l’app et masque ses quatre presets, sans effacer état, XP, reçus, réglages ni archives.
3. Refermer les trois constantes dans une livraison de code revue si nécessaire. Conserver les schémas et acquis ; ne pas restaurer une ancienne table de résultats ou supprimer des crédits.

Pour reprendre après un retrait, les files restent conservées et les reçus protègent contre les doublons. Le code client doit être rechargé pour reprendre une session refusée pendant la fermeture.
