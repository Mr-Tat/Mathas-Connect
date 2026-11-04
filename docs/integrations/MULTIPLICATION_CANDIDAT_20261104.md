# Multiplication écrite simple — fiche de continuité du candidat 04/11/2026

## Mise à jour après la PR #190 — 04/11/2026

**[GITHUB/CI/PAGES vérifiés]** La correction de reprise des preuves certifiées
est fusionnée via [PR #190](https://github.com/Mr-Tat/Mathas-Connect/pull/190)
dans `main` au commit `67c1c797048870edd0129364d75c3e77c4038f36`.
[GitHub Pages](https://github.com/Mr-Tat/Mathas-Connect/actions/runs/41837025937)
et [la suite de régression générale](https://github.com/Mr-Tat/Mathas-Connect/actions/runs/41837026838)
ont réussi sur **ce SHA exact**. Les tests spécifiques de la PR sont verts :
[Chromium vrai lanceur](https://github.com/Mr-Tat/Mathas-Connect/actions/runs/41836867081),
[contrats d'intégration](https://github.com/Mr-Tat/Mathas-Connect/actions/runs/41836867056)
et [suite générale](https://github.com/Mr-Tat/Mathas-Connect/actions/runs/41836867003).

**[CORRECTION LIVRÉE]** Une série Connect interrompue conserve dorénavant
le défi complet émis par le serveur (session, questions, réponses, paramètres,
révision/époque). Après rechargement, le joueur peut continuer ou renvoyer
**le même reçu d'épreuve** si le réseau a échoué à la fin. Le serveur reste
autoritaire pour la note, la déduplication, les XP, les trophées et les droits ;
aucune preuve ne peut être certifiée depuis les seules valeurs locales.
Une vieille preuve incompatible est conservée jusqu'à expiration ou abandon
**explicite** par l'élève, plutôt qu'écrasée par un nouveau défi.

**[CI renforcée]** Le workflow Chromium du parcours certifié doit aussi être
déclenché par les changements du lanceur, du moteur natif, des indicateurs
XP/coupes et du consentement, et pas uniquement par l'adaptateur de preuve.

**[LIMITE ACTUELLE]** La **recette sur le vrai site Pages avec un JWT réellement
approuvé de l'un des trois profils fictifs TEST reste NON EXÉCUTÉE**.
Une CI avec endpoints simulés n'est pas un test Auth + Edge + PostgreSQL
hébergé. Ne pas ouvrir les cinq HUB réels avant ce contrôle ; ne pas utiliser
les données d'élèves réels. La présentation du tableau de projection est
un chantier indépendant et ne doit pas être modifiée ici.

---

## État courant vérifié après les PR #182, #184 et #186 — 04/11/2026

**[REPO + GITHUB ACTIONS vérifiés]** La multiplication écrite scolaire est intégrée
dans `main` au commit `ca6c482d06b97e2ee7b29221733c195ca43bfc8a`, et le workflow **pages build and deployment**
de ce SHA a réussi : [run Pages](https://github.com/Mr-Tat/Mathas-Connect/actions/runs/41835202832).
Le moteur V7.0.0 et ses règles pédagogiques restent inchangés.
La PR #182 teste le vrai lanceur avec Auth/Edge simulés ; la PR #184 répare
la file de consentements successifs ; la PR #186 corrige la superposition
qui empêchait de cliquer sur « Oui » ou « Non » après une série certifiée.
Son test Chromium exécute les quatre calculs et vérifie absence d'envoi,
refus, acceptation unique et absence de doublon à la reconnexion :
[CI navigateur réussie](https://github.com/Mr-Tat/Mathas-Connect/actions/runs/41834963236).
La [régression générale sur le commit de publication](https://github.com/Mr-Tat/Mathas-Connect/actions/runs/41835203292) est verte.

**[LIVE vérifié, lecture seule]** Sur Supabase Math'as Connect
`awmhpfofacaglewammxt`, l'Edge `connect-multiplication-school` est
**v3, ACTIVE, verify_jwt=true** ; ses fichiers `index.ts` et
`school-visibility.mjs` sont identiques à ceux de la version dépôt examinée.
`connect-results` est **v47** et `connect-projection-v2` **v6**.
Les six RPC de certification multiplication existent ; seuls les rôles
serveur peuvent les exécuter, pas les rôles web `anon` et
`authenticated`. Aucune migration ni Edge n'a été redéployée pour
les PR #182, #184, #186.

**[LIVE vérifié, lecture seule]** L'application est activée au catalogue
`connect_apps` ; sa case du HUB laboratoire TEST est visible, avec
**3 profils fictifs actifs et 3 appareils approuvés**. Elle reste
**masquée dans les cinq presets scolaires**
(`observation`, `phase1`, `phase2`, `phase2b`, `2eco`).
Les réglages du tableau de projection et les données d'élèves n'ont pas été modifiés.

**[NON EXÉCUTÉ] La recette réellement authentifiée sur GitHub Pages**
avec l'un de ces profils fictifs TEST n'a pas été attestée.
Les tests Chromium avec Supabase simulé **ne constituent pas** une
preuve d'un JWT hébergé ni du parcours réel navigateur → Edge → SQL.
Avant l'ouverture scolaire : jouer une série certifiée en session
TEST effectivement approuvée, constater XP/trophées/records après
rechargement, valider le partage Oui/Non et le flux professeur/Monsieur T,
puis vérifier la projection de multiplication sans toucher à sa mise en page.
Aucune classe réelle ne doit être ouverte sur la seule base des CI.

**Historique ci-dessous :** les sections de 12 h et celles du candidat
initial restent conservées à titre de traçabilité ; les indications
« publication non encore réalisée » qui y figurent sont supplantées par
la présente section. L'absence de recette Pages authentifiée reste actuelle.

---

## État de livraison actualisé — 04/11/2026, 12 h (Europe/Brussels)

**[REPO vérifié]** Ce document a commencé comme un audit pré-implémentation.
Les constats et listes de « reste à réaliser » situés plus bas sont un
**historique du candidat initial**, pas le statut des commits ultérieurs.

**[LIVE vérifié]** Supabase `awmhpfofacaglewammxt` a désormais :
- `connect-multiplication-school` **v2**, JWT obligatoire ;
- `connect-results` **v47**, qui refuse les scores natifs non certifiés de
  multiplication dans les classes scolaires ;
- les six RPC de multiplication **réellement présentes** avec droits SQL limités
  à `postgres` et `service_role` ;
- les quatre migrations de certification des modes scolaires ;
- la correction déployée **`mul_optional_carries_native_v1_20261104`**
  (version Supabase `20261104120710`) qui aligne les reports facultatifs
  CLASSIQUE / 3 vies / Mort subite / HARD sur le moteur V7.0.0.

**[CI vérifiée]** SHA `da39dae4171b7b8d378f4ed50c057ed63f46da10` :
- PostgreSQL 16 jetable : 9 variantes classiques, 4 étendues, erreurs de
  reports écrits, reports vides corrects, refus de mauvais élèves, ACL et
  idempotence des XP — succès ;
- suite multiplication 29/29, suite générale 461 réussis, 0 échec,
  1 ignoré ; Chromium certifié 2/2, sans Auth hébergée.
- Le test SQL est dans
  `tests/postgres/multiplication-school-optional-carries.test.sql` et le
  workflow `multiplication-school-postgres.yml`.

**[REPO vérifié]** Le parcours connecté comporte dorénavant :
- épreuves serveur 4/10/20, Mort subite, 3 vies, HARD avec chiffres et reports
  vérifiés, accusé de réception atomique, trophées, XP idempotents et
  déblocages serveur ;
- interrupteur « Dizaines d’abord » **durant** la partie certifiée,
  sans vider la grille ; animation de gain uniquement après un reçu nouveau ;
- indices de coupes et XP officiels placés sur les boutons du moteur d'origine ;
- un pont sécurisé de conservation de résultats personnels et
  de restauration serveur, en préservant le jeu libre V7.0.0.

**[LIVE vérifié]** La multiplication reste **masquée dans les cinq presets**,
et ces tests n'ont manipulé aucune donnée d'élève réel. La classe TEST a
trois profils fictifs approuvés utilisables pour une recette JWT.

**[À valider avant ouverture scolaire]** La nouvelle version statique doit
encore être publiée depuis `main` et vérifiée sur Pages, puis parcourue dans
un navigateur **réellement authentifié** avec un élève fictif TEST.
Le clic de la carte « Top du jour » et le contrôle de preuve propre à
Multiplication dans la projection V2 ne sont **pas équivalents** aux tests
Chromium avec serveur simulé : ils demandent un test/durcissement spécifique
avant l'ouverture. Ne pas toucher à la mise en page du tableau pendant cette
intégration.

---


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
