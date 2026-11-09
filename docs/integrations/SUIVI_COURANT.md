# Suivi courant inter-conversations — Math'as Connect

> **Nouvelle série de suivi ouverte le 09/11/2026, à partir de zéro pour les futures intégrations.** Ce suivi concerne le **travail réalisé à partir de cette date**, pas une remise à zéro des jeux, des résultats, des données ou de l'historique Git. Le document conserve les transmissions ; les PR techniques restent propres à chaque intégration. Lire la [synthèse express](00_DEMARRER_ICI.md) **avant** ce journal.

## A. Reprise ultra-rapide — mettre à jour à CHAQUE passation (max. 12 lignes)

- **Point de départ documentaire :** 09/11/2026 ; nouveau suivi initialisé. **Aucune nouvelle intégration enregistrée dans CE journal** à cette date (ceci ne signifie PAS qu'il n'existe aucune PR ouverte ni aucun chantier ancien).
- **Intégration en cours dans ce suivi :** À INITIALISER au prochain travail. `app_key` : — ; branche/PR : —.
- **Dernière décision importante :** Mort subite = x2 points 3 vies avant arrondi ; XP plein contre demi sur les mêmes jalons. Trophées **de score** accessibles depuis 3 vies ; coupes propres à Mort subite réservées à ce mode. Référence : [contrat complet](CONTRAT_FONCTIONNEL_COMMUN_APPLICATIONS_20261109.md).
- **État de publication/recette de la future intégration :** NON DÉMARRÉ dans ce suivi.
- **Prochaine action :** identifier la prochaine application ou le prochain correctif demandé ; vérifier GitHub `main`, PR ouvertes, Pages et Supabase pertinents **avant d'ouvrir une PR d'intégration**.
- **Blocage :** aucun identifié pour le démarrage documentaire ; l'absence de tests live ne vaut pas validation.
- **Dernière mise à jour du suivi :** 09/11/2026 — création du journal vierge.

**Nouveau chat :** lire l'en-tête seulement ; puis descendre directement à l'entrée active / la dernière passation pertinente. Éviter le chargement de toutes les entrées anciennes.

## B. Index des intégrations entreprises DEPUIS le 09/11/2026

| App / sujet | app_key | PR technique | État confirmé | Dernière passation |
| --- | --- | --- | --- | --- |
| Aucune encore inscrite dans ce **nouveau suivi** | — | — | À initialiser | — |

**Règle :** ne jamais convertir automatiquement « PR fusionnée » en « publiée », « testée sur un élève » ou « autorisée pour les classes ». Employer : `À FAIRE`, `EN COURS`, `PR FUSIONNÉE`, `PAGES VÉRIFIÉ`, `EDGE/SQL VÉRIFIÉ`, `RECETTE FICTIVE VÉRIFIÉE`, `OUVERT AUX CLASSES`, `SANS OBJET` ; chaque statut exige date et preuve. Conserver les réserves indépendantes.

## C. Passations détaillées — ajouter en ordre antéchronologique

_Aucune entrée pour l'instant : c'est le **nouveau départ du journal**, pas un effacement de l'historique existant._

Copier le mini-gabarit suivant à la fin de chaque session ou PR de code :

### [AAAA-MM-JJ] — [nom app / sujet] — [ÉTAT]

- **Objet/périmètre et décision pédagogique :** […]
- **app_key, moteur source et SHA, branche/PR :** […]
- **Fait réellement et preuve :** [… fichiers/commit, tests pass/fail/skip, SHA et environnement ; distinction [REPO] / [LIVE] / [TEST LOCAL] / [RECETTE HÉBERGÉE]]
- **XP/trophées/scores/enseignant/projection :** [… oui / non / SANS OBJET, attesté ou non]
- **Publication :** GitHub `main` […], Pages […], SQL […], Edge […], classes […]. Si non contrôlé, écrire **NON VÉRIFIÉ**.
- **Risques, tickets, PR concurrentes à éviter :** […]
- **Prochaine action exacte, test de réussite et éventuelle autorisation manquante :** […]
- **Lien vers fiche d'application, PR et tests détaillés :** […] (ne pas recopier de code ou de longs logs dans ce suivi).

## D. Historique antérieur CONSERVÉ, mais pas relu en entier par défaut

Les documents suivants restent des **références/archives** ; la remise à zéro concerne uniquement la série C ci-dessus :
- [Contrat fonctionnel complet du 09/11 (PR #272, fusionnée)](CONTRAT_FONCTIONNEL_COMMUN_APPLICATIONS_20261109.md) — référence permanente, avec les formules détaillées.
- [Décisions et contrôles ouverts constatés au 07/11](SUIVI_DECISIONS_OUVERTES_20261107.md) — **ne pas effacer ni considérer automatiquement clôturés** ; revalider chaque sujet lors de sa reprise.
- [Doctrine et retour d'expérience du 04/11](DOCTRINE_EFFICACITE_ET_RETEX_20261104.md) et [ancien résumé du 04/11](DOCTRINE_EFFICACITE_INTEGRATION_20261104.md).
- GitHub : l'historique des PR/commits, notamment [PR #272](https://github.com/Mr-Tat/Mathas-Connect/pull/272), conserve les changements et preuves. Un suivi n'a pas à redécrire chaque diff.
- **[REPO, 09/11] Des PR anciennes étaient encore ouvertes lors de la création** (par ex. #213 et #248–#251). **Ne pas interpréter le journal remis à zéro comme une autorisation de fermer, fusionner ou abandonner ces PR** : relire leur état courant et les conflits avant chaque nouvelle intégration.

## E. Protocole pour les prochaines IA — anti-contexte-gaspillé

1. Toujours lire `AGENTS.md`, [00_DEMARRER_ICI.md](00_DEMARRER_ICI.md), puis **la section A et la dernière entrée C pertinente**, pas tout le journal.
2. À la reprise, comparer **faits du journal** aux états réels de GitHub/Pages/Edge/SQL, sans ignorer les autres PR ouvertes.
3. Mettre à jour A/B/C **dans la PR propre à l'intégration** ou via une petite PR documentaire fusionnée ; **ne pas conserver une PR « suivi global » perpétuellement ouverte**, source de conflits et d'obsolescence.
4. Déposer les longues preuves/captures non sensibles dans la PR/fiches/tests de l'application ; dans C ne garder que les liens, résultats et décisions, afin que le contexte utile reste petit.
5. Si le suivi grandit, garder A à jour et **archiver les entrées C terminées par période** dans un fichier daté, en conservant les liens. Ne jamais écraser une décision encore ouverte.
6. Le professeur reste décisionnaire pour les barèmes et l'ouverture des classes ; aucune mission de documentation ne donne le droit de modifier des élèves ou de déployer du SQL/Edge.

**Note de sécurité :** aucun token, secret, nom d'élève ou export de résultats personnels dans GitHub, ce suivi, les PR ou la prochaine conversation.
