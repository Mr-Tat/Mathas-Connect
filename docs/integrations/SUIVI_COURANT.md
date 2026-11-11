# Suivi courant — index léger des intégrations

> **Suivi démarré le 09/11/2026, nouvelle série uniquement.** Aucun historique effacé, aucune application remise à zéro. Pour démarrer : [synthèse](00_DEMARRER_ICI.md) → résumé ci-dessous → **ligne de l'app concernée** → sa fiche. Ne jamais charger toutes les fiches à la suite.

## Reprise en 30 secondes

- **Travail documentaire initialisé le 09/11/2026.** Aucune nouvelle intégration enregistrée dans cet index à sa création ; cela **ne signifie pas** absence de PR anciennes ou de chantiers antérieurs.
- **Chantier actif :** projection du jour des quatre calculs écrits : [PR #277](https://github.com/Mr-Tat/Mathas-Connect/pull/277) fusionnée, SQL et GitHub Pages publiés le 10/11/2026. **Recette hébergée avec profil fictif approuvé non exécutée** ; voir la fiche.
- **Verrou pédagogique :** XP, trophées et scores d'une **nouvelle** app nécessitent chacun une proposition de l'IA et **l'accord explicite du professeur avant codage** ; état de décision dans la fiche.
- **Signal transversal à traiter :** aucun nouveau signal classé à la création ; voir [les tendances et raccourcis](RETEX_OPERATIONNEL.md) si incident similaire.
- **Chantiers hérités** : cinq PR anciennes **toujours ouvertes et non fusionnées lors de la vérification GitHub du 10/11/2026** ; voir le bref inventaire plus bas. L'ancien [suivi du 07/11](SUIVI_DECISIONS_OUVERTES_20261107.md) reste à revalider, sans présumer ses tâches terminées.
- **Dernière consolidation** : 10/11/2026 — chantier #277 fusionné (`0572059a`) ; SQL live `20261110110523` et déploiement Pages [réussi](https://github.com/Mr-Tat/Mathas-Connect/actions/runs/42804980643). Recette de bout en bout sur profil fictif hébergé encore non exécutée ; cinq PR héritées inchangées.

## Applications en cours depuis cette nouvelle série

| Application / `app_key` | Étape | XP / coupes / scores approuvés ? | PR et prochaine action | Fiche |
| --- | --- | --- | --- | --- |
| Projection Score du jour — quatre calculs écrits | `main` + SQL + Pages publiés 10/11 ; recette TEST à faire | Barèmes inchangés ; consentement quotidien validé | [PR #277](https://github.com/Mr-Tat/Mathas-Connect/pull/277) fusionnée ; prochaine action : recette sur profil fictif | [Fiche](applications/projection-score-du-jour-calculs-ecrits.md) |

| Multiplication simple — Guidé collectif | Pilote SQL/Edge/Pages opérationnel ; #294 sauvegarde F5 publiée ; #295 optimisation sur clic CI/Pages à confirmer | XP, trophées, scores : SANS OBJET | [#295](https://github.com/Mr-Tat/Mathas-Connect/pull/295) : élèves = Suivant/Rejoindre seuls déclencheurs réseau, rendu événementiel, sauvegardes groupées ; présence professeur 25 s inchangée. Recette réelle Monsieur T + Élève A reste à faire. [Passation 3 autres jeux](applications/PASSATION_GUIDE_COLLECTIF_AUTRES_CALCULS_20261110.md) | [Fiche](applications/multiplication-guide-collectif.md) |

**Étapes distinctes** : `AUDIT` → `ARBITRAGE PROF` → `CODE` → `CI` → `PAGES` → `EDGE/SQL` → `RECETTE FICTIVE` → `OUVERTURE AUTORISÉE`. N'afficher une étape comme franchie qu'avec **date + preuve** ; `SANS OBJET` si le jeu n'a pas cette capacité. Une fusion GitHub ne certifie pas le reste.

## Chantiers hérités — PR ouvertes constatées sur GitHub le 10/11/2026

> **Inventaire de continuité, pas un nouvel état de livraison.** Ces PR précèdent ce suivi et ne comptent pas comme « nouvelles intégrations ». Le statut ci-dessous vient de GitHub au 10/11/2026 ; **le recontrôler au moment de reprendre**. Une PR ouverte peut contenir un travail devenu obsolète ou repris ailleurs sur `main`. **Ne pas la fusionner, la fermer, ni rejouer sa migration sans audit du diff actuel et autorisation pertinente.**

| PR héritée et objet | Branche (HEAD observé) | État vérifié | Action à la reprise |
| --- | --- | --- | --- |
| [#213 — Soustraction scolaire finale](https://github.com/Mr-Tat/Mathas-Connect/pull/213) | `work/soustraction-finale-eleve-20261104` (`0f540bc2`) | Ouverte, non fusionnée | Examiner portée, chevauchement avec `main`, tests et état SQL/Edge ; ne pas redéployer implicitement |
| [#248 — Fermeture proposition projection Oui/Non](https://github.com/Mr-Tat/Mathas-Connect/pull/248) | `fix/projection-consent-one-click-20261106` (`47365b35`) | Ouverte, non fusionnée | Comparer le comportement et le correctif aux changements plus récents |
| [#249 — Avatars des quatre calculs écrits](https://github.com/Mr-Tat/Mathas-Connect/pull/249) | `feat/avatars-four-written-calculations-20261106` (`bd46dea7`) | Ouverte, non fusionnée | Comparer les quatre interfaces à `main` ; vérifier si déjà repris ailleurs |
| [#250 — Points du jour Soustraction](https://github.com/Mr-Tat/Mathas-Connect/pull/250) | `fix/subtraction-today-points-restoration-20261106` (`28c626b2`) | Ouverte, non fusionnée | Contrôler persistance du jour, tests et éventuels correctifs ultérieurs |
| [#251 — Meilleur score du jour Additions](https://github.com/Mr-Tat/Mathas-Connect/pull/251) | `fix/addition-daily-score-reopen-20261106` (`853ce262`) | Ouverte, non fusionnée | Contrôler les deux additions et la reconnexion avant toute reprise |

**Méthode de reprise :** partir de la PR/branche **et de `main` actuels**, comparer les commits, vérifier que le problème existe encore, puis créer/compléter **une fiche propre au sujet réellement repris**, sur la branche appropriée. Consigner dans l'index une seule ligne si le sujet devient actif. Les preuves d'anciennes PR ne prouvent pas un déploiement LIVE en 2026-11-10.

## Entretien (pas de journal infini)

- **À chaque nouvelle conversation :** consulter aussi **les PR ouvertes et leur branche** : une fiche en cours peut n'exister que sur cette branche et non sur `main`. Mettre à jour **la ligne du jeu** quand elle est accessible via la PR appropriée, pas raconter tout le fil. Les détails (commits, tests, erreurs, solutions, décisions datées et prochaine action) restent dans sa [fiche](applications/README.md).
- **À la livraison** : déplacer la ligne vers le registre de fiches terminées dans [applications/README.md](applications/README.md), garder dans cet index **les seuls sujets encore actifs ou en attente**.
- **À la rencontre d'un incident** : consigner d'abord dans la fiche. S'il se répète sur plusieurs applications, analyser le **motif commun**, le promouvoir dans [RETEX_OPERATIONNEL.md](RETEX_OPERATIONNEL.md) avec références et nombre de cas ; n'afficher ici qu'**une alerte courte si une action globale est nécessaire**.
- Le [contrat complet](CONTRAT_FONCTIONNEL_COMMUN_APPLICATIONS_20261109.md), la [doctrine historique](DOCTRINE_EFFICACITE_ET_RETEX_20261104.md) et le [suivi hérité](SUIVI_DECISIONS_OUVERTES_20261107.md) restent conservés. Ne pas supposer clos un point historique sans nouvelle preuve.
