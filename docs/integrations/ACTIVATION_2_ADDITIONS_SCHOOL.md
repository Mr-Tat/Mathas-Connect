# Activation indépendante des deux additions — procédures de dernière bascule

**NE PAS FUSIONNER CETTE PR AVANT LA RECETTE HÉBERGÉE AVEC LE PROFESSEUR.** La PR de prévisualisation #138 a déjà été fusionnée, et le nouveau serveur de preuves scolaires (Edge v1) et ses six migrations sont actifs. Les anciennes cartes du HUB restent en place.

## 1. Conditions bloquantes à vérifier

- Le professeur se connecte via son portail Math'as Connect habituel et ouvre l'URL de prévisualisation de chacune des deux additions avec `joueur=prof` et l'UUID d'une classe qu'il gère.
- Tester une série **4 calculs de niveau 1** au vrai clavier dans chaque jeu. Le message de fin doit afficher « Vérifié côté serveur » et le delta XP. Relire les XP après actualisation et les coupes permanentes si la série parfaite correspond à un jalon inédit. Ne pas utiliser le compte d'un véritable élève comme sujet de test.
- Vérifier le choix de consentement au tableau « Non, merci » / « Oui, envoyer ». L'événement n'est autorisé à apparaître qu'après un oui explicite. Le joueur personnel du professeur peut ne pas être inscrit comme élève dans la classe et donc ne pas apparaître au tableau : ce test ne prouve pas à lui seul la projection élève ; maintenir une recette spécifique avec profil fictif approuvé et inscrit avant de marquer `projectionVerified`.
- Consulter les résultats et le parcours du joueur professeur sans interférer avec ceux des élèves. Vérifier le retour au HUB, la classe, l'actualisation après reconnexion.
- **Modèle de sécurité** : une fois les deux cartes déplacées, les anciennes URLs legacy restent parfois accessibles. Une requête forgée `connect-results game-record` ne doit plus attribuer d'XP dans l'une des cinq classes scolaires pour les deux additions. Ne modifier ni Soustraction, Multiplication, Mélange ni la classe TEST.

## 2. Ordre des opérations — ne pas inverser

1. Conserver une copie SHA des Edge `connect-results` actuellement en production et du commit avant activation.
2. Déployer **en premier** le fichier `supabase/functions/connect-results/index.ts` de cette PR avec `verify_jwt=true`. Contrôler son statut ACTIVE et son contenu exact. L'ancienne voie native de score des deux additions sera alors refusée, mais les trois autres jeux continueront à fonctionner. Prévenir que les anciennes additions ne créditeront plus d'XP pendant cette très courte transition.
3. Confirmer que l'Edge scolaire dédié `connect-objective-record-school` reste ACTIVE, JWT vrai, et que les six RPC SQL privées restent `service_role` uniquement.
4. Fusionner cette PR (commutateur `SCHOOL_ADDITIONS_ROLLOUT` à quatre indicateurs tous vrais). Attendre le job de déploiement GitHub Pages **SUCCESS**, puis vérifier les deux cartes scolaires et les autres trois inchangées sur chaque préréglage.
5. Rejouer les deux additions depuis les **cartes du HUB**, avec un profil Connect approuvé et une classe autorisée. Vérifier lecture/écriture des résultats, classe, trophées, XP, et absence de `game-record` natif.
6. Contrôler qu'aucune donnée n'a été effacée et qu'il n'y a aucun double crédit en répétant un reçu.

## 3. Retour arrière si anomalie

- Revenir au commutateur `SCHOOL_ADDITIONS_ROLLOUT` **désactivé** et publier les pages, puis restaurer l'ancien Edge `connect-results` seulement si l'on souhaite redonner de l'XP aux anciens jeux. **Ne jamais réouvrir la voie score-natif alors que le HUB utilise l'interface certifiée**.
- Ne pas supprimer ni vider les six nouvelles fonctions/tables : les reçus XP déjà attribués doivent rester durables.
- L'Edge `connect-objective-record-test`, la classe TEST et les trois autres calculs écrits restent inchangés.

**Important** : les modes Mort subite, 3 vies et HARD du nouvel hôte restent jouables sans XP tant que les preuves et barèmes spécifiques n'ont pas été validés, même après la bascule des deux séries Classique. Ne jamais promettre les 474 XP totaux disponibles via cette seule tranche de livraison.

Suivi : ticket #125, PR #138 (prévisualisation), cette PR (activation).
