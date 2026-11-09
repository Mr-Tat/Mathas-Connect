# Math'as Connect — démarrage express pour une IA (09/11/2026)

> **POINT D'ENTRÉE OBLIGATOIRE — cible : environ deux minutes de lecture.** Ce fichier donne les règles de tous les jeux, sans prétendre résumer les détails SQL. Lire **ensuite l'en-tête** de [SUIVI_COURANT.md](SUIVI_COURANT.md) (état du travail), et **seulement les rubriques nécessaires** des documents complets. Ne pas charger toute la documentation par réflexe. Aucun ancien compte rendu n'est une preuve de l'état LIVE.

## Mission et méthode

- Dépôt : `Mr-Tat/Mathas-Connect`. Vérifier HEAD de `main`, PR ouvertes et fichiers réellement servis ; vérifier séparément Pages, Edge Supabase, migrations et droits. **GitHub fusionné ≠ jeu publié ≠ Edge déployée ≠ essai élève authentifié**.
- **Conserver le moteur pédagogique original** (source/commit/empreinte, niveaux, méthodes, calculs, contrôles). Ajouter une intégration Connect légère ; **un seul candidat final pour les élèves**, le HUB TEST / comptes fictifs servent à sa recette, pas à multiplier les prototypes.
- Déclarer **par jeu** : XP / trophées / scores / Mort subite–3 vies / projection / réglages professeur = oui ou **SANS OBJET**. Ne pas inventer de score, récompense, mode HARD ou XP.
- Ne jamais utiliser un élève réel ni exposer de données privées pour tester. Ne pas faire de reset global, d'ouverture de classe, de déploiement SQL/Edge ou de migration implicites. Les décisions pédagogiques priment sur un ancien barème.

## Contrat commun — ce qui doit être visible et fonctionner

| Partie | Minimum attendu |
| --- | --- |
| HUB | Vraie carte et miniature, `app_key` stable, classes autorisées, retour HUB ; permissions **serveur**, pas uniquement dans le catalogue. |
| Connexion | Session élève approuvée, pastille de connexion + **avatar + nom**, profil Monsieur T testé séparément, mode libre sans XP Connect. |
| Bandeau | Nom/version du jeu, niveau **global** Connect + barre XP, bouton **« XP à récupérer »**, accès retour et plein écran ; éviter doublons et gaspillage de hauteur. |
| Exercices | Modes/techniques/difficultés du moteur, déblocages exacts ; **« Reste N XP »** discret en bas à droite du bouton si serveur a confirmé N, jamais un faux zéro. |
| Trophées | Coupes réellement définies, restantes nettement assombries, acquises près des exercices et du score ; permanentes après reset des scores ; compteur = trophées **visuels uniques**. Trophée de maîtrise d'une section si pertinent et critères explicités. |
| Scores | **Facultatifs**. Si pertinents : score du jour, record personnel historique et historique/podium proches des trophées ; conserver le panneau de score natif. Points de classement **distincts des XP**. |
| Fin de partie | Valider la preuve, enregistrer le résultat/XP/trophées et obtenir ACK **avant** animations, navigation et proposition du score. Événement idempotent ; abandon/reprise ne doit pas bloquer un autre exercice. |
| Professeur | Résultats par élève/classe/app/mode, réglages et autorisations si utiles, reset de l'application seulement, sans effacer XP/trophées permanents. |
| Projection | Par classe et application ; « Score du jour » / « Meilleur score » si applicable ; **score certifié + amélioration admissible + consentement explicite Oui** ; reset du tableau distinct du record de l'élève. |
| Qualité | Clavier, téléphone/320 px, focus, animation maîtrisée, pas de panneaux qui se chevauchent, preuve de recette avec profils fictifs. |

## Objectif record — principes déjà tranchés

- **3 vies :** la troisième réponse complète fausse met fin à la partie ; **une seule vie** retirée par calcul faux ; une réponse incomplète n'enlève rien.
- **Mort subite :** la première réponse complète fausse met fin à la partie.
- Pour les **quatre calculs écrits confirmés**, à mêmes bonnes réponses, niveau et difficulté : **Mort subite = x2 les POINTS des 3 vies avant arrondi**, **pas +20 %**. Les séries normales 4/10/20 ont leurs coefficients de points spécifiques.
- **XP, système distinct :** 3 vies atteint **la moitié** du droit XP d'un palier ; Mort subite le **droit complet**, et seulement le complément si la moitié a été obtenue. Paliers actuels des quatre écrits : **5 et 10 réussites** en normal, **3 et 7** en HARD, **20 XP pleins / 10 XP demi-droits par palier**. Le total du groupe partagé normal est **40 XP**, pas 20+40.
- Les quatre calculs écrits demandent actuellement **au moins 80 % sur une série 10 ou 20 au même niveau** pour ouvrir Objectif record normal. L'application Mélange a **une autre formule de points** ; conserver le principe x2 **sans copier les coefficients**.
- **[DÉCISION PROF, 09/11] Les trophées de SCORE sont attribuables aussi en 3 vies**, si les points certifiés atteignent leur seuil (par ex. 200/400/600 dans les quatre écrits). **Seuls les trophées propres à Mort subite** exigent vraiment Mort subite. « Pas de trophée 3 vies » veut dire **pas de trophée spécifique à ce mode**.

## Travail entre conversations, vérifications et lecture à la demande

1. **Au début** : lire ce document puis l'**en-tête + la dernière entrée pertinente** de [SUIVI_COURANT.md](SUIVI_COURANT.md) ; vérifier `main`, PR et état live **avant** d'affirmer qu'une demande a été réalisée.
2. **Pendant** : une seule PR **par intégration** et un journal de décisions/commits/risques dans le suivi ; détailler preuves, SHA, tests et prochaine action, avec statuts `[LIVE]`, `[REPO]`, `[TEST LOCAL]`, `[NON VÉRIFIÉ]`, `[DÉCISION]`. Pas de faux « terminé ».
3. **À la passation** : actualiser le résumé en tête du suivi et une entrée compacte de continuation ; joindre PR + référence de code et [modèle de passation](TEMPLATE_PASSAGE_FLAMBEAU.md). Quand la tâche est terminée, **fusionner la PR de l'intégration**, conserver l'historique dans Git ; ne pas laisser une PR de journal ouverte à vie.
4. **À la livraison** : CI sur SHA exact, vrai test navigateur hébergé authentifié si applicable, Pages/Edge/SQL/autorisation des classes **vérifiés séparément**. Dire précisément les couches non testées.

## Références profondes — ne pas ouvrir toutes d'emblée

- [Contrat fonctionnel complet du 09/11 / PR #272](CONTRAT_FONCTIONNEL_COMMUN_APPLICATIONS_20261109.md) : UX, formules, exemples JS/SQL, Objectif record, XP, trophées, tableau prof, tests. **Lire les sections utiles seulement.**
- [Doctrine et incidents historiques du 04/11](DOCTRINE_EFFICACITE_ET_RETEX_20261104.md), [guide d'intégration](README.md), [contrat scores/XP/trophées](CONTRAT_COMMUN_SCORES_XP_TROPHEES.md) et [référence serveur](REFERENCE_TECHNIQUE.md), à consulter sur besoin ciblé.
- [Fiche nouvelle application](TEMPLATE_FICHE_APPLICATION.md), [passation](TEMPLATE_PASSAGE_FLAMBEAU.md), [tests et publication](RECETTE_ET_PUBLICATION.md).
- [Suivi hérité jusqu'au 07/11](SUIVI_DECISIONS_OUVERTES_20261107.md) : **archive de contexte**, non certificat de statut actuel.

**Si une règle précise manque ici, lire le contrat détaillé, puis vérifier le code et l'état serveur de l'application. Ne pas improviser.**
