# Erreurs historiques : diagnostic rapide et prévention

**Usage :** rechercher un symptôme, exécuter la vérification indiquée, corriger le contrat le plus petit possible puis ajouter un test qui échouait avant. Ces incidents viennent des archives du 31/10/2026 et de la comparaison au dépôt. **Ne pas interpréter un ancien incident comme une panne encore présente.**

| Gravité / symptôme | Cause déjà rencontrée | Prévention et preuve exigée |
| --- | --- | --- |
| **P0** score sauvé, XP absents | Code Edge, RPC et barème/allowlist non synchronisés ; écriture état puis XP séparés | Un seul appel RPC atomique, test d'échec XP avec rollback état+reçu et matrice app_key lecture/écriture/professeur/XP |
| **P0** double crédit à la reconnexion | Événement refabriqué, ACK partiel ou déduplication courte | UUID durable, reçu serveur unique, ACK corrélé, doublon 0 même après reload |
| **P0** événements du mauvais élève | Même JWT/appareil réaffecté à une nouvelle fiche | Namespace `app + classe + sujet Auth + élève résolu`, garde `expectedStudentId` et test de réaffectation |
| **P0** ancien trophée ressuscité | Cache natif réhydraté après reset professeur | `resetEpoch` autoritaire et quarantaine de file ancienne, nettoyer caches dérivés de **cette seule app** |
| **P0** fausse publication « complète » | Tests simulés confondus avec navigateur Pages authentifié ; Pages ≠ Edge/SQL | Journal de preuves par couche, vraie session fictive approuvée, SHA/versions exactes |
| **P1** lanceur non connecté | Dépendance supposée à `window.MathasConnectHost` qui n'existait pas dans ce HUB | Réutiliser `connect-host.mjs` adapté ; tester Auth native et lancement réel |
| **P1** fin ou trophée manquant | Hook `lastWork` supposé identique, trophées mis à jour **après** la fin | Étudier la source et les chemins de fin ; hook minimal, snapshot **après** finalisation |
| **P1** file bloquée en cours d'envoi | Drainage ne re-lisait pas les nouvelles fins après ACK | Une requête active, relecture de file après chaque ACK, test réseau lent + deux fins |
| **P1** file saturée/perdue | 100 événements atteints, écrasement automatique | Bloquer explicitement la suite Connect, garder tout événement non acquitté |
| **P1** faux HARD débloqué | Présence d'un compteur à zéro assimilée à déblocage, ou mode challenge non lançable compté | Reprendre la **condition native de menu** et jouer réellement le mode ; ne pas rémunérer le dormant |
| **P1** meilleurs scores écrasés | Cache natif ne conserve qu'un record par niveau au lieu de 4/10/20 | État Connect distinct par parcours et longueur ; tester 4→10→20 **et** 20→10→4 |
| **P1** tables/méthodes mélangées | Paramètres d'un jeu copiés vers un autre | Configuration professeur propre à l'app ; sélectionner les conditions au début, jamais après tirage |
| **P1** erreurs de focus cachées | Tests injectant valeur directement dans un champ ; report latéral / emprunt à deux frappes | E2E saisie **au clavier**, niveaux/méthodes complets, GSM et petits PC |
| **P2** fausse régression CI | Assertion sur libellé ancien, ou API du test Chromium utilisée incorrectement | Comparer le test avec ancien `main`, distinguer test/infrastructure/produit ; revoir logs |
| **P2** record du jour décalé | Calcul jour UTC au lieu du calendrier local | Date/heure source serveur, jour civil `Europe/Brussels` à l'affichage |
| **P2** miniature provisoire | Image de remplacement non approuvée ou cache URL | Employer miniature fournie, WebP léger, vérifier URL HTTP Pages, réglages et lisibilité |
| **P2** XP confirmés mais animation absente | Confusion ACK/texte '+XP'/vol de jauge | Scénario manuel séparé ACK → delta → popup → mouvement → jauge |
| **P2** fausse disponibilité PostgreSQL local | Socket d'init Docker actif avant serveur final TCP | Vérifier `pg_isready -h 127.0.0.1` sur instance définitive |
| **P2** tests introuvables ou trop larges | Glob Node qui inclut désormais des tests HTTP live | Séparer suites locales **et** HTTP publics ; compter vrais tests et skips |

## Classification et méthode de réparation

- **P0** : risque données, autorisation, XP ou publication indue → arrêt et protection de l'existant ; aucune ouverture.
- **P1** : usage essentiel cassé → reproducteur minimal, patch isolé et regression dédiée.
- **P2** : interface, instrumentation ou assertion fragile → réparer sans dérégler le serveur.

Avant d'accuser le nouveau changement : reproduire sur l'ancien `main` quand possible. Quand une assertion teste un libellé au lieu d'un droit, la rendre structurelle. Si l'échec vient d'un service réseau inaccessible, ne pas le présenter comme un échec du contrat local. Ne jamais réduire une règle de sécurité ou effacer des données pour « faire passer » un test.

Pour approfondir : [référence](REFERENCE_TECHNIQUE.md), [recette](RECETTE_ET_PUBLICATION.md) et archives datées sous `docs/`.