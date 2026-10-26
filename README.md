# Math’as Connect — Base de référence (26 octobre 2026)

Plateforme indépendante, légère, destinée aux élèves et aux professeurs.

## Référence actuelle

- HUB élèves : https://mr-tat.github.io/Mathas-Connect/hub.html\n- Espace professeur : https://mr-tat.github.io/Mathas-Connect/prof.html
- Première application pilote : https://mr-tat.github.io/CE-Addition-simple/
- GitHub Pages héberge les pages statiques ; Supabase **Connect** (projet `awmhpfofacaglewammxt`) gère identités, sauvegardes, progression et XP.
- **Ne jamais modifier l'ancien projet Math’as** `jftzuslpelgzbdrftszw` pour mettre en place Connect.

## Décision stable : aucun import historique vers Connect

- Chaque élève commence Connect au niveau global **1** avec **0 XP** et des records Connect vierges.
- Une nouvelle application est intégrée avec ses propres règles de déblocage et son propre barème XP ; les XP s'additionnent dans le HUB.
- Le **mode Classique** est local, indépendant de Supabase Connect. L'ancien jeu et le mode Classique du nouveau pilote Addition partagent les résultats locaux lorsque l'origine GitHub Pages et le navigateur sont identiques.
- En mode Connecté, les données de partie restent isolées des résultats classiques ; le serveur fait foi et les validations doivent réussir avant toute écriture cloud.
- Pas de conversion des anciens résultats en XP Connect. Les anciennes migrations SQL restent uniquement comme historique technique, leurs fonctions/tables actives d'import ont été supprimées.

## Contrat opérationnel

- Une ligne `connect_states` par (élève, application), avec `revision` et `reset_epoch`. Conflits et réinitialisations ne doivent pas écraser silencieusement une progression plus récente.
- Une requête par partie terminée, pas de requête par frappe ; file locale d'envoi bornée, contrôles d'identité/appareil/classe côté fonction serveur.
- Déblocages et records rechargés depuis le serveur. Jalons XP uniques dans `connect_xp_milestones`, crédits cumulés dans `connect_xp_credits` ; règle effective `connect_xp_sync_v2` / `connect_xp_read_v2`.
- Les XP déjà acquis sont conservés lorsque seuls les résultats sont effacés ; la remise à zéro n'efface pas automatiquement la progression.
- Sauvegarde chiffrée hebdomadaire vers le dépôt GitHub **privé** `Mathas-Connect-Sauvegardes`. Une sauvegarde déposée n'équivaut pas à un test complet de restauration.
- Tableau professeur : utiliser `teacher-overview` (résumé léger), garder `teacher-export` pour les sauvegardes explicites uniquement.
- Future projection : ne pas diffuser d'identités sensibles, limiter les requêtes et prévoir la lecture de résumés agrégés.

## Statut de validation

Code et base audités le 26 octobre 2026. Les scénarios SQL des XP ont été vérifiés dans des transactions annulées, y compris la conservation des jalons après remise à zéro des records. La recette réelle sur appareils élèves et la restauration d'une sauvegarde chiffrée restent à terminer avant usage généralisé.

## Documents d'archives

Les fichiers `docs/*` datés d'étapes précédentes sont **des archives historiques** : certaines hypothèses (import XP historique, anciens contrats ou version de pilote) sont annulées. Ce README fait foi pour le prochain développement.
