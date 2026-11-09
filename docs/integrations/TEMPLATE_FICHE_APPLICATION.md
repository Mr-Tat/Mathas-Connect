# Fiche vivante d'application — [JEU] / [app_key]

> **Copier une fois** vers `docs/integrations/applications/<app-key>.md` puis tenir **cette même fiche** à jour entre conversations. Ne pas créer plusieurs comptes rendus parallèles. Lire au besoin la [synthèse](00_DEMARRER_ICI.md), la [procédure](README.md) et le [modèle historique détaillé](archives/TEMPLATE_FICHE_APPLICATION_DETAILLE_20261109.md).

**État :** AUDIT / ARBITRAGE / CODE / CI / PAGES / EDGE-SQL / RECETTE / OUVERT / EN ATTENTE · **Date de vérification :** …  
**Références :** `app_key` … · dépôt/moteur source + commit/empreinte … · `main` SHA … · branche/PR … · classes visées … · source des décisions …

## 1. Audit de l'application (faits, pas suppositions)

- **Objectif pédagogique** et unité de réussite : …
- **Modes/méthodes/niveaux, aides, verrous, fin de partie, abandon/reprise** : …
- **Capacités possibles** XP / trophées / score / projection / réglages : applicables, absentes ou à décider ; **pas de droits fictifs**.
- **État des accès et du serveur** : code REPO vérifié … ; SQL/Edge LIVE vérifié … ; Pages … ; PR concurrentes … ; **NON VÉRIFIÉ** pour le reste.

## 2. Verrou professeur — brainstorming AVANT les récompenses

**L'IA propose** avec exemples chiffrés, comparaisons et alternatives ; le professeur **décide séparément**. `[PROPOSÉ]` ≠ `[APPROUVÉ]`. Même un barème connu d'une autre app doit être discuté.

| Sujet | Proposition IA | Décision explicite du professeur + date / source | Statut |
| --- | --- | --- | --- |
| **XP** : exercices, seuils, paliers, plafonds, compléments, rejouabilité | … | … | EN ATTENTE / APPROUVÉ / SANS OBJET |
| **Trophées** : `trophy_key`, coupes, nombre visible, critères, persistance | … | … | EN ATTENTE / APPROUVÉ / SANS OBJET |
| **Scores** : pertinence, formule, coefficients, records/compatibilité/projection | … | … | EN ATTENTE / APPROUVÉ / SANS OBJET |

**Interdiction :** ne pas coder ou déployer les nouvelles règles XP/trophées/scores dont le statut n'est pas **APPROUVÉ** ou **SANS OBJET explicitement validé**. Les tâches techniques indépendantes peuvent avancer.

## 3. Contrat retenu, technique et tests

- **Règles approuvées** : liens/barème versionné ; exemples de cas limites et résultat attendu (premier gain, répétition, erreurs, reset) … ; `SANS OBJET` si absent.
- **Connect** : `app_key`, identité/session, limites serveur, preuve de fin + UUID/ACK et restauration, état/trophées permanents … .
- **Parcours** : HUB → jeu → score/XP/coupes → professeur → projection volontaire si existante ; interface et petits écrans … .
- **Tests** : contrat logique … ; Auth/Edge/SQL … ; Chromium vrai moteur … ; isolement autres apps … ; **recette Pages authentifiée fictive** … . Pour chaque case : OK/ÉCHEC/NON EXÉCUTÉ/SANS OBJET, date, run et SHA.

## 4. Livraison et prochaine conversation

- **PR et commit** … ; **`main`** … ; **Pages servi** … ; **Edge/version et JWT** … ; **SQL/migration** … ; **catalogue et classes réellement ouverts** … . Distinguer **NON VÉRIFIÉ** de **SANS OBJET**.
- **Incidents / leçons** : symptôme … → cause vérifiée … → solution … → test/PR … → **raccourci pour le prochain jeu** … ; lien au [RETEX](RETEX_OPERATIONNEL.md) si récurrent dans plusieurs apps.
- **Prochaine action exacte / blocage / autorisation nécessaire** : …
- **Passation** : 3–8 lignes de conclusion, avec liens, tests et statut ; mettre **une seule ligne** dans [l'index actif](SUIVI_COURANT.md). Ne pas recopier ce fichier en entier dans la conversation suivante.

**Sécurité :** aucun secret, nom d'élève réel, export privé, reset global ou activation non autorisée.
