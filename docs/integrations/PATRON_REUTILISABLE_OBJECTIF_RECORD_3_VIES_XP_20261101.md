# Patron réutilisable — 🏆 Objectif record, 3 vies et XP restants

**Décisions du professeur : 1er novembre 2026.** Référence commune pour les applications Math’as Connect **qui disposent des capacités correspondantes**, pas seulement les calculs écrits. Ce patron complète le [guide permanent](README.md), le [contrat XP / trophées](CONTRAT_COMMUN_SCORES_XP_TROPHEES.md) et le [prototype Addition simple](PROJET_DEFIS_SCORE_3_VIES_20261101.md). **État : choix d'UX validés, prototype Addition simple uniquement, intégration Connect réelle non déployée.**

## 1. Expérience élève à retenir

- Remplacer la carte **« Mort subite »** par **« 🏆 Objectif record »**, **sans point d'exclamation**, avec la phrase **« Deux façons de marquer un gros score. »**. Rapprocher nettement la phrase des deux boutons ; ne pas recréer un grand vide.
- Deux boutons de largeur égale, côte à côte lorsque l'espace le permet : **❤️❤️❤️ 3 vies à gauche** (dégradé mauve prune foncé `#754287 → #502963`, bordure `#a77cbe`) ; **💀 Mort subite à droite** (dégradé rouge `#a32b47 → #7e253b`, bordure `#eb7189`). Mobile : adaptation sans chevauchement ni perte de lisibilité.
- **3 vies** : petite mention **« Sans trophée »**, très discrète, dans un cadre intérieur fin et translucide. **Mort subite** : badge doré compact et visible **« +20 % de points »** dans un cadre intérieur semblable.
- **Ne plus afficher** « 50 % des XP », « 100 % des XP » ni « XP et bonus présentés à titre indicatif dans cet essai. ». Le pourcentage de droit XP reste une **règle métier**, pas un sous-titre.
- **« Reste N XP »** (N entier, y compris **« Reste 0 XP »**) s'affiche **uniquement pour un élève Connect réellement approuvé, lorsque les droits restants sont confirmés par le serveur**. Sinon **aucune mention XP**, jamais un faux zéro, jamais des montants extrapolés à partir des scores locaux.
- Indicateur **petit, normal, peu contrasté**, **en bas à droite de chacun des boutons de séries** (pour un jeu avec 4/10/20, les trois boutons) ; **en bas à droite du cadre intérieur** sur 3 vies et Mort subite, en réservant un espace pour ne pas chevaucher « Sans trophée » ou le badge +20 %. Toujours une surface cliquable complète.
- La valeur dépend **du niveau et des options qui déterminent le droit XP dans l'application**, du barème versionné, des jalons déjà crédités et de la politique de nouveau parcours. Elle représente un **plafond encore accessible**, **pas un gain garanti pour la prochaine partie**. Actualiser après le chargement authentifié, chaque changement de sélection pertinent, et après l'ACK de crédit serveur.
- Le panneau **« XP à gagner »**, les XP acquis, les animations de gain et les trophées existants restent disponibles ; éviter toute divergence entre leur source serveur et « Reste N XP ».

## 2. Mécanique 3 vies, distincte de Mort subite

- Départ avec **3 cœurs**. **Une réponse complète et validée fausse = exactement une vie perdue pour ce calcul**, même si plusieurs chiffres sont incorrects ; réponse incomplète = **zéro** vie perdue. Les calculs d'une paire sont validés **individuellement** : deux calculs faux peuvent consommer deux vies.
- Un calcul raté **ne se corrige pas** et ne rapporte pas de points ; le calcul est terminé et on poursuit. **Aucune perte doublée** par double validation, clic rapide ou retour sur un calcul marqué faux.
- **Troisième erreur = fin immédiate**, avec score des bonnes réponses. Le rythme, le calcul des points normaux, les aides et les règles de correction s'appuient sur le **moteur propre à l'application**, sans inventer un nouveau moteur.
- Les trois cœurs restent dans un **cadre discret dans la barre supérieure de session**, entre retour au menu et niveau/progression/score sur PC, sans déplacer les commandes. Sur écrans étroits, un repli accessible évite les collisions. Un cœur perdu **grossit, se fissure, se casse, devient anthracite foncé et reste brisé**. Respecter la réduction des animations.
- **Mort subite** : une première erreur arrête la partie. **Séries normales, HARD, Master, entraînement, niveaux, méthodes, aides et trophées natifs : inchangés**, sauf décision pédagogique expresse et tests spécifiques. Ne pas mélanger les sauvegardes des modes.

## 3. XP, points, classement et sécurité

- **3 vies = moitié du droit XP d'un jalon Mort subite comparable, sans trophée**. Il s'agit de **compléments**, jamais de deux récompenses indépendantes : pour un jalon de plein droit 10 XP, 3 vies validé = droit à 5 XP au total ; une Mort subite validée ensuite = complément possible 5 XP ; Mort subite d'abord = aucun XP supplémentaire en 3 vies. Répétitions ordinaires = 0 ; respecter les permissions `repeatXp` et `reset_epoch`.
- Le **+20 %** de Mort subite concerne uniquement **les points admissibles au classement** de l'application, **pas les XP** et pas les trophées. Un **classement commun à l'application** rapproche les séries classiques, 3 vies, Mort subite seulement après définition d'une unité de points comparable, de l'arrondi et d'éventuels plafonds ; **jamais de classement unique entre applications**.
- Tout crédit XP, droit partiel, preuve d'erreur, résultat, meilleur score, trophée et reçu de jeu est **vérifié et idempotent côté serveur**, atomique avec l'état, l'identité, l'app_key, la révision et l'époque. Le navigateur n'attribue pas d'XP ni de +20 % au reçu et ne modifie pas les historiques pour faire correspondre l'affichage.
- **Pas de déploiement SQL/Edge, de modification de barème réel, de résultats élèves, de trophées ou de classement vivant sans validation explicite.** Tester d'abord avec données/élèves fictifs et PR distinctes. Un bouton visible sur GitHub Pages n'atteste pas un droit serveur actif.
- **Projection et classe** : ne pas utiliser les données ou scores d'élèves dans une projection ou classement collectif sans respecter les permissions et consentements existants.

## 4. Particularité Mélange : dépendance aux opérations sélectionnées

Dans `Mr-Tat/Melange-calculs-ecrits-1`, le menu permet **1, 2 ou 3 types d'opérations** parmi **addition (`add`)**, **soustraction (`sub`)**, **multiplication (`mul`)**, avec **niveau 1/2/3** et **séries 4/10/20**. Le moteur enregistre `settings.ops`; le contrat Connect existant transmet `operationsSelectedAtStart`, `operationsCompleted` et `firstTry`, plus aides et Master. **Le montant « Reste N XP » doit dépendre de la sélection exacte**, et pas seulement du nombre brut d'opérations :

- Exemple de configurations distinctes : `[add]`, `[sub]`, `[mul]`, `[add,sub]`, `[add,mul]`, `[sub,mul]`, `[add,sub,mul]`. Il ne faut ni additionner des jalons d'une opération non sélectionnée, ni traiter deux combinaisons différentes comme équivalentes parce qu'elles comprennent deux types.
- Distinguer **types cochés (1/2/3)** et **nombre de calculs du bouton (4/10/20)** : chaque dimension peut modifier les jalons accessibles. Dépendre aussi du niveau, des règles d'aide et des éléments du parcours nécessaires à l'éligibilité.
- Source d'autorité : contrat et lecture actuels du **serveur Mélange** (`connect_mixed_xp_read_v1` pour la lecture ; `connect_mixed_record_v1` pour les preuves). **Auditer réellement ses 9 règles XP par niveau et ses plafonds avant toute formule** ; ne pas recycler automatiquement 22/36/60 XP d'Addition simple, ni diviser un maximum par trois, ni déduire les crédits à partir d'une simulation DOM.
- Quand l'élève coche/décoche une opération, change de niveau, change le nombre de calculs, ou lorsqu'un serveur acquitte une nouvelle récompense, recalculer la **projection autorisée** (sans crédit local). Si le serveur ne fournit pas une projection fiable pour la combinaison, **masquer** l'indication plutôt que mentir.
- **Nouvelle règle 3 vies appliquée à Mélange** : figer les opérations **au départ de la partie** ; preuves d'opérations effectivement données et réponses correctes ; les demi-jalons XP doivent être adaptés aux règles propres de Mélange, **pas supposés égaux** aux jalons de Mort subite d'Addition simple. Les méthodes d'emprunt, reports, multiplicateurs autorisés et aides doivent rester inchangés.

## 5. Cinq applications visées et audit confirmé (01/11/2026)

| Jeu | Dépôt source | app_key Connect | Notes d'adaptation |
| --- | --- | --- | --- |
| Addition simple | `Mr-Tat/CE-Addition-simple` | `addition-ecrite-simple` | **Prototype** `essai-mode-score-3-vies.html` sur `game-original.html`, PR #6–#18 ; lanceur `index.html` Connect distinct. Pas de fonctionnalité XP 3 vies en production. |
| Addition multiple | `Mr-Tat/addition-ecrite-multiple` | `addition-ecrite-multiple` | Moteur proche d'Addition simple ; **index généré depuis clean-v1, ne pas modifier le HTML généré à la main** : identifier et modifier les sources + reconstruire. |
| Soustraction écrite | `Mr-Tat/soustraction-ecrite` | `soustraction-ecrite-simple` | Moteur proche mais validation **avec retenues/emprunts**, plusieurs méthodes et boutons pouvant avoir `aria-pressed` ; vérifier les erreurs incomplètes et la non-correction. |
| Multiplication simple | `Mr-Tat/Multiplication-simple` | `multiplication-ecrite-simple` | Menu avec `startSudden` de classe `sudden-choice`, **pas** de `suddenMaxDigits` ; `index.html` indique clean-v1, modifier les sources et générer, respecter report et aides. |
| Mélange de calculs écrits | `Mr-Tat/Melange-calculs-ecrits-1` | `melange-calculs-ecrits` | Moteur distinct : `suddenBtn`, `countBtn`, `levelSelect`, `opsSelector` `add/sub/mul` ; preuve par opérations choisies au départ ; voir §4. |

**Prudence :** les fonctionnalités détectées dans les fichiers sources ne prouvent pas que les cinq jeux sont publiés en Connect avec les mêmes droits. Vérifier le catalogue, les adaptateurs réellement utilisés, les branches et les versions live avant une intégration. Les fonctions `connect-results` possèdent déjà la lecture `student-xp` pour les apps historiques et Mélange utilise sa lecture spécifique. **Les droits partiels 3 vies et la projection serveur « Reste N XP » ne sont pas présumés implémentés.**

## 6. Exigences de transposition aux autres applications Math'as

- **Patron de capacités, pas copier-coller aveugle :** vérifier d'abord qu'un jeu a de vrais jalons d'erreurs et un mode assimilable à Mort subite ; les séries peuvent être d'une autre durée et certains outils n'ont ni trophées ni XP.
- Séparer dans l'architecture : **composant de présentation**, **contrat d'événement de fin**, **règles de score du jeu**, **droits XP côté serveur**, **projection du reste** et **adaptateur par moteur**. Ne pas briser une app pour imposer le vocabulaire/calcul des calculs écrits.
- Accessibilité : bouton complet au clavier, focus visible, texte lisible à 320 px et en portrait, `aria-live` raisonnable pour vies perdues, pas de mort subite masquée, pas de cœurs sur un autre mode, reduced motion.
- Vérifications minimum : 0/1/2/3 erreurs, deux erreurs dans une paire, doublons/double-click, réponse incomplète, aides/méthodes, score, classement, jalons demi/plein, zéro restant, changements de niveau / opérations, compte libre/Connect/serveur inaccessible, reset/repeat, vrais reçus serveur fictifs, mobile et PC, contrôle de non-régression des anciennes séries.
- Livrer d'abord **branches/PRs et démos isolées**, tests JavaScript/moteur/CI, puis tests PostgreSQL/Auth/Edge/Chromium sous identité **fictive**. **Aucune fusion qui ouvrirait le jeu vivant et/ou distribuerait des XP réels sans approbation explicite du professeur.** Documenter toute absence de test réel.

## 7. Références

- [Spécification et historique Addition simple](PROJET_DEFIS_SCORE_3_VIES_20261101.md).
- [Guide d'intégration permanent](README.md) et [contrat commun des XP](CONTRAT_COMMUN_SCORES_XP_TROPHEES.md).
- Prototype visuel : https://mr-tat.github.io/CE-Addition-simple/essai-mode-score-3-vies.html?v=18
- Source du dernier ajustement visuel (XP en bas à droite) : https://github.com/Mr-Tat/CE-Addition-simple/pull/18
- [Prompt opérationnel pour la prochaine conversation](PROMPT_DEPLOIEMENT_OBJECTIF_RECORD_5_APPS_20261101.md).
