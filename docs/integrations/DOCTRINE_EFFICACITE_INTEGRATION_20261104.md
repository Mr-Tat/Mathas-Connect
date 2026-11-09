# Fiche express — intégrer une application dans Math’as Connect

## Archive du 04/11/2026 — ancienne fiche express

> **HISTORIQUE, remplacée comme point de départ obligatoire** par [00_DEMARRER_ICI.md](00_DEMARRER_ICI.md) et [SUIVI_COURANT.md](SUIVI_COURANT.md). Conserver les raccourcis techniques de ce fichier, mais ne pas appliquer ses instructions de lecture intégrale ou ses anciens chiffres sans vérifier l'état actuel.


**Actualisé le 4 novembre 2026.** Cette page est le **résumé de démarrage**. La seule source de référence complète est la [doctrine d’efficacité et son RETEX transversal](DOCTRINE_EFFICACITE_ET_RETEX_20261104.md). Les deux anciens rapports, leurs commits et leurs détails restent consultables dans Git ; ne pas maintenir deux doctrines parallèles.

## La règle qui prime

**Construire immédiatement la version finale destinée aux élèves, en un seul candidat et une seule trajectoire de publication.** Utiliser la classe fictive du Laboratoire uniquement lorsque la recette authentifiée est nécessaire ; elle vérifie **exactement ce candidat**, et ne justifie pas plusieurs prototypes. Respecter le moteur original, ses modes, ses pédagogies et ses conditions de succès. Sécurité et consentement restent impératifs.

## Les cinq capacités à déclarer AVANT le code

| Fonction | Quand elle existe | Quand elle n’existe pas |
| --- | --- | --- |
| **XP** | Barème propre au jeu, validé serveur ; petit « Reste N XP » au bas des boutons réellement éligibles ; 0 seulement s’il est confirmé ; gain animé après ACK | Marquer « SANS OBJET », ne pas simuler des crédits |
| **Trophées** | Décompte exact des **coupes réellement visibles**, restant à gagner **dans la case de l’exercice/mode** ; acquis permanents après reset et visibles dans HUB | Ne pas créer de coupes fictives |
| **Score** | Meilleur personnel/jour, records et historique natifs ; points distincts des XP ; envoi au projecteur seulement après preuve et « Oui » explicite | Aucun classement ou 0 fictif ; résultats pédagogiques et XP peuvent exister sans score |
| **Projection** | Classe et application isolées, scores autorisés, exploits prouvés ; rafraîchissement 20 s et rotation 30 s actuellement | SANS OBJET ou seulement les progrès pertinents, jamais une métrique inventée |
| **HUB et professeur** | Carte activable/masquable par classe, miniature correcte, session approuvée, sauvegarde, résultats professeur et Monsieur T selon droits | Décrire la fonction volontairement absente dans la fiche |

**Exemple concret :** les deux additions ont **20 coupes visuelles**, non les 25 indicateurs internes du moteur. « Reste N XP » n’est jamais un gain garanti lors de la prochaine partie ; il désigne le maximum encore accessible dans la configuration officielle. Le mode HARD n’apparaît qu’après son déblocage réel.

## Le chemin court : six lots, pas six prototypes

1. **État réel et accès :** relire `main`, PR concurrentes, source/commit du moteur, `app_key`, RPC/migrations/Edge existantes, capacités GitHub/Supabase. Ne jamais réclamer un token avant d’avoir vérifié les accès déjà disponibles.
2. **Contrat pédagogique :** audit des vraies fins/modes/aides et décisions XP/coupes/score/projection ; noter ce qui est **SANS OBJET**. Épingler le moteur d’origine, conserver ZIP et manifeste source ; modifier par adaptateur plutôt que réécrire un gros HTML.
3. **Un seul circuit complet :** depuis la **vraie carte élève** et une session fictive approuvée, jouer une activité → preuve → reçu/ACK serveur → XP éventuels et trophées → sauvegarde/retour HUB → professeur → projection si applicable.
4. **Tests ciblés :** contrat et sécurité, idempotence et reset, Chromium au vrai clavier, PC/GSM, 320 px, chevauchement XP/coupes, record natif préservé, droits d’affichage ; PostgreSQL jetable seulement si écritures sensibles.
5. **Livraison en couches :** SQL additif gardé **si nécessaire**, Edge version/JWT exact **si modifié**, puis Pages sur bon SHA et catalogues/classes. Ne jamais conclure que fusion GitHub = déploiement Edge ou visibilité des cartes.
6. **Clôture :** recette courte du candidat final avec profil fictif, puis ouverture scolaire dans les seules classes autorisées ; preuve écrite `main` + Pages + Edge/SQL + HUB. Corriger les P0/P1 sans multiplier LAB ; fermer PR et branches temporaires et prévoir retrait du seul jeu sans effacer les acquis.

## Six raccourcis issus des incidents

- **Badge XP doublé :** neutraliser la simulation LAB **avant** de créer l’interface Connect ; vérifier dans Chromium les nœuds texte et l’unique badge officiel, pas seulement la CSS.
- **HARD prématuré / trophées erronés :** vérifier les droits de jeu réellement actifs ; une valeur stockée à zéro n’est pas un déblocage, un indicateur n’est pas forcément une coupe.
- **Panneau de score disparut :** brancher consentement et lecture officielle **dans la carte native** ; ne pas la masquer au profit d’un deuxième panneau Connect.
- **Score / exploit absent en projection :** vérifier toute la chaîne source certifiée → Edge professeur → filtre `app_key` → consentement → rendu. Pas de classement d’un autre jeu ni d’exploit fabriqué.
- **CI échoue sur ancienne étiquette :** distinguer bug de produit, test obsolète et indisponibilité réseau avant de modifier l’application ; contrôler rendu et géométrie sur le vrai DOM exécuté.
- **« Prêt » mais invisible :** vérifier PR fusionnée, Pages réussie sur bon commit, Edge/SQL éventuels, catalogue et cache, et session élève réellement authentifiée ; rien ne doit rester en brouillon après une publication approuvée.

## Définition courte de « terminé »

**Terminé =** moteur pédagogique intact + capacités décidées + XP et coupes officiellement visibles si concernés + sauvegarde + HUB professeur + projection adaptée si concernée + tests pertinents réussis + `main` fusionné + Pages publié + Edge/SQL corrects + jeu visible dans les espaces prévus + recette fictive authentifiée attestée. À défaut, écrire exactement ce qui manque : `NON EXÉCUTÉ`, `EN ATTENTE` ou `SANS OBJET`.

Pour les scénarios détaillés, les causes des incidents, les risques et toutes les références : [**rapport complet**](DOCTRINE_EFFICACITE_ET_RETEX_20261104.md), [erreurs connues](RETEX_ERREURS.md), [contrat XP/scores/trophées](CONTRAT_COMMUN_SCORES_XP_TROPHEES.md), [fiche application](TEMPLATE_FICHE_APPLICATION.md) et [recette/publication](RECETTE_ET_PUBLICATION.md).

## Consigne courte à transmettre à la prochaine conversation

> Intègre [NOM DU JEU] **directement en version scolaire finale de Math’as Connect**. Lis la fiche express et la doctrine complète, vérifie HEAD et tes droits GitHub/Supabase. Protège le moteur natif. Déclare XP, trophées, score et projection comme **présents ou sans objet** ; affiche les vrais XP restant sur les boutons et les coupes à gagner dans les cases pertinentes. Relie identité, preuves serveur, sauvegarde, HUB, professeur/Monsieur T et projection selon besoin. Une seule branche/PR de livraison, une recette fictive du même candidat quand nécessaire ; fusionne, contrôle GitHub Pages et Edge/SQL séparément, puis ouvre uniquement les classes autorisées. Ne considère pas une PR verte comme une version élève déjà publiée.
