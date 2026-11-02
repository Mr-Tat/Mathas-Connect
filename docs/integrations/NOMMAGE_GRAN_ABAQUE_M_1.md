# GRAN-abaque-m-1 : nom et dépôt de référence

**[DÉCISION professeur — 2 novembre 2026]** Chaque application garde son dépôt autonome. Le nom retenu pour cet exercice est `GRAN-abaque-m-1` : Grandeurs, utilisation de l’abaque, longueurs en référence au mètre, premier parcours. Le préfixe `CE` des applications de calcul écrit reste propre à ce domaine ; cette demande ne renomme pas les autres applications.

**[REPO vérifié]** Le dossier autonome est `/workspace/GRAN-abaque-m-1`. Les évolutions du moteur et de l’accueil sont réalisées dans ce dépôt. Connect intègre une version Git identifiée dans `apps/GRAN-abaque-m-1/`. `scripts/sync-gran-abaque.mjs` vérifie la source propre et son commit ; `--write` copie la version, les assets et les empreintes. Il refuse d’écraser la candidate authentifiée, qui possède ses hooks de preuve supplémentaires.

| Élément | Nom retenu |
| --- | --- |
| Dossier du dépôt autonome | `GRAN-abaque-m-1` |
| Nom GitHub demandé | `Mr-Tat/GRAN-abaque-m-1` |
| Dossier de la copie versionnée Connect | `apps/GRAN-abaque-m-1/` |
| Identifiant de données conservé | `abaque-longueurs` |
| Ancienne adresse Connect | `apps/abaque-longueurs/`, redirection compatible |

Le nom du dossier ne renomme pas l’identité des résultats. Les clés de stockage, l’`app_key`, les droits XP et les trophées existants restent stables. L’ancienne adresse préserve les paramètres de classe/connexion et le fragment.

Le mode normal du dépôt autonome conserve son stockage historique. Son `?demo=1` utilise le stockage distinct du Laboratoire. La copie de démonstration Connect ne modifie que `environment.js` pour sélectionner ce dernier ; son moteur, son CSS et ses modules de présentation proviennent du dépôt autonome. Le mode Connect authentifié reste candidat et fermé.

**[CI locale — 02/11/2026]** Source autonome `69ed04ece90faae317dee8a2ce2d6c4224d0d763` : onze contrôles réussis, dont dix scénarios Chromium. Copie Connect : dix-sept contrôles contrats/Chromium réussis. Les tests vérifient l’ancienne adresse, la conservation des paramètres de classe/connexion et du fragment, les résultats locaux après redirection, les deux espaces de stockage et les empreintes de la source. La synchronisation réexécutée ne produit aucun changement.

**[LIVE vérifié, accès — 02/11/2026]** Git fonctionne. La lecture API puis la requête réelle `PATCH /repos/Mr-Tat/abaque-m-1` pour renommer le dépôt ont été refusées (`Forbidden`). L’identifiant GitHub est déjà présent ; aucun nouveau jeton n’a été demandé. Le nom distant n’est donc pas encore changé. Les remotes et `sourceRepository` gardent le nom distant vérifié jusqu’à confirmation du renommage ; `repositoryDisplayName` indique le nom demandé. L’accès réseau à `api.github.com` est préparé dans le brouillon cloud, sans être observé comme appliqué au runtime.
