# Abaque des longueurs — parcours officiel exclusivement dans le HUB Toutes (07/11/2026)

## Décision professeur
Intégrer la **même application Abaque connectée** dans la rubrique standard **Outils** du HUB **Toutes**, comme les cartes élèves, **mais exclusivement dans ce HUB professeur/TEST**. La classe fictive reste `4bf3400d-a315-4ea4-a2f3-afaca24dc9b9`. **Ne jamais la publier dans les HUB scolaires**, les presets de classes, les autres sections de publication, ni le HUB TEST ordinaire.

## Changement de configuration hébergée ciblé
- `connect_hub_all_settings` : pour `abaque-longueurs`, `section='outil'`, `stage='published'`, `all_order=70` ; le statut `published` est ici **descriptif pour Toutes uniquement**, ce n'est pas une activation scolaire.
- `connect_lab_hub_visibility` : `visible=false` pour sortir la carte du HUB TEST ordinaire. Le panneau d'administration du Laboratoire (fonction `list`) reste accessible au professeur.
- `connect_apps.enabled=true` et `connect_abaque_classes` TEST inchangés ; **aucun INSERT** dans `connect_hub_preset_entries` ou dans une classe scolaire ; aucun droit XP ou succès modifié.
- Les URL publiques de démonstration restent accessibles, mais **l'accès Connect exige toujours un JWT, un appareil ou profil autorisé, et la classe TEST**.

## Parcours professeur/élève
- Dans Toutes connecté comme **Monsieur T**, l'Abaque reçoit `joueur=prof` et lit la session professeur, pas la session élève.
- Dans Toutes connecté comme un **élève fictif TEST**, aucune identité professeur n'est transmise : l'authentification élève native et l'appareil approuvé restent obligatoires.
- Le professeur peut autoriser un seul profil fictif sélectionné ou Monsieur T depuis **Toutes → Connexions de test → Accès Abaque**. Confirmation explicite et RPC `teacher-pilot-approve`. Aucune approbation automatique d'un appareil ou d'un élève réel.
- Les résultats restent persistés via `connect-abaque` (même application, XP 160 max et 6 trophées). Le résumé du profil vient de la RPC Abaque uniquement si la fonction est ouverte suivant le même garde-fou de projet `pilot`. Une valeur de secret `closed` garde toujours la priorité.

## Vérifications à conserver
1. CI du HUB Toutes en professeur/élève : classement Outils hors Tests, six clés uniques, lancement professeur avec `joueur=prof`, élève sans ce paramètre, consentement et absence de panneau d'approbation côté élève, téléphone.
2. CI de la fonction Connect et des calculs écrits inchangés ; ne pas redéployer une version Edge divergeant du code GitHub.
3. Contrôle SQL en lecture seule : carte visible dans Toutes Outils, invisible dans HUB TEST simple, aucune entrée scolaire ni classe scolaire Abaque autorisée.
4. Test **hébergé et authentifié** : vrai professeur → autorisation d'un profil fictif → connexion élève native → un exercice → reçu, XP, trophée, retour HUB, autre appareil. Tant que non réalisé, ne pas marquer « validation en conditions réelles terminée ».

## Retour arrière non destructif
Remettre `connect_hub_all_settings.section='test',stage='test'` et `connect_lab_hub_visibility.visible=true` pour la seule `abaque-longueurs`. Conserver les états, reçus, XP et trophées. La remise en état du code du HUB et de la politique de résumé se fait par une PR distincte ; **ne pas changer les quatre HUB scolaires**.
