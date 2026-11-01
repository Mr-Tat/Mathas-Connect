# Projection V2 — contrat fonctionnel et étapes (31 octobre 2026)

## Référence et avancement
Référence visuelle : `MATHAS_LAB_TABLEAU_PROJECTION_V1.9.10_DEMO.html` fournie dans la conversation. Une maquette actualisée, volontairement **isolée et fictive**, est livrée dans `projection-v2-demo.html`. Ne pas la confondre avec `projection.html` qui reste la projection actuelle et protégée.

## Classes
Cinq espaces distincts : Observation, Phase 1, Phase 2 A, Phase 2 B, 2 ECO. Le changement de classe ne doit pas réunir les résultats. Comparateurs latéraux à choix indépendants, pourcentage et scores par classe seulement. Chaque classe dispose de ses propres dates de début de classement et éventuellement de ses propres réglages.

## Classement et rotations
- **Un classement par application**, jamais de cumul entre applications. Score = **meilleur résultat en points du jeu**, sur la période de projection courante, et non XP Connect ou somme hebdomadaire.
- Afficher une seule application à la fois, rotation de **90 s** par défaut entre celles cochées *Score*. Flèches de navigation, pause pendant réglages. Ne pas confondre le passage entre deux jeux avec une remontée.
- Au plus 14 élèves par classe : 1 colonne pour 1 à 7, 2 colonnes jusqu'à 14 (7+7). Nom et score voisins, gras, nettement dominants ; niveau Connect et nombre global de trophées en secondaire ; aucune donnée inventée pour un élève sans partie.
- Les **nouveaux exploits** sont contextualisés à l'application actuelle ; **aucun palmarès permanent « Meilleures remontées »**. Les trophées restent permanents malgré les reprises de parcours. Une remontée remarquable peut être mentionnée **ponctuellement** parmi ces exploits, à condition de vérifier les règles strictes ci-dessous.

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


## Évolution du 31 octobre — défi interclasses, consentement explicite

- Classement central de l'application en cours : classe principale + classes **explicitement cochées en Score**, jamais les classes uniquement cochées en %. Plafond **16 meilleurs**, répartis **8+8** si le classement est plein (une ou plusieurs classes) ; classe seule jusqu’à 14 joueurs, 7+7 ; les autres scores sont hors écran, pas effacés. Les deux colonnes **s'étalent sur toute la hauteur utile d'un écran de projection** (par exemple 1366×768), avec des rangs de hauteur équilibrée, plutôt que d'accumuler 16 lignes compactes en haut. Badge de classe près de chaque joueur pour le défi.
- Suppression de « 14 élèves · 2 colonnes », « noms et scores mis en évidence », du score agrégé des autres classes à gauche et de la note du pied de classement. L'identité de la classe est déplacée en haut à droite.
- Rotation automatique : **30 secondes** ; le rafraîchissement réseau ne remet pas le chrono à zéro. Une seule application cochée ne tourne pas.
- Un score de partie n'apparaît pas simplement parce qu'il a été sauvegardé : après chaque fin de jeu Connect, l'élève dispose de **Oui, envoyer / Non, merci**. La réponse Non ne provoque aucun envoi de consentement et n'affecte pas les résultats, XP ou trophées. La réponse Oui produit un consentement lié à l'identifiant unique de partie, authentifié par le serveur ; conservation du consentement en file locale si hors ligne.
- Le service lit **uniquement les événements de score validés par l'enregistrement natif et dotés d'un consentement explicite**. L'autorisation est propre à l'élève, à la classe, à l'application et à la partie. Pour une comparaison, il vérifie les permissions professeur sur chaque classe.
- Une autorisation est un *choix d'exposition*, pas une écriture de points. L'envoi de points n'est jamais accepté par la fonction d'autorisation. La requête comporte seulement `eventId`, `classId`, `appKey`.
- Migration privée `20261031_projection_v2_explicit_score_consent.sql` : table RLS + jointure obligatoire sur les événements réels. Test PostgreSQL jetable `projection-consent-contract.sql`.
- Le calcul exhaustif des exercices **entamés** (hors Mort subite), ainsi que les notifications d'exploits réels, restent des chantiers séparés. Jusqu'à preuve, le % reste `—`. Le tableau historique `projection.html` demeure inchangé pendant la validation de V2.

**Recette avant substitution à la projection historique** : contrôle réseau réel avec une session élève approuvée et une session professeur autorisée, partie effectivement terminée et envoyée, refus → absence du résultat, accord → apparition du record, compte non consenti → aucune donnée nominative, vérification de deux classes croisées, pas de régression XP / trophées.

## Ajustement projection plein écran après défilement

- Le bandeau supérieur qui indique la classe reste **hors du plateau**. Il défile naturellement : après un petit défilement manuel du professeur, **le plateau central + les flèches et commandes en bas occupent exactement 100dvh**, la hauteur de l'écran du projecteur. Pas de masquage forcé de la classe ni de mode plein écran du navigateur imposé.
- Classement limité à **16 scores, huit par colonne** ; les cases se répartissent sur toute la hauteur résiduelle du plateau, et deviennent plus hautes. La classe seule à 14 élèves reste en **7+7**.
- « Autres classes » disparaît comme titre dans la petite carte de comparaisons, **les noms de classes restent visibles**. Le « Global » de chaque comparaison est compact (fond et cadre distinctifs, chiffre plus petit, **sans barre de progression**), les applications suivent en dessous. Le Global principal garde sa grande barre.
- « Application X / Y » et « Suivante dans Ns » sont déplacés **dans la bande inférieure, près des flèches de navigation**. L'ancienne bande intérieure sous les scores est supprimée, sa hauteur profite aux élèves.
- Les versions maquette fictive et tableau connecté doivent rester synchronisées ; test Chromium à 1366×768 après défilement, vérifiant la hauteur des rangs, l'absence de défilement interne du classement, les commandes, et l'absence de barre du Global comparatif.

## Ajustement pédagogique — éviter d'inciter aux défaites volontaires (01/11/2026)

**Décision : supprimer la carte de droite « 📈 Meilleures remontées »** dans la maquette fictive et la Projection V2 connectée. La colonne droite ne conserve qu'une grande carte **« ✨ Nouveaux exploits »**. Les remontées spectaculaires **d'au moins trois places** (strictement plus de deux) peuvent y apparaître **ponctuellement**, sans palmarès, podium, compteur, récompense supplémentaire ni trophée.

**Critères obligatoires avant affichage réel :**

1. Le changement de rang est causé par **une progression confirmée du meilleur score personnel** d'une partie réellement validée et consentie pour la projection. Aucune remontée sur simple performance inférieure suivie d'une hausse sans amélioration du record, et aucune remontée calculée à partir de scores non autorisés.
2. Comparer uniquement **la même application, la même période de classement (reset_epoch), le même ensemble de classes participantes et la même population éligible**, sur deux classements validés consécutifs. Un changement de participants, de choix interclasses, de rotation d'application, de consentement, de réinitialisation ou d'option de projection **invalide la comparaison**.
3. **Seuil : avant − après ≥ 3 places** ; pas de notification sur une simple entrée au classement, sur une baisse volontaire ou sur un faux saut dû au retrait d'autres élèves. Calcul et déduplication côté serveur sur événements authentifiés, autorisés et horodatés ; la V2 connectée **n'a pas encore ces données** et ne doit pas simuler la récompense.
4. Limiter la fréquence (par exemple **un seul exploit de progression par élève et par application sur une période pédagogique définie**, à fixer avant déploiement), éviter de répéter la même annonce ; aucune conséquence XP, points, trophée ou note scolaire.
5. La **maquette** peut présenter un cas explicitement fictif de 7e → 4e place et un meilleur score en hausse. La V2 **connectée** doit garder le message neutre « Pas encore de nouvel exploit confirmé » en attendant un vrai contrat de preuve.

**Autres biais à surveiller** : la compétition entre 16 meilleurs peut démotiver ceux qui restent hors écran ; la comparaison publique peut stigmatiser ; les scores peuvent favoriser le volume de jeu ou les aides/modes plus simples ; le pourcentage global peut devenir trompeur lorsque son dénominateur est faible ou incomplet ; les événements saillants monopolisent l'attention ; les élèves connectés plus souvent ou plus longtemps ont plus d'occasions d'apparaître. Prévoir consentement renouvelable, possibilité de masquer la projection, objectifs collectifs, encouragements non classants, transparence des règles et absence de chiffres inventés.

## Activation officielle de Projection V2 et quatre DA — 1er novembre 2026

- Les **cinq accès « Projection »** du portail professeur (Observation, Phase 1, Phase 2 A, Phase 2 B, 2 ECO) pointent désormais vers **`projection-v2.html?space=...`**, qui utilise `connect-context.js` pour le contexte de classe puis **l'authentification et l'autorisation professeur côté serveur** ; l'ancienne `projection.html` reste intacte et disponible en secours par URL directe. Le service sécurisé `connect-projection-v2` a été vérifié **ACTIVE** dans le projet Supabase lors de la préparation ; aucune fonction ni table Supabase modifiée par ce chantier.
- La V2 connectée réutilise exactement les **quatre directions artistiques validées** et leur CSS testé depuis `essais/projection-v2-da.css` : Néon auditorium, Papier clair, Ardoise scolaire et Studio compétition. Chaque thème conserve le **podium or/argent/bronze**, les **13 paliers du rang 4 au 16**, les typographies lisibles, la colonne gauche, **8+8 au centre** et les seuls « Nouveaux exploits » à droite. Le fichier `projection-v2-live.js` et les contrats de classements ne sont pas modifiés.
- En haut à droite, un **sélecteur « Thème »** est visible y compris avant le chargement des résultats. Choix appliqué immédiatement **sans navigation, aucun rechargement de scores ou appel serveur**. Préférence par navigateur dans `localStorage['mathas_projection_v2_theme']`, purement cosmétique, jamais envoyée à Supabase. Ordre de priorité : **`?theme=neon|papier|ardoise|studio`** si valide, sinon préférence locale valide, sinon Néon. En navigateur avec stockage refusé, le sélecteur reste fonctionnel pendant l'affichage.
- Le sélecteur est compatible clavier et affiche son focus. Sous certaines largeurs de vidéoprojecteur, le bandeau de classe passe sur une ligne centrée pour éviter qu'il soit masqué par les outils. **La hauteur et l'ordre de chaque rang, le classement, les exploitations et les consentements sont inchangés.**
- Tests requis : cinq liens de classes vers V2, préférence et paramètre URL, changement sans rechargement, stockage refusé, couleurs du podium, 13 dégradés, JS de classement inchangé, sécurité de la projection connectée, régression Chromium en 1366×768, conservation de l'ancienne projection.
