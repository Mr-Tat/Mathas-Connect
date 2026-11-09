# Passage de flambeau — [APP / SUJET] — [DATE]

> **Nouvelle règle de passation depuis le 09/11/2026 :** lire [la synthèse express](00_DEMARRER_ICI.md), puis la section A et la dernière entrée utile du [suivi courant inter-conversations](SUIVI_COURANT.md). Le [contrat complet](CONTRAT_FONCTIONNEL_COMMUN_APPLICATIONS_20261109.md) et la [doctrine/RETEX](DOCTRINE_EFFICACITE_ET_RETEX_20261104.md) se lisent par section au besoin. Reprendre **le candidat final pour les élèves**, pas reconstruire un pilote LAB.

Ce modèle contient les détails **propres à une intégration** ; inscrire son résumé (3 à 8 lignes + lien) dans `SUIVI_COURANT.md`. Ne pas charger systématiquement toutes les anciennes passations. Ne pas transmettre tokens, exports d'élèves ou dumps personnels.

## Références immuables

- **Guide :** [docs/integrations/README.md](README.md) — relire d'abord `AGENTS.md`.
- **Dépôt et branche de travail :** `Mr-Tat/Mathas-Connect` / […].
- **MAIN SHA constaté :** […] à [date] ; **HEAD branche :** […] ; **PR :** […] ; **autres branches concurrentes :** […].
- **Moteur source :** repo/commit/SHA-256 […] ; **app_key :** […] ; **versions contrat, état, barème :** […].
- **Migrations :** fichier + SHA-256 + statut réellement constaté […] ; **Edge :** source + version live + `verify_jwt` réellement observé […] ; **Pages :** commit réellement servi […].
- **Capacités agent :** Git lecture/écriture/PR/fusion […], Supabase lecture/écriture/Edge […], tests locaux […], navigateur **authentifié Pages** […]. Vérifier à nouveau les accès avant de demander des identifiants.

## Validation pédagogique à transmettre (obligatoire pour une nouvelle intégration)

**Brainstorm avec le professeur effectué ?** OUI / NON ; **Date et preuve de l'échange :** […].
**XP proposés / validés :** […] / EN ATTENTE / SANS OBJET.
**Trophées proposés / validés :** […] / EN ATTENTE / SANS OBJET.
**Scores proposés / validés :** […] / EN ATTENTE / SANS OBJET.
**Blocage :** tant que ces décisions ne sont pas explicites, aucune logique nouvelle de barème, trophée ou classement à coder/déployer ; poursuivre au besoin l'audit ou les tâches indépendantes.

## Faits, décisions, incertitudes — ne pas mélanger

| Sujet | Statut de preuve | Source/date | Conclusion |
| --- | --- | --- | --- |
| Mode et score natifs | REPO / NAVIGATEUR local | | |
| XP et compléments | DÉCISION professeur / SQL | | |
| Publication | GitHub / Supabase LIVE / Pages | | |
| Parcours, reçus, reset | CI locale / LAB authentifié | | |
| Réglages professeur et sécurité | tests / LIVE | | |
| Points non vérifiés | NON EXÉCUTÉ | | |

## Capacités et état de livraison élève

**XP / badges « Reste N XP » sur les boutons :** […] / SANS OBJET ; **trophées dans les cases d’exercice :** […] / SANS OBJET ; **score personnel :** […] / SANS OBJET ; **projection + consentement :** […] / SANS OBJET ; **HUB/professeur/Monsieur T :** […] ; **candidat final :** […] ; **vraie publication élève :** OK / ÉCHEC / NON EXÉCUTÉ. Aucun test LAB supplémentaire ne doit être créé sans besoin explicite.

## Déjà réalisé

[Commits exacts, fichiers modifiés, tests lancés (pass/skip/fail), vrai résultat, décisions, problèmes résolus. Ne pas recopier des commandes anciennes comme des ordres.]

## Prochaine action précise

**But :** […]  
**Préconditions :** […]  
**Exécution permise :** […]  
**Ce qu'il est interdit de faire :** pas d'élèves réels, pas de reset global ni migration/activation hors autorisation.  
**Tests/critère de succès :** […]  
**Plan d'arrêt non destructif :** […]  
**Question réellement bloquante pour le professeur (le cas échéant) :** […].

## Journal concis à laisser à la prochaine conversation

[3 à 8 points max : preuve, changement, résultat, manque. Les détails restent dans la PR et la fiche de l'app.]
