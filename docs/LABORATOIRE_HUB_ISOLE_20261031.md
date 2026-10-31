# HUB de test isolé — badge « Connecté » et cases « Afficher »

## Cas d'usage
Pour la seule classe de démonstration `4bf3400d-a315-4ea4-a2f3-afaca24dc9b9`, on souhaite afficher une sélection d'applications différente des quatre vrais HUB.

## Séparation des données et de l'identité
- `connect_lab_hub_visibility` est une **nouvelle table indépendante**, RLS activé, aucun droit direct anon/authenticated.
- Nouvelle Edge `connect-lab-catalog` :
  - GET `?class=<UUID TEST>` : public, retourne les apps **enabled et choisies visible** uniquement pour le HUB test.
  - POST `list` ou `set` : exige un JWT de **professeur non anonyme** et `connect_class_permissions.can_manage=true` sur la seule classe test. Le service_role ne sert qu'à une lecture/écriture strictement autorisée ; `connect_hub_preset_entries` et `connect_apps` ne sont jamais écrits.
  - `set` refuse les apps globalement désactivées et `connect-lab`.
- Dans `hub.js`, cette classe utilise exclusivement cette Edge ; **aucun retour de secours vers Observation** en cas de panne. Quatre classes réelles restent strictement sur le chemin originel.
- Dans `laboratoire.js`, les cases « Afficher » récupèrent le vrai état depuis POST `list` et enregistrent par POST `set`. Aucun état n'est inventé côté navigateur.
- Le badge « Connecté » n'utilise pas les appareils approuvés historiques : il interroge `connect-api/student-me` sous l'auth **élève présente dans le stockage de ce navigateur**, distinct du compte professeur, et vérifie statut approuvé + classe de test. Ambiguïté entre homonymes → aucun badge. Le badge ne peut **pas** connaître une session ouverte dans un navigateur privé ou autre appareil.

## Déploiement
1. Vérifier absence préalable de `connect_lab_hub_visibility` et de `connect-lab-catalog`.
2. Appliquer le SQL versionné `supabase/release-candidates/connect_lab_hub_visibility_v1.sql` en migration.
3. Déployer **uniquement** l'Edge `connect-lab-catalog` avec `verify_jwt=false` (nécessaire au GET public ; le POST vérifie explicitement le JWT). Ne pas modifier `connect-results`, `connect-catalog`, `connect-api`.
4. Vérifier la table (RLS et droits), les migrations et le code Edge, puis fusionner la PR après CI verte et publier Pages.
5. Recette authentifiée : cocher « profils fictifs », cliquer « Afficher » pour Mélange, ouvrir le HUB test dans la session approuvée, vérifier uniquement cette carte ajoutée et **aucun changement dans les quatre vrais HUB** ; fermer/cocher à nouveau et vérifier persistance ; vérifier badge « Connecté » dans le même navigateur. Répéter en navigation privée pour démontrer l'isolation des sessions.
6. Si la nouvelle Edge ou le HUB test échoue, **ne pas** rendre visibles les cartes des vraies classes pour compenser.

## Non autorisé
Aucune donnée ou résultat réel lu/modifié, aucune action de reset, aucune ouverture Mélange globale, aucune modification des presets et des Edge existantes.
