# Brain Mathing pilote n° 2 — Addition écrite simple → Math’as Connect
**23 octobre 2026 · Audit du code avant intégration · Statut : conception à valider techniquement**

## Périmètre de cet Brain Mathing
Source examinée **en lecture seule** : `Mr-Tat/Addition-ecrite-simple/index.html`, version affichée V6.0.2 ; fichier autonome ~703 Ko dans GitHub, plusieurs images statiques. Aucun jeu, HUB public ni base Supabase historique n'a été modifié. Aucun score Connect n'est encore enregistré.

**Conclusion : conserver le jeu et son moteur pédagogique**, mais **ne PAS brancher une synchronisation générique naïve du `localStorage`**. Prévoir un adaptateur de données versionné et des états distincts par profil.

## Ce qui est réellement stocké dans le jeu
Configuration exacte `window.MathasAppConfig` :
| Famille | Clé de stockage examinée | Destination proposée |
|---|---|---|
| Meilleurs scores classiques | `addition_classic_v1` | **Connect** : synthèse + détails de série 4/10/20 et niveau |
| Meilleurs scores Mort subite | `addition_sudden_v1` | **Connect** : record par niveau |
| Résultats et records HARD | `addition1_hard_sudden_v1`, `addition1_hard_three_v1` | **Connect** : record/évolution, en respectant les variantes |
| Progression et verrous | `mathas_progression_addition_simple_v1` | **Connect** : déblocages et réussites |
| Points et meilleurs records | `mathas_points_v1_addition-simple` | **Connect** : top du jour, top 3 personnels et record absolu, sans confondre points et score brut |
| Collection de trophées | `mathas_trophies_v3_addition-simple` | **Connect** : trophées séparés du top 3 (« médailles ») |
| Historique court et dernière partie | `addition1_last_work`, `mathas_recent_two_scores_v1_addition-simple`, `mathas_scores_` + `location.pathname.toLowerCase()` | **Partiellement Connect** : événements terminés pertinents ; affichage local rapide, pas d'historique brut infini |
| Préférences de jeu | `addition_settings_v1`, `addition1_theme_mode_v1`, `mathas_aids_addition_simple_v1`, `mathas_gamification_v1_addition-simple` | **Local par défaut** : thème, affichage des panneaux, réglages facultatifs ; éventuellement synchronisation optionnelle ultérieure |
| Usage de la réglette | `addition_ruler_usage_v1` | **Métrique ponctuelle**, uniquement `aidUsed` dans la tentative pertinente, pas les gestes détaillés |
| Mode Master | `sessionStorage` lié au chemin de page et `window.__masterMode` | **Jamais synchronisé** : privilège temporaire uniquement |

Attention : existent aussi anciennes clés de trophées (`v1/v2`), score global et anciens calculs de progression ; le jeu possède une logique de **réconciliation non destructive** à l'ouverture (historique/records vers déblocages/trophées). La migration doit préserver les preuves déjà acquises, ne pas créer de doublons et ne pas inclure les faux déblocages visuels du Master mode.

### Règles exactes repérées
- Série classique : 4, 10 ou 20 calculs. Déblocages sur >= 80 % pour 10/20, et sans faute pour des réussites spécifiques.
- Mort subite : score = réussites consécutives et non « score sur 20 ». `score_max` doit être **NULL**, jamais un dénominateur inventé.
- HARD : modes et niveaux distincts ; des résultats ne sont pas forcément directement comparables au classique.
- Les **points** sont une autre unité, calculée via multiplicateurs selon niveau, type de partie et aides ; les médailles affichent les 3 records personnels de points, tandis que les trophées sont une collection d'objectifs.
- Le jeu affiche le meilleur score « du jour » et les meilleurs absolus. Garder l'horodatage UTC d'origine et calculer « aujourd'hui » en fuseau Europe/Brussels lors de la présentation ; ne pas redéfinir « jour » selon une date serveur UTC.
- La réglette de comptage/aide peut être utilisée : il faut conserver un indicateur d'aide sur les événements plutôt que de prétendre que toutes les performances sont sans aide.
- Le Master mode propose **deux remises à zéro différentes** :
  1. « Effacer les résultats » : points, records et trophées effacés ; **progression/déblocages conservés** ;
  2. « Remise à zéro » : efface les scores des séries et les déblocages mais **conserve certains records Mort subite**.
  Ces intentions ne doivent jamais être confondues. Toute suppression doit avoir un mécanisme anti-résurrection depuis un autre appareil (`resetEpoch`/versions).

## Modèle Connect retenu pour le pilote (proposition)
### 1. Profil de sauvegarde
Un identifiant de jeu stable **`app_key = addition-ecrite-simple`**, indépendant de `MathasAppConfig.appId = addition-simple`. Mapping explicite.
`connect_states` contient une **sauvegarde compacte canonique** par (student_id, app_key) :
- `schemaVersion` (format d'échange), `revision` serveur et `resetEpoch` ;
- `progression` (niveaux, mode Mort subite, accès HARD, maîtrise réelle) ;
- `scores` (records pertinents par mode/niveau/4-10-20 ; éventuellement top 3 points et records par jour) ;
- `trophies` (identifiants acquis, par version de barème) ;
- `lastResult` résumé et horodatage ; rien qui ne serve à la récupération n'est gardé par défaut.
Ne pas transférer CSS, préférences d'apparence, clavier, animations, calculs affichés temporairement ou traces de chaque clic.

### 2. Historique de résultats
`connect_attempts` stocke **un événement uniquement à la FIN d'une partie réellement notée**, avec `event_id` UUID stable pour déduplication ; session `launch_id` autorisée et courte ; `student_id/class_id` **déduits côté serveur** du ticket. Attributs : `app_key`, `activity_key`, `mode` (classic/sudden/hard), `level_key`, `score`, `score_max` (NULL pour Mort subite), `points`, `scoring_version`, `game_version`, `received_at` et **indicateur d'aide**.
**À adapter avant écriture :** enregistrer et valider `aidUsed`/type d'aide sans gonfler les données ; vérifier que les variantes 4/10/20 ont chacune une identité claire ; créer `connect_activities` pilote correspondant. Les scores `hard` ne se comparent pas automatiquement aux classiques, même si les points sont comparables selon barème.

### 3. Source de vérité et conflits
- La sauvegarde Cloud est celle de l'élève connecté, et **non** la sauvegarde Libre du navigateur.
- Deux ordinateurs : serveur avec révision compare-et-échange (CAS), pas de simple `upsert` écrasant. En cas de conflit, fusion prudente des déblocages prouvés / records selon règle explicite ; **jamais** fusionner automatiquement une suppression ou un reset.
- `resetEpoch` interdit qu'un ordinateur ancien ressuscite des résultats effacés volontairement.
- Passage en mode libre/Connect : rechargement du jeu dans le contexte choisi, pas de changement furtif du stockage pendant une partie.
- N'importer **aucun** score libre sans action d'import explicitement demandée et testée.
- Ne pas exposer le `service_role` ou le JWT de longue durée au jeu ; authentification et accès vérifiés par l'API à chaque écriture. Prévoir ticket éphémère pour le jeu ouvert dans un autre dépôt Pages.

## Point d'architecture CRUCIAL : même origine de stockage
Les jeux sous `https://mr-tat.github.io/<nom-de-dépôt>/` et le HUB sous `https://mr-tat.github.io/Mathas-Connect/` partagent **la même origine** (`https://mr-tat.github.io`). Le `localStorage` ne sépare pas automatiquement les données par chemin !
- Ne JAMAIS compter sur un autre chemin GitHub Pages pour isoler les résultats.
- Ne jamais recopier les clés locales de l'élève connecté dans les anciennes clés libres du jeu sans mécanisme contrôlé et retour arrière.
- Prévoir un adaptateur du jeu qui sélectionne explicitement un espace de stockage indépendant par profil ; le code comporte plusieurs appels `localStorage` directs et des scripts multiples, il faut les inventorier avant modification.
- Le HUB ouvre actuellement le jeu en nouvel onglet `target=_blank` avec `rel=noopener noreferrer` : ne pas compter sur `window.opener` pour transporter l'identité ; concevoir une preuve de lancement éphémère sécurisée, sans exposer de token durable dans les URLs.
- Ne pas laisser un changement de classe ou d'élève réutiliser l'ancienne session Connect sur un ordinateur partagé.

## Économie de données
- **Mode libre** : aucune écriture DB et aucun appel périodique vers l'API pour jouer.
- **Connect** : 1 chargement de l'état à l'ouverture, 1 événement + 1 sauvegarde compacte aux jalons de partie (à grouper quand possible), et uniquement si l'état a changé.
- Aucun appel à chaque chiffre saisi, manipulation de retenue, mouvement de réglette, ouverture de panneau ou seconde d'une minuterie.
- Stockage serveur des essais : conserver une granularité **utile aux bilans pédagogiques** tout en bornant le volume ; prévoir périodes de conservation et éventuellement agrégats par niveau plutôt que des copies illimitées de chaque interaction.
- Ne pas envoyer les SVG de trophées, CSS, ressources graphiques, ni les préférences purement visuelles.
- Maintenir catalogue et miniatures statiques GitHub ; pas de dépendance aux images de l'ancien Supabase.
- Prévoir les quotas : pilote sur un élève/appareil avant généralisation, mesurer trafic réel, puis extrapoler par classe.

## Plan d'intégration, sans risque pour l'existant
0. **D'abord sécuriser** reconnexion / révocation / oubli du profil et deuxième appareil (encore à valider).
1. **Créer une copie d'essai sur branche ou dépôt de test**, pas de remplacement direct de `Mr-Tat/Addition-ecrite-simple` publié. Aucun changement aux sauvegardes de la version classique.
2. Créer une **table de correspondance exhaustive** des clés et des variantes ainsi que des exemples de fixtures (ancien profil, nouveau profil, réinitialisation).
3. Adapter le jeu à un contrat explicite `loadState/saveState/onAttempt` via une couche de compatibilité local/cloud **avant les autres scripts** ; garder les fonctionnalités locales identiques.
4. Préparer l'API Connect pour authentification du lancement, accès état, enregistrement idempotent et contrôle des versions.
5. Tests automatiques sur cas de données + tests navigateurs groupés avec l'enseignant.
6. Après validation, basculer **seulement la carte Addition simple de Connect** vers la version pilote ; ne pas modifier les autres jeux ni le HUB classique.
7. Une fois ce modèle stabilisé, réutiliser le connecteur sur les autres jeux, un par un.

## Campagne de tests groupée à proposer au professeur (pas maintenant)
1. PC A Mode libre : partie classique, record, déblocage ; repérer les valeurs.
2. PC A Connect Élève A : compte neuf ne reprend pas automatiquement l'ancien libre, puis création de nouveaux scores/trophées.
3. PC A retour Mode libre : retrouver **à l'identique** toutes les valeurs du début (y compris la progression).
4. PC A reconnexion : récupérer les valeurs Connect, pas celles du mode libre.
5. PC B (appareil approuvé pour le même élève) : mêmes scores, déblocages, trophées Connect.
6. PC B Mode libre : les scores propres à B, **pas** ceux de A/Connect.
7. Changer de classe/profil : refuser lecture du profil précédent.
8. Révocation/oubli : plus d'accès cloud, Mode libre reste utilisable.
9. Conflit A et B : pas d'écrasement silencieux. Double envoi d'une tentative : 1 seul événement.
10. Deux boutons Master de remise à zéro : conserver les bons éléments et interdire les anciennes sauvegardes de ressusciter les effacements.
11. Tester classiques 4/10/20, Mort subite, HARD et usage d'aide ; valeurs correctement classées, points et récompenses cohérents.
12. Supabase : comparer le nombre d'appels/volume avant-après ; GitHub : poids/caches ; vérifier absence de données sensibles en URL.

## Validation de Brain Mathing
**Audit du jeu effectué ; aucune modification du jeu ni migration cloud réalisée.** La prochaine étape est la préparation de l'adaptateur pilote isolé, suivie d'une campagne de tests groupée.

Liens :
- Code du jeu : https://github.com/Mr-Tat/Addition-ecrite-simple/blob/main/index.html
- Contrat global : https://github.com/Mr-Tat/Mathas-Connect/blob/main/docs/CONNECT_GAME_CONTRACT_V0.md
- Site pilote futur : à créer ; ne pas envoyer à l'élève un lien annoncé prêt pour les sauvegardes avant vérification.
