# Laboratoire Connect — passage de flambeau
Issue #35 · branche `feature/laboratoire-connect-test-20261031`

## Objectif
Rubrique `🧪 Laboratoire` sur l’accueil du professeur, distincte des quatre espaces et de la gestion de ses classes usuelles. La classe existante `Classe démo - TEST` (`4bf3400d-a315-4ea4-a2f3-afaca24dc9b9`) sert aux essais avec **les mêmes API Connect** que les élèves.

## Livré sur cette branche
- `laboratoire.html`, `laboratoire.css`, `laboratoire.js`, raccourci dans `index.html`.
- Session professeur par la clé de stockage déjà utilisée, sans authentification contournée.
- Vérification de l’appartenance de la classe au tableau de bord professeur avant tout affichage.
- HUB/copie du lien, liste des profils et appareils et demandes d'approbation (API natives). Validation explicite que les profils sont fictifs avant gestion.
- Liens de jeux tirés du tableau GLOBAL du professeur avec secours pour les applications connues, même si cartes HUB cachées ; activation Monsieur T via `teacher-player`.
- Résultats prof par appli, détail, XP disponibles, verrouillage des tables (Mélange ou Multiplication), reset **un seul élève fictif** / **une seule appli**, `repeatXp:false`.
- Navigation quotidienne inchangée ; classes TEST restent masquées dans `Gestion` habituelle.

## Vigilances
1. Vérifier dans le portail professeur que la classe de test est bien visible via `teacher-dashboard` et accessible au compte connecté.
2. Vérifier manuellement que les profils inscrits dans la classe sont fictifs **avant de cocher la confirmation du laboratoire**. On a observé 3 inscriptions, 2 profils avec appareil approuvé, sans certifier leur identité.
3. Ouvrir le HUB élève dans un navigateur/profil distinct, demander la session native, approuver le code depuis le laboratoire ; la présence d’un appareil approuvé en base ne donne pas de JWT au navigateur.
4. Comparer l’usage de `teacher-app-matrix-get`, `teacher-summary`, `teacher-detail`, `teacher-multipliers-get/set` et `teacher-parcours-restart` aux usages de `app.js`. Aucun schéma SQL ni Edge modifié.
5. Les quatre cartes Mélange restent **masquées** jusqu’à réussite effective de la recette hébergée (7 → 14 → 28 puis +0, offline/ACK, reset, Monsieur T) et le script d’ouverture déjà versionné.
6. L’authentification et les tests graphiques dans un navigateur professeur ne peuvent pas être simulés par le seul test statique : **ne jamais les déclarer réussis avant preuve réelle**.

## Validation automatisée
`node --test tests/laboratoire-static.test.mjs` + CI existante. Vérifier manuellement le portail à la première publication ; la branche ne change pas les jeux, les données ni les règles XP.

## Connexion rapide à un profil fictif (31/10/2026)
Chaque carte « Élèves fictifs et appareils » présente « Se connecter avec ce profil ».
Ce lien ouvre le **formulaire élève natif** en onglet séparé, avec prénom et
initiale présélectionnés si la fiche est en forme `Prénom.X` / `Prénom X`.
La session professeur utilise une clé de stockage distincte :
- session élève déjà approuvée pour le même profil : continuer normalement ;
- session élève approuvée pour un *autre* profil : continuer sous la mauvaise
  identité est bloqué ; « Utiliser un autre compte » est proposé (révocation
  de l’appareil courant, pas des XP), puis demande et approbation natives ;
- aucune session : envoyer la demande du profil et vérifier le code dans le labo.
Cette présélection n'est **ni** un contournement de l'authentification
**ni** une connexion automatique à partir d'un nom ou UUID.

## Mise à jour du 01/11/2026 — tester les versions avant ouverture officielle

Le HUB de la classe fictive « Classe démo - TEST » est l'**environnement de prépublication des jeux Math’as Connect**. Les quatre catalogues scolaires restent intacts : on commence par le Laboratoire, puis on ouvre officiellement seulement après la recette et la décision pédagogique.

Deux parcours coexistent :
- **Essais de moteur / présentation, sans connexion Connect** : cinq démonstrations « 🏆 Objectif record » sont publiées sur Pages et répertoriées dans `objective-record-lab-previews.mjs`. Dans le HUB TEST : rubrique dédiée « 🏆 Objectif record — essais », distincte des applications Connect et **sans `app_key`** ; sur la page `laboratoire.html` : cinq boutons d'essai après contrôle de la session professeur et confirmation du caractère fictif des profils. **XP et « Reste N XP » fictifs ; aucune sauvegarde ou trophée Connect.** Les URL Pages directes restent publiques, même si leur carte est absente ailleurs.
- **Pilote Connect authentifié** : utiliser le mécanisme déjà en place `connect-lab-catalog`, la case « Afficher » et les profils fictifs approuvés. Exiger validation serveur des preuves, tests de non-double crédit et vrai navigateur authentifié avant d'ouvrir les quatre HUB scolaires. Les essais statiques ne remplissent pas ces conditions.

Règle complète dans [le guide permanent](integrations/README.md#-déployer-dabord-dans-le-hub-du-laboratoire-pour-tester). Pour retirer les cinq raccourcis d'essai, revenir sur le changement `hub.js`, `laboratoire.js`, `laboratoire.html` et `objective-record-lab-previews.mjs` ; aucune migration ni aucune modification de données n'est nécessaire.
