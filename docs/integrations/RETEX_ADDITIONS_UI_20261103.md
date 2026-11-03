# RETEX — Interface finale des deux additions Connect
**Date :** 3 novembre 2026  
**Périmètre :** `addition-ecrite-simple` et `addition-ecrite-multiple` dans `apps/objective-record/`  
**Statuts :** [REPO vérifié] pour les causes et correctifs, [CI locale] pour les tests GitHub Actions. Une recette hébergée avec authentification fictive approuvée reste distincte.

## Problèmes reproduits et causes

| Symptomatique | Cause réelle dans le dépôt | Solution ciblée |
| --- | --- | --- |
| « Reste N XP » écrit deux fois, dont une ligne accolée à « 4/10/20 calculs » | Le *wrapper* d'essai génère des `.classic-xp-remaining` fictifs en mode `connected`, puis l'hôte insère ses propres `.mathas-connect-official-xp` authentifiés. Une remise en mode « free » tardive laisse des doublons visibles. | Dès `?connect=1`, désactiver le simulateur **avant** le chargement du moteur ; retirer défensivement les anciens indicateurs LAB ; ne positionner que le badge officiel, petit et en bas à droite. Ne jamais utiliser un nombre XP inventé. |
| La ligne HARD H1/H2/H3 apparaît pour un élève sans accès | Le tableau natif déduit `hardUnlocked` de l'existence de clés de records HARD. Le miroir scolaire fournit des valeurs 0, qui suffisent à faire apparaître des records alors qu'aucun mode n'est débloqué. | Conserver les records, mais masquer la ligne et les difficultés bloquées selon `schoolModeAllowed` à partir du **`student-load` officiel**, jamais des clés/valeurs locales. HARD 1 après perfection N1–N3 ; HARD 2 après trois réussites HARD 1 ; HARD 3 après trois réussites HARD 2. |
| Bouton rouge « Lancer la mort subite » et perte éventuelle de l'icône/bonus | Les moteurs d'origine réécrivent le `textContent` de `#startSudden` après l'insertion des boutons enrichis par le wrapper. Cela efface les sous-éléments. | Garder l'arbre DOM enrichi (`score-mode-name`, crâne, bonus) et ne changer un libellé de secours que s'il n'existe pas de `score-mode-name`. Libellé visible « Mort subite ». |
| Déroulant Niveau coupé par la barre fixe en haut | La logique native `mathas-p30-dropdown-portal-script` calcule explicitement `top = r.top - height` : menu **au-dessus**. | Remplacer **uniquement dans la copie intégrée** sa géométrie par `top = r.bottom + 5`, position `fixed`, hauteur adaptée à `visualViewport.height` et scroll interne ; pas de modification de la barre Connect. |

## Précautions de livraison

- Pas de SQL, pas de modification des XP ni des trophées côté serveur, pas de reset d'élève.
- Les moteurs sources de grande taille sont **préservés** : corrections en adaptateurs et `swap` fail-closed du HTML embarqué. Les originaux autonomes et les autres calculs écrits restent inchangés.
- Le mode LAB sans `?connect=1` peut continuer de simuler XP et déverrouillages, sans usurper les récompenses Connect.
- La ligne HARD reflète strictement les droits du serveur pour une session scolaire approuvée. Les essais hors connexion sont indépendants.

## Chemin plus rapide pour les prochaines applications

1. **Inspecter une fois le DOM réellement exécuté**, dans le navigateur Playwright avec classe fictive approuvée, *avant* de retoucher les styles. La source HTML d'origine n'est pas le rendu final : plusieurs scripts réécrivent les mêmes éléments après montage.
2. **Cartographier les trois couches** dès le début : original `index.html` → wrapper `srcdoc` et ses `swap` → adaptateur Connect et lecture serveur. Chercher les mutations tardives (`textContent`, `render`, `setInterval`, menus portalisés), plutôt que corriger uniquement le CSS de la capture.
3. **Séparer explicitement la démo et Connect à la création de l'iframe** (`?connect=1`) au lieu de tenter de nettoyer son interface après coup ; l'origine serveur doit être unique pour XP, trophées et verrous.
4. **Réutiliser les ponts communs** `native-connect-bridge.mjs`, `school-official-unlocks.mjs` et les tests, en changeant seulement les sélecteurs propres à chaque moteur. Éviter des mutations multiples dans les fichiers de 700 Ko.
5. **Écrire immédiatement les assertions de rendu et de droits** : zéro doublon XP, badge dans le coin, libellé stable, grille HARD absente puis visible après déblocage, menu vers le bas, largeur téléphone. Conserver les tests de preuve XP au vrai clavier en parallèle.
6. **Valider les `swap` avec un contrôle exact du texte source**, y compris l'indentation. Ici un premier motif avait cinq espaces alors que le moteur en avait quatre : l'essai visuel aurait échoué à charger. Ce contrôle de quelques lignes coûte moins cher qu'un cycle Chromium de plusieurs minutes.
7. **Documenter le statut réel** séparément : assertions statiques / CI Chromium locale / déploiement Pages / **recette authentifiée hébergée**. Ne jamais appeler « tout vérifié » une application dont la mise en page en situation réelle n'a pas été contrôlée.

## Contrôles ciblés

- `tests/objective-record-school-native-xp.test.mjs` — niveaux HARD réellement accessibles, les compteurs à zéro ne suffisent pas.
- `tests/objective-record-school-extended.browser.mjs` — DOM embarqué des deux additions : badges Connect non dupliqués, position en bas à droite, nom Mort subite, HARD conditionnel, déroulant placé sous son bouton.
- Suites existantes : premier chiffre et report au clavier, validation serveur, profil/XP, trophées permanents, règles de déblocage, non-régression.

**Retour arrière :** revert de la PR d'interface uniquement, sans action sur Supabase ni les comptes élèves. Vérifier les trois états (nouvel élève, élève ayant débloqué HARD 1, élève ayant débloqué HARD 3) avant d'étendre ce patron à Soustraction et Mélange.
