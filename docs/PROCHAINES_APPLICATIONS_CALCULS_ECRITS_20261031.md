# Prochaines intégrations de calculs écrits

Préparation du **31 octobre 2026**, après ouverture de Mélange. Elle ne lance pas l'intégration suivante et n'autorise aucun changement de son dépôt moteur.

Ordre demandé : **Multiplication à plusieurs chiffres**, puis un **nouveau Mélange avec soustraction, multiplication à un chiffre et addition de plusieurs nombres**. Lire d'abord le [guide général](GUIDE_INTEGRATION_APPLICATIONS_CONNECT.md).

## Multiplication à plusieurs chiffres : repérage déjà effectué

Le dépôt a été retrouvé dans la préparation du 29 octobre, puis relu en direct :

| Élément | Observation du 31 octobre |
| --- | --- |
| Dépôt | <https://github.com/Mr-Tat/Multiplication-multi> |
| HEAD relevé | `1b64a0b70632be8e831914437bd95b1d7d319dce` |
| Fichier étudié | `index.html`, 725 638 octets |
| SHA-256 | `fcf03012d465006cfa33f77372395430e55ab05e4957990e76e93057a3dc8ca8` |
| Identifiant moteur | `multiplication-plusieurs-chiffres` |
| Version affichée | V6.0.2 |
| Famille | `multiplication` |
| Classique | Séries 4/10/20, un seul meilleur record par niveau dans le cache natif |
| Écriture de fin | Fonction locale `setLastWork`, clé `multi2_last_work` ; aucun `window.__setLastWork` trouvé |
| Arithmétique | Produits calculés en `BigInt` et représentés par des chaînes |
| Méthodes repérées | Reports en haut ou sur le côté, option `tensFirst`, guide et tables |

Il s'agit d'un **repérage du code**, pas d'une recette navigateur ni d'un contrat XP approuvé. Re-vérifier le HEAD avant toute copie et annoncer les différences pertinentes.

### Difficultés natives observées

| Zone | Niveau | Taille nominale premier facteur × multiplicateur |
| --- | --- | --- |
| Normal | 1 | 3 chiffres × 2 chiffres |
| Normal | 2 | 5 chiffres × 2 chiffres |
| Normal | 3 | 4 chiffres × 3 chiffres |
| HARD | 1 | 5 chiffres × 3 chiffres |
| HARD | 2 | 7 chiffres × 3 chiffres |
| HARD | 3 | 7 chiffres × 4 chiffres |

Le générateur retire parfois un chiffre au premier facteur : commentaire/code observés, 15 % des tirages. Le multiplicateur garde sa longueur prévue. Ne pas « corriger » cette variation parce qu'un test attend toujours la taille nominale.

### Stockages à isoler

- `multi2_settings_v1`, `multi2_classic_v1`, `multi2_sudden_v1` ;
- `multi2_hard_sudden_v1`, `multi2_hard_aid_usage_v1`, `multi2_hard_three_v1` ;
- `multi2_last_work` et `mathas_progression_multiplication_multiples_v1` ;
- trophées, points, thèmes, aides et autres clés effectivement utilisées à inventorier aussi.

La nouvelle copie Connect aura son app_key, son répertoire et ses préfixes propres. Ne pas réutiliser `multiplication-ecrite-simple` ni `melange-calculs-ecrits`, et ne pas écraser les réglages de ces applications.

## Les trois pièges à traiter avant le barème

**Le record classique natif ne suffit pas.** `saveClassicBest()` utilise une clé de niveau et arbitre les records par taux, longueur puis aide. Un 4/4, un 10/10 et un 20/20 ne sont donc pas trois preuves indépendantes dans ce cache. Conserver côté Connect les meilleures preuves par niveau et longueur, puis tester **4 → 10 → 20** et **20 → 10 → 4**. La solution conceptuelle de Mélange est réutilisable, pas ses clés ni tout son modèle de sélection d'opérations.

**Le callback des autres jeux n'existe pas.** La fonction locale `setLastWork()` est appelée après l'enregistrement natif dans `finishClassic()` et `endSudden()`. Une affectation de `window.__setLastWork` ne l'interceptera pas. Auditer également la fin de mort subite HARD, instrumenter minimalement la copie, capturer les paramètres au départ et garantir une seule fin. Repérer les gardes de réentrée nécessaires ; ne pas attendre d'un simple changement de stockage qu'il fournisse le contrat complet.

**Le défi HARD 5 calculs ne doit pas être récompensé par habitude.** Des références historiques à `challenge` et `hardThree` existent, mais `startHard(spec,mode)` retourne immédiatement pour `mode==='challenge'`, et le menu lu propose entraînement/mort subite. Vérifier l'interface réelle ; ne pas inventer de jalons pour un mode neutralisé et ne pas le réactiver silencieusement.

## Les chiffres du multiplicateur : respecter le générateur réel

Au HEAD étudié, `selectedMultiplierDigits` est un ensemble de 2 à 9. Mais `generateMultiplierString()` autorise aussi :

- 1 parmi les premiers chiffres ;
- 0 et 1 dans les positions suivantes ;
- au moins un chiffre appartenant à la sélection 2..9 dans le multiplicateur généré.

Ainsi, avec seulement 2 sélectionné et deux chiffres, 12, 20, 21 ou 22 sont des exemples compatibles avec le code. La présence de 0 ou 1 n'est pas, à elle seule, un bug de filtrage.

Avant de brancher les réglages professeur, définir si la commande porte sur des **chiffres admissibles**, des **minimums de sélection**, une **liste exclusive** ou la présence d'un chiffre dans chaque exercice. Le comportement des jeux actuels « tables minimales » signifie que l'élève ne peut pas retirer les choix obligatoires mais peut en ajouter ; il ne garantit pas que chaque table apparaît dans chaque tirage.

Préserver le comportement natif tant qu'une modification pédagogique n'est pas demandée. Les réglages classe/élève de cette nouvelle application doivent rester indépendants de Multiplication simple et des deux Mélanges. Ne pas imposer un app_key existant simplement pour récupérer son panneau de tables.

## Validation arithmétique et saisie

L'unité de résultat à définir est la **multiplication complète**, pas chaque produit partiel ni l'addition finale comptés comme de nouveaux exercices. Déterminer précisément l'effet d'une erreur corrigée dans une ligne, un report ou la somme finale sur la première tentative admissible.

Tester le vrai clavier et le focus, notamment :

- deux, trois et quatre chiffres au multiplicateur ;
- produits partiels, décalage unités/dizaines/centaines et somme finale ;
- zéro interne ou final du multiplicateur, chiffre 1, lignes de produit nul ;
- retenues de multiplication et d'addition, avec ou sans retenue finale ;
- reports en haut et latéraux, `tensFirst` actif/inactif ;
- correction d'une erreur, effacement, retour de focus, validation automatique et manuelle ;
- guide, tables et aides : usage tracé selon la règle retenue ;
- affichage étroit, petits PC et longs nombres, sans masquage du champ actif.

Préserver `BigInt` et les chaînes existantes. Ne pas convertir par commodité tous les opérandes et résultats en `Number` ; la marge de précision doit être vérifiée pour les niveaux réellement supportés. Les scores, compteurs et révisions restent des entiers bornés distincts des nombres arithmétiques.

Adapter un solveur de test aux **cellules rendues**, produits partiels et reports. Le helper Mélange est une méthode utile, mais ses sélecteurs et sa structure à deux opérandes ne correspondent pas automatiquement à ce moteur. Un test qui remplit directement les réponses sans suivre le focus ne prouve pas l'utilisabilité.

## XP : décision à prendre pour ce jeu

N'appliquer automatiquement ni 474, ni 594, ni un ancien barème 500/750. Recenser les modes accessibles, choisir les acquis et faire approuver un barème chiffré. Le nouveau moteur n'est pas Mélange : il ne doit pas hériter d'une règle « nombre de familles d'opérations sélectionnées » sans raison.

Préciser le traitement d'une sélection restreinte de chiffres, des aides et du guide. Capturer au départ les options qui influencent les droits et les valider dans un contrat ; un champ `allTables=true` seul n'est pas une preuve d'activité terminée. Les compléments et arrondis éventuels doivent être définis par exemples.

Les entraînements et le mode Master des calculs écrits actuels sont exclus du crédit Mélange. Préserver les conventions décidées pour le nouveau jeu ; ne pas créditer un mode de démonstration ou un défi inaccessible pour atteindre un plafond souhaité.

## Nouveau Mélange avec addition de plusieurs nombres

Cette application doit être **indépendante du Mélange déjà ouvert**. Son moteur et son contrat ne sont pas encore audités ici. L'app_key définitif, le dépôt source et le barème restent à établir ; les 594 XP actuels ne sont pas une approbation automatique du prochain barème.

Les familles attendues sont : soustraction, multiplication à un chiffre, addition de plusieurs nombres. L'addition simple du Mélange actuel ne doit pas être conservée par inadvertance sous un nouveau titre.

Pour chaque famille, établir opérandes, méthode, difficulté, aides, premier essai et unité d'exercice. Une addition à trois ou quatre termes reste une activité complète : elle ne doit pas verser plusieurs récompenses simplement parce qu'elle contient plusieurs lignes.

Références utiles :

- [`apps/addition-plusieurs/`](../apps/addition-plusieurs/) : moteur et intégration déjà disponibles pour plusieurs termes ;
- [`apps/soustraction-simple/`](../apps/soustraction-simple/) : méthodes de compensation et d'emprunt direct ;
- [`apps/multiplication-simple/`](../apps/multiplication-simple/) : multiplication à un chiffre et réglages existants ;
- [`apps/calculs-melanges/`](../apps/calculs-melanges/) : sélection initiale, journal de familles, preuves et compléments.

Ces sources sont des références. Ne pas assembler leurs variables globales, clés et callbacks sans adaptation : mêmes noms de fonctions, structures de calcul et sémantiques de fin peuvent entrer en collision.

Si le propriétaire souhaite reprendre la règle 25/50/100, la définir explicitement pour les **trois nouvelles familles** et adapter le contrat serveur. Ne pas appliquer à nouveau la proposition abandonnée « au moins deux types réellement tirés ». Dans le Mélange actuel, trois familles sélectionnées donnent le taux complet même si le tirage est chanceux ; cela ne dispense pas d'une vraie partie terminée.

Le journal doit identifier sans ambiguïté la famille de chaque exercice. Ne pas faire passer une addition de plusieurs termes dans une preuve conçue exclusivement pour deux opérandes si les champs n'en décrivent plus correctement l'activité.

Les méthodes, nombres de termes, chiffres et tables doivent rester propres à la nouvelle application. Tester des séquences mixtes, les transitions de méthode et le passage d'un exercice à l'autre sans fuite de reports ou d'aide. Vérifier séparément chaque famille seule, chaque paire si disponible, puis les trois.

## Livrables attendus de la prochaine intégration

1. Audit source à HEAD figé, modes accessibles et adaptations tracées.
2. Contrat de résultat, règles XP chiffrées et exemples d'erreur/rejeu/reset.
3. Copie libre fonctionnelle, nouvel app_key et états isolés.
4. Sauvegarde atomique, idempotence, file bornée, époque de reset et identité réelle.
5. Réglages et résultats professeur propres à l'application, Monsieur T séparé.
6. Tests locaux significatifs puis recette dans le laboratoire déjà existant.
7. PR avec CI, installation/activation/ouverture distinctes et retour arrière non destructif.
8. Bilan indiquant ce qui est réellement testé, ce qui est rapporté et ce qui reste non exécuté.

Le meilleur raccourci consiste à réutiliser cette méthode et les protections communes, pas à copier les suppositions d'un moteur dans le suivant.
