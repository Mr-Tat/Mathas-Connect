# Préparation des prochains calculs écrits — 29 octobre 2026

> **Document de préparation, pas une demande d'activation.** Les trois jeux actuels (Addition simple, Multiplication simple et Soustraction simple) ne doivent pas être retouchés ni réinitialisés pour intégrer les suivants. La Soustraction simple reste volontairement masquée jusqu'à la recette réelle.

## Moteurs autonomes réellement repérés (lecture GitHub)

| Ordre proposé | Dépôt existant | `MathasAppConfig.appId` | Source | Observations |
| --- | --- | --- | --- | --- |
| 1 | `Mr-Tat/addition-ecrite-multiple` | `addition-plusieurs` | `index.html` (~711 Ko de texte) | V6.0.2, mode Classique 4/10/20, Mort subite, HARD, `lastWork`, `hardThree`. Le pont de dernière partie `__setLastWork` est présent : base favorable pour réutiliser l'intégration Addition/Soustraction. |
| 2 | `Mr-Tat/Multiplication-multi` | `multiplication-plusieurs-chiffres` | `index.html` (~724 Ko) | V6.0.2, modes 4/10/20, Mort subite et HARD ; stockage `multi2_*`. Le pont `__setLastWork` n'est pas présent à l'identique : **vérifier comment la fin de partie écrit `lastWork` avant toute adaptation**. |
| 3 | `Mr-Tat/Melange-calculs-ecrits-1` | `melange-calculs` | `index.html` (~633 Ko) | V6.0.2, mélange addition/soustraction/multiplication, sélection `ops`, choix `subMethod`. Nécessite des règles XP propres et un examen anti-double récompense avant connexion. |

L'outil `Mr-Tat/Outil-calculs-ecrits` est un **outil pédagogique**, sans moteur normalisé `MathasAppConfig` ni modes de récompense comparables. Il doit être intégré comme outil **sans XP** si une intégration est décidée ; éviter de copier le schéma des jeux.

Ces informations proviennent de la lecture des moteurs **sans modifier** leurs dépôts.

## Espaces de stockage à préserver pour les futurs jeux

- **Addition de plusieurs nombres** : `addition2_classic_v1`, `addition2_sudden_v1`, `addition2_hard_sudden_v3`, `addition2_hard_three_v2`, `addition2_last_work`, `mathas_progression_addition_plusieurs_v1`.
- **Multiplication à plusieurs chiffres** : `multi2_classic_v1`, `multi2_sudden_v1`, `multi2_hard_sudden_v1`, `multi2_hard_three_v1`, `multi2_last_work`, `mathas_progression_multiplication_multiples_v1`.
- **Mélange** : `mixcalc_classic_v1`, `mixcalc_sudden_v1`, `mixcalc_hard_v1`, `mix_hard_three_v1`, `mixcalc_last_v1`, `mathas_progression_melange_de_calculs_v1`.

**Ne jamais utiliser les préfixes d'un autre jeu dans le nouveau lanceur**, ni fusionner les résultats de plusieurs `app_key`. Un `reset_epoch` et une reprise de parcours par application, aucun reset global implicite.

## Séquence technique minimale pour l'application n°1

1. Sauvegarder le commit source autonome choisi et relever son empreinte ; **ne pas modifier le dépôt d'origine** pour Connect.
2. Créer une copie locale isolée du moteur et un lanceur de mode libre, **hors HUB**. Réutiliser uniquement les mécaniques éprouvées du lanceur Addition/Soustraction : pont de fin de partie, fermeture de l'iframe, file d'envoi, affichage XP ; conserver les clés natives propres au nouveau moteur.
3. Simuler **tous** les événements réels : Classique 4/10/20 aux niveaux 1, 2 et 3 ; Mort subite ; HARD 5 calculs ; HARD Mort subite ; effets et trophées. La présence des mêmes boutons **ne suffit pas** à garantir la même sémantique de score.
4. Définir un nouvel `app_key` et un état serveur séparé. Le barème théorique **474 XP** ne peut être réutilisé **que** si les jalons réellement disponibles sont strictement compatibles ; sinon définir un maximum proportionné, sans XP gratuits ni doublons. Aucun crédit côté navigateur sans preuve validée par le serveur.
5. Préparer les changements Edge + migration Supabase en **branche**, avec nouvelle application **désactivée** et quatre HUB **invisibles** par défaut. Ne rien appliquer en production avant des tests isolés et une décision explicite d'activation.
6. Ajouter le tableau professeur et le catalogue, puis les tests : indépendance des applications et des résultats, `reset_epoch`, rejouabilité contrôlée, idempotence des XP, rollback d'une requête rejetée, rétention hors connexion, absence de doubles trophées, 320 px à PC école.
7. **Un jeu à la fois.** Faire valider le premier dans un profil d'essai, puis accélérer les suivants avec le même protocole. Ne pas publier tous les nouveaux jeux simultanément.

## Conditions non négociables

- Ne jamais migrer ni effacer les résultats déjà obtenus.
- Ne pas activer automatiquement Soustraction simple ou un nouveau jeu dans les quatre HUB.
- Ne jamais rejouer les migrations historiques Soustraction / XP déjà appliquées.
- Préférer les tests locaux / Chromium simulé / PostgreSQL isolé ; éviter d'émettre des XP ou sauvegardes réelles pour les tests.
- Protéger les petits PC et les quotas : un envoi par fin de partie, pas de suivi au clavier ni polling Supabase, animations UI sans calcul permanent.
- Les classements ou records individuels en projection exigent une décision pédagogique et des protections de confidentialité distinctes ; la projection collective actuelle reste anonyme.

## Blocages qui nécessiteront réellement le professeur

- Validation de Soustraction sur au moins un petit PC et un profil autorisé.
- Ordre pédagogique des prochains jeux si le professeur veut privilégier autre chose que **Addition de plusieurs nombres**, notre premier candidat technique.
- Recette finale de chaque jeu avant activation générale.

La préparation technique et les tests simulés peuvent continuer **sans attendre** ces décisions, à condition de conserver les futurs jeux masqués et désactivés.
