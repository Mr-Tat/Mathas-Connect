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
- Code fusionné sur `main` : [PR #279](https://github.com/Mr-Tat/Mathas-Connect/pull/279) (pilote), [PR #280](https://github.com/Mr-Tat/Mathas-Connect/pull/280) (lancer/rejoindre depuis un guidé déjà ouvert). Dernier SHA fonctionnel `c0fa401c`.
- Code : PR #279 ; tests navigateur Chromium **13+ cas réussis** au SHA `55854831` (run [42813878262](https://github.com/Mr-Tat/Mathas-Connect/actions/runs/42813878262)). Tests d'intégration et de validation manuelle existants réussis. La suite globale comporte 4 échecs de référence hors périmètre (3 miniatures, guide Laboratoire), plus une assertion de test du pilote corrigée ensuite.
- SQL : migration `guided_multiplication_classroom_20261110` **appliquée** le 10/11/2026 sur le projet Connect ; RLS et grants service_role vérifiés, table vide.
- Edge : `connect-guided-multiplication` **déployée** (version 1 ACTIVE, vérification JWT active) ; aucun score ou profil élève modifié.
- GitHub Pages : **publication réussie le 10/11/2026** pour SHA `c0fa401c`, [workflow #42815242183](https://github.com/Mr-Tat/Mathas-Connect/actions/runs/42815242183).
- Tests navigateur Chromium : le pilote et le correctif #280 réussis, dont prof/élève, copie des opérations, pages, passage libre, entraînement et mode Élève au tableau ; recette authentifiée en classe **non encore exécutée**.
- Les quatre échecs récurrents du test de régression global concernent des miniatures et le guide de laboratoire hors de ce chantier ; ne pas les présenter comme des tests du guidé collectif.
- Recette fictive à faire : Monsieur T / Élève A ou B (classe TEST), questions identiques, saisies indépendantes, page suivante, passage libre, entraînement/rejoint, verrouillage tableau, petit écran, réseau intermittent.
- Ne modifier aucune visibilité de classe, aucun résultat de vrais élèves et aucune application autre que Multiplication simple.

## Incidents corrigés et raccourcis
- Au premier branchement, le contrôleur collectif était initialisé avant son drapeau de disponibilité : erreur d'accès anticipé à une variable et absence d'iframe. Corrigé en initialisant après le pont natif ; le module optionnel tombe désormais en panne sans bloquer le jeu.
- Les fixtures de test ne servaient pas les nouveaux modules : ajout explicite aux routes du serveur HTTP de Chromium.
- Le clavier natif utilise des champs `readonly` remplis par le pavé virtuel ; les essais Playwright ne doivent pas recourir à `locator.fill()` sur ces champs.
- Le besoin de pouvoir démarrer et rejoindre depuis le guidé ouvert a entraîné la PR #280, testée avec de vrais moteurs Chromium simulés.
- PR #282 (ergonomie demandée en classe) : bouton professeur aligné à droite du grand « Exercice guidé » ; bouton élève « Rejoindre la classe » dans le guidé individuel, visible même sans séance. La vérification de l'existence de la séance ne part **que sur son clic**. Une fois inscrit à la séance, une synchronisation légère suit les pages débloquées. Tests Chromium sur 320/390/1160 px et vérification qu'aucun appel collectif n'a lieu avant le clic. Déploiement Pages à confirmer séparément.

## Retour d'expérience à compléter
- Source de divergence : chaque navigateur tire aléatoirement ses propres opérations ; la séance doit porter les nombres déterminés côté serveur.
- Ne pas déclencher les clics natifs automatiques « Nouveaux calculs » pendant le guidé collectif.
- Contrôles professeur validés par Edge, pas simplement par le paramètre URL ou le verrou local de présentation.
