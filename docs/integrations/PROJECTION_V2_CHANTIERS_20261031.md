# Projection V2 — contrat fonctionnel et étapes (31 octobre 2026)

## Référence et avancement
Référence visuelle : `MATHAS_LAB_TABLEAU_PROJECTION_V1.9.10_DEMO.html` fournie dans la conversation. Une maquette actualisée, volontairement **isolée et fictive**, est livrée dans `projection-v2-demo.html`. Ne pas la confondre avec `projection.html` qui reste la projection actuelle et protégée.

## Classes
Cinq espaces distincts : Observation, Phase 1, Phase 2 A, Phase 2 B, 2 ECO. Le changement de classe ne doit pas réunir les résultats. Comparateurs latéraux à choix indépendants, pourcentage et scores par classe seulement. Chaque classe dispose de ses propres dates de début de classement et éventuellement de ses propres réglages.

## Classement et rotations
- **Un classement par application**, jamais de cumul entre applications. Score = **meilleur résultat en points du jeu**, sur la période de projection courante, et non XP Connect ou somme hebdomadaire.
- Afficher une seule application à la fois, rotation de **90 s** par défaut entre celles cochées *Score*. Flèches de navigation, pause pendant réglages. Ne pas confondre le passage entre deux jeux avec une remontée.
- Au plus 14 élèves par classe : 1 colonne pour 1 à 7, 2 colonnes jusqu'à 14 (7+7). Nom et score voisins, gras, nettement dominants ; niveau Connect et nombre global de trophées en secondaire ; aucune donnée inventée pour un élève sans partie.
- Les hauts faits et meilleures remontées sont contextualisés à l'application actuelle. Les trophées restent permanents malgré les reprises de parcours.

## Panneau Applications
- Colonnes distinctes « Score » et « % » par application, indépendantes. Les choix doivent être persistants **par classe**.
- Réinitialiser **une seule application et une seule classe** par bouton de droite. Confirmation + mot de passe professeur revalidé **côté serveur** ; jamais de mot de passe en clair dans une table ou dans l'URL.
- La remise à zéro change uniquement la date de début du meilleur score **projeté** et l'historique de ses remontées ; n'efface aucune partie, historique réel, XP, trophée, parcours ou pourcentage. Ne jamais toucher aux autres classes, même si comparées.
- « Afficher Monsieur T » est **décoché lors de chaque ouverture**. Les autres noms doivent respecter la politique d'alias/consentement de projection ; lecture via session professeur uniquement.

## Pourcentage : ne pas fabriquer un chiffre
- Valeur pédagogique recherchée : nombre d'exercices commencés puis réussis / nombre d'exercices réellement commencés (par application, classes choisies), **hors Mort subite**.
- Les états actuellement publiés conservent surtout les 3 parties récentes, un meilleur score et des fragments d'état ; `connect_attempts` est **vide** au contrôle du 31/10/2026. Ils ne permettent PAS de reconstruire exhaustivement toutes les questions commencées ou abandonnées.
- Avant affichage de vrais %, instrumenter chaque moteur pour remonter durablement les événements d'exercice/question démarré, terminé, réussi ou abandonné, avec identifiant stable, attribution serveur à la classe et dédoublonnage. Exclure les exercices jamais commencés, respecter premier essai si retenu. Tester au minimum Addition, Multiplication, Soustraction, Addition multiple, Mélange et modes Classique/Difficile ; exclure Mort subite.
- Ajouter un compteur permanent indépendant des remises à zéro de scores, et un service d'agrégation sécurisé par professeur/classe. Un 0% non observé doit s'afficher **« — »**, jamais 0 artificiel. Ne pas utiliser les trois dernières parties comme statistique de réussite exhaustive.

## Étapes restantes pour la projection connectée
1. Event log durable + contrat de score en points par jeu et modes ; preuve SQL locale d'exclusion et de non-destruction.
2. Instrumentation du dénominateur (questions réellement entamées) et de numérateur réussite, sans doublon, Mort subite exclue.
3. Endpoints autorisés lecture et réglages, reset ponctuel authentifié par mot de passe côté serveur, isolation `(class_id,app_key)`, audit log.
4. Remplacer les exemples de la maquette par données réellement autorisées, retrouver les effets V1.9.10 ; intégration finale dans les cinq boutons Projection.
5. Validation Chromium 1366×768 (14 élèves visibles, zoom, contraste) + petits écrans, permissions croisées, déconnexion, absence de fuite de noms dans les caches publics.

## Interdictions
Pas de modification ou de réinitialisation des élèves réels lors des tests. Jamais considérer la démo isolée comme projection de données réelles. Ne jamais lancer de récupération de mot de passe vers une Edge Function non authentifiée.
