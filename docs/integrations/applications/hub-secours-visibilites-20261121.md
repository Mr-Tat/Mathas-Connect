# HUB — disponibilité en mode libre et visibilité des classes en panne Edge

**Date : 21/11/2026 ; PR [#338](https://github.com/Mr-Tat/Mathas-Connect/pull/338).**

## Sources vérifiées
- `main` `147e2f6a412d1651160b58db55a36f8ef08bb4a5`, avant les changements.
- Lecture seule Supabase du tableau `public.connect_hub_preset_entries`, projet `awmhpfofacaglewammxt`, le 21/11.
- Règle professeur : Abaque **non** en Observation et Phase 1 ; **oui** en Phase2 A, Phase2 B et 2 ECO. Soustraction **cachée** dans les cinq espaces scolaires ordinaires. Addition simple/Multi, multiplication, Padlet et Bowling conservent leurs accès approuvés.
- Le professeur est seul à modifier les droits via ses réglages ; aucune modification SQL/Edge, aucun élève réel touché.

## Défaillances constatées
1. `hub.js` utilisait le `hub-catalog.json` sans filtre quand `connect-catalog` ou le SDK était inaccessible. Le secours montrait Abaque et Soustraction dans les classes où le professeur les avait masqués.
2. `hub.html` connaissait Phase2 A mais pas `phase2b` dans le contrôle d'URL exécuté **avant** le JS du HUB ; ouvrir `hub.html?space=phase2b` redirigeait vers `connexion.html` sans raison.

## Correctifs et garanties
- Les deux cartes de secours portent `fallback_visible_spaces` : Abaque [`phase2`, `phase2b`, `2eco`], Soustraction `[]`. Ces données sont un **instantané conservateur**, non un droit serveur.
- Si `connect-catalog` est inaccessible, les cartes sont filtrées selon le preset déterminé par l'identifiant de classe ; métadonnée invalide = masquée. Si le catalogue authentique répond, la liste *dynamique* le remplace et les nouvelles décisions du professeur redeviennent immédiatement visibles.
- Le garde HTML reconnaît la classe Phase2 B avec son UUID connu, sans abaisser l'obligation de classe sur les autres liens.
- Mode libre direct des jeux, boutons de validation, score, guide, auth, XP et données existantes inchangés. Les cartes Bowling et Padlet externes restent présentes ; leur contenu hors ligne n'est pas garanti.

## Tests et livraison
- Chromium `tests/ce-free-launch.browser.mjs` : HUB sans SDK/Edge en Observation, Phase1, Phase2 A, Phase2 B, 2 ECO, comparaison des cartes à la visibilité approuvée ; lancement des moteurs en libre et refus scolaire implicite inchangés.
- [Première recette ciblée verte 21/11](https://github.com/Mr-Tat/Mathas-Connect/actions/runs/44913541545).
- Suite générale historiquement 742 OK / 10 tests obsolètes sur base ; PR [#337](https://github.com/Mr-Tat/Mathas-Connect/pull/337) corrige ces tests séparément (752 OK, 1 ignoré, 0 échec).
- Prévoir revue de cet instantané si le professeur change les visibilités alors que tous les services restent indisponibles : hors réseau, le navigateur ne peut connaître les nouvelles décisions prises sur le serveur.
- Recette AUTH réelle en classe TEST professeur + élève fictif : **non exécutée**, distincte des tests Chromium à API simulée.
