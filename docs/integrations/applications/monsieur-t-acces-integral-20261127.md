# Monsieur T — accès pédagogique intégral, 27/11/2026

Décision : ouverture de tous les modes et niveaux existants au profil professeur joueur authentifié, sans prérequis. XP, trophées, résultats et projection restent disponibles et uniquement issus des performances réelles. Ni Master mode ni records fabriqués. Aucune ouverture de catalogue/classe.

Abaque déjà conforme : teacherFree côté SQL/Edge/client. Milieu : correction des défis entiers/décimaux client + reward-contract Edge. Quatre calculs écrits : accès UI calculé à part de la vraie progression et exceptions sur les prérequis SQL pour le joueur professeur autorisé. Mélange : même capacité native et exception sur le recorder privé, Edge vérifie la classe. Les validations élèves existantes sont inchangées ; les lacunes préexistantes sur quelques niveaux Classique/HARD des RPC additions/soustraction sont un sujet de durcissement distinct. Tous les jeux libres restent inchangés. Tests de recette avec compte fictif requis.

## Vérifications

- SQL production sous transaction annulée : 60 ouvertures professeur (4 jeux × 5 modes × 3 niveaux), 24 refus élève sur Mort subite/3 vies, puis 4 défis HARD niveau 3 réellement corrigés à 10 bonnes réponses et 1 erreur : XP positifs, trophées permanents et points enregistrés, aucun crédit lors de l'ouverture seule. Mélange : reçu HARD et XP après journal réel simulé, élève bloqué. Capacité privée (anon/authenticated refusés), mauvais droit de classe refusé. ROLLBACK intégral.
- Les lignes des résultats du professeur sont affichées même si celui-ci a joué dans le désordre ; seules les vraies valeurs sont rendues, aucune réussite artificielle.
- CI générale précédente verte sur `9677a3d1` ; revalider sur SHA final. La recette navigateur réelle reste distincte.
