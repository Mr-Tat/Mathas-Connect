# Abaque des longueurs — fiche d’intégration — 2 novembre 2026

**[LIVE vérifié, GitHub] Démo publiée. [REPO vérifié] Version Connect candidate fermée ; pilote hébergé non exécuté.**

- Démo : https://mr-tat.github.io/Mathas-Connect/apps/abaque-longueurs/ ; publiée sur `main` à `6ac032c6482f30d402e37ca44665521ce85ae92c`, après accord explicite du professeur pour le push direct sans PR.
- [Déploiement Pages réussi](https://github.com/Mr-Tat/Mathas-Connect/actions/runs/41368284892), [CI Abaque réussie](https://github.com/Mr-Tat/Mathas-Connect/actions/runs/41367786603), [régression main réussie](https://github.com/Mr-Tat/Mathas-Connect/actions/runs/41368285430). Le GET direct Pages reste refusé par le proxy de cet environnement ; ce constat s’appuie sur le déploiement GitHub.
- Source autonome `Mr-Tat/abaque-m-1` : `7dc9dc00e87302d5aafa1c9d131e500a57419c1d`, dépôt inchangé. Copie `game-original.html` et 25 assets identiques, empreinte source dans `source-manifest.json`.
- Candidate : `feat/abaque-longueurs-connect`, depuis la démo publiée. Même `apps/abaque-longueurs/`, même `app_key` (`abaque-longueurs`), mode Connect optionnel. Voir [le lot de déploiement](ABAQUE_LONGUEURS_DEPLOIEMENT.md) et [le passage de relais](ABAQUE_LONGUEURS_PASSAGE_FLAMBEAU.md) pour preuves et statut.

## Moteur et décisions pédagogiques

**[REPO vérifié]** Construction : 4 unités + 8 images, seuil ≥10/12, deux réussites. Déplacements : deux pages de quatre, seuil ≥7/8, deux réussites. Conversions classiques : 4, 12, 20, puis Objectif record. Seuls les premiers essais déterminent les seuils ; aides natives autorisées, correction classique à 6 points. Master reste entraînement pour toute la partie, même après sortie. Une perfection obtenue après les deux cases de déblocage reste reconnue.

**[DÉCISION professeur, prompt final]** 160 XP : construction 8+6+6 ; déplacements 8+6+6 ; conversions 20, 18+10, 28+12 ; record 12+20 partagés avec les demi-droits 6+10 de 3 vies. Compléments uniques, répétitions à zéro ; aucun crédit pour Master, démo, abandon ou restauration. Trois trophées permanents : bronze 12/12, argent 8/8, or 4/4+12/12+20/20 à des moments éventuellement différents. Repères visuels en bas à droite des cartes ; aucun trophée en 3 vies, aucune médaille locale comptée comme trophée Connect.

**[REPO vérifié]** Points classiques : 100/324/580 sans aide. Mort subite : `30+5*floor(réussites/4)`, coefficients aides .8/.6 arrondis ; pas de deuxième bonus de 20 %. En 3 vies, base `round((30+5*floor(réussites/4))/1.2)` avant coefficients. Incomplet : aucune vie perdue ; erreur complète : zéro point, pas de correction ; fin à la troisième erreur. Records par mode + global + série consécutive Mort subite. Preuves des dix premières réussites puis segments bornés pour conserver les records longs sans plafonner arbitrairement les parties.

## Contrat Connect candidat

**[REPO vérifié]** Le mode par défaut reste la démo sans requête externe. `?connect=1&class=<UUID>` charge un bridge qui exige une identité approuvée et une classe explicitement ouverte par le serveur. Edge `connect-abaque` fermée par défaut ; mode pilote limité à la classe TEST et à une liste explicite de profils fictifs. La future activation scolaire utilise les données de classe, sans deuxième application.

Le serveur vérifie le JWT via Auth, l’appareil, l’inscription active ou les droits de Monsieur T, l’identité liée, le schéma de preuve, l’époque et la révision. Il recalcule réussite/points ; le client ne déclare ni XP ni trophée. Reçu durable, état, droits, XP et trophées sont atomiques ; les verrous empêchent les doubles crédits concurrents. Le résumé HUB conserve les anciennes applications.

Stockages démo `mathas_connect_abaque_demo_*`, Connect par classe/sujet Auth/élève/époque. File de 100 événements maximum et 100 archives de conflit, persistée avant envoi jusqu’à ACK exact. Après reset, anciens événements isolés ; après changement de session ou réaffectation, jeu bloqué. Les XP restants viennent uniquement d’une réponse approuvée en ligne ; les trophées Connect uniquement du serveur, sans import de la démo. Les résultats hors ligne attendent synchronisation.

Tableau professeur dédié, consentement avant lecture, permission de classe et actualisation manuelle. Reset limité à l’Abaque, archive du parcours et incrément d’époque ; droits consommés, XP historiques et trophées conservés. Le bouton de reset Master local n’efface aucune donnée serveur.

## Preuves et limites

**[CI locale, 02/11/2026]** 289 tests Node sans services ; 7 Chromium Abaque et 9 Chromium Projection/Soustraction ; 8 scénarios PostgreSQL réel et 3 scénarios Auth + Edge Deno + Chromium réels, exclusivement sur services jetables et profils fictifs. Tests d’installation fermée/historique, 160 XP, trois trophées, concurrence, échec tardif, révocation, identité réaffectée, reset, restauration sur second appareil, réponse perdue et hors ligne. Vérification des repères visuels en démo à 320/768/1024 px.

Les deux tests HTTP de production et l’ancien test Soustraction PostgreSQL avec son Chromium Playwright propre sont séparés : ce dernier a atteint ses contrôles serveur mais son navigateur reste bloqué par le téléchargement interdit du binaire. Les autres tests navigateur utilisent Chromium système. Aucun de ces tests ne prouve un pilote Supabase hébergé.

**[PROPOSÉ]** Installation SQL masquée/désactivée, fonctions Edge, Pages puis pilote fictif : accord précis et accès Supabase nécessaires. Aucune ouverture des HUB scolaires. Arrêt non destructif prévu dans le lot de déploiement.
