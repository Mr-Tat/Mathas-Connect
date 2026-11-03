# Mise en service finale – Addition simple et Addition de plusieurs nombres – 03/11/2026

## Portée de la livraison

Les deux cartes des classes scolaires de Math'as Connect conservent exactement leurs paramètres de visibilité professeur ; seul leur écran jeu certifié est complété. Le routage scolaire n'affecte pas Soustraction, Multiplication ou Mélange. Les séries Classique demeurent hébergées dans les moteurs natifs et conservent leur preuve PostgreSQL précédente.

L'interface Connect (bouton 🔐, dans la **même page élève et la même session**) propose désormais :
- **Classique** : 4, 10 ou 20 opérations, trois niveaux, première saisie des chiffres/retenues capturée dans le jeu natif, serveur scolaire existant ;
- **3 vies** : addition posée normale en grille Connect. La partie s'achève à la troisième réponse erronée ou à la 120e opération ;
- **Mort subite** : addition posée normale en grille Connect. La première réponse erronée achève la partie, ou limite de 120 opérations ;
- **HARD · 3 vies** et **HARD · Mort subite** : mêmes règles, grands nombres natifs (simple : 10/12/16 chiffres, 2 termes ; multiple : 9/12/14 chiffres, 6 ou 7 termes). Les calculs sont exacts avec des entiers décimaux, sans perte de précision JavaScript.

Pour les quatre modes de survie, le serveur émet 120 questions maximum **à l'avance** avec session à durée limitée ; **le navigateur ne peut pas créer son propre nombre, score, XP ou trophée**. PostgreSQL vérifie la première tentative en détail, y compris les retenues, et vérifie que la partie se termine au nombre de vies perdues approprié. Les réponses sont sauvegardées temporairement dans le navigateur pour réessayer après interruption, avec un reçu idempotent côté serveur. Aucun nouveau compte, ni aucune démo isolée, n'est requis.

Le panneau dédié de saisie des chiffres/retenues certifiées ne réutilise pas la totalité de l'animation du moteur historique HARD ; les modes natifs restent disponibles en **entraînement libre, sans XP**. L'enseignant peut continuer à montrer le jeu original. Ne pas prétendre que le panneau certifié est visuellement identique au moteur original.

## XP et trophées : plafond inchangé

**474 XP par application et par parcours** demeurent la somme des jalons existants : 354 en Classique, 60 via « soudain » (normal), 60 via « hard » (HARD). L'ancienne table de règles XP n'est PAS modifiée. Les 3 vies progressent vers les mêmes paliers XP 5/10 (normal), ou 3/7 (HARD) ; un palier n'est jamais crédité deux fois. Les scores records des 3 vies sont stockés séparément de Mort subite (champs `threeLives` et `hardThree`), avec maintien du meilleur `sudden` / `hard` pour les jalons partagés.

Les coupes propres à **Mort subite** requièrent une vraie partie Mort subite à 25 réussites. Les coupes **HARD** ne proviennent que des véritables parties HARD Mort subite (seuils 3/5/10). Les coupes de score 200/400/600 points reposent sur les points effectivement recalculés par le serveur. Les trophées survivent aux réinitialisations via `connect_trophy_achievements`.

## Projection et permissions

Chaque validation acceptée crée un reçu atomique `connect_states.recent[eventId]`. Le déclencheur de projection collecte les événements lorsque le profil élève a exactement une classe active ; le tableau ne les lit qu'après un **consentement explicite par score**. L'API exige JWT, appareil approuvé/inscription active ou professeur-joueur autorisé ; les fonctions PostgreSQL sont interdites aux rôles `anon` et `authenticated`, exécutées exclusivement par `service_role` dans l'Edge.

La **classe TEST** continue d'utiliser le système pilote Classique et n'est pas autorisée pour les nouveaux défis scolaires. Les tests automatisés utilisent uniquement des classes/élèves fictifs dans une base Postgres de CI ou un navigateur simulé : aucun score réel élève n'est injecté pendant la recette.

## Déploiement / rollback

Ordre impératif : (1) valider CI Postgres 24 variantes, Node et Chromium, (2) appliquer **quatre migrations additives** `20261103130000` à `...130030`, (3) vérifier RLS et privilèges réels, (4) déployer `connect-objective-record-school` avec **verify_jwt=true**, comparer source, (5) seulement alors merger la PR de Pages / vérifier son déploiement. **Ne pas déployer Pages avant l'Edge/RPC**. Ne jamais revenir au serveur ancien si le client certifié est actif.

Pour rollback de l'interface : revenir au précédent commit Pages; garder les tables et RPC privées et l'Edge corrigé (qui préserve Classique), sans jamais effacer les progrès des élèves. Les sessions entamées peuvent expirer après 8 h ; les reçus permanents ne sont pas supprimés.

## Critères de fin

CI PostgreSQL (24 combinaisons et 18 variantes classiques toujours vertes), Chromium sur les deux jeux, JWT et privilèges, XP+records/trophées, consentement projection, déploiement Pages confirmé. Le parcours réel élève avec session et accord de projection reste une vérification de terrain à faire après activation, puisqu'aucun faux élève ne doit toucher la production.
