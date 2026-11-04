# Multiplication écrite simple — fiche de continuité du candidat 04/11/2026

**Statut : candidat partiel, NON OUVERT comme nouveau parcours scolaire certifié.**
La recette doit reprendre cette branche plutôt que reconstruire un LAB.

## Références et version source

- Dépôt cible : Mr-Tat/Mathas-Connect ; main à l'audit :
  5b14b139e11d3ed42150f3df9964bf7e7acf81f7 ; aucune PR ouverte.
- Branche : feat/multiplication-school-integration-20261104.
- Moteur original : Mr-Tat/Multiplication-simple, commit
  a38b4008c0bfa192d5d4ad82e01f8e3e9f2d8a2b.
- Archive ZIP reproductible, figée sur ce commit :
  https://github.com/Mr-Tat/Multiplication-simple/archive/a38b4008c0bfa192d5d4ad82e01f8e3e9f2d8a2b.zip
  (téléchargement et SHA-256 non vérifiés : ne pas annoncer de ZIP physiquement archivé).
- Moteur du lanceur Connect historique : apps/multiplication-simple/game-original.html
  (version V7.0.0) ; moteur du pilote Objectif record :
  apps/objective-record/engines/multiplication/index.html (version V6.0.2).
  Ces deux copies diffèrent : pas de remplacement silencieux.
- App key : multiplication-ecrite-simple.
- Miniature : assets/miniatures/multiplication-ecrite-simple.webp.
- Supabase LIVE : awmhpfofacaglewammxt ; lecture le 04/11 :
  connect-results Edge v46, connect-objective-record-school Edge v2,
  connect-projection-v2 Edge v6. Vérification JWT activée.
- Migration XP historique : multiplication_simple_xp_v1, 9 règles
  d'attribution, 158 XP par niveau et 474 XP possibles au premier
  parcours sur trois niveaux ; Classique 4/10/20, Mort subite 5/10,
  HARD 3/7. Ne pas assimiler 9 règles au total des récompenses.
- Audit du moteur V7.0.0 : 20 coupes visuelles (6 bronze, 6 argent,
  7 or et Platine après les 19), dont les conditions et la correspondance
  avec les drapeaux internes doivent encore être confrontées aux acquits
  officiellement délivrés.

## Audit de sécurité et de sortie

1. Le lanceur historique conserve les multiplicateurs, méthodes de report,
   aides, scores, sélection des niveaux, réglages et files de synchronisation.
   Il utilise toutefois des événements game-record fondés sur les résultats
   du navigateur, non une vérification indépendante des chiffres et reports.
2. Le nouvel hôte apps/objective-record/eleve.mjs et la fonction Supabase
   connect-objective-record-school n'admettent en classe que les deux
   additions. Aucun contrat de preuve multiplication n'a été déployé.
3. Le lanceur historique offrait la projection avant ACK et sans preuve
   mathématique. Cette offre a été retirée ; ne pas la réactiver lors
   de l'ACK legacy. Un score reçu par game-record n'est pas certifié
   au sens du contrat scolaire.
4. En LIVE, la carte multiplication reste masquée dans les cinq presets :
   2eco, observation, phase1, phase2 et phase2b.
5. Aucune migration, aucun reset, aucune modification des données élèves,
   récompenses, XP, catalogue ou droits classe.

## Modifications isolées sur la branche

- apps/multiplication-simple/school-ui.mjs ajoute le réglage « Dizaines
  d'abord » durant le calcul normal et HARD, synchronisé avec l'accueil,
  le commentaire pédagogique adapté aux reports supérieurs/latéraux et
  une indication ambre de la prochaine unité.
- Les badges « Reste N XP » lisent exclusivement les jalons de student-xp
  pour le jeu et le parcours actif. Aucun XP fictif ou panneau redondant.
  Le module n'écrit ni records, ni preuves, ni trophées.
- apps/multiplication-simple/index.html ne propose plus à la projection
  un événement non certifié ; le montage natif réapplique le style après
  reconstruction des boutons.
- tests/multiplication-school-ui.test.mjs contient les gardes de sécurité,
  scénarios de retenue et règles d'affichage des XP.

## Reste à réaliser avant la définition de « terminé »

- Émission serveur de multiplications compatibles avec le niveau,
  multiplicateurs autorisés, les deux types de report, colonne de tête,
  calculs HARD et vraies premières saisies.
- Évaluation mathématique indépendante et atomique des parties 4/10/20,
  3 vies, Mort subite et HARD, journal des preuves idempotent, XP, coupes
  permanentes, resetEpoch, Monsieur T et classement projection.
- Raccorder les vrais boutons scolaires, les 20 coupes dans leurs cases,
  records natifs cliquables et consentement Oui/Non APRÈS certification.
- Tests Node et vrais tests navigateur/clavier/mobile, SQL jetable, Edge,
  JWT avec profils fictifs, droits professeur, persistance et projection V2.
  Aucun test authentifié ou publication Pages de cette branche ne doit être
  présenté comme réussi sans résultat vérifié.
- Enfin seulement ouvrir les cartes des classes autorisées, fusionner
  le candidat certifié, vérifier le commit Pages réellement servi
  et documenter les versions SQL/Edge après publication.

## État vérifié de ce candidat

- SQL/Edge modifiés par ces commits : **aucun** ; versions LIVE inchangées.
- Visibilité scolaire des cinq presets : **masquée**.
- Nouvelle version du parcours scolaire certifié : **non publiée**.
- Données et scores des élèves : **non manipulés**.

**RETEX :** un ancien lanceur « connecté », des XP affichés et une fonction
game-record ne prouvent pas une multiplication. Ordre obligatoire :
épreuve serveur → premières réponses et reports vérifiés → ACK
transactionnel → choix explicite de l'élève → projection.
