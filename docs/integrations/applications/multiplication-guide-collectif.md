# Multiplication simple — guidé collectif (10/11/2026)

## Décisions pédagogiques validées
- Première étape : **multiplication simple seulement**, puis retour d’expérience avant les trois autres jeux.
- Même paire d'opérations par classe, réponses et corrections **individuelles**, sans synchroniser les chiffres du professeur.
- Seul le professeur lance/arrête la séance et ouvre de nouvelles pages ; les élèves ne peuvent passer qu'après l'ouverture et normalement après correction.
- Le professeur peut activer « passage libre » pour permettre de rejoindre la page ouverte sans terminer.
- « M'entraîner en attendant » utilise le guidé individuel, puis « Rejoindre la classe » rétablit les opérations partagées.
- Corrigés uniquement côté professeur, sous les opérations, plus bas dans la page, confirmation Oui/Non neutre. « Élève au tableau » masque/verrouille les commandes et corrigés, PIN local provisoire pour en sortir.
- XP : **SANS OBJET** ; trophées : **SANS OBJET** ; scores : **SANS OBJET** (aucun nouveau barème ni résultat scolaire).

## Architecture
- Moteur original inchangé ; pont natif injecté uniquement depuis l'hôte Connect, points d'insertion vérifiés ; les activités non guidées et le mode libre restent inchangés.
- Edge dédiée « connect-guided-multiplication » : authentification, inscription/permission, visibilité HUB, décisions professeur côté serveur. Les élèves n'ont qu'un accès à la lecture.
- Table RLS privée de séance : deux opérations par page, config, progression des pages et version ; aucune réponse, score, XP ou donnée de résultat élève.
- Poll léger et reprise après réseau absent.

## État et preuves à distinguer
- Branche : feat/mul-guided-collective-20261110.
- Code : PR #279 ; tests navigateur Chromium **13+ cas réussis** au SHA `55854831` (run [42813878262](https://github.com/Mr-Tat/Mathas-Connect/actions/runs/42813878262)). Tests d'intégration et de validation manuelle existants réussis. La suite globale comporte 4 échecs de référence hors périmètre (3 miniatures, guide Laboratoire), plus une assertion de test du pilote corrigée ensuite.
- SQL : migration `guided_multiplication_classroom_20261110` **appliquée** le 10/11/2026 sur le projet Connect ; RLS et grants service_role vérifiés, table vide.
- Edge : `connect-guided-multiplication` **déployée** (version 1 ACTIVE, vérification JWT active) ; aucun score ou profil élève modifié.
- GitHub Pages : en attente de fusion et de déploiement confirmé.
- Recette fictive à faire : Monsieur T / Élève A ou B (classe TEST), questions identiques, saisies indépendantes, page suivante, passage libre, entraînement/rejoint, verrouillage tableau, petit écran, réseau intermittent.
- Ne modifier aucune visibilité de classe, aucun résultat de vrais élèves et aucune application autre que Multiplication simple.

## Retour d'expérience à compléter
- Source de divergence : chaque navigateur tire aléatoirement ses propres opérations ; la séance doit porter les nombres déterminés côté serveur.
- Ne pas déclencher les clics natifs automatiques « Nouveaux calculs » pendant le guidé collectif.
- Contrôles professeur validés par Edge, pas simplement par le paramètre URL ou le verrou local de présentation.
