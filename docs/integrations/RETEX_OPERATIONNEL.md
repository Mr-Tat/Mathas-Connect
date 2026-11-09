# RETEX opérationnel — problèmes, solutions, raccourcis et tendances

> **Bibliothèque transversale réutilisable, à lire PAR RUBRIQUE selon le besoin, jamais intégralement au démarrage.** Les entrées historiques ci-dessous sont des pistes documentées, **pas des preuves que le code LIVE est encore défectueux**. Les faits nouveaux doivent citer fiche de jeu, PR, commit, date et test. Voir [erreurs détaillées](RETEX_ERREURS.md) et [doctrine/RETEX du 04/11](DOCTRINE_EFFICACITE_ET_RETEX_20261104.md).

## 1. État d'esprit efficace : six habitudes à préserver

1. **Un seul candidat scolaire final**, testé sur le parcours réel avec profil fictif ; éviter les versions LAB jetables.
2. **Regarder la vraie cause avant de réparer le visuel** : moteur → adaptateur Connect → serveur → HUB ; inspecter DOM exécuté et reçus, pas seulement la CSS ou le code statique.
3. **Réutiliser le contrat validé**, sans recopier aveuglément barèmes et restrictions pédagogiques d'autres jeux ; brainstorm XP/trophées/scores **avec le professeur** avant leur code.
4. **Tester le chemin complet une fois d'abord** : carte → session approuvée → activité → ACK → progression → professeur → projection éventuelle ; puis les cas limites ciblés.
5. **Écrire ce qui est prouvé** : REPO, TEST LOCAL, LIVE, RECETTE HÉBERGÉE, NON VÉRIFIÉ ; Pages, SQL, Edge et catalogues ne sont pas interchangeables.
6. **Capitaliser sans alourdir** : dans la fiche de l'app, noter symptôme → cause → réparation → test/PR ; ici ne promouvoir que le savoir **réutilisable**, avec références.

## 2. Raccourcis de diagnostic issus des anciens RETEX

| Symptôme à reconnaître | Premier contrôle utile / solution à vérifier | Référence historique |
| --- | --- | --- |
| Double badge XP, XP fictifs persistants | Désactiver la simulation LAB dès l'entrée Connect ; inspecter le **DOM exécuté** et vérifier l'unicité du badge officiel | [RETEX UI additions](RETEX_ADDITIONS_UI_20261103.md) |
| HARD affiché mais inutilisable | Tester la **condition de déblocage native du menu** : une donnée à zéro n'est pas une autorisation | [RETEX erreurs](RETEX_ERREURS.md) |
| Score natif/panneau de records disparu | Brancher le consentement et la lecture Connect **dans l'interface native** au lieu de la masquer et de créer un second panneau | [Doctrine du 04/11, §4](DOCTRINE_EFFICACITE_ET_RETEX_20261104.md#4-retour-dexpérience--symptômes-cause-correction-et-raccourci) |
| Partie finie mais score/XP/trophée absent | Tracer fin native → preuve → reçu serveur → ACK ; **enregistrer avant animations, redirections et menus**, snapshot des coupes après finalisation | [RETEX erreurs](RETEX_ERREURS.md) |
| Reconnexion donnant un doublon, ancien exercice bloquant | UUID durable, reçu idempotent, gestion claire du resetEpoch, abandon sans réutiliser un événement terminé | [RETEX erreurs](RETEX_ERREURS.md), [contrat technique](REFERENCE_TECHNIQUE.md) |
| Une PR fusionnée mais une app toujours invisible | Vérifier **dans cet ordre** : SHA de `main` → Pages servi → Edge/SQL si modifiés → catalogue classe et cache → session fictive réellement approuvée | [Recette/publication](RECETTE_ET_PUBLICATION.md) |
| Score au projecteur absent malgré un record | Vérifier événement certifié → serveur professeur → filtre classe+`app_key` → consentement Oui → affichage, sans scores d'autres jeux | [Doctrine du 04/11, §4](DOCTRINE_EFFICACITE_ET_RETEX_20261104.md#4-retour-dexpérience--symptômes-cause-correction-et-raccourci) |
| CI miniatures échoue après changement d'images | Vérifier le WebP **approuvé** avant d'actualiser tailles et empreintes des tests ; ne pas masquer une régression | [Suivi historique du 07/11](SUIVI_DECISIONS_OUVERTES_20261107.md) |

**Règle :** ce tableau est un index pour réduire l'enquête, pas un automatisme de correction. Vérifier d'abord si le symptôme et la cause correspondent réellement.

## 3. Faire ressortir les tendances, sans statistiques inventées

**À CHAQUE clôture d'incident**, examiner la fiche de l'application et les cas déjà référencés ici : regrouper uniquement les incidents ayant **une cause commune vérifiée**, et distinguer une panne de code, une panne de publication, une erreur de procédure ou une décision pédagogique non prise.

- **Signal émergent** : même catégorie de défaut constatée **au moins 2 fois dans 2 applications différentes** (ou un incident P0 répété après correctif). L'afficher ici avec références et avertissement **CAUSE À CONFIRMER** si les diagnostics divergent.
- **Tendance confirmée** : **au moins 3 occurrences vérifiables dans au moins 2 applications**, avec mécanisme causal commun documenté ; une réapparition P0 avec cause identique peut justifier l'alerte avant ce seuil. Afficher fréquence, impact, causes, correction reproductible, **raccourci validé**, test anti-régression conseillé et dernière date.
- **Bonne pratique récurrente** : lorsqu'un raccourci a **réellement été utilisé avec succès dans 2 intégrations distinctes**, le promouvoir dans « méthode efficace », avec les limites de réutilisation. Ne pas transformer une intuition en standard.
- **Pas de compteur infini** : compter les **10 dernières intégrations closes** en priorité, compléter par les cas historiques si pertinents, séparer événements et applications (une même panne répétée cinq fois dans une seule app ≠ cinq apps).
- **Action** : une tendance confirmée et encore risquée doit apparaître **en une seule ligne** dans le [suivi actif](SUIVI_COURANT.md) ; une fois maîtrisée, rester ici avec lien et contrôle préventif. **Ne pas modifier automatiquement les autres jeux**.

### Tableau des tendances (à remplir par des preuves, pas des impressions)

| Famille / tendance | Statut | Cas (apps / occurrences) | Cause commune et preuves | Raccourci / prévention / prochaine vérification |
| --- | --- | --- | --- | --- |
| Fin de partie / ACK avant animations | **À SURVEILLER** — historique, non quantifié | À compter depuis les fiches/PR | [RETEX erreurs](RETEX_ERREURS.md) ; [suivi 07/11](SUIVI_DECISIONS_OUVERTES_20261107.md) | Vérifier persistance serveur **avant** tout écran de félicitations |
| Interface Connect / doublons de badges | **À SURVEILLER** — historique, non quantifié | À compter | [RETEX additions](RETEX_ADDITIONS_UI_20261103.md) | Regarder le DOM réel, éteindre l'UI XP du LAB |
| Publication/recette déclarée trop tôt | **À SURVEILLER** — historique, non quantifié | À compter | [RETEX erreurs](RETEX_ERREURS.md) | Distinguer SHA PR / Pages / Edge SQL / droits classes / session fictive |

Aucun de ces sujets n'est déclaré **tendance statistiquement confirmée** par ce document seul : ils sont des **candidats historiques** à confronter aux prochaines intégrations.

### Modèle d'une leçon à ajouter

`[DATE] — [TITRE] — [ÉMERGENTE / CONFIRMÉE / RÉSOLUE]`  
**Symptôme :** … · **Cause prouvée :** … · **Apps/cas distincts :** … · **Sources (PR/commit/test) :** …  
**Solution et raccourci reproductibles :** … · **Limite ou condition d'usage :** … · **Test préventif :** … · **Dernière vérification :** …

**Entretien :** chaque fiche de nouvelle app renvoie ici si elle a rencontré un motif connu ; le suivi global n'affiche **que** les tendances actionnables, pas toutes les anecdotes.
